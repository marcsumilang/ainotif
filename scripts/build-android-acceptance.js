"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");

const PRODUCTION_HOSTS = new Set([
  "ainotif-backend.marcsumilang.workers.dev",
  "ainotif-web.marcsumilang.workers.dev",
]);

function validateHttpsOrigin(name, rawValue) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    throw new Error(`${name} must be explicitly set to a reviewed HTTPS origin.`);
  }

  let parsed;
  try {
    parsed = new URL(rawValue.trim());
  } catch {
    throw new Error(`${name} must be a valid HTTPS origin.`);
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new Error(`${name} must be an HTTPS origin without credentials, path, query, or fragment.`);
  }

  if (PRODUCTION_HOSTS.has(parsed.hostname.toLowerCase().replace(/\.$/, ""))) {
    throw new Error(`${name} cannot target a production service host.`);
  }

  return parsed.origin;
}

function validateAcceptanceConfig(env = process.env) {
  if (env.ACCEPTANCE_TARGET_REVIEWED?.trim() !== "true") {
    throw new Error("Set ACCEPTANCE_TARGET_REVIEWED=true after reviewing the non-production target.");
  }

  const backendBaseUrl = validateHttpsOrigin(
    "ACCEPTANCE_BACKEND_BASE_URL",
    env.ACCEPTANCE_BACKEND_BASE_URL
  );
  const webBaseUrl = validateHttpsOrigin(
    "ACCEPTANCE_WEB_BASE_URL",
    env.ACCEPTANCE_WEB_BASE_URL
  );
  const clerkPublishableKey = env.ACCEPTANCE_CLERK_PUBLISHABLE_KEY?.trim();

  if (!clerkPublishableKey || !/^pk_test_[A-Za-z0-9+/=_-]+$/.test(clerkPublishableKey)) {
    throw new Error("ACCEPTANCE_CLERK_PUBLISHABLE_KEY must be a non-empty pk_test_ key.");
  }

  return { backendBaseUrl, webBaseUrl, clerkPublishableKey };
}

function main(argv = process.argv.slice(2), env = process.env) {
  let config;
  try {
    config = validateAcceptanceConfig(env);
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  const [task = "assembleAcceptance", ...gradleArgs] = argv;
  const allowedTasks = new Set([
    "assembleAcceptance", "assembleAcceptanceAndroidTest", "connectedAcceptanceAndroidTest",
    "testAcceptanceUnitTest", "validateAcceptanceConfig",
  ]);
  if ([task, ...gradleArgs].some((arg) => !arg.startsWith("-") && !allowedTasks.has(arg.replace(/^:app:/, "")))) {
    console.error("Use only acceptance build/test tasks with the acceptance runner.");
    return 1;
  }
  if (gradleArgs.some((arg) => /^-P(?:org\.gradle\.project\.)?CLERK_PUBLISHABLE_KEY(?:=|$)/.test(arg))) {
    console.error("Do not override CLERK_PUBLISHABLE_KEY in Gradle arguments; the acceptance key is selected from explicit acceptance configuration.");
    return 1;
  }

  const childEnv = {
    ...env,
    ACCEPTANCE_TARGET_REVIEWED: "true",
    ACCEPTANCE_BACKEND_BASE_URL: config.backendBaseUrl,
    ACCEPTANCE_WEB_BASE_URL: config.webBaseUrl,
    ACCEPTANCE_CLERK_PUBLISHABLE_KEY: config.clerkPublishableKey,
    CLERK_PUBLISHABLE_KEY: config.clerkPublishableKey,
    ORG_GRADLE_PROJECT_CLERK_PUBLISHABLE_KEY: config.clerkPublishableKey,
  };
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "build-android.js"), task, ...gradleArgs],
    { cwd: repoRoot, env: childEnv, stdio: "inherit" }
  );

  if (result.error) {
    console.error("Could not start the Android build wrapper.");
    return 1;
  }
  return result.status ?? 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { validateAcceptanceConfig };
