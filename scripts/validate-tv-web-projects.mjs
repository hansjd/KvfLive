import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

async function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw);
}

async function readXml(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return readFile(absolutePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function validateWebOS() {
  const appInfo = await readJson("webos/appinfo.json");
  assert(appInfo.id, "webOS: app id is required");
  assert(appInfo.main === "index.html", "webOS: main must be index.html");
  console.log("webOS config validation passed");
}

async function validateTizen() {
  const xml = await readXml("tizen/config.xml");
  assert(xml.includes("<tizen:profile name=\"tv-samsung\"/>"), "Tizen: tv-samsung profile is required");
  assert(xml.includes("<content src=\"index.html\"/>"), "Tizen: content source must be index.html");
  console.log("Tizen config validation passed");
}

async function validateSharedConfigCopies() {
  const checks = [
    "webos/shared/app-config.json",
    "tizen/shared/app-config.json",
    "android-tv/app/src/main/assets/shared/app-config.json",
    "apple-tv/TVApp/Resources/shared/app-config.json"
  ];

  for (const file of checks) {
    await readJson(file);
  }

  console.log("Shared config copies validation passed");
}

await validateWebOS();
await validateTizen();
await validateSharedConfigCopies();
console.log("All TV project validations passed");
