#!/usr/bin/env node

/**
 * adb-install.js
 * Automatically finds the newly created APK and installs it to the connected ADB device.
 * 
 * Usage:
 *   node scripts/adb-install.js [options] [path/to/apk]
 *   npm run adb-install
 *   npm run adb-install -- --launch
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PACKAGE_NAME = 'com.ainotif';
const LAUNCH_ACTIVITY = 'com.ainotif/.ui.MainActivity';

// Format bytes into human readable string
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format relative time (e.g. "2 minutes ago")
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleString();
}

function readSdkDirFromLocalProperties() {
  const localPropertiesPath = path.join(PROJECT_ROOT, 'android', 'local.properties');
  if (!fs.existsSync(localPropertiesPath)) return null;

  try {
    const sdkLine = fs.readFileSync(localPropertiesPath, 'utf8')
      .split(/\r?\n/)
      .find(line => /^\s*sdk\.dir\s*=/.test(line));
    if (!sdkLine) return null;

    const rawPath = sdkLine.slice(sdkLine.indexOf('=') + 1).trim();
    return rawPath.replace(/\\(.)/g, '$1');
  } catch {
    return null;
  }
}

function isExecutableFile(filePath) {
  try {
    if (!fs.statSync(filePath).isFile()) return false;
    if (process.platform !== 'win32') fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Find ADB on PATH, in the configured Android SDK, or in the platform default.
function findAdb() {
  const executable = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const pathCandidates = (process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean)
    .map(dir => path.join(dir, executable));
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    readSdkDirFromLocalProperties(),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
    path.join(os.homedir(), 'Android', 'sdk'),
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
    '/opt/android-sdk',
    '/usr/lib/android-sdk',
  ].filter(Boolean);
  const sdkCandidates = sdkRoots.map(root => path.join(root, 'platform-tools', executable));
  const candidates = [...pathCandidates, ...sdkCandidates, '/usr/bin/adb'];

  return candidates.find(isExecutableFile) || null;
}

// Get connected ADB devices
function getConnectedDevices(adb) {
  try {
    const output = execFileSync(adb, ['devices', '-l'], { encoding: 'utf-8' });
    const lines = output.split('\n');
    const devices = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(/\s+/);
      const serial = parts[0];
      const state = parts[1];

      // Extract details like model:XXX, product:XXX
      const details = {};
      for (let j = 2; j < parts.length; j++) {
        const [k, v] = parts[j].split(':');
        if (k && v) details[k] = v;
      }

      devices.push({
        serial,
        state,
        model: details.model || details.device || serial,
        product: details.product || '',
        raw: line
      });
    }

    return devices;
  } catch (err) {
    console.error(`❌ Failed to run "${adb} devices":`, err.message);
    process.exit(1);
  }
}

// Find all APK files in the project and return the newest one
function findLatestApk(explicitPath) {
  if (explicitPath) {
    const fullPath = path.resolve(process.cwd(), explicitPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Specified APK file does not exist: ${fullPath}`);
      process.exit(1);
    }
    const stat = fs.statSync(fullPath);
    return { path: fullPath, stat };
  }

  const apkFiles = [];

  function scanDir(dir, depth = 0) {
    if (depth > 6) return;
    if (!fs.existsSync(dir)) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip irrelevant directories
        if (['node_modules', '.git', '.gradle', '.open-next', 'intermediates', 'tmp', 'cache'].includes(entry.name)) {
          continue;
        }
        scanDir(full, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.apk')) {
        try {
          const stat = fs.statSync(full);
          apkFiles.push({ path: full, stat });
        } catch {
          // ignore stat errors
        }
      }
    }
  }

  // Scan target directories first
  scanDir(path.join(PROJECT_ROOT, 'android', 'app', 'build', 'outputs', 'apk'));
  scanDir(PROJECT_ROOT, 0); // Scans root and immediate subdirs

  if (apkFiles.length === 0) {
    return null;
  }

  // Sort descending by mtimeMs (newest first)
  apkFiles.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  return apkFiles[0];
}

async function main() {
  const args = process.argv.slice(2);
  const flags = {
    launch: args.includes('--launch') || args.includes('-l'),
    launchOnly: args.includes('--launch-only'),
    devicesOnly: args.includes('--devices') || args.includes('-d'),
    explicitApk: args.find(a => !a.startsWith('-') && a.endsWith('.apk')),
    targetDevice: (args.find(a => a.startsWith('--device=')) || '').replace('--device=', '') || process.env.ANDROID_SERIAL
  };

  const adb = findAdb();
  if (!adb) {
    console.error('❌ Android Debug Bridge (adb) was not found. Install Android SDK Platform-Tools or set ANDROID_HOME/ANDROID_SDK_ROOT.');
    console.error('   This installer also checks android/local.properties and the standard macOS SDK location.');
    process.exit(1);
  }

  // If user just wants device list
  const devices = getConnectedDevices(adb);

  if (flags.devicesOnly) {
    console.log('\n📱 Connected ADB Devices:');
    if (devices.length === 0) {
      console.log('  No devices found.');
    } else {
      devices.forEach(d => console.log(`  • ${d.serial} [${d.state}] (${d.model})`));
    }
    return;
  }

  // Verify devices
  const activeDevices = devices.filter(d => d.state === 'device');

  if (devices.length === 0) {
    console.error('\n❌ No Android devices found.');
    console.error('\nTroubleshooting:');
    console.error('  1. Connect your Android phone via USB or WiFi debugging.');
    console.error('  2. Enable "Developer Options" and "USB Debugging" on your phone.');
    console.error('  3. Run `adb devices` in your terminal to verify connection.\n');
    process.exit(1);
  }

  if (activeDevices.length === 0) {
    console.error('\n⚠️ Android device detected, but not ready:');
    devices.forEach(d => {
      if (d.state === 'unauthorized') {
        console.error(`  • ${d.serial}: UNAUTHORIZED -> Check phone screen and tap "Allow USB debugging".`);
      } else if (d.state === 'offline') {
        console.error(`  • ${d.serial}: OFFLINE -> Reconnect USB cable or run: adb kill-server && adb start-server`);
      } else {
        console.error(`  • ${d.serial}: State is "${d.state}"`);
      }
    });
    console.error('');
    process.exit(1);
  }

  let selectedDevice = activeDevices[0];
  if (flags.targetDevice) {
    const match = activeDevices.find(d => d.serial === flags.targetDevice || d.model === flags.targetDevice);
    if (!match) {
      console.error(`❌ Specified device "${flags.targetDevice}" not found among active devices.`);
      console.error('Available active devices:');
      activeDevices.forEach(d => console.error(`  • ${d.serial} (${d.model})`));
      process.exit(1);
    }
    selectedDevice = match;
  } else if (activeDevices.length > 1) {
    console.log(`ℹ️ Multiple devices attached. Targeting first active device: ${selectedDevice.model} (${selectedDevice.serial})`);
    console.log('   (Tip: target a specific device using --device=<serial> or ANDROID_SERIAL=<serial>)\n');
  }

  // Launch only mode
  if (flags.launchOnly) {
    console.log(`🚀 Launching ${PACKAGE_NAME} on ${selectedDevice.model} (${selectedDevice.serial})...`);
    try {
      execFileSync(adb, ['-s', selectedDevice.serial, 'shell', 'am', 'start', '-n', LAUNCH_ACTIVITY], { stdio: 'inherit' });
      console.log('✅ App launched successfully.');
    } catch (err) {
      console.error('❌ Failed to launch app:', err.message);
      process.exit(1);
    }
    return;
  }

  // Find newest APK
  const latestApk = findLatestApk(flags.explicitApk);
  if (!latestApk) {
    console.error('\n❌ No APK files found in this workspace.');
    console.error('\nPlease assemble an APK first:');
    console.error('  • Run: npm run build:apk');
    console.error('  • Or:  cd android && ./gradlew assembleDebug\n');
    process.exit(1);
  }

  const relativeApkPath = path.relative(PROJECT_ROOT, latestApk.path);
  const apkSizeStr = formatBytes(latestApk.stat.size);
  const apkTimeAgo = formatTimeAgo(latestApk.stat.mtime);

  // Sync to root notifai-debug.apk and ainotif-debug.apk if this APK is the newly built gradle debug artifact
  const rootNotifAiApk = path.join(PROJECT_ROOT, 'notifai-debug.apk');
  const rootAiNotifApk = path.join(PROJECT_ROOT, 'ainotif-debug.apk');
  if (latestApk.path !== rootNotifAiApk && latestApk.path !== rootAiNotifApk && latestApk.path.includes(path.join('android', 'app', 'build'))) {
    try {
      fs.copyFileSync(latestApk.path, rootNotifAiApk);
      fs.copyFileSync(latestApk.path, rootAiNotifApk);
    } catch {
      // ignore
    }
  }

  console.log('\n==========================================================');
  console.log('📱 NotifAi ADB Installer');
  console.log('==========================================================');
  console.log(`  Device:     ${selectedDevice.model} (${selectedDevice.serial})`);
  console.log(`  APK:        ${relativeApkPath}`);
  console.log(`  Size:       ${apkSizeStr}`);
  console.log(`  Modified:   ${apkTimeAgo} (${latestApk.stat.mtime.toLocaleTimeString()})`);
  console.log('----------------------------------------------------------');
  console.log('⏳ Installing APK to device (with -r -d -t flags)...');

  const startTime = Date.now();

  const adbArgs = ['-s', selectedDevice.serial, 'install', '-r', '-d', '-t', latestApk.path];
  const installProcess = spawn(adb, adbArgs, { stdio: 'inherit' });

  installProcess.on('close', (code) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('----------------------------------------------------------');
    if (code === 0) {
      console.log(`✅ Successfully installed in ${duration}s to ${selectedDevice.model}!`);

      if (flags.launch) {
        console.log(`🚀 Launching ${PACKAGE_NAME}...`);
        try {
          execFileSync(adb, ['-s', selectedDevice.serial, 'shell', 'am', 'start', '-n', LAUNCH_ACTIVITY], { stdio: 'inherit' });
        } catch (e) {
          console.error('⚠️ Could not automatically launch app:', e.message);
        }
      } else {
        console.log(`💡 Tip: Run 'npm run adb-install -- --launch' to auto-launch after installing.`);
      }
      console.log('==========================================================\n');
      process.exit(0);
    } else {
      console.error(`❌ ADB install failed with exit code ${code}.`);
      console.error('\nCommon fixes:');
      console.error('  • If you see INSTALL_FAILED_UPDATE_INCOMPATIBLE: uninstall the previous app first with:');
      console.error(`      ${adb} -s ${selectedDevice.serial} uninstall ${PACKAGE_NAME}`);
      console.error('  • If you see INSTALL_FAILED_INSUFFICIENT_STORAGE: free up device storage.');
      console.error('==========================================================\n');
      process.exit(code || 1);
    }
  });
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
