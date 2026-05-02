import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SIZE = 130;

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  let dx = x2 - x1;
  let dy = y2 - y1;
  let l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    let ox = px - x1;
    let oy = py - y1;
    return Math.sqrt(ox * ox + oy * oy);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  let projX = x1 + t * dx;
  let projY = y1 + t * dy;
  let sx = px - projX;
  let sy = py - projY;
  return Math.sqrt(sx * sx + sy * sy);
}

function crc32Table() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
}

const CRC_TABLE = crc32Table();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcVal]);
}

function writePng(raw, outPath) {
  const compressed = zlib.deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  return png.length;
}

const variants = [
  {
    id: "a",
    draw: function (x, y, nx, ny) {
      // Variant A: diagonal "K" beam
      const top = { r: 0x10, g: 0x19, b: 0x2B };
      const bot = { r: 0x1A, g: 0x3F, b: 0x63 };
      const stem = { r: 0xF1, g: 0xF6, b: 0xFF };
      const arms = { r: 0x4E, g: 0xE3, b: 0xFF };

      let c = {
        r: lerp(top.r, bot.r, ny),
        g: lerp(top.g, bot.g, ny),
        b: lerp(top.b, bot.b, ny),
      };

      const inStem = x >= 30 && x <= 44 && y >= 18 && y <= 112;
      const inUpper = distToSegment(x, y, 43, 64, 98, 24) <= 6;
      const inLower = distToSegment(x, y, 43, 64, 98, 106) <= 6;
      if (inStem) c = stem;
      else if (inUpper || inLower) c = arms;

      const dotDx = nx - 0.8;
      const dotDy = ny - 0.22;
      if (dotDx * dotDx + dotDy * dotDy < 0.0032) c = { r: 0xFF, g: 0x6A, b: 0x5B };
      return c;
    },
  },
  {
    id: "b",
    draw: function (x, y, nx, ny) {
      // Variant B: circular signal ring + play cutout
      const bg = { r: 0x0E, g: 0x2E, b: 0x2D };
      const grad = { r: 0x1B, g: 0x56, b: 0x54 };
      let c = {
        r: lerp(bg.r, grad.r, ny),
        g: lerp(bg.g, grad.g, ny),
        b: lerp(bg.b, grad.b, ny),
      };

      const cx = 65;
      const cy = 65;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 28 && d < 44) c = { r: 0xD9, g: 0xFF, b: 0xF8 };
      if (d > 34 && d < 38) c = { r: 0x32, g: 0xD4, b: 0xB2 };

      const inPlay = x > 56 && x < 86 && y > 46 && y < 84 && (x - 56) > Math.abs(y - 65) * 0.9;
      if (inPlay) c = { r: 0x0A, g: 0x1E, b: 0x1E };

      const pulseDx = nx - 0.22;
      const pulseDy = ny - 0.26;
      if (pulseDx * pulseDx + pulseDy * pulseDy < 0.0044) c = { r: 0xFF, g: 0x87, b: 0x6E };
      return c;
    },
  },
  {
    id: "c",
    draw: function (x, y, nx, ny) {
      // Variant C: clean monogram blocks
      const top = { r: 0x1F, g: 0x14, b: 0x2E };
      const bot = { r: 0x43, g: 0x21, b: 0x52 };
      let c = {
        r: lerp(top.r, bot.r, ny),
        g: lerp(top.g, bot.g, ny),
        b: lerp(top.b, bot.b, ny),
      };

      // Subtle checker texture
      if (((x >> 3) + (y >> 3)) % 2 === 0) {
        c = { r: c.r + 6, g: c.g + 6, b: c.b + 6 };
      }

      const white = { r: 0xFF, g: 0xFF, b: 0xFF };
      const cyan = { r: 0x7D, g: 0xE7, b: 0xFF };

      const inLeft = x >= 26 && x <= 42 && y >= 22 && y <= 108;
      const inMid = x >= 42 && x <= 58 && y >= 56 && y <= 74;
      const inDiag1 = distToSegment(x, y, 56, 65, 98, 28) <= 6;
      const inDiag2 = distToSegment(x, y, 56, 65, 98, 102) <= 6;

      if (inLeft || inMid) c = white;
      else if (inDiag1 || inDiag2) c = cyan;

      const liveBar = y >= 100 && y <= 108 && x >= 76 && x <= 108;
      if (liveBar) c = { r: 0xFF, g: 0x63, b: 0x8A };
      return c;
    },
  },
];

for (const variant of variants) {
  const raw = Buffer.alloc(SIZE * (1 + SIZE * 3), 0);
  for (let y = 0; y < SIZE; y++) {
    const off = y * (1 + SIZE * 3);
    raw[off] = 0;
    for (let x = 0; x < SIZE; x++) {
      const c = variant.draw(x + 0.5, y + 0.5, x / (SIZE - 1), y / (SIZE - 1));
      raw[off + 1 + x * 3] = c.r;
      raw[off + 1 + x * 3 + 1] = c.g;
      raw[off + 1 + x * 3 + 2] = c.b;
    }
  }

  const webosOut = path.join(root, "webos", `icon-variant-${variant.id}.png`);
  const tizenOut = path.join(root, "tizen", `icon-variant-${variant.id}.png`);
  const s1 = writePng(raw, webosOut);
  const s2 = writePng(raw, tizenOut);
  console.log(`Wrote webos/icon-variant-${variant.id}.png (${s1} bytes)`);
  console.log(`Wrote tizen/icon-variant-${variant.id}.png (${s2} bytes)`);
}
