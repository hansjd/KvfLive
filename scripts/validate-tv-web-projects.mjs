import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

import { sharedConfigPaths } from "./sync-shared-config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

async function readJson(projectRoot, relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw);
}

async function readXml(projectRoot, relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  return readFile(absolutePath, "utf8");
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function validateWebOS(projectRoot) {
  const appInfo = await readJson(projectRoot, "webos/appinfo.json");
  assertCondition(appInfo.id, "webOS: app id is required");
  assertCondition(appInfo.main === "index.html", "webOS: main must be index.html");
  console.log("webOS config validation passed");
}

async function validateTizen(projectRoot) {
  const xml = await readXml(projectRoot, "tizen/config.xml");
  assertCondition(xml.includes("<tizen:profile name=\"tv-samsung\"/>"), "Tizen: tv-samsung profile is required");
  assertCondition(xml.includes("<content src=\"index.html\"/>"), "Tizen: content source must be index.html");
  console.log("Tizen config validation passed");
}

export async function validateSharedConfigCopies(projectRoot = root) {
  const source = await readJson(projectRoot, "packages/shared/app-config.json");

  for (const relativePath of sharedConfigPaths) {
    const config = await readJson(projectRoot, relativePath);
    assert.deepStrictEqual(
      config,
      source,
      `Shared config copy does not match packages/shared/app-config.json: ${relativePath}`
    );
  }

  console.log("Shared config copies validation passed");
}

export async function validateTvProjects(projectRoot = root) {
  await validateWebOS(projectRoot);
  await validateTizen(projectRoot);
  await validateSharedConfigCopies(projectRoot);
  console.log("All TV project validations passed");
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await validateTvProjects();
}
