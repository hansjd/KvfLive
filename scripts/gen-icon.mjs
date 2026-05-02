/**
 * Generates a 130×130 PNG icon: red background + white play triangle.
 * No external dependencies — uses Node built-ins only.
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SIZE = 130;
const BG   = { r: 0xCC, g: 0x00, b: 0x00 }; // KVF red
const FG   = { r: 0xFF, g: 0xFF, b: 0xFF }; // white

const cx = SIZE / 2;
const cy = SIZE / 2;

// Play-triangle vertices (pointing right, centred)
const triW = SIZE * 0.38;
const triH = SIZE * 0.44;
const t = [
  { x: cx - triW * 0.45, y: cy - triH / 2 },
  { x: cx - triW * 0.45, y: cy + triH / 2 },
  { x: cx + triW * 0.55, y: cy },
];

function sign(p1, p2, p3) {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}
function inTriangle(px, py) {
  const pt = { x: px, y: py };
  const d1 = sign(pt, t[0], t[1]);
  const d2 = sign(pt, t[1], t[2]);
  const d3 = sign(pt, t[2], t[0]);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

// Build raw scanlines: 1 filter byte + SIZE*3 RGB bytes per row
const raw = Buffer.alloc(SIZE * (1 + SIZE * 3), 0);
for (let y = 0; y < SIZE; y++) {
  const off = y * (1 + SIZE * 3);
  raw[off] = 0; // filter: None
  for (let x = 0; x < SIZE; x++) {
    const inside = inTriangle(x + 0.5, y + 0.5);
    const c = inside ? FG : BG;
    raw[off + 1 + x * 3]     = c.r;
    raw[off + 1 + x * 3 + 1] = c.g;
    raw[off + 1 + x * 3 + 2] = c.b;
  }
}

const compressed = zlib.deflateSync(raw);

// ── CRC-32 ──────────────────────────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcVal  = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcVal]);
}

// ── IHDR ─────────────────────────────────────────────────────────────────────
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8-bit depth, RGB color type

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
  pngChunk("IHDR", ihdr),
  pngChunk("IDAT", compressed),
  pngChunk("IEND", Buffer.alloc(0)),
]);

const targets = [
  path.join(root, "webos", "icon.png"),
  path.join(root, "tizen", "icon.png"),
];

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, png);
  console.log("Wrote", path.relative(root, target), `(${png.length} bytes)`);
}
