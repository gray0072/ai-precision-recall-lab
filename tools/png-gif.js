#!/usr/bin/env node
'use strict';

// Turns PNG frames (screenshots from tools/cdp.js) into an animated GIF, with no dependencies: a small PNG
// decoder (8-bit RGB / RGBA, not interlaced: what Chrome writes), an optional box downscale by an integer
// factor, one global palette of the most used colours (the game's colours are flat, so 255 colours of 5-bit
// buckets keep it clean), and frame differencing (pixels unchanged since the previous frame are transparent,
// which keeps the file small). Used to make docs/showcase.gif for the READMEs (spec 04 §8, I07).
// Usage: node tools/png-gif.js <out.gif> <delay ms> [--scale N] <frame1.png> <frame2.png> …

const fs = require('fs'), zlib = require('zlib');

// ---------- PNG ----------
function readPng(file) {
  const b = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), kind = b.toString('latin1', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; interlace = d[12]; }
    else if (kind === 'IDAT') idat.push(d);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace) throw new Error(file + ': only 8-bit RGB/RGBA, not interlaced');
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * 3), cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) out[(y * w + x) * 3 + k] = cur[x * bpp + k];
    cur.copy(prev);
  }
  return { w, h, px: out };
}

function downscale(img, s) {
  if (s <= 1) return img;
  const w = Math.floor(img.w / s), h = Math.floor(img.h / s), px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) {
    let sum = 0;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) sum += img.px[((y * s + dy) * img.w + x * s + dx) * 3 + k];
    px[(y * w + x) * 3 + k] = Math.round(sum / (s * s));
  }
  return { w, h, px };
}

// ---------- palette: the 255 most used 5-bit buckets (index 255 = transparent) ----------
function palette(frames) {
  const count = new Map(), sum = new Map();
  for (const f of frames) for (let i = 0; i < f.px.length; i += 3) {
    const key = (f.px[i] >> 3) << 10 | (f.px[i + 1] >> 3) << 5 | (f.px[i + 2] >> 3);
    count.set(key, (count.get(key) || 0) + 1);
    let s = sum.get(key);
    if (!s) sum.set(key, s = [0, 0, 0]);
    s[0] += f.px[i]; s[1] += f.px[i + 1]; s[2] += f.px[i + 2];
  }
  const top = Array.from(count.keys()).sort((a, b) => count.get(b) - count.get(a)).slice(0, 255);
  const colors = top.map((k) => sum.get(k).map((v) => Math.round(v / count.get(k))));
  const cache = new Map();
  const nearest = (r, g, b) => {
    const key = r << 16 | g << 8 | b;
    let best = cache.get(key);
    if (best !== undefined) return best;
    let bd = Infinity;
    for (let i = 0; i < colors.length; i++) {
      const c = colors[i], d = 2 * (c[0] - r) ** 2 + 4 * (c[1] - g) ** 2 + 3 * (c[2] - b) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    cache.set(key, best);
    return best;
  };
  return { colors, nearest };
}

// ---------- GIF LZW ----------
function lzw(indices, minCode) {
  const clear = 1 << minCode, eoi = clear + 1, out = [];
  let size = minCode + 1, next = eoi + 1, dict = new Map(), bits = 0, acc = 0;
  const put = (code) => { acc |= code << bits; bits += size; while (bits >= 8) { out.push(acc & 255); acc >>= 8; bits -= 8; } };
  put(clear);
  let w = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = w << 8 | k, hit = dict.get(key);
    if (hit !== undefined) { w = hit; continue; }
    put(w);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
    else { put(clear); dict = new Map(); size = minCode + 1; next = eoi + 1; }
    w = k;
  }
  put(w); put(eoi);
  if (bits) out.push(acc & 255);
  return Buffer.from(out);
}

function subBlocks(data) {
  const parts = [];
  for (let i = 0; i < data.length; i += 255) { const c = data.subarray(i, i + 255); parts.push(Buffer.from([c.length]), c); }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

function main() {
  const args = process.argv.slice(2);
  const si = args.indexOf('--scale');
  const scale = si >= 0 ? +args.splice(si, 2)[1] : 1;
  const [outFile, delayArg, ...files] = args;
  if (!outFile || !files.length) { console.error('usage: node tools/png-gif.js <out.gif> <delay ms> [--scale N] <frames.png…>'); process.exit(2); }
  const frames = files.map((f) => downscale(readPng(f), scale));
  const { w, h } = frames[0];
  const pal = palette(frames);
  const delay = Math.round(+delayArg / 10);
  const parts = [Buffer.from('GIF89a', 'latin1')];
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(w, 0); lsd.writeUInt16LE(h, 2); lsd[4] = 0xF7; // global table, 8 bits, 256 entries
  parts.push(lsd);
  const table = Buffer.alloc(768);
  pal.colors.forEach((c, i) => { table[i * 3] = c[0]; table[i * 3 + 1] = c[1]; table[i * 3 + 2] = c[2]; });
  parts.push(table);
  parts.push(Buffer.from([0x21, 0xFF, 11]), Buffer.from('NETSCAPE2.0', 'latin1'), Buffer.from([3, 1, 0, 0, 0]));   // loop forever
  let prev = null;
  for (const f of frames) {
    const idx = Buffer.alloc(w * h);
    for (let i = 0, j = 0; i < idx.length; i++, j += 3) {
      const n = pal.nearest(f.px[j], f.px[j + 1], f.px[j + 2]);
      idx[i] = prev && prev[i] === n ? 255 : n;
      if (prev) prev[i] = n;
    }
    if (!prev) prev = Buffer.from(idx);
    const gce = Buffer.from([0x21, 0xF9, 4, 0x05, delay & 255, delay >> 8, 255, 0]);   // keep the frame, transparent 255
    const desc = Buffer.alloc(10);
    desc[0] = 0x2C; desc.writeUInt16LE(w, 5); desc.writeUInt16LE(h, 7);
    parts.push(gce, desc, Buffer.from([8]), subBlocks(lzw(idx, 8)));
  }
  parts.push(Buffer.from([0x3B]));
  fs.writeFileSync(outFile, Buffer.concat(parts));
  console.log(`${outFile}: ${frames.length} frames, ${w}×${h}, ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`);
}

main();
