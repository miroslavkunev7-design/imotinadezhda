// Кадри за видео моделите: всяка снимка се изрязва (по центъра) и мащабира точно във формата на видеото –
// 9:16 → 720×1280, 16:9 → 1280×720 – с правилната ориентация (EXIF). Видео моделите искат първият и последният кадър
// да са в същия формат като клипа; иначе генерирането се проваля или изкривява. Чист JS (jpeg-js), без външни услуги.
"use strict";
const JPEG = require("./_vendor/jpeg-js");

/* EXIF ориентация (1–8) от JPEG; 1 ако няма */
function exifOrientation(buf) {
  try {
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
    let p = 2;
    while (p + 4 < buf.length) {
      if (buf[p] !== 0xff) return 1;
      const m = buf[p + 1], len = buf.readUInt16BE(p + 2);
      if (m === 0xe1 && buf.toString("ascii", p + 4, p + 10) === "Exif\0\0") {
        const t = p + 10, le = buf.toString("ascii", t, t + 2) === "II";
        const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o)), u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
        const ifd = t + u32(t + 4), n = u16(ifd);
        for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (u16(e) === 0x0112) { const v = u16(e + 8); return v >= 1 && v <= 8 ? v : 1; } }
        return 1;
      }
      if (m === 0xda) return 1;
      p += 2 + len;
    }
  } catch (e) {}
  return 1;
}
/* размери без декодиране (SOFn) */
function jpegSize(buf) {
  try {
    let p = 2;
    while (p + 9 < buf.length) {
      if (buf[p] !== 0xff) return null;
      const m = buf[p + 1], len = buf.readUInt16BE(p + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7) };
      p += 2 + len;
    }
  } catch (e) {}
  return null;
}
/* завъртане/огледало според EXIF → { width, height, data } (RGBA) */
function orient(img, o) {
  if (o === 1) return img;
  const { width: w, height: h, data: s } = img, swap = o >= 5, W = swap ? h : w, H = swap ? w : h, d = Buffer.alloc(W * H * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let X, Y;
    switch (o) {
      case 2: X = w - 1 - x; Y = y; break; case 3: X = w - 1 - x; Y = h - 1 - y; break; case 4: X = x; Y = h - 1 - y; break;
      case 5: X = y; Y = x; break; case 6: X = h - 1 - y; Y = x; break; case 7: X = h - 1 - y; Y = w - 1 - x; break; case 8: X = y; Y = w - 1 - x; break;
      default: X = x; Y = y;
    }
    const si = (y * w + x) * 4, di = (Y * W + X) * 4; d[di] = s[si]; d[di + 1] = s[si + 1]; d[di + 2] = s[si + 2]; d[di + 3] = 255;
  }
  return { width: W, height: H, data: d };
}
/* изрязване по центъра до TW:TH и мащабиране (усредняване при намаляне, билинейно при увеличение) */
function cover(img, TW, TH) {
  const { width: w, height: h, data: s } = img, ta = TW / TH;
  let cw = w, ch = h; if (w / h > ta) cw = Math.round(h * ta); else ch = Math.round(w / ta);
  const cx = Math.floor((w - cw) / 2), cy = Math.floor((h - ch) / 2), d = Buffer.alloc(TW * TH * 4), sx = cw / TW, sy = ch / TH;
  if (sx >= 1 && sy >= 1) {
    for (let y = 0; y < TH; y++) {
      const y0 = cy + Math.floor(y * sy), y1 = Math.max(y0 + 1, cy + Math.floor((y + 1) * sy));
      for (let x = 0; x < TW; x++) {
        const x0 = cx + Math.floor(x * sx), x1 = Math.max(x0 + 1, cx + Math.floor((x + 1) * sx));
        let r = 0, g = 0, b = 0, n = 0;
        for (let yy = y0; yy < y1 && yy < h; yy++) { let i = (yy * w + x0) * 4; for (let xx = x0; xx < x1 && xx < w; xx++, i += 4) { r += s[i]; g += s[i + 1]; b += s[i + 2]; n++; } }
        const o = (y * TW + x) * 4; d[o] = r / n; d[o + 1] = g / n; d[o + 2] = b / n; d[o + 3] = 255;
      }
    }
  } else {
    for (let y = 0; y < TH; y++) {
      const fy = cy + (y + 0.5) * sy - 0.5, y0 = Math.max(0, Math.floor(fy)), y1 = Math.min(h - 1, y0 + 1), wy = Math.min(1, Math.max(0, fy - y0));
      for (let x = 0; x < TW; x++) {
        const fx = cx + (x + 0.5) * sx - 0.5, x0 = Math.max(0, Math.floor(fx)), x1 = Math.min(w - 1, x0 + 1), wx = Math.min(1, Math.max(0, fx - x0));
        const a = (y0 * w + x0) * 4, b2 = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, e = (y1 * w + x1) * 4, o = (y * TW + x) * 4;
        for (let k = 0; k < 3; k++) d[o + k] = (s[a + k] * (1 - wx) + s[b2 + k] * wx) * (1 - wy) + (s[c + k] * (1 - wx) + s[e + k] * wx) * wy;
        d[o + 3] = 255;
      }
    }
  }
  return { width: TW, height: TH, data: d };
}
const SIZES = { "9:16": [720, 1280], "16:9": [1280, 720], "1:1": [1024, 1024] };
/* JPEG → кадър за видео (Buffer JPEG). Хвърля грешка при не-JPEG. */
function prep(buf, aspect, quality) {
  const [TW, TH] = SIZES[aspect] || SIZES["9:16"];
  const img = JPEG.decode(buf, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 60, maxMemoryUsageInMB: 700 });
  const o = orient({ width: img.width, height: img.height, data: Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length) }, exifOrientation(buf));
  const out = cover(o, TW, TH);
  return JPEG.encode(out, quality || 88).data;
}
module.exports = { prep, exifOrientation, jpegSize, SIZES };
