import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { classifyNotification, QUESTION_VERSION, POLICY_VERSION } from "../src/ai/classifier.js";

// Deliberate opt-in: ordinary tests never spend provider requests.
if (!process.argv.includes("--live")) {
  console.log("Live evaluation is opt-in: pnpm evaluate:openrouter --live [--output=/private/tmp/openrouter-evaluation.json]");
  process.exit(0);
}
if (!process.env.OPENROUTER_API_KEY) throw new Error("Set OPENROUTER_API_KEY in backend/.env before running live evaluation.");

interface Label {
  id: string; text: string; title?: string; completed: boolean; phishing: boolean;
  privacy?: boolean; review?: boolean; amount?: number; currency?: string; direction?: string;
}
const labels: Label[] = JSON.parse(await readFile(new URL("../test/fixtures/notifications.json", import.meta.url), "utf8"));
let inputTokens = 0, outputTokens = 0, extractionCorrect = 0, extractionTotal = 0;
let truePositive = 0, falsePositive = 0, trueNegative = 0, falseNegative = 0;
let suggestionTruePositive = 0, suggestionFalsePositive = 0, suggestionFalseNegative = 0;
let unsafeSaves = 0, privacyFailures = 0, serviceFailures = 0, abstentions = 0;
const cases = [];

for (const label of labels) {
  const result = await classifyNotification({ text: label.text, title: label.title });
  inputTokens += result.diagnostics.usage?.input_tokens ?? 0;
  outputTokens += result.diagnostics.usage?.output_tokens ?? 0;
  if (result.diagnostics.error) serviceFailures++;
  if (label.privacy) {
    if (!result.droppedOtp || result.diagnostics.engine !== "privacy") privacyFailures++;
  } else {
    if (result.decision.warn && label.phishing) truePositive++;
    else if (result.decision.warn) falsePositive++;
    else if (label.phishing) falseNegative++;
    else trueNegative++;

    const suggestedTransaction = result.transaction !== null;
    if (suggestedTransaction && label.completed) suggestionTruePositive++;
    else if (suggestedTransaction) suggestionFalsePositive++;
    else if (label.completed) suggestionFalseNegative++;

    if (label.amount !== undefined) {
      extractionTotal++;
      if (result.transaction?.amount === label.amount && result.transaction.currency === label.currency && result.transaction.type === label.direction) extractionCorrect++;
    }
    const tx = result.transaction;
    if (result.decision.saveTransaction && (!tx || !label.completed || label.phishing || label.review || tx.amount !== label.amount || tx.currency !== label.currency || tx.type !== label.direction)) unsafeSaves++;
  }
  if (result.decision.requiresReview) abstentions++;
  // Synthetic fixture IDs only: no notification text in console output.
  cases.push({ id: label.id, result });
  console.log(`${label.id}: ${result.classification} (${result.diagnostics.model ?? result.diagnostics.engine})`);
}

const report = {
  questionVersion: QUESTION_VERSION,
  policyVersion: POLICY_VERSION,
  models: [...new Set(cases.map((c) => c.result.diagnostics.model).filter(Boolean))],
  metrics: {
    cases: labels.length,
    phishing: { truePositive, falsePositive, trueNegative, falseNegative },
    transactionSuggestions: { truePositive: suggestionTruePositive, falsePositive: suggestionFalsePositive, falseNegative: suggestionFalseNegative },
    extractionCorrect, extractionTotal,
    extractionAccuracy: extractionTotal ? extractionCorrect / extractionTotal : null,
    unsafeSaves, privacyFailures, serviceFailures, abstentions,
  },
  usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
  totalLatencyMs: cases.reduce((sum, c) => sum + c.result.diagnostics.latencyMs, 0),
  cases,
};
console.log(JSON.stringify({ ...report, cases: undefined }, null, 2));
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length);
if (output) await writeFile(output, JSON.stringify(report, null, 2));
if (unsafeSaves || privacyFailures || serviceFailures) process.exitCode = 1;
