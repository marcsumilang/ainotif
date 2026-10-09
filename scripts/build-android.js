"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const androidDir = path.join(repoRoot, "android");
const [task, ...gradleArgs] = process.argv.slice(2);

if (!task) {
  console.error("Usage: node scripts/build-android.js <Gradle task> [Gradle arguments...]");
  process.exit(2);
}

function parseValue(rawValue) {
  const value = rawValue.trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  return value.replace(/\s+#.*$/, "").trim();
}

function readConfigValue(filePath, keys) {
  if (!fs.existsSync(filePath)) return undefined;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^(?:export\s+)?(?:org\.gradle\.project\.)?([A-Za-z_][A-Za-z\d_]*)\s*=\s*(.*)$/);
    if (match && keys.includes(match[1])) {
      return parseValue(match[2]);
    }
  }

  return undefined;
}

function readGradleArgumentValue(args) {
  for (const arg of args) {
    const match = arg.match(/^-P(?:org\.gradle\.project\.)?CLERK_PUBLISHABLE_KEY=(.*)$/);
    if (match) return parseValue(match[1]);
  }
  return undefined;
}

const envFilePath = path.join(repoRoot, "web", ".env.local");
const gradlePropertyFiles = [
  path.join(androidDir, "gradle.properties"),
  path.join(os.homedir(), ".gradle", "gradle.properties"),
];
const userGradlePropertyKey = readConfigValue(
  gradlePropertyFiles[1],
  ["CLERK_PUBLISHABLE_KEY"]
);
const projectGradlePropertyKey = readConfigValue(
  gradlePropertyFiles[0],
  ["CLERK_PUBLISHABLE_KEY"]
);
const envFileKey = readConfigValue(envFilePath, ["CLERK_PUBLISHABLE_KEY"]);
const publicWebKey = readConfigValue(envFilePath, ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]);

// The environment and Gradle properties take precedence. The web env file is
// only a fallback so the standard root APK scripts use the existing local key.
const keyFromBuildArgs = readGradleArgumentValue(gradleArgs);
if (keyFromBuildArgs !== undefined && !keyFromBuildArgs.trim()) {
  console.error("CLERK_PUBLISHABLE_KEY was explicitly set to an empty Gradle property.");
  process.exit(1);
}
if (
  [userGradlePropertyKey, projectGradlePropertyKey].some(
    (value) => value !== undefined && !value.trim()
  )
) {
  console.error("CLERK_PUBLISHABLE_KEY is empty in Gradle properties.");
  process.exit(1);
}
const keyCandidates = [
  keyFromBuildArgs,
  process.env.ORG_GRADLE_PROJECT_CLERK_PUBLISHABLE_KEY?.trim(),
  userGradlePropertyKey,
  projectGradlePropertyKey,
  process.env.CLERK_PUBLISHABLE_KEY?.trim(),
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
  envFileKey,
  publicWebKey,
];
const configuredKey = keyCandidates.find((value) => value?.trim());

if (!configuredKey || !/^pk_(test|live)_/.test(configuredKey)) {
  console.error(
    "Android sign-in needs a Clerk publishable key (pk_test_… or pk_live_…). Set CLERK_PUBLISHABLE_KEY or configure it in Gradle properties or web/.env.local."
  );
  process.exit(1);
}

const childEnv = { ...process.env, CLERK_PUBLISHABLE_KEY: configuredKey };
const result = spawnSync("./gradlew", [task, ...gradleArgs], {
  cwd: androidDir,
  env: childEnv,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Could not start Gradle: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (task === "assembleDebug") {
  const apkPath = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  if (!fs.existsSync(apkPath)) {
    console.error("Gradle succeeded but the debug APK was not found at the expected path.");
    process.exit(1);
  }
  for (const outputName of ["ainotif-debug.apk", "notifai-debug.apk"]) {
    fs.copyFileSync(apkPath, path.join(repoRoot, outputName));
  }
}
