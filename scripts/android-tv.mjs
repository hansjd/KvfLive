import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const androidDir = path.join(root, "android-tv");

const APP_ID = "com.kvflive.tv";
const MAIN_ACTIVITY = `${APP_ID}/.MainActivity`;
const APK_PATH = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function adb(args) {
  run("adb", args);
}

function gradle(task) {
  const gradlewPath = path.join(androidDir, "gradlew.bat");
  if (fs.existsSync(gradlewPath)) {
    run("cmd.exe", ["/c", gradlewPath, task], { cwd: androidDir });
    return;
  }

  const gradleProbe = spawnSync("gradle", ["-v"], {
    stdio: "ignore",
    shell: false,
    cwd: androidDir,
  });

  if (gradleProbe.status === 0) {
    run("gradle", [":app:" + task], { cwd: androidDir });
    return;
  }

  console.error("Gradle wrapper not found: " + gradlewPath);
  console.error("Global gradle command is also unavailable.");
  console.error("Run one-time setup:");
  console.error("  1) Install Gradle or Android Studio");
  console.error("  2) In android-tv folder run: gradle wrapper");
  console.error("  3) Re-run: npm run android:tv:build");
  process.exit(1);
}

function connectIfConfigured() {
  const host = process.env.ANDROID_TV_HOST;
  if (host) {
    adb(["connect", host]);
  }
}

function usage() {
  console.log("Usage: node scripts/android-tv.mjs <command>");
  console.log("Commands: connect, build, install, launch, run");
  console.log("Optional env: ANDROID_TV_HOST=192.168.x.x:5555");
}

const command = process.argv[2];

switch (command) {
  case "connect": {
    const host = process.env.ANDROID_TV_HOST;
    if (!host) {
      console.error("ANDROID_TV_HOST is required for connect. Example: 192.168.86.50:5555");
      process.exit(1);
    }
    adb(["connect", host]);
    adb(["devices"]);
    break;
  }

  case "build": {
    gradle("assembleDebug");
    break;
  }

  case "install": {
    connectIfConfigured();
    gradle("assembleDebug");
    adb(["install", "-r", APK_PATH]);
    break;
  }

  case "launch": {
    connectIfConfigured();
    adb(["shell", "am", "start", "-n", MAIN_ACTIVITY]);
    break;
  }

  case "run": {
    connectIfConfigured();
    gradle("assembleDebug");
    adb(["install", "-r", APK_PATH]);
    adb(["shell", "am", "start", "-n", MAIN_ACTIVITY]);
    break;
  }

  default:
    usage();
    process.exit(command ? 1 : 0);
}
