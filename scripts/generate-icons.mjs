import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(width, height, drawFn) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

// Draw a neon retro spaceship on deep space canvas
function drawArcadeIcon(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background
  const maxR = w * (isMaskable ? 0.72 : 0.46);
  if (!isMaskable && dist > maxR) {
    return [0, 0, 0, 0]; // Transparent outer border for standard
  }

  // Deep space vignette
  const bgGrad = Math.min(1, dist / (w * 0.5));
  let r = Math.floor(10 + bgGrad * 6);
  let g = Math.floor(14 + bgGrad * 8);
  let b = Math.floor(28 + bgGrad * 15);
  let a = 255;

  // Outer neon ring
  const ringDist = Math.abs(dist - (w * 0.42));
  if (ringDist < 3) {
    return [56, 189, 248, 255]; // Cyan neon ring
  }

  // Draw ship triangle (vector lines)
  // Tip: (cx, cy - h*0.22)
  // Left: (cx - w*0.18, cy + h*0.18)
  // Center indent: (cx, cy + h*0.11)
  // Right: (cx + w*0.18, cy + h*0.18)
  const tipX = cx, tipY = cy - h * 0.22;
  const leftX = cx - w * 0.18, leftY = cy + h * 0.18;
  const rightX = cx + w * 0.18, rightY = cy + h * 0.18;
  const inX = cx, inY = cy + h * 0.11;

  function distToSeg(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  const d1 = distToSeg(x, y, tipX, tipY, leftX, leftY);
  const d2 = distToSeg(x, y, leftX, leftY, inX, inY);
  const d3 = distToSeg(x, y, inX, inY, rightX, rightY);
  const d4 = distToSeg(x, y, rightX, rightY, tipX, tipY);
  const minShipD = Math.min(d1, d2, d3, d4);

  const strokeW = Math.max(2, w * 0.015);
  if (minShipD < strokeW) {
    return [56, 189, 248, 255]; // Bright cyan
  } else if (minShipD < strokeW * 2.8) {
    // Glow
    const glow = (1 - (minShipD - strokeW) / (strokeW * 1.8));
    return [
      Math.min(255, Math.floor(r + 56 * glow)),
      Math.min(255, Math.floor(g + 189 * glow)),
      Math.min(255, Math.floor(b + 248 * glow)),
      255
    ];
  }

  // Thruster flame
  const flameTipY = cy + h * 0.26;
  const fd1 = distToSeg(x, y, inX - w * 0.04, inY + h * 0.03, cx, flameTipY);
  const fd2 = distToSeg(x, y, cx, flameTipY, inX + w * 0.04, inY + h * 0.03);
  const minFlameD = Math.min(fd1, fd2);
  if (minFlameD < strokeW * 0.8) {
    return [249, 115, 22, 255]; // Orange thruster
  }

  return [r, g, b, a];
}

const pubDir = path.resolve('public');
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

console.log('Generating PNG icons for PWA compliance...');
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createPng(192, 192, (x, y, w, h) => drawArcadeIcon(x, y, w, h, false)));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createPng(512, 512, (x, y, w, h) => drawArcadeIcon(x, y, w, h, false)));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createPng(512, 512, (x, y, w, h) => drawArcadeIcon(x, y, w, h, true)));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createPng(180, 180, (x, y, w, h) => drawArcadeIcon(x, y, w, h, false)));
fs.writeFileSync(path.join(pubDir, 'favicon.ico'), createPng(32, 32, (x, y, w, h) => drawArcadeIcon(x, y, w, h, false)));
console.log('Successfully generated all PWA icons.');
