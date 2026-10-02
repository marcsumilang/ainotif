export interface ClassificationResult {
  classification: "TRANSACTION" | "SCAM_PHISHING" | "IGNORED_OTP" | "OTHER";
  isScamOrPhishing: boolean;
  riskScore: number;
  scamReason: string | null;
  scamIndicators: string[];
  transaction: {
    amount: number;
    currency: string;
    merchant: string;
    category: string;
    type: "DEBIT" | "CREDIT" | "TRANSFER";
  } | null;
  droppedOtp?: boolean;
}

// Local OTP Regex patterns (drops verification codes on-device before cloud processing)
const OTP_REGEXES = [
  /\b(?:verification|one-time|otp|2fa|security|passcode|secret)\s*code(?:\s*is)?[:\s]+([0-9]{4,8})\b/i,
  /\b(?:use|enter)\s*code[:\s]+([0-9]{4,8})\b/i,
  /\b([0-9]{4,8})\s+is\s+your\s+(?:verification|security|login|access)\s+code\b/i,
  /\bdo\s+not\s+share\s+this\s+code\b/i,
  /\bnever\s+share\s+your\s+(?:password|pin|code|otp)\b/i,
];

export function isSensitiveOtp(text: string): boolean {
  return OTP_REGEXES.some((rx) => rx.test(text));
}

// Phishing & Scam Heuristics
const PHISHING_SIGNALS = [
  { pattern: /\b(suspended|frozen|locked|compromised|unauthorized|deactivated|restricted)\b/i, label: "Account Freeze / Suspension Threat" },
  { pattern: /\b(immediately|urgent|within\s+\d+\s*(?:hours|mins|minutes)|final\s+notice|warrant)\b/i, label: "Artificial High Urgency" },
  { pattern: /(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com|t\.co|is\.gd|cutt\.ly|rb\.gy|goo\.gl|tiny\.cc)[^\s]*/i, label: "Shortened Unverified URL" },
  { pattern: /\b(click\s+here|tap\s+to\s+verify|verify\s+now|claim\s+refund|reset\s+password)\b/i, label: "Credential Harvesting Lure" },
  { pattern: /\b(irs|fbi|usps|fedex|dhl|apple\s+security|paypal\s+security|amazon\s+fraud)\b/i, label: "Brand / Authority Impersonation" },
];

export async function classifyNotification(payload: {
  text: string;
  title?: string;
  packageName?: string;
  timestamp?: number;
}): Promise<ClassificationResult> {
  const fullText = `${payload.title ? payload.title + " " : ""}${payload.text}`.trim();

  // 1. Strict Privacy Rule: Instant OTP Drop
  if (isSensitiveOtp(fullText)) {
    return {
      classification: "IGNORED_OTP",
      isScamOrPhishing: false,
      riskScore: 0,
      scamReason: "Sensitive OTP or 2FA verification code dropped on-device",
      scamIndicators: ["Sensitive OTP / 2FA Code dropped before cloud sync"],
      transaction: null,
      droppedOtp: true,
    };
  }

  // 2. OpenRouter AI call if key is present
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey && apiKey.startsWith("sk-or-v1-")) {
    try {
      const model = process.env.OPENROUTER_MODEL || "openrouter/free";
      const prompt = `You are a financial and cybersecurity classifier. Analyze this mobile notification:
"${fullText}"
Source App Package: "${payload.packageName || "unknown"}"

Determine:
1. Is it a financial transaction, a phishing/scam lure, an OTP to ignore, or other?
2. If scam, give riskScore (0-100), scamReason, and scamIndicators list.
3. If financial transaction, extract amount (number), currency (e.g. USD, EUR, GBP, PHP), merchant (string), category (Food & Dining, Groceries, Shopping, Transport & Travel, Entertainment, Bills & Utilities, Health & Fitness, Transfers, Income, or General), and type (DEBIT, CREDIT, or TRANSFER).

Return JSON only with this schema:
{
  "classification": "TRANSACTION" | "SCAM_PHISHING" | "IGNORED_OTP" | "OTHER",
  "isScamOrPhishing": boolean,
  "riskScore": number,
  "scamReason": string | null,
  "scamIndicators": string[],
  "transaction": {
    "amount": number,
    "currency": string,
    "merchant": string,
    "category": string,
    "type": "DEBIT" | "CREDIT" | "TRANSFER"
  } | null
}`;

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ainotif.app",
          "X-Title": "AiNotif Web",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          let parsed: any;
          try {
            parsed = JSON.parse(content);
          } catch {
            const m = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (m && m[1]) {
              try {
                parsed = JSON.parse(m[1].trim());
              } catch {
                const firstBrace = content.indexOf("{");
                const lastBrace = content.lastIndexOf("}");
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                  try {
                    parsed = JSON.parse(content.substring(firstBrace, lastBrace + 1));
                  } catch {}
                }
              }
            }
          }
          if (parsed) {
            let cat = parsed.transaction?.category || "General";
            if (cat === "Dining") cat = "Food & Dining";
            if (cat === "Salary") cat = "Income";
            if (cat === "Utilities") cat = "Bills & Utilities";
            if (cat === "Transfer") cat = "Transfers";
            if (cat === "Travel") cat = "Transport & Travel";
            if (cat === "Healthcare") cat = "Health & Fitness";

            return {
              classification: parsed.classification || "OTHER",
              isScamOrPhishing: parsed.isScamOrPhishing || (parsed.riskScore ?? 0) >= 60,
              riskScore: parsed.riskScore || 0,
              scamReason: parsed.scamReason || null,
              scamIndicators: parsed.scamIndicators || [],
              transaction: parsed.transaction ? {
                ...parsed.transaction,
                category: cat,
                merchant: cleanMerchantName(parsed.transaction.merchant || "Bank Merchant"),
              } : null,
            };
          }
        }
      }
    } catch (err) {
      console.warn("OpenRouter API call failed, falling back to heuristics:", err);
    }
  }

  // 3. Robust Deterministic Heuristic Engine Fallback
  const detectedCues: string[] = [];
  for (const sig of PHISHING_SIGNALS) {
    if (sig.pattern.test(fullText)) {
      detectedCues.push(sig.label);
    }
  }

  if (detectedCues.length >= 2 || (detectedCues.length >= 1 && /suspended|locked|urgent|warrant/i.test(fullText))) {
    const score = Math.min(98, 50 + detectedCues.length * 15);
    return {
      classification: "SCAM_PHISHING",
      isScamOrPhishing: true,
      riskScore: score,
      scamReason: `Suspicious lure detected: ${detectedCues.join(", ")}`,
      scamIndicators: detectedCues,
      transaction: null,
    };
  }

  // Check for financial transaction patterns
  const currencyRegex = /(?:(\$|€|£|¥|₱|USD|EUR|GBP|PHP|CAD|AUD)\s*([\d,]+\.?\d*)|([\d,]+\.?\d*)\s*(\$|€|£|¥|₱|USD|EUR|GBP|PHP|CAD|AUD))/i;
  const amountMatch = fullText.match(currencyRegex);

  const transactionKeywords = [
    "spent", "charged", "debited", "paid", "purchase", "withdrawal",
    "received", "credited", "refunded", "transferred", "sent to", "received from", "payment to", "direct deposit"
  ];
  const hasTransactionKeyword = transactionKeywords.some((k) => fullText.toLowerCase().includes(k));

  if (amountMatch || hasTransactionKeyword) {
    let amount = 0;
    let currency = "USD";

    if (amountMatch) {
      const symbolOrCode = (amountMatch[1] || amountMatch[4] || "$").toUpperCase();
      const rawNum = (amountMatch[2] || amountMatch[3] || "0").replace(/,/g, "");
      amount = parseFloat(rawNum) || 0;

      const symbolMap: Record<string, string> = {
        "$": "USD",
        "€": "EUR",
        "£": "GBP",
        "¥": "JPY",
        "₱": "PHP",
      };
      currency = symbolMap[symbolOrCode] || symbolOrCode;
    }

    const lower = fullText.toLowerCase();
    let type: "DEBIT" | "CREDIT" | "TRANSFER" = "DEBIT";
    if (lower.includes("received") || lower.includes("credited") || lower.includes("refunded") || lower.includes("deposited") || lower.includes("direct deposit")) {
      type = "CREDIT";
    } else if (/\b(?:transferred|transfer\s+to|transfer\b|sent\b.*?\bto|send\s+money|cash\s+out|cash\s+in|p2p|express\s+send)\b/i.test(lower)) {
      type = "TRANSFER";
    }

    const merchant = extractCleanMerchant(fullText, payload.packageName);
    const category = deduceCategory(merchant, lower, type);

    if (amount > 0) {
      return {
        classification: "TRANSACTION",
        isScamOrPhishing: false,
        riskScore: 2,
        scamReason: null,
        scamIndicators: [],
        transaction: {
          amount,
          currency,
          merchant,
          category,
          type,
        },
      };
    }
  }

  return {
    classification: "OTHER",
    isScamOrPhishing: false,
    riskScore: 10,
    scamReason: null,
    scamIndicators: [],
    transaction: null,
  };
}

const KNOWN_PACKAGES: Record<string, string> = {
  "com.ing.banking": "ING Bank",
  "com.chase.sig.android": "Chase",
  "com.infonow.bofa": "Bank of America",
  "com.wf.wellsfargomobile": "Wells Fargo",
  "com.citibank.mobile.citibankmobile": "Citi",
  "com.revolut.revolut": "Revolut",
  "com.paypal.android.p2pmobile": "PayPal",
  "com.globe.gcash.android": "GCash",
  "com.paymaya": "Maya",
  "com.bdo.banking": "BDO",
  "com.bpi.ng.app": "BPI",
  "com.grabtaxi.passenger": "Grab",
  "com.ubercab": "Uber",
  "com.netflix.ninja": "Netflix",
  "com.netflix.mediaclient": "Netflix",
  "com.spotify.music": "Spotify",
  "com.amazon.mShop.android.shopping": "Amazon",
  "com.shopee.ph": "Shopee",
  "com.lazada.android": "Lazada",
  "com.mcdonalds.app": "McDonald's",
  "com.walmart.android": "Walmart",
  "com.target.ui": "Target",
};

const ACRONYMS = new Set(["SM", "BDO", "BPI", "CVS", "ATM", "PLDT", "AT&T", "USA", "NYC", "HK", "UK", "IBM", "PH", "PG&E", "DLI", "KFC", "BBQ"]);

const GENERIC_TITLES = new Set(["alert", "alerts", "notification", "bank", "card", "debit", "credit", "security", "update", "notice", "messages", "messaging", "android"]);

export function cleanMerchantName(raw: string): string {
  let clean = raw.trim();
  clean = clean.replace(/^(?:the|a)\s+/i, "");

  // Handle Uber and Grab sub-brands cleanly
  if (/^uber/i.test(clean)) {
    return /eats/i.test(clean) ? "Uber Eats" : "Uber";
  }
  if (/^grab/i.test(clean)) {
    return /food/i.test(clean) ? "GrabFood" : /car/i.test(clean) ? "GrabCar" : "Grab";
  }

  // Strip payment gateway / card aggregator prefixes
  clean = clean.replace(
    /^(?:SQ\s*\*|SQUARE\s*\*|TST\s*\*|TOAST\s*\*|PAYPAL\s*\*|SP\s*\*|SHOPIFY\s*\*|AMZN\s*\*|AMAZON\s*\*|APL\s*\*|APPLE\s*\*|GOOGLE\s*\*|MSFT\s*\*|MICROSOFT\s*\*)\s*/i,
    ""
  );

  // Strip trailing channels & noise
  clean = clean.replace(
    /\s+(?:using\s+[\w\s]+|via\s+[\w\s]+|with\s+(?:account|acct|card|message|ref).*|ref\s*#?.*)$/i,
    ""
  );

  // Strip trailing phone numbers
  clean = clean.replace(/\s+(?:09\d{9}|\+?63\d{10}|\d{10,12})$/, "");

  // Strip store numbers / branch tags
  clean = clean.replace(/\s+(?:store|branch)?\s*#\d+/i, "");

  // Strip domain extensions
  clean = clean.replace(/(?:\.com|\.ph|\.org|\.net|\.io|\.co)$/i, "");

  clean = clean.trim().replace(/[,.\-;]+$/, "");

  // Apply proper Title Casing if all uppercase
  if (clean.length > 2 && clean.toUpperCase() === clean && !clean.includes(".")) {
    clean = clean.split(" ").map((word) => {
      if (ACRONYMS.has(word.toUpperCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(" ");
  }

  return clean || "Bank Merchant";
}

function isValidMerchantCandidate(candidate: string): boolean {
  if (!candidate || candidate.trim().length === 0) return false;
  if (candidate.toLowerCase() === "a" || candidate.toLowerCase() === "the") return false;
  if (/^\d+$/.test(candidate)) return false;
  if (/^(?:card|acct|account)?\s*\d+$/i.test(candidate)) return false;
  return true;
}

export function extractCleanMerchant(text: string, packageName?: string): string {
  // 1. Text pattern extraction prioritized: 'at' first, then 'to', then 'from'
  const patterns = [
    /\bat\s+([A-Za-z0-9&'*+./#\s-]+?)(?:\s+(?:(?:was|is|has)\s+(?:successful|completed|authorized|approved|posted|declined|made)|on\s+\d|on\s+card|for\s+(?:order|purchase|PHP|USD|EUR|GBP|₱|\$|€|£|\d)|using|via|with\s+(?:account|acct|card|ref|msg)|ref|card|ending|acct|account|trace|trans|txn|avail|balance|approved|\.|\$|PHP|USD|EUR|GBP|₱|€|£)|$)/i,
    /(?:bill to|payment to|paid to|sent to|charge at|charged at)\s+([A-Za-z0-9&'*+./#\s-]+?)(?:\s+(?:(?:was|is|has)\s+(?:successful|completed|authorized|approved|posted|declined|made)|using|via|with|on\s+\d|on\s+card|ref|card|ending|acct|account|balance)|$)/i,
    /\bto\s+([A-Za-z0-9&'*+./#\s-]+?)(?:\s+(?:(?:was|is|has)\s+(?:successful|completed|authorized|approved|posted|declined|made)|on\s+\d|on\s+card|for\s+(?:order|purchase|PHP|USD|EUR|GBP|₱|\$|€|£|\d)|using|via|with\s+(?:account|acct|card|ref|msg)|ref|card|ending|acct|account|trace|trans|txn|avail|balance|approved|\.|\$|PHP|USD|EUR|GBP|₱|€|£)|$)/i,
    /(?:direct deposit|deposit|payroll)\s+of\s+[^f]+from\s+([A-Za-z0-9&'*+./#\s-]+?)(?:\s+(?:has|ref|into|to|\.|$))/i,
    /\bfrom\s+([A-Za-z0-9&'*+./#\s-]+?)(?:\s+(?:(?:was|is|has)\s+(?:successful|completed|authorized|approved|posted|declined|made)|on\s+\d|on\s+card|for\s+|has|ref|into|to|\.|$))/i,
    /bought\s+[^o]+of\s+([A-Za-z0-9\s-]+load)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = cleanMerchantName(match[1]);
      if (isValidMerchantCandidate(candidate)) {
        return candidate;
      }
    }
  }

  // 2. Known package lookup
  if (packageName && KNOWN_PACKAGES[packageName]) {
    return KNOWN_PACKAGES[packageName];
  }

  // 3. Check if text begins with a merchant prefix (e.g. "Starbucks: ...", "Netflix: ...")
  const prefixMatch = text.match(/^([A-Za-z0-9\s&'.-]{2,30}):/);
  if (prefixMatch && prefixMatch[1]) {
    const pLower = prefixMatch[1].trim().toLowerCase();
    if (!GENERIC_TITLES.has(pLower) && !pLower.startsWith("sms")) {
      const candidate = cleanMerchantName(prefixMatch[1]);
      if (isValidMerchantCandidate(candidate)) {
        return candidate;
      }
    }
  }

  return "Bank Merchant";
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

export function deduceCategory(merchant: string, lower: string, type: "DEBIT" | "CREDIT" | "TRANSFER"): string {
  const combined = `${merchant.toLowerCase()} ${lower}`;

  // 1. Food & Dining
  if (containsAny(combined, [
    "starbucks", "mcdonald", "mcdo", "jollibee", "kfc", "burger king", "burger", "wendy",
    "subway", "pizza", "domino", "pizza hut", "dunkin", "tim horton", "chipotle", "taco bell",
    "shake shack", "sweetgreen", "panera", "grabfood", "foodpanda", "doordash", "uber eats",
    "postmates", "deliveroo", "mang inasal", "chowking", "bonchon", "max's", "restaurant",
    "cafe", "coffee", "dining", "bistro", "diner", "grill", "bar", "pub", "bakery", "ramen",
    "sushi", "noodle", "boba", "tea", "breakfast", "lunch", "dinner", "eats", "pastry", "pret a manger"
  ])) {
    return "Food & Dining";
  }

  // 2. Groceries
  if (containsAny(combined, [
    "trader joe", "whole foods", "walmart", "kroger", "safeway", "aldi", "costco", "heb",
    "h-e-b", "publix", "sprouts", "wegmans", "sm supermarket", "sm hypermarket", "puregold",
    "robinsons supermarket", "dali", "alfamart", "7-eleven", "7 eleven", "lawson", "familymart",
    "circle k", "wawa", "grocery", "groceries", "supermarket", "super market", "convenience store",
    "produce", "butcher", "bodega"
  ])) {
    return "Groceries";
  }

  // 3. Health & Fitness
  if (containsAny(combined, [
    "mercury drug", "watsons", "cvs", "walgreens", "boots", "rite aid", "pharmacy",
    "drugstore", "medicine", "hospital", "clinic", "dental", "dentist", "optometry",
    "vision", "eyewear", "doctor", "medical", "health", "fitness", "gym", "workout",
    "anytime fitness", "gold's gym", "planet fitness", "equinox", "yoga", "wellness",
    "lab", "diagnostics"
  ])) {
    return "Health & Fitness";
  }

  // 4. Transport & Travel
  if (containsAny(combined, [
    "uber", "lyft", "grab", "grabcar", "angkas", "joyride", "taxi", "cab", "transit",
    "metro", "subway", "train", "bus", "amtrak", "rail", "parking", "toll", "expressway",
    "ezpass", "shell", "chevron", "exxon", "mobil", "bp", "texaco", "petron", "caltex",
    "total", "fuel", "gas station", "airline", "flight", "delta", "united", "american airlines",
    "southwest", "airasia", "cebu pacific", "philippine airlines", "emirates", "hotel", "airbnb",
    "booking.com", "expedia", "agoda", "travel", "car rental", "hertz", "enterprise", "avis"
  ])) {
    return "Transport & Travel";
  }

  // 5. Entertainment
  if (containsAny(combined, [
    "netflix", "spotify", "youtube", "disney", "hulu", "hbo", "max", "paramount", "apple tv",
    "prime video", "steam", "playstation", "sony", "xbox", "nintendo", "twitch", "cinema",
    "movie", "theater", "theatre", "amc", "regal", "concert", "ticketmaster", "eventbrite",
    "audible", "kindle", "gaming", "game"
  ])) {
    return "Entertainment";
  }

  // 6. Shopping
  if (containsAny(combined, [
    "amazon", "amzn", "apple store", "target", "best buy", "home depot", "lowe's", "lowes",
    "ebay", "shopee", "lazada", "zalora", "shein", "temu", "aliexpress", "etsy", "nike",
    "adidas", "zara", "h&m", "uniqlo", "ikea", "sephora", "ulta", "sm store", "department store",
    "mall", "boutique", "clothing", "apparel", "shoes", "retail", "shop", "store"
  ])) {
    return "Shopping";
  }

  // 7. Bills & Utilities
  if (containsAny(combined, [
    "meralco", "manila water", "maynilad", "pg&e", "pacific gas", "con edison", "duke energy",
    "electric", "power", "water", "utility", "utilities", "pldt", "globe", "smart", "dito",
    "converge", "at&t", "verizon", "t-mobile", "sprint", "comcast", "xfinity", "spectrum",
    "broadband", "internet", "wifi", "telecom", "phone bill", "bill", "mobile load",
    "prepaid load", "regular load", "insurance", "geico", "progressive", "allstate",
    "state farm", "rent", "mortgage", "dues", "aws", "google cloud", "azure", "openai",
    "chatgpt", "github", "icloud", "dropbox"
  ])) {
    return "Bills & Utilities";
  }

  // 8. Transfers
  if (type === "TRANSFER" || containsAny(combined, [
    "transfer", "transferred", "sent to", "wire", "remittance", "cash in", "cash out",
    "atm withdrawal", "atm", "bank transfer", "wire transfer", "instapay", "pesonet",
    "zelle", "venmo", "cash app", "western union", "moneygram", "express send", "savings vault"
  ])) {
    return "Transfers";
  }

  // 9. Income
  if (type === "CREDIT" || containsAny(combined, [
    "salary", "payroll", "paycheck", "direct deposit", "employer", "compensation", "bonus",
    "stipend", "dividend", "interest earned", "payout", "refund", "refunded", "reimbursement", "cashback"
  ])) {
    return "Income";
  }

  return "General";
}
