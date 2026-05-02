import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const candidates = [
  "https://kvf.fo/sites/default/files/kvf_logo.png",
  "https://kvf.fo/sites/default/files/logo.png",
  "https://kvf.fo/sites/all/themes/kvf/images/logo.png",
  "https://kvf.fo/themes/custom/kvf/logo.png",
  "https://kvf.fo/themes/kvf/images/logo.png",
  "https://www.kringvarp.fo/sites/default/files/kvf_logo.png",
];

const targets = [
  path.join(root, "webos", "icon.png"),
  path.join(root, "tizen", "icon.png"),
];

function download(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          resolve(download(res.headers.location));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

let downloaded = false;
for (const url of candidates) {
  try {
    process.stdout.write(`Trying ${url} ... `);
    const buf = await download(url);
    console.log(`OK (${buf.length} bytes)`);
    for (const target of targets) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buf);
      console.log(`Saved: ${path.relative(root, target)}`);
    }
    downloaded = true;
    break;
  } catch (e) {
    console.log(`failed: ${e.message}`);
  }
}

if (!downloaded) {
  console.error(
    "\nCould not auto-download the logo. Please save the image manually as:\n" +
    "  webos/icon.png\n" +
    "  tizen/icon.png\n" +
    "(Recommended size: 80x80 or 130x130 PNG)"
  );
  process.exit(1);
}
