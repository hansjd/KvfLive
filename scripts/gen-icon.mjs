/**
 * Generates a 130x130 PNG icon with an original abstract "K" mark.
 * Design is intentionally custom and does not reuse third-party logo artwork.
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SIZE = 130;

const BG_TOP = { r: 0x06, g: 0x1B, b: 0x2E };
const BG_BOTTOM = { r: 0x09, g: 0x3A, b: 0x57 };
const STRIPE = { r: 0x0F, g: 0x56, b: 0x78 };
const K_STEM = { r: 0xF5, g: 0xF8, b: 0xFC };
const K_ARMS = { r: 0x2F, g: 0xD0, b: 0xFF };

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  var dx = x2 - x1;
  var dy = y2 - y1;
  var l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    var ox = px - x1;
    var oy = py - y1;
    return Math.sqrt(ox * ox + oy * oy);
  }
  var t = ((px - x1) * dx + (py - y1) * dy) / l2;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  var projX = x1 + t * dx;
  var projY = y1 + t * dy;
  var sx = px - projX;
  var sy = py - projY;
  return Math.sqrt(sx * sx + sy * sy);
}

// Build raw scanlines: 1 filter byte + SIZE*3 RGB bytes per row
const raw = Buffer.alloc(SIZE * (1 + SIZE * 3), 0);
for (let y = 0; y < SIZE; y++) {
  const off = y * (1 + SIZE * 3);
  raw[off] = 0; // filter: None
  for (let x = 0; x < SIZE; x++) {
    const nx = x / (SIZE - 1);
    const ny = y / (SIZE - 1);

    // Base vertical gradient.
    const c = {
      r: lerp(BG_TOP.r, BG_BOTTOM.r, ny),
      g: lerp(BG_TOP.g, BG_BOTTOM.g, ny),
      b: lerp(BG_TOP.b, BG_BOTTOM.b, ny),
    };

    // Diagonal accent stripe.
    if (x > (y * 0.9 + 34) && x < (y * 0.9 + 52)) {
      c.r = STRIPE.r;
      c.g = STRIPE.g;
      c.b = STRIPE.b;
    }

    // Original abstract K mark: one stem + two diagonal arms.
    const inStem = x >= 34 && x <= 46 && y >= 24 && y <= 106;
    const inUpperArm = distToSegment(x + 0.5, y + 0.5, 45, 65, 94, 30) <= 5.5;
    const inLowerArm = distToSegment(x + 0.5, y + 0.5, 45, 65, 94, 100) <= 5.5;

    if (inStem) {
      c.r = K_STEM.r;
      c.g = K_STEM.g;
      c.b = K_STEM.b;
    } else if (inUpperArm || inLowerArm) {
      c.r = K_ARMS.r;
      c.g = K_ARMS.g;
      c.b = K_ARMS.b;
    }

    // Small "live" pulse dot to reinforce app purpose.
    const dotDx = nx - 0.78;
    const dotDy = ny - 0.25;
    if ((dotDx * dotDx + dotDy * dotDy) < 0.0032) {
      c.r = 0xFF;
      c.g = 0x59;
      c.b = 0x59;
    }

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
