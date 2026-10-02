import { buildJevRequest, type NotificationPayload } from "../src/ai/classifier.js";

// Contract fixtures are simulated judgments, not measured Jev accuracy.
export function jevFixture(payload: NotificationPayload, overrides: Record<string, string | number> = {}) {
  const request = buildJevRequest(payload);
  const defaults: Record<string, string | number> = {
    completed: 0.99, phishing: 0.01, credentials: 0.01, status: "COMPLETED",
    amount: request.state.amounts[0]?.id ?? "none", merchant: request.state.merchants[0]?.id ?? "none",
    direction: "DEBIT", category: "General", ...overrides,
  };
  return {
    model: "jev-contract-fixture", usage: { input_tokens: 0, output_tokens: 0 },
    answers: Object.fromEntries(Object.entries(request.questions).map(([id, question]) => {
      if (question.type === "noul") return [id, { type: "noul", noul: defaults[id] }];
      const keys = Object.keys(question.criteria);
      const probabilities = Object.fromEntries(keys.map((key) => [key, key === defaults[id] ? 1 : 0]));
      return [id, { type: "choice", choice: defaults[id], probabilities, confidence: 1 }];
    })),
  };
}
