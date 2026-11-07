// Логото „Недвижими имоти • Надежда •“ върху снимки на имоти – на сървъра (за снимките, които Тед сваля, генерира
// или архивира). Същото като в браузъра (crm-scan.js watermark): снимката се смалява до 2000 px, логото е бледо,
// В СРЕДАТА на снимката, ширина до 42 %. Чист JS: jpeg-js + pngjs, без външни услуги. Изход: JPEG 88 %.
"use strict";
const fs = require("fs"), path = require("path");
const JPEG = require("./_vendor/jpeg-js");
const { PNG } = require("./_vendor/pngjs/lib/png.js");
let LOGO = null;
function logo() { if (!LOGO) { const l = PNG.sync.read(fs.readFileSync(path.join(__dirname, "_vendor", "wm-logo.png"))); LOGO = { w: l.width, h: l.height, d: l.data }; } return LOGO; }

function decode(buf, mime) {
  const isPng = /png/.test(mime || "") || (buf[0] === 0x89 && buf[1] === 0x50);
  const isJpg = /jpe?g/.test(mime || "") || (buf[0] === 0xff && buf[1] === 0xd8);
  if (isPng) { const p = PNG.sync.read(buf); return { w: p.width, h: p.height, d: p.data }; }
  if (isJpg) { const j = JPEG.decode(buf, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 100, maxMemoryUsageInMB: 1024 }); return { w: j.width, h: j.height, d: j.data }; }
  return null; /* WebP/GIF – оставя се без промяна */
}
/* билинейно смаляване/уголемяване на RGBA */
function resize(src, w, h) {
  if (src.w === w && src.h === h) return src;
  const d = new Uint8Array(w * h * 4), sx = src.w / w, sy = src.h / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(src.h - 1, (y + 0.5) * sy - 0.5), y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(src.h - 1, y0 + 1), ty = Math.max(0, fy - y0);
    for (let x = 0; x < w; x++) {
      const fx = Math.min(src.w - 1, (x + 0.5) * sx - 0.5), x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(src.w - 1, x0 + 1), tx = Math.max(0, fx - x0);
      const a = (y0 * src.w + x0) * 4, b = (y0 * src.w + x1) * 4, c = (y1 * src.w + x0) * 4, e = (y1 * src.w + x1) * 4, o = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) d[o + k] = (src.d[a + k] * (1 - tx) + src.d[b + k] * tx) * (1 - ty) + (src.d[c + k] * (1 - tx) + src.d[e + k] * tx) * ty;
    }
  }
  return { w, h, d };
}
/* снимка (Buffer) → JPEG с логото в средата; ако форматът не се чете – връща оригинала */
function stamp(buf, mime) {
  let im;
  try { im = decode(buf, mime); } catch (e) { im = null; }
  if (!im) return { buf, mime, stamped: false };
  const k = Math.min(1, 2000 / Math.max(im.w, im.h));
  if (k < 1) im = resize(im, Math.round(im.w * k), Math.round(im.h * k));
  const W = im.w, H = im.h, L = logo();
  const lw = Math.round(Math.min(W * 0.42, H * 0.42 * L.w / L.h)), lh = Math.round(lw * L.h / L.w);
  const lg = resize(L, lw, lh), x0 = Math.round((W - lw) / 2), y0 = Math.round((H - lh) / 2);
  /* бяло сияние под логото (като shadowBlur в браузъра) + самото лого, общо ≈ 45 % плътност */
  const out = im.d;
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const li = (y * lw + x) * 4, la = lg.d[li + 3] / 255; if (la <= 0.01) continue;
    const oi = ((y0 + y) * W + (x0 + x)) * 4;
    const glow = 0.12 * la, a = 0.45 * la;
    for (let c = 0; c < 3; c++) { let v = out[oi + c] * (1 - glow) + 255 * glow; v = v * (1 - a) + lg.d[li + c] * a; out[oi + c] = v; }
  }
  for (let i = 3; i < out.length; i += 4) out[i] = 255; /* без прозрачност в JPEG */
  const enc = JPEG.encode({ data: out, width: W, height: H }, 88);
  return { buf: Buffer.from(enc.data), mime: "image/jpeg", stamped: true, width: W, height: H };
}
module.exports = { stamp };
