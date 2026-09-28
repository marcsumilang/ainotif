import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

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

const geminiApiKey = process.env.GEMINI_API_KEY;
let genAi: GoogleGenAI | null = null;

if (geminiApiKey) {
  try {
    genAi = new GoogleGenAI({ apiKey: geminiApiKey });
  } catch (err) {
    console.warn("Failed to initialize GoogleGenAI client:", err);
  }
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

  // If Gemini API is configured, use Gemini 2.0 Flash structured output
  if (genAi && geminiApiKey) {
    try {
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
   - category (one of: "Food & Dining", "Groceries", "Shopping", "Transport & Travel", "Bills & Utilities", "Entertainment", "Health", "Transfers", "Income", "General")
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

      const response = await genAi.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const rawJson = response.text?.trim();
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        const validated = ClassificationResultSchema.parse(parsed);
        return validated;
      }
    } catch (err) {
      console.warn("Gemini AI API classification failed, falling back to heuristic engine:", err);
    }
  }

  // Heuristic rule-based fallback analyzer (Zero external latency / offline safe)
  return fallbackHeuristicClassifier(fullText, payload.packageName);
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

  // Suspicious link patterns (shorteners, raw IP, http)
  const linkMatches = text.match(/https?:\/\/[^\s]+/gi) || [];
  for (const link of linkMatches) {
    const linkLower = link.toLowerCase();
    if (
      linkLower.includes("bit.ly") ||
      linkLower.includes("tinyurl") ||
      linkLower.includes("t.co") ||
      linkLower.includes(".xyz") ||
      linkLower.includes(".top") ||
      linkLower.includes("bank-verify") ||
      linkLower.includes("login-secure") ||
      linkLower.includes("update-account")
    ) {
      phishingIndicators.push(`Suspicious URL detected: ${link}`);
      riskScore += 45;
    } else if (!linkLower.includes("chase.com") && !linkLower.includes("revolut.com") && !linkLower.includes("paypal.com")) {
      phishingIndicators.push(`External link in financial alert: ${link}`);
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
    "received", "credited", "refunded", "transferred", "sent to", "received from", "payment to"
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
    if (lower.includes("received") || lower.includes("credited") || lower.includes("refunded") || lower.includes("deposited")) {
      type = "CREDIT";
    } else if (lower.includes("transferred") || lower.includes("sent to") || lower.includes("transfer to")) {
      type = "TRANSFER";
    }

    // Extract merchant
    let merchant = "Bank Merchant";
    const atMatch = text.match(/(?:at|to|from)\s+([A-Za-z0-9\s'.-]+?)(?:\s+on|\s+for|\s+ref|\s+card|\.|$)/i);
    if (atMatch && atMatch[1]) {
      merchant = atMatch[1].trim().replace(/^the\s+/i, "");
    } else if (packageName) {
      const parts = packageName.split(".");
      merchant = parts[parts.length - 1].toUpperCase();
    }

    // Deduce Category
    let category = "General";
    const mLower = merchant.toLowerCase() + " " + lower;
    if (mLower.includes("starbucks") || mLower.includes("mcdonald") || mLower.includes("coffee") || mLower.includes("restaurant") || mLower.includes("cafe") || mLower.includes("burger")) {
      category = "Food & Dining";
    } else if (mLower.includes("trader joe") || mLower.includes("walmart") || mLower.includes("grocery") || mLower.includes("supermarket") || mLower.includes("whole foods")) {
      category = "Groceries";
    } else if (mLower.includes("uber") || mLower.includes("lyft") || mLower.includes("airline") || mLower.includes("flight") || mLower.includes("gas") || mLower.includes("shell") || mLower.includes("chevron")) {
      category = "Transport & Travel";
    } else if (mLower.includes("netflix") || mLower.includes("spotify") || mLower.includes("steam") || mLower.includes("cinema") || mLower.includes("disney")) {
      category = "Entertainment";
    } else if (mLower.includes("amazon") || mLower.includes("apple") || mLower.includes("target") || mLower.includes("store") || mLower.includes("shop")) {
      category = "Shopping";
    } else if (mLower.includes("electric") || mLower.includes("water") || mLower.includes("internet") || mLower.includes("mobile") || mLower.includes("bill") || mLower.includes("telecom")) {
      category = "Bills & Utilities";
    } else if (type === "TRANSFER") {
      category = "Transfers";
    } else if (type === "CREDIT") {
      category = "Income";
    }

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
