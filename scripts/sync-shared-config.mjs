import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

export const sharedConfigPaths = [
  "webos/shared/app-config.json",
  "tizen/shared/app-config.json",
  "android-tv/app/src/main/assets/shared/app-config.json",
  "apple-tv/TVApp/Resources/shared/app-config.json"
];

export async function syncSharedConfig(projectRoot = root) {
  const source = path.join(projectRoot, "packages", "shared", "app-config.json");

  for (const relativePath of sharedConfigPaths) {
    const destination = path.join(projectRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    console.log(`Synced: ${path.relative(projectRoot, destination)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  await syncSharedConfig();
}
