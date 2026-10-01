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
3. If financial transaction, extract amount (number), currency (e.g. USD), merchant (string), category (Groceries, Dining, Shopping, Utilities, Salary, Transfer, Entertainment, Travel, Healthcare, or General), and type (DEBIT, CREDIT, or TRANSFER).

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
          const parsed = JSON.parse(content);
          return {
            classification: parsed.classification || "OTHER",
            isScamOrPhishing: parsed.isScamOrPhishing || parsed.riskScore >= 60,
            riskScore: parsed.riskScore || 0,
            scamReason: parsed.scamReason || null,
            scamIndicators: parsed.scamIndicators || [],
            transaction: parsed.transaction || null,
          };
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
  const amountMatch = fullText.match(/(?:\$|USD|EUR|GBP|CAD|PHP|¥|£)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)|([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:USD|dollars?)/i);
  if (amountMatch) {
    const rawVal = (amountMatch[1] || amountMatch[2]).replace(/,/g, "");
    const amount = parseFloat(rawVal);
    const isCredit = /deposit|received|refund|credit|salary|earned/i.test(fullText);
    const isTransfer = /transferred|transfer\s+to|wire/i.test(fullText);

    let category = "General";
    if (/grocer|trader\s+joe|whole\s+foods|safeway|kroger|supermarket|market/i.test(fullText)) category = "Groceries";
    else if (/coffee|starbucks|blue\s+bottle|restaurant|cafe|dining|uber\s+eats|doordash/i.test(fullText)) category = "Dining";
    else if (/amazon|walmart|target|shopping|store|retail/i.test(fullText)) category = "Shopping";
    else if (/electric|water|gas|utility|internet|wifi|pg&e|verizon|at&t/i.test(fullText)) category = "Utilities";
    else if (/salary|payroll|direct\s+deposit|employer/i.test(fullText)) category = "Salary";
    else if (isTransfer) category = "Transfer";

    // Guess merchant
    let merchant = "Merchant";
    const atMatch = fullText.match(/\bat\s+([A-Za-z0-9\s'.-]+?)(?:\s+(?:on|for|using|with|via|\.|\$))/i);
    const fromMatch = fullText.match(/\bfrom\s+([A-Za-z0-9\s'.-]+?)(?:\s+(?:on|for|has|\.|\$))/i);
    const toMatch = fullText.match(/\bto\s+([A-Za-z0-9\s'.-]+?)(?:\s+(?:on|for|using|\.|\$))/i);

    if (atMatch) merchant = atMatch[1].trim();
    else if (fromMatch) merchant = fromMatch[1].trim();
    else if (toMatch) merchant = toMatch[1].trim();
    else if (payload.title) merchant = payload.title.trim();

    return {
      classification: "TRANSACTION",
      isScamOrPhishing: false,
      riskScore: 5,
      scamReason: null,
      scamIndicators: [],
      transaction: {
        amount,
        currency: "USD",
        merchant,
        category,
        type: isCredit ? "CREDIT" : isTransfer ? "TRANSFER" : "DEBIT",
      },
    };
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
