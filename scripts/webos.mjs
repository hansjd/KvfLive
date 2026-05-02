import { readdir, access, writeFile, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const webosDir = path.join(root, "webos");
const appId = "com.kvflive.webos";

const command = process.argv[2] ?? "run";

function readDeviceArg(args) {
  const direct = args.find((a) => a.startsWith("--device="));
  if (direct) {
    return direct.slice("--device=".length).trim();
  }

  const index = args.indexOf("--device");
  if (index >= 0 && args[index + 1]) {
    return String(args[index + 1]).trim();
  }

  return "";
}

const rawArgs = process.argv.slice(3);
const argDevice = readDeviceArg(rawArgs);
const device = argDevice || process.env.WEBOS_DEVICE || "";

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function requireDevice() {
  if (!device) {
    console.error("Missing device. Use one of:");
    console.error("  1) PowerShell: $env:WEBOS_DEVICE=\"kvf-tv\"");
    console.error("  2) npm run webos:run -- --device kvf-tv");
    process.exit(1);
  }
}

async function findLatestIpk() {
  const files = await readdir(webosDir, { withFileTypes: true });
  const ipks = files
    .filter((f) => f.isFile() && f.name.toLowerCase().endsWith(".ipk"))
    .map((f) => path.join(webosDir, f.name));

  if (ipks.length === 0) {
    console.error("No .ipk found. Run package first.");
    process.exit(1);
  }

  ipks.sort();
  return ipks[ipks.length - 1];
}

function syncShared() {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  run(npmCmd, ["run", "sync:shared"], root);
}

async function ensureIcon() {
  const iconPath = path.join(webosDir, "icon.png");
  try {
    await access(iconPath);
  } catch {
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBAAZ/qn8AAAAASUVORK5CYII=";
    await writeFile(iconPath, Buffer.from(pngBase64, "base64"));
    console.log("Created placeholder webOS icon: webos/icon.png");
  }
}

async function ensureHlsJs() {
  const dest = path.join(webosDir, "lib", "hls.min.js");
  const src = path.join(root, "node_modules", "hls.js", "dist", "hls.min.js");
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
}

async function packageApp() {
  syncShared();
  await ensureIcon();
  await ensureHlsJs();
  run("ares-package", ["."], webosDir);
}

async function installApp() {
  requireDevice();
  const ipk = await findLatestIpk();
  run("ares-install", ["--device", device, ipk], webosDir);
}

async function launchApp() {
  requireDevice();
  run("ares-launch", ["--device", device, appId], webosDir);
}

async function streamLogs() {
  requireDevice();
  run("ares-log", ["--device", device, appId], webosDir);
}

switch (command) {
  case "package":
    await packageApp();
    break;
  case "install":
    await installApp();
    break;
  case "launch":
    await launchApp();
    break;
  case "run":
    await packageApp();
    await installApp();
    await launchApp();
    break;
  case "logs":
    await streamLogs();
    break;
  default:
    console.error("Unknown command. Use: package | install | launch | run | logs");
    process.exit(1);
}
