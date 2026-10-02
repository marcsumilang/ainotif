import { z } from "zod";

// Shared server-only pipeline, also imported by Next's API route.
// HTTP contract: https://docs.typesafe.ai/api (POST /v1/systemone).
export const QUESTION_VERSION = "notification-jev-v2";
export const POLICY_VERSION = "notification-actions-v1";
export const CATEGORIES = ["Food & Dining", "Groceries", "Shopping", "Transport & Travel", "Bills & Utilities", "Entertainment", "Health", "Transfers", "Income", "General"] as const;
export const CURRENCIES = ["USD", "EUR", "GBP", "PHP", "JPY", "INR", "CAD", "AUD", "SGD", "NZD", "CHF", "HKD"] as const;
export const ProcessNotificationSchema = z.object({
  text: z.string().min(1).max(16_000),
  title: z.string().max(500).nullish().transform((v) => v ?? undefined),
  packageName: z.string().max(255).nullish().transform((v) => v ?? undefined),
  timestamp: z.number().int().min(0).max(8_640_000_000_000_000).nullish().transform((v) => v ?? undefined),
  categoryRules: z.array(z.object({ keyword: z.string().min(1).max(100), category: z.enum(CATEGORIES) })).max(32).optional(),
});
export const POLICY = {
  transaction: 0.97, fieldProbability: 0.95, fieldConfidence: 0.9,
  categoryProbability: 0.7, categoryConfidence: 0.65, safeThreatProbability: 0.05,
  warning: 0.85, credentialWarning: 0.9, reviewThreat: 0.2,
  // No automatic hiding until a labeled evaluation justifies enabling it.
  allowHide: false,
} as const;
const probability = z.number().finite().min(0).max(1);
const NoulSchema = z.object({ type: z.literal("noul"), noul: probability });
const ChoiceSchema = z.object({ type: z.literal("choice"), choice: z.string(), probabilities: z.record(probability), confidence: probability });
const AnswerSchema = z.discriminatedUnion("type", [NoulSchema, ChoiceSchema]);
const UsageSchema = z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() });
const JevResponseSchema = z.object({ model: z.string().min(1), answers: z.record(AnswerSchema), usage: UsageSchema });
export const TransactionSchema = z.object({
  amount: z.number().finite().positive(), currency: z.enum(CURRENCIES),
  merchant: z.string().trim().min(1).max(255), category: z.enum(CATEGORIES),
  type: z.enum(["DEBIT", "CREDIT", "TRANSFER"]),
});
export const ClassificationResultSchema = z.object({
  classification: z.enum(["TRANSACTION", "SCAM_PHISHING", "IRRELEVANT", "IGNORED_OTP", "REVIEW"]),
  isScamOrPhishing: z.boolean(), riskScore: z.number().int().min(0).max(100),
  scamReason: z.string().nullable(), scamIndicators: z.array(z.string()), transaction: TransactionSchema.nullable(),
  confidence: probability, // Legacy display only, never an action threshold.
  explanation: z.string(), droppedOtp: z.boolean().optional(),
  decision: z.object({
    saveTransaction: z.boolean(), warn: z.boolean(), hideNotification: z.literal(false),
    requiresReview: z.boolean(), suggestCategory: z.boolean(), reasons: z.array(z.string()),
  }),
  diagnostics: z.object({
    engine: z.enum(["jev", "heuristic", "privacy"]), model: z.string().nullable(),
    questionVersion: z.string(), policyVersion: z.string(), latencyMs: z.number().nonnegative(),
    usage: UsageSchema.nullable(), answers: z.record(AnswerSchema),
    error: z.enum(["not_configured", "service_unavailable", "invalid_response"]).nullable(),
  }),
}).superRefine((r, ctx) => {
  const bad = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (r.classification === "TRANSACTION" && (!r.transaction || r.isScamOrPhishing)) bad("Transaction classification requires consistent financial fields");
  if (r.classification !== "TRANSACTION" && r.classification !== "REVIEW" && r.transaction) bad("Only transaction or review results can have financial fields");
  if (r.isScamOrPhishing !== (r.classification === "SCAM_PHISHING")) bad("Scam flag and classification disagree");
  if (r.decision.saveTransaction && (r.classification !== "TRANSACTION" || r.decision.requiresReview || r.diagnostics.engine !== "jev")) bad("Uncertain or fallback results cannot save transactions");
  if (r.decision.warn !== r.isScamOrPhishing) bad("Warning and scam classification disagree");
  if (r.classification === "IGNORED_OTP" && (r.decision.requiresReview || r.transaction || !r.droppedOtp)) bad("Sensitive content cannot be retained for review");
});
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;
type ChoiceAnswer = z.infer<typeof ChoiceSchema>;
export type Question = { type: "noul"; instructions: string; criteria?: { true: string; false: string } } | { type: "choice"; instructions: string; criteria: Record<string, string> };
export interface NotificationPayload {
  text: string; title?: string; packageName?: string; timestamp?: number;
  categoryRules?: { keyword: string; category: string }[];
}
export interface AmountCandidate {
  id: string; span: string; start: number; end: number; context: string;
  amount: number; currency: typeof CURRENCIES[number];
}
export interface MerchantCandidate { id: string; span: string; start: number; end: number; context: string }

// Device privacy rules plus supplied PINs/passwords and reset-link credentials.
// Run before extracting candidates, inference, or storing notification content.
const SECURITY_PATTERNS = [
  /\b(?:otp|one[ -]time\s+(?:password|code)|verification\s+code|security\s+code|auth(?:entication)?\s+code|login\s+code|access\s+code|secret\s+code)\b/i,
  /\b(?:password\s+reset|reset\s+your\s+password|temporary\s+password)\b/i,
  /\b(?:do\s+not|never|don't)\s+share\s+(?:this\s+code|your\s+(?:password|pin|code|otp))\b/i,
  /\b(?:code|pin|password|passcode)\s*(?:is|:|=)\s*\S+/i,
  /\b(?:use|enter)\s+(?:code\s*:?\s*)?\d{4,8}\b/i,
  /\b\d{4,8}\s+is\s+your\s+(?:verification|security|login|access|2fa|mfa)\s+code\b/i,
  /\b(?:2fa|mfa)\s+(?:code|token)\b/i,
  /[?&#](?:token|access_token|reset_token|code|password|pin)=\S+/i,
];
export const isSensitiveOtp = (text: string): boolean => SECURITY_PATTERNS.some((pattern) => pattern.test(text));
const fullTextOf = (payload: NotificationPayload) => `${payload.title ? payload.title + " : " : ""}${payload.text}`.trim();
const contextOf = (text: string, start: number, end: number) => text.slice(Math.max(0, start - 55), Math.min(text.length, end + 65));

export function extractAmountCandidates(text: string): AmountCandidate[] {
  const money = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?`;
  const token = `(?:${CURRENCIES.join("|")}|[$€£₱₹¥])`;
  const sign = String.raw`(?:-\s*)?`;
  const rx = new RegExp(`(?<![\\w.,-])(${sign}${token}\\s*${sign}${money}|${sign}${money}\\s*${token})(?!\\w|[.,]\\d)`, "gi");
  const symbols: Record<string, typeof CURRENCIES[number]> = { "$": "USD", "€": "EUR", "£": "GBP", "₱": "PHP", "₹": "INR", "¥": "JPY" };
  const candidates: AmountCandidate[] = [];
  for (const match of text.matchAll(rx)) {
    const span = match[0];
    const currencyToken = span.match(new RegExp(token, "i"))?.[0];
    if (!currencyToken) continue;
    const currency = symbols[currencyToken] ?? currencyToken.toUpperCase() as typeof CURRENCIES[number];
    const amount = Number(span.replace(new RegExp(token, "i"), "").replace(/[\s,]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER / 100) continue;
    const start = match.index!;
    candidates.push({ id: `amount_${candidates.length}`, span, start, end: start + span.length, context: contextOf(text, start, start + span.length), amount, currency });
  }
  return candidates.slice(0, 32);
}
export function extractMerchantCandidates(text: string): MerchantCandidate[] {
  const candidates: MerchantCandidate[] = [];
  const rx = /\b(?:at|from|to|sa|kay)\s+([\p{L}\p{N}][\p{L}\p{N}\s'’&.-]{0,100}?)(?=\s+(?:on|for|using|with|via|has|was|is|card|balance)\b|[.!;,](?:\s|$)|\s*[$€£₱₹¥]|$)/giu;
  for (const match of text.matchAll(rx)) {
    const span = match[1].trim();
    const start = match.index! + match[0].indexOf(match[1]);
    if (!span || /^(?:your|my|this|the)\b/i.test(span)) continue;
    candidates.push({ id: `merchant_${candidates.length}`, span, start, end: start + span.length, context: contextOf(text, start, start + span.length) });
  }
  return candidates.slice(0, 32);
}
const KNOWN_DOMAINS = ["chase.com", "revolut.com", "monzo.com", "wise.com", "venmo.com", "paypal.com", "gcash.com", "wellsfargo.com", "bankofamerica.com", "citi.com", "capitalone.com"];
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rb.gy", "goo.gl", "tiny.cc"];
export function hostnameMatches(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === domain || host.endsWith(`.${domain}`);
}
export function parseUrlFacts(text: string) {
  const matches = text.match(/https?:\/\/[^\s<>"']+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi) ?? [];
  return [...new Set(matches)].slice(0, 32).map((raw) => {
    try {
      const clean = raw.replace(/[),.!;]+$/, "");
      const url = new URL(/^https?:/i.test(clean) ? clean : `https://${clean}`);
      const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
      return {
        hostname, recognizedDomain: KNOWN_DOMAINS.find((domain) => hostnameMatches(hostname, domain)) ?? null,
        shortened: SHORTENERS.some((domain) => hostnameMatches(hostname, domain)),
        lookalike: KNOWN_DOMAINS.some((domain) => hostname.includes(domain) && !hostnameMatches(hostname, domain)),
        hasUserInfo: Boolean(url.username || url.password), sourceIdentityVerified: "unknown" as const,
      };
    } catch {
      return { hostname: null, recognizedDomain: null, shortened: false, lookalike: false, hasUserInfo: false, sourceIdentityVerified: "unknown" as const };
    }
  });
}
export function buildJevRequest(payload: NotificationPayload, model = "jev-latest") {
  const text = fullTextOf(payload);
  const amounts = extractAmountCandidates(text);
  const merchants = extractMerchantCandidates(text);
  const selection = (candidates: { id: string; span: string; context: string }[]) => Object.fromEntries([
    ["none", "No candidate matches, information is missing, or the message does not report a transaction."],
    ...candidates.map((c) => [c.id, `Source span: ${c.span}. Context: ${c.context}`]),
  ]);
  const questions: Record<string, Question> = {
    completed: { type: "noul", instructions: "Does `notification.text` SAY a financial transaction already happened? Judge what the message reports, not whether the sender is authentic or the event can be independently verified.", criteria: {
      true: "Reports money paid, spent, debited, withdrawn, received, deposited, credited, transferred, or already refunded. For example: 'Paid PHP 1,250 at SM', 'You spent $42.50', 'You transferred PHP 1,000', 'Refund credited'. A balance included alongside a completed payment does not negate that payment.",
      false: "Only an offer, promotion, balance, credit limit, quoted fee, request to pay, future payment, pending authorization, declined or failed payment, chat, or security alert. For example: 'Get $50 cashback when you sign up', 'Available balance $500', 'Payment declined', 'Pending authorization'.",
    } },
    phishing: { type: "noul", instructions: "Does `notification.text` appear to be phishing or a scam? Use `urls` as parsed hostname evidence. A routine security alert telling the user to open their bank app is not by itself phishing. The source package or a bank name in text does not verify identity. Unknown domains alone do not establish fraud. Evaluate lures, threats, deceptive links and demands together." },
    credentials: { type: "noul", instructions: "Does `notification.text` ask the recipient to disclose or enter credentials to another person or an unverified destination? A reminder not to disclose credentials is not a disclosure request." },
    status: { type: "choice", instructions: "If this message reports a transaction, what is its status? Choose unknown when no status can be established.", criteria: { COMPLETED: "Money already moved or a payment is confirmed paid.", PENDING: "Pending, scheduled, authorized only, or not settled yet.", DECLINED: "Failed or declined; money did not move.", REVERSED: "An already completed refund or credited reversal.", UNKNOWN: "No transaction or unclear status." } },
    amount: { type: "choice", instructions: "If this message reports a transaction, which `amounts` span is the amount of that money movement? Exclude balances, limits, offers and separate fees. If multiple independent transactions are described, select none; the app cannot record multiple movements from one notification.", criteria: selection(amounts) },
    merchant: { type: "choice", instructions: "If this message reports a transaction, which `merchants` span names its merchant or counterparty? Choose none if missing or ambiguous.", criteria: selection(merchants) },
    direction: { type: "choice", instructions: "If this message reports a transaction, which ledger type applies to the account owner receiving the notification? Interpret 'you' as that account owner. A named counterparty is not the account owner. Choose UNKNOWN if unclear.", criteria: { DEBIT: "The account owner paid a merchant, spent, or withdrew money.", CREDIT: "The account owner received money, a deposit, salary, or a completed refund.", TRANSFER: "The account owner sent or transferred money to another account or person (e.g. 'You transferred PHP 1,000 to Ana').", UNKNOWN: "No transaction or unclear direction." } },
    category: { type: "choice", instructions: "If this message reports a transaction, what category applies? Consider supported `categoryRules`. Choose General when uncertain.", criteria: Object.fromEntries(CATEGORIES.map((category) => [category, category])) },
  };
  return { model, state: {
    notification: { text, packageName: payload.packageName ?? null, timestamp: payload.timestamp ?? null, sourceIdentityVerified: "unknown" },
    urls: parseUrlFacts(text), amounts, merchants,
    categoryRules: (payload.categoryRules ?? []).filter((rule) => CATEGORIES.includes(rule.category as typeof CATEGORIES[number])).slice(0, 32),
  }, questions };
}
function baseResult(engine: "jev" | "heuristic" | "privacy"): ClassificationResult {
  return {
    classification: "IRRELEVANT", isScamOrPhishing: false, riskScore: 0, scamReason: null, scamIndicators: [], transaction: null,
    confidence: 0, explanation: "No completed transaction or specific phishing evidence found.",
    decision: { saveTransaction: false, warn: false, hideNotification: false, requiresReview: false, suggestCategory: false, reasons: [] },
    diagnostics: { engine, model: null, questionVersion: QUESTION_VERSION, policyVersion: POLICY_VERSION, latencyMs: 0, usage: null, answers: {}, error: null },
  };
}
function privacyResult(): ClassificationResult {
  const r = baseResult("privacy");
  r.classification = "IGNORED_OTP"; r.droppedOtp = true;
  r.explanation = "Sensitive credentials discarded before inference and persistence.";
  r.decision.reasons = ["privacy_filter"];
  return r;
}
export function fallbackHeuristicClassifier(text: string, _packageName?: string): ClassificationResult {
  if (isSensitiveOtp(text)) return privacyResult();
  const r = baseResult("heuristic");
  const urls = parseUrlFacts(text);
  const lure = /\b(?:verify|confirm|click|tap|claim|log\s?in|sign\s?in|unlock|update)\b/i.test(text);
  const pressure = /\b(?:suspended|locked|deactivated|urgent|immediately|final\s+notice)\b/i.test(text);
  const deceptiveLink = urls.some((url) => url.lookalike || url.hasUserInfo || url.shortened);
  if (lure && deceptiveLink && (pressure || urls.some((url) => url.lookalike))) {
    r.classification = "SCAM_PHISHING"; r.isScamOrPhishing = true;
    r.riskScore = 80; // Heuristic severity, not a measured probability.
    r.scamIndicators = ["Unverified or deceptive link", "Action lure", ...(pressure ? ["Coercive pressure"] : [])];
    r.scamReason = "Rule-based warning: deceptive link combined with an action lure.";
    r.decision.warn = true;
  }
  const financial = /\b(?:paid|spent|sent|charged|debit|received|refunded|credited|debited|transferred|withdrawn|payment|purchase|deposit|nagbayad|nakareceive)\b/i.test(text);
  if (r.isScamOrPhishing || (financial && extractAmountCandidates(text).length > 0) || (lure && urls.length > 0)) {
    r.decision.requiresReview = true;
    if (!r.isScamOrPhishing) r.classification = "REVIEW";
    r.explanation = "Rule-based fallback retained for review; no transaction saved and original notification stays visible.";
    r.decision.reasons = ["heuristic_requires_review"];
  }
  return ClassificationResultSchema.parse(r);
}
function validateAnswers(response: z.infer<typeof JevResponseSchema>, questions: Record<string, Question>) {
  for (const [id, question] of Object.entries(questions)) {
    const answer = response.answers[id];
    if (!answer || answer.type !== question.type) throw new Error("invalid_response");
    if (answer.type === "choice" && question.type === "choice") {
      const keys = Object.keys(question.criteria);
      if (!keys.includes(answer.choice) || Object.keys(answer.probabilities).length !== keys.length || keys.some((key) => answer.probabilities[key] === undefined)) throw new Error("invalid_response");
      const values = Object.values(answer.probabilities);
      if (Math.abs(values.reduce((sum, p) => sum + p, 0) - 1) > 0.02 || answer.probabilities[answer.choice] < Math.max(...values) - 0.001) throw new Error("invalid_response");
      const derived = keys.length > 1 ? (Math.max(...values) - 1 / keys.length) / (1 - 1 / keys.length) : 1;
      if (Math.abs(derived - answer.confidence) > 0.02) throw new Error("invalid_response");
    }
  }
}
export function composeJevResult(payload: NotificationPayload, rawResponse: unknown, latencyMs = 0): ClassificationResult {
  if (isSensitiveOtp(fullTextOf(payload))) return privacyResult();
  const request = buildJevRequest(payload);
  const response = JevResponseSchema.parse(rawResponse);
  validateAnswers(response, request.questions);
  const r = baseResult("jev");
  r.diagnostics = { ...r.diagnostics, model: response.model, usage: response.usage, answers: response.answers, latencyMs };
  const noul = (id: string) => (response.answers[id] as z.infer<typeof NoulSchema>).noul;
  const choice = (id: string) => response.answers[id] as ChoiceAnswer;
  const reliable = (answer: ChoiceAnswer, p: number = POLICY.fieldProbability, confidence: number = POLICY.fieldConfidence) => answer.probabilities[answer.choice] >= p && answer.confidence >= confidence;
  const phishing = noul("phishing"); const credentials = noul("credentials");
  r.riskScore = Math.round(Math.max(phishing, credentials) * 100);
  if (phishing >= POLICY.warning || credentials >= POLICY.credentialWarning) {
    r.classification = "SCAM_PHISHING"; r.isScamOrPhishing = true; r.confidence = Math.max(phishing, credentials);
    r.scamIndicators = [...(phishing >= POLICY.warning ? ["Jev phishing judgment"] : []), ...(credentials >= POLICY.credentialWarning ? ["Credential disclosure request"] : [])];
    r.scamReason = "Potential phishing: verify the message through the provider's app or a known contact.";
    r.decision.warn = true; r.decision.requiresReview = true; r.decision.reasons = ["threat_warning"];
    r.explanation = "Warning retained for review. The original notification stays visible.";
    return ClassificationResultSchema.parse(r);
  }
  if (phishing >= POLICY.reviewThreat || credentials >= POLICY.reviewThreat) {
    r.classification = "REVIEW"; r.decision.requiresReview = true; r.decision.reasons = ["uncertain_threat"];
    r.explanation = "Possible threat needs review before recording financial data.";
    return ClassificationResultSchema.parse(r);
  }
  const completed = noul("completed");
  if (completed < 0.2) return ClassificationResultSchema.parse(r); // Ignore speculative financial fields.
  const amountAnswer = choice("amount");
  const amount = request.state.amounts.find((candidate) => candidate.id === amountAnswer.choice);
  const direction = choice("direction"); const status = choice("status"); const merchantAnswer = choice("merchant");
  const merchant = request.state.merchants.find((candidate) => candidate.id === merchantAnswer.choice);
  const category = choice("category");
  r.decision.suggestCategory = reliable(category, POLICY.categoryProbability, POLICY.categoryConfidence);
  const categoryRule = merchant && reliable(merchantAnswer) ? request.state.categoryRules.find((rule) =>
    merchant.span.toLowerCase().includes(rule.keyword.toLowerCase())) : undefined;
  if (categoryRule) r.decision.suggestCategory = true;
  if (amount && direction.choice !== "UNKNOWN") {
    r.transaction = TransactionSchema.parse({ amount: amount.amount, currency: amount.currency,
      merchant: merchant && reliable(merchantAnswer) ? merchant.span : "Unknown merchant",
      category: categoryRule?.category ?? (r.decision.suggestCategory ? category.choice : "General"), type: direction.choice });
  }
  const reasons = [
    ...(completed < POLICY.transaction ? ["uncertain_completed_transaction"] : []),
    ...(!amount || !reliable(amountAnswer) ? ["uncertain_or_missing_amount"] : []),
    ...(direction.choice === "UNKNOWN" || !reliable(direction) ? ["uncertain_direction"] : []),
    ...(!reliable(status) || !(status.choice === "COMPLETED" || (status.choice === "REVERSED" && direction.choice === "CREDIT")) ? ["not_completed_status"] : []),
    ...(phishing > POLICY.safeThreatProbability || credentials > POLICY.safeThreatProbability ? ["threat_not_ruled_out"] : []),
  ];
  r.confidence = Math.min(completed, amountAnswer.confidence, direction.confidence, status.confidence);
  r.decision.reasons = reasons; r.decision.saveTransaction = Boolean(r.transaction) && reasons.length === 0;
  r.decision.requiresReview = !r.decision.saveTransaction;
  r.classification = r.decision.saveTransaction ? "TRANSACTION" : "REVIEW";
  r.explanation = r.decision.saveTransaction ? "Completed money movement passed the field and threat checks." : "Uncertain financial notification retained for review; no transaction saved.";
  return ClassificationResultSchema.parse(r);
}
export interface ClassifierOptions { apiKey?: string; model?: string; fetch?: typeof fetch; timeoutMs?: number }
export async function classifyNotification(payload: NotificationPayload, options: ClassifierOptions = {}): Promise<ClassificationResult> {
  const text = fullTextOf(payload);
  if (isSensitiveOtp(text)) return privacyResult();
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    const r = fallbackHeuristicClassifier(text, payload.packageName); r.diagnostics.error = "not_configured";
    return r;
  }
  const start = Date.now();
  let error: "service_unavailable" | "invalid_response" = "service_unavailable";
  let metadata: { model: string; usage: z.infer<typeof UsageSchema> } | null = null;
  try {
    const response = await (options.fetch ?? fetch)("https://api.typesafe.ai/v1/systemone", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildJevRequest(payload, options.model ?? process.env.TYPESAFE_MODEL ?? "jev-latest")),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
    if (!response.ok) throw new Error("service_unavailable");
    error = "invalid_response";
    const raw: unknown = await response.json();
    const parsedMetadata = z.object({ model: z.string(), usage: UsageSchema }).safeParse(raw);
    if (parsedMetadata.success) metadata = parsedMetadata.data;
    return composeJevResult(payload, raw, Date.now() - start);
  } catch {
    // Provider error bodies can echo input; never log them.
    const r = fallbackHeuristicClassifier(text, payload.packageName);
    r.diagnostics.error = error; r.diagnostics.latencyMs = Date.now() - start;
    if (metadata) { r.diagnostics.model = metadata.model; r.diagnostics.usage = metadata.usage; }
    return r;
  }
}
