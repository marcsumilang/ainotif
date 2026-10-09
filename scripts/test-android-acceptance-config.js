"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { validateAcceptanceConfig } = require("./build-android-acceptance");

const validConfig = {
  ACCEPTANCE_TARGET_REVIEWED: "true",
  ACCEPTANCE_BACKEND_BASE_URL: "https://api.staging.example.test",
  ACCEPTANCE_WEB_BASE_URL: "https://app.staging.example.test/",
  ACCEPTANCE_CLERK_PUBLISHABLE_KEY: "pk_test_acceptance_placeholder",
};

function rejectsConfig(config, pattern) {
  assert.throws(() => validateAcceptanceConfig(config), pattern);
}

rejectsConfig({}, /ACCEPTANCE_TARGET_REVIEWED/);
rejectsConfig({ ...validConfig, ACCEPTANCE_TARGET_REVIEWED: "false" }, /ACCEPTANCE_TARGET_REVIEWED/);
rejectsConfig({ ...validConfig, ACCEPTANCE_BACKEND_BASE_URL: undefined }, /ACCEPTANCE_BACKEND_BASE_URL/);

for (const productionUrl of [
  "https://ainotif-backend.marcsumilang.workers.dev",
  "https://AINOTIF-WEB.MARCSUMILANG.WORKERS.DEV:443/",
  "https://ainotif-backend.marcsumilang.workers.dev./",
]) {
  rejectsConfig({ ...validConfig, ACCEPTANCE_BACKEND_BASE_URL: productionUrl }, /production service host/);
}

for (const invalidUrl of [
  "http://api.staging.example.test",
  "https://api.staging.example.test/v1",
  "https://user:secret@api.staging.example.test",
  "https://api.staging.example.test?token=secret",
  "https://api.staging.example.test/#secret",
  "not a URL containing secret",
]) {
  rejectsConfig({ ...validConfig, ACCEPTANCE_BACKEND_BASE_URL: invalidUrl }, /ACCEPTANCE_BACKEND_BASE_URL/);
}

for (const key of ["", "pk_test_", "pk_live_live_placeholder", "sk_test_secret_placeholder", "pk_test_line\nbreak", undefined]) {
  rejectsConfig({ ...validConfig, ACCEPTANCE_CLERK_PUBLISHABLE_KEY: key }, /pk_test_/);
}

const accepted = validateAcceptanceConfig(validConfig);
assert.deepEqual(accepted, {
  backendBaseUrl: "https://api.staging.example.test",
  webBaseUrl: "https://app.staging.example.test",
  clerkPublishableKey: "pk_test_acceptance_placeholder",
});

const secretCanary = "pk_live_never-print-this-canary";
const cliEnv = {
  ...process.env,
  ACCEPTANCE_TARGET_REVIEWED: "true",
  ACCEPTANCE_BACKEND_BASE_URL: "https://api.staging.example.test",
  ACCEPTANCE_WEB_BASE_URL: "https://app.staging.example.test",
  ACCEPTANCE_CLERK_PUBLISHABLE_KEY: secretCanary,
};
const cliResult = spawnSync(
  process.execPath,
  [path.join(__dirname, "build-android-acceptance.js")],
  { cwd: path.resolve(__dirname, ".."), env: cliEnv, encoding: "utf8" }
);
assert.equal(cliResult.status, 1);
assert.doesNotMatch(cliResult.stdout, new RegExp(secretCanary));
assert.doesNotMatch(cliResult.stderr, new RegExp(secretCanary));

const wrongTask = spawnSync(process.execPath, [path.join(__dirname, "build-android-acceptance.js"), "assembleRelease"], {
  env: { ...process.env, ...validConfig }, encoding: "utf8",
});
assert.equal(wrongTask.status, 1);
assert.match(wrongTask.stderr, /only acceptance build\/test tasks/);

console.log("Android acceptance config checks passed.");
