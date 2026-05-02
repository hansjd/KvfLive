import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SIZE = 130;

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
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
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
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
    id: "d",
    draw: function (x, y, nx, ny) {
      // D: sunrise arc + play beam
      const top = { r: 6, g: 20, b: 36 };
      const bot = { r: 18, g: 58, b: 87 };
      let c = {
        r: clamp(lerp(top.r, bot.r, ny)),
        g: clamp(lerp(top.g, bot.g, ny)),
        b: clamp(lerp(top.b, bot.b, ny)),
      };

      const cx = 65;
      const cy = 78;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 30 && d < 40 && y < cy + 4) {
        c = { r: 255, g: 199, b: 97 };
      }
      if (d > 42 && d < 46 && y < cy + 2) {
        c = { r: 255, g: 125, b: 87 };
      }

      const beam = distToSegment(x, y, 40, 75, 102, 52) < 6;
      if (beam) c = { r: 191, g: 246, b: 255 };

      const tip = (x - 101) * (x - 101) + (y - 52) * (y - 52) < 26;
      if (tip) c = { r: 255, g: 255, b: 255 };

      return c;
    },
  },
  {
    id: "e",
    draw: function (x, y, nx, ny) {
      // E: rounded square glyph with split-tone "K"
      const bg1 = { r: 19, g: 16, b: 32 };
      const bg2 = { r: 40, g: 28, b: 61 };
      let c = {
        r: clamp(lerp(bg1.r, bg2.r, ny)),
        g: clamp(lerp(bg1.g, bg2.g, ny)),
        b: clamp(lerp(bg1.b, bg2.b, ny)),
      };

      // Rounded card.
      const rx = x - 65;
      const ry = y - 65;
      const inCard = Math.abs(rx) < 46 && Math.abs(ry) < 46;
      const corner = Math.abs(rx) > 38 && Math.abs(ry) > 38;
      const cornerDx = Math.abs(rx) - 38;
      const cornerDy = Math.abs(ry) - 38;
      const roundPass = !corner || (cornerDx * cornerDx + cornerDy * cornerDy <= 64);
      if (inCard && roundPass) {
        c = { r: 242, g: 246, b: 255 };
      }

      const inStem = x >= 43 && x <= 53 && y >= 35 && y <= 95;
      const inArm1 = distToSegment(x, y, 52, 66, 84, 40) <= 4.8;
      const inArm2 = distToSegment(x, y, 52, 66, 84, 91) <= 4.8;
      if (inStem) c = { r: 34, g: 54, b: 89 };
      if (inArm1 || inArm2) c = { r: 44, g: 145, b: 255 };

      const liveDot = (x - 88) * (x - 88) + (y - 35) * (y - 35) < 18;
      if (liveDot) c = { r: 255, g: 86, b: 105 };

      return c;
    },
  },
  {
    id: "f",
    draw: function (x, y, nx, ny) {
      // F: wave signal + center play chevron
      const top = { r: 7, g: 33, b: 32 };
      const bot = { r: 13, g: 73, b: 67 };
      let c = {
        r: clamp(lerp(top.r, bot.r, ny)),
        g: clamp(lerp(top.g, bot.g, ny)),
        b: clamp(lerp(top.b, bot.b, ny)),
      };

      const cx = 50;
      const cy = 64;
      const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
      if (d > 10 && d < 14) c = { r: 145, g: 255, b: 228 };
      if (d > 20 && d < 24) c = { r: 88, g: 237, b: 214 };
      if (d > 30 && d < 34) c = { r: 52, g: 198, b: 184 };

      const inChevron = x > 58 && x < 96 && Math.abs(y - 65) < (x - 58) * 0.55;
      if (inChevron) c = { r: 239, g: 252, b: 255 };

      const cut = x > 70 && x < 88 && Math.abs(y - 65) < (x - 70) * 0.4;
      if (cut) {
        c = {
          r: clamp(lerp(top.r, bot.r, ny) + 12),
          g: clamp(lerp(top.g, bot.g, ny) + 8),
          b: clamp(lerp(top.b, bot.b, ny) + 8),
        };
      }

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
