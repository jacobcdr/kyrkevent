import crypto from "node:crypto";
import { deflateSync } from "node:zlib";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUWXYZ2345689";

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  J: ["00111", "00001", "00001", "00001", "10001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "01010", "01010", "00100", "01010", "01010", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00110", "01010", "10010", "11111", "00010", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"]
};

const INK = [
  [51, 65, 85],
  [71, 85, 105],
  [30, 41, 59]
];

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const dest = y * (stride + 1);
    raw[dest] = 0;
    rgb.copy(raw, dest + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

const rand = (max) => crypto.randomInt(max);

export function createDemoCaptchaCode() {
  let code = "";
  for (let i = 0; i < 5; i += 1) code += ALPHABET[rand(ALPHABET.length)];
  return code;
}

export function normalizeCaptcha(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function captchaMatches(expected, given) {
  const a = normalizeCaptcha(expected);
  const b = normalizeCaptcha(given);
  if (!a || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function createDemoCaptchaPng(code) {
  const scale = 5;
  const glyphW = 5 * scale;
  const glyphH = 7 * scale;
  const gap = 16;
  const padX = 18;
  const padY = 18;
  const width = padX * 2 + code.length * glyphW + (code.length - 1) * gap;
  const height = padY * 2 + glyphH + 10;
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = 248;
    rgb[i + 1] = 250;
    rgb[i + 2] = 252;
  }
  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 3;
    rgb[i] = color[0];
    rgb[i + 1] = color[1];
    rgb[i + 2] = color[2];
  };

  for (let n = 0; n < 40; n += 1) {
    setPixel(rand(width), rand(height), [203, 213, 225]);
  }

  const chars = String(code || "").toUpperCase();
  for (let c = 0; c < chars.length; c += 1) {
    const rows = FONT[chars[c]];
    if (!rows) continue;
    const originX = padX + c * (glyphW + gap) + rand(5) - 2;
    const originY = padY + rand(7);
    const ink = INK[rand(INK.length)];
    const shear = rand(3) - 1;
    for (let row = 0; row < rows.length; row += 1) {
      for (let col = 0; col < rows[row].length; col += 1) {
        if (rows[row][col] !== "1") continue;
        const shearX = (row - 3) * shear;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            setPixel(originX + col * scale + dx + shearX, originY + row * scale + dy, ink);
          }
        }
      }
    }
  }

  const wave = [203, 213, 225];
  for (let x = 0; x < width; x += 1) {
    setPixel(x, 6 + Math.round(Math.sin(x / 10) * 2), wave);
  }

  return encodePng(width, height, rgb);
}
