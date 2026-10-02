import { z } from "zod";
import OpenAI from "openai";

export const ClassificationResultSchema = z.object({
  classification: z.enum(["TRANSACTION", "SCAM_PHISHING", "IRRELEVANT"]),
  isScamOrPhishing: z.boolean(),
  riskScore: z.number().min(0).max(100),
  scamReason: z.string().nullable(),
  scamIndicators: z.array(z.string()),
  transaction: z.object({
    amount: z.number(),
    currency: z.string(),
    merchant: z.string(),
    category: z.string(),
    type: z.enum(["DEBIT", "CREDIT", "TRANSFER"]),
  }).nullable(),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

let cachedClient: OpenAI | null = null;
let lastApiKey: string | undefined = undefined;

export function getOpenRouterClient(): { client: OpenAI | null; apiKey: string | undefined } {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { client: null, apiKey: undefined };

  if (cachedClient && lastApiKey === apiKey) {
    return { client: cachedClient, apiKey };
  }

  try {
    cachedClient = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://github.com/marcsumilang/ainotif",
        "X-Title": process.env.OPENROUTER_SITE_NAME || "AiNotif",
      },
    });
    lastApiKey = apiKey;
    return { client: cachedClient, apiKey };
  } catch (err) {
    console.warn("Failed to initialize OpenRouter client:", err);
    return { client: null, apiKey };
  }
}

/**
 * Robustly parses and extracts JSON from model responses, handling potential markdown fences
 * or leading/trailing commentary common in free open-source models.
 */
export function extractJsonPayload(content: string): unknown {
  let clean = content.trim();

  // 1. Direct JSON parse
  try {
    return JSON.parse(clean);
  } catch {
    // Continue
  }

  // 2. Extract from markdown code fence (```json ... ``` or ``` ... ```) anywhere in content
  const markdownMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (markdownMatch && markdownMatch[1]) {
    try {
      return JSON.parse(markdownMatch[1].trim());
    } catch {
      clean = markdownMatch[1].trim();
    }
  }

  // 3. Find outermost JSON object bounds { ... }
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = clean.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Remove trailing commas before } or ] common in open-source LLM outputs
      const relaxed = candidate.replace(/,\s*([}\]])/g, "$1");
      try {
        return JSON.parse(relaxed);
      } catch {
        // Fall through
      }
    }
  }

  throw new Error("No valid JSON structure found in AI response");
}

/**
 * Classifies an incoming notification into a structured transaction or flags as phishing/scam.
 */
export async function classifyNotification(payload: {
  text: string;
  title?: string;
  packageName?: string;
  timestamp?: number;
}): Promise<ClassificationResult> {
  const fullText = `${payload.title ? payload.title + " : " : ""}${payload.text}`.trim();

  // If OpenRouter API is configured, use OpenRouter structured output
  const { client: openRouterClient, apiKey: openRouterApiKey } = getOpenRouterClient();
  if (openRouterClient && openRouterApiKey) {
    try {
      const model = process.env.OPENROUTER_MODEL || "openrouter/free";
      const prompt = `
You are a cybersecurity and banking notification analyzer. Analyze the following notification from an Android phone:

Source App Package: ${payload.packageName || "Unknown"}
Notification Content:
"""
${fullText}
"""

Tasks:
1. Determine if this message is a PHISHING/SCAM attempt (e.g. fake bank security alerts, account suspension threats, links to suspicious login portals, unexpected lottery/wire transfer claims).
2. If it is a legitimate financial transaction (purchase, debit, credit, withdrawal, transfer), extract:
   - amount (numeric positive float)
   - currency (3-letter ISO like USD, EUR, GBP, PHP, etc.)
   - merchant name (cleaned, e.g. "Starbucks", "Amazon", "Trader Joe's", "Uber")
   - category (one of: "Food & Dining", "Groceries", "Shopping", "Transport & Travel", "Bills & Utilities", "Entertainment", "Health & Fitness", "Transfers", "Income", "General")
   - type ("DEBIT", "CREDIT", or "TRANSFER")
3. If it is neither (e.g. chat, marketing, system alert, or already dropped OTP), classify as "IRRELEVANT".

Respond ONLY with valid JSON conforming to this schema:
{
  "classification": "TRANSACTION" | "SCAM_PHISHING" | "IRRELEVANT",
  "isScamOrPhishing": boolean,
  "riskScore": number (0 to 100),
  "scamReason": string or null,
  "scamIndicators": string[],
  "transaction": {
    "amount": number,
    "currency": string,
    "merchant": string,
    "category": string,
    "type": "DEBIT" | "CREDIT" | "TRANSFER"
  } or null,
  "confidence": number (0 to 1),
  "explanation": string
}
`;

      const completion = await openRouterClient.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "You are a cybersecurity and banking notification analyzer. Analyze notifications and respond ONLY with valid JSON conforming strictly to the requested schema. Return clean merchant names without gateway prefixes or payment channel noise.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const rawJson = completion.choices[0]?.message?.content;
      if (rawJson) {
        const parsed = extractJsonPayload(rawJson);
        const validated = ClassificationResultSchema.parse(parsed);
        return validated;
      }
    } catch (err) {
      console.warn("OpenRouter AI API classification failed, falling back to heuristic engine:", err);
    }
  }

  // Heuristic rule-based fallback analyzer (Zero external latency / offline safe)
  return fallbackHeuristicClassifier(fullText, payload.packageName);
}

const GENERIC_TITLES = new Set([
  "sms", "messages", "bank", "chase", "bpi", "bdo", "gcash", "maya", "citi", "wells fargo",
  "capital one", "amex", "revolut", "google auth", "alert", "notification", "security alert",
  "banking push", "bank alert", "metrobank", "unionbank", "rcbc", "apple card", "apple pay",
  "google pay", "samsung pay", "apple wallet", "google wallet", "wallet"
]);

const KNOWN_PACKAGES: Record<string, string> = {
  "com.starbucks.mobilecard": "Starbucks",
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

function cleanMerchantName(raw: String): string {
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

/**
 * High-precision heuristic rule engine for instant classification when AI API is unavailable.
 */
export function fallbackHeuristicClassifier(text: string, packageName?: string): ClassificationResult {
  const lower = text.toLowerCase();

  // 1. Phishing & Scam Detection Rules
  const phishingIndicators: string[] = [];
  let riskScore = 0;

  const urgentPhrases = [
    "account suspended",
    "account locked",
    "security alert",
    "unauthorized access",
    "action required immediately",
    "verify your identity",
    "unusual activity detected",
    "compromised",
    "suspended permanently",
    "card deactivated",
    "click here to unlock",
    "confirm your details",
    "wire transfer pending approval",
  ];

  for (const phrase of urgentPhrases) {
    if (lower.includes(phrase)) {
      phishingIndicators.push(`Urgent coercion cue: "${phrase}"`);
      riskScore += 35;
    }
  }

  // Advanced Real-time Phishing URL Threat Intelligence
  const linkMatches = text.match(/https?:\/\/[^\s]+/gi) || [];
  const rawIpRegex = /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?(?:\/.*)?$/i;
  const deceptiveBankSubstrings = ["bank-verify", "login-secure", "update-account", "chase-alert", "wellsfargo-verify", "bofa-security", "paypal-auth", "secure-account"];
  const suspiciousShortenersAndTlds = ["bit.ly", "tinyurl.com", "t.co", "cutt.ly", "rb.gy", "is.gd", "tiny.cc", "ow.ly", ".xyz", ".top", ".click", ".buzz", ".cam", ".work"];

  for (const link of linkMatches) {
    const linkLower = link.toLowerCase();
    let isThreat = false;

    if (rawIpRegex.test(link)) {
      phishingIndicators.push(`Deceptive raw IP host URL detected: ${link}`);
      riskScore += 55;
      isThreat = true;
    }

    if (suspiciousShortenersAndTlds.some((s) => linkLower.includes(s))) {
      phishingIndicators.push(`Suspicious/shortened redirect URL masks real destination: ${link}`);
      riskScore += 45;
      isThreat = true;
    }

    if (deceptiveBankSubstrings.some((d) => linkLower.includes(d))) {
      phishingIndicators.push(`Deceptive domain mimics banking brand: ${link}`);
      riskScore += 50;
      isThreat = true;
    }

    if (!isThreat && !linkLower.includes("chase.com") && !linkLower.includes("revolut.com") && !linkLower.includes("paypal.com") && !linkLower.includes("bankofamerica.com")) {
      phishingIndicators.push(`External unverified link in financial alert: ${link}`);
      riskScore += 20;
    }
  }

  // Suspicious sender or spoofing cues
  if (lower.includes("irs") && (lower.includes("gift card") || lower.includes("bitcoin") || lower.includes("crypto"))) {
    phishingIndicators.push("Government impersonation demanding non-standard payment");
    riskScore += 60;
  }

  if (riskScore >= 40) {
    return {
      classification: "SCAM_PHISHING",
      isScamOrPhishing: true,
      riskScore: Math.min(riskScore, 99),
      scamReason: `Potential phishing or security scam: detected ${phishingIndicators.length} high-risk cue(s).`,
      scamIndicators: phishingIndicators,
      transaction: null,
      confidence: 0.92,
      explanation: "Message exhibits aggressive urgency, suspicious URL, or deceptive bank account suspension claims.",
    };
  }

  // 2. Transaction Detection & Extraction Rules
  // Match currency and amount e.g. $45.20, €12.50, £99, USD 50, 45.00 EUR, ₱1,250.00
  const currencyRegex = /(?:(\$|€|£|¥|₱|USD|EUR|GBP|PHP|CAD|AUD)\s*([\d,]+\.?\d*)|([\d,]+\.?\d*)\s*(\$|€|£|¥|₱|USD|EUR|GBP|PHP|CAD|AUD))/i;
  const amountMatch = text.match(currencyRegex);

  const transactionKeywords = [
    "spent", "charged", "debited", "paid", "purchase", "withdrawal",
    "received", "credited", "refunded", "transferred", "sent to", "received from", "payment to", "direct deposit"
  ];
  const hasTransactionKeyword = transactionKeywords.some((k) => lower.includes(k));

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

    // Determine type (DEBIT vs CREDIT vs TRANSFER)
    let type: "DEBIT" | "CREDIT" | "TRANSFER" = "DEBIT";
    if (lower.includes("received") || lower.includes("credited") || lower.includes("refunded") || lower.includes("deposited") || lower.includes("direct deposit")) {
      type = "CREDIT";
    } else if (/\b(?:transferred|transfer\s+to|transfer\b|sent\b.*?\bto|send\s+money|cash\s+out|cash\s+in|p2p|express\s+send)\b/i.test(lower)) {
      type = "TRANSFER";
    }

    // Extract merchant
    const merchant = extractCleanMerchant(text, packageName);

    // Deduce Category
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
        confidence: 0.88,
        explanation: `Parsed ${type} transaction of ${currency} ${amount} at ${merchant} (${category}).`,
      };
    }
  }

  // 3. Irrelevant
  return {
    classification: "IRRELEVANT",
    isScamOrPhishing: false,
    riskScore: 5,
    scamReason: null,
    scamIndicators: [],
    transaction: null,
    confidence: 0.75,
    explanation: "Message does not contain financial transaction or phishing markers.",
  };
}
