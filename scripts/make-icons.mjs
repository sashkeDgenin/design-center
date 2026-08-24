/**
 * Generates the PWA icons as real PNG files, with no image dependency.
 *
 * The mark is a lead list: three rows, each a checkbox and a bar, with the top row
 * highlighted the way a blocked lead is highlighted in the app.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const INK = [0x16, 0x18, 0x1d];
const WHITE = [0xff, 0xff, 0xff];
const RED = [0xd9, 0x2d, 0x20];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function draw(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };

  // Maskable icons get cropped to a circle by the OS, so they need a full bleed
  // background and the mark pulled into the safe zone.
  const radius = maskable ? 0 : size * 0.22;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inCorner =
        (x < radius && y < radius && (x - radius) ** 2 + (y - radius) ** 2 > radius ** 2) ||
        (x > size - radius && y < radius && (x - (size - radius)) ** 2 + (y - radius) ** 2 > radius ** 2) ||
        (x < radius && y > size - radius && (x - radius) ** 2 + (y - (size - radius)) ** 2 > radius ** 2) ||
        (x > size - radius && y > size - radius && (x - (size - radius)) ** 2 + (y - (size - radius)) ** 2 > radius ** 2);
      if (!inCorner) set(x, y, INK);
    }
  }

  const inset = maskable ? size * 0.3 : size * 0.22;
  const rowGap = (size - inset * 2) / 3;
  const boxSize = rowGap * 0.5;
  const barHeight = boxSize * 0.62;

  for (let row = 0; row < 3; row += 1) {
    const top = Math.round(inset + row * rowGap);
    const color = row === 0 ? RED : WHITE;
    // checkbox
    for (let y = top; y < top + boxSize; y += 1) {
      for (let x = Math.round(inset); x < inset + boxSize; x += 1) set(x, y, color);
    }
    // bar, shorter on each row so it reads as a list rather than a grid
    const barStart = Math.round(inset + boxSize * 1.5);
    const barEnd = Math.round(size - inset - row * (size * 0.06));
    const barTop = Math.round(top + (boxSize - barHeight) / 2);
    for (let y = barTop; y < barTop + barHeight; y += 1) {
      for (let x = barStart; x < barEnd; x += 1) set(x, y, color, row === 0 ? 255 : 190);
    }
  }
  return px;
}

mkdirSync("public/icons", { recursive: true });
const targets = [
  ["public/icons/icon-192.png", 192, { maskable: false }],
  ["public/icons/icon-512.png", 512, { maskable: false }],
  ["public/icons/icon-maskable.png", 512, { maskable: true }],
  ["public/icons/apple-touch-icon.png", 180, { maskable: false }],
];
for (const [path, size, opts] of targets) {
  writeFileSync(path, png(size, draw(size, opts)));
  console.log(`wrote ${path} (${size}x${size})`);
}
