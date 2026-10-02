import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { classifyNotification, QUESTION_VERSION, POLICY_VERSION } from "../src/ai/classifier.js";

// Deliberate opt-in: ordinary tests never spend provider tokens.
if (!process.argv.includes("--live")) {
  console.log("Live evaluation is opt-in: pnpm evaluate:jev --live [--output=/private/tmp/jev-evaluation.json]");
  process.exit(0);
}
if (!process.env.TYPESAFE_API_KEY) throw new Error("Set TYPESAFE_API_KEY in backend/.env before running live evaluation.");
interface Label {
  id: string; text: string; title?: string; completed: boolean; phishing: boolean;
  privacy?: boolean; review?: boolean; amount?: number; currency?: string; direction?: string;
}
const labels: Label[] = JSON.parse(await readFile(new URL("../test/fixtures/notifications.json", import.meta.url), "utf8"));
let inputTokens = 0, outputTokens = 0, extractionCorrect = 0, extractionTotal = 0;
let truePositive = 0, falsePositive = 0, trueNegative = 0, falseNegative = 0;
let completedCorrect = 0, completedTotal = 0, unsafeSaves = 0, privacyFailures = 0, serviceFailures = 0, abstentions = 0;
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
    const completed = result.diagnostics.answers.completed;
    if (completed?.type === "noul") { completedTotal++; if ((completed.noul >= 0.97) === label.completed) completedCorrect++; }
    if (label.amount !== undefined) {
      extractionTotal++;
      if (result.transaction?.amount === label.amount && result.transaction.currency === label.currency && result.transaction.type === label.direction) extractionCorrect++;
    }
    if (result.decision.saveTransaction && (!label.completed || label.phishing || label.review || result.transaction?.amount !== label.amount || result.transaction.currency !== label.currency || result.transaction.type !== label.direction)) unsafeSaves++;
  }
  if (result.decision.requiresReview) abstentions++;
  // Synthetic fixture IDs only: no real notification content in console output.
  cases.push({ id: label.id, result });
  console.log(`${label.id}: ${result.classification} (${result.diagnostics.engine})`);
}
const report = {
  questionVersion: QUESTION_VERSION, policyVersion: POLICY_VERSION,
  models: [...new Set(cases.map((c) => c.result.diagnostics.model).filter(Boolean))],
  metrics: {
    cases: labels.length, extractionCorrect, extractionTotal,
    extractionAccuracy: extractionTotal ? extractionCorrect / extractionTotal : null,
    completedCorrect, completedTotal, completedAccuracy: completedTotal ? completedCorrect / completedTotal : null,
    phishing: { truePositive, falsePositive, trueNegative, falseNegative },
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
