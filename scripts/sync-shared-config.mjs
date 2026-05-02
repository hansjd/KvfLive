import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const source = path.join(root, "packages", "shared", "app-config.json");

const destinations = [
  path.join(root, "webos", "shared", "app-config.json"),
  path.join(root, "tizen", "shared", "app-config.json"),
  path.join(root, "android-tv", "app", "src", "main", "assets", "shared", "app-config.json"),
  path.join(root, "apple-tv", "TVApp", "Resources", "shared", "app-config.json")
];

for (const destination of destinations) {
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  console.log(`Synced: ${path.relative(root, destination)}`);
}
