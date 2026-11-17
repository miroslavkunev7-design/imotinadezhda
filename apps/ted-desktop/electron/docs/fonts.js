// Fonts for PDF documents made in MAIN: the program's own Roboto Condensed and PT Serif WOFF2 files
// (src/assets/fonts, packed into app.asar by electron-builder; SIL OFL 1.1, see LICENSES.md there).
// The files are Fontsource subsets: Cyrillic and Latin glyphs live in separate files, so every text run is
// split by script and set with the matching file. Characters that neither subset has fall back to a Windows
// system font (Arial) when one exists.
//
// pdfkit subsets embedded fonts with fontkit, whose TrueType subsetter copies raw `glyf` bytes from the loca
// offsets. In a WOFF2 file the glyf table is stored transformed, so those bytes are wrong (composite glyphs
// even throw). patchSubset() replaces the per-glyph step: every glyph is re-encoded from its decoded outline
// as a plain TrueType simple glyph (hinting is dropped, which a PDF does not need).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FONTS_DIR = path.resolve(here, "../../src/assets/fonts");

// Font roles used by the PDF writer -> files (Cyrillic subset first).
export const FONT_FILES = {
  body: ["roboto-condensed-cyrillic-400-normal.woff2", "roboto-condensed-latin-400-normal.woff2"],
  bold: ["roboto-condensed-cyrillic-700-normal.woff2", "roboto-condensed-latin-700-normal.woff2"],
  head: ["pt-serif-cyrillic-700-normal.woff2", "pt-serif-latin-700-normal.woff2"],
};

// Windows fonts with Cyrillic, used only for characters the bundled subsets lack (and, should a bundled file
// ever be missing, for everything).
export const SYSTEM_FALLBACKS = [
  path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "arial.ttf"),
  path.join(process.env.WINDIR || "C:\\Windows", "Fonts", "arialbd.ttf"),
];

export const isCyrillic = (ch) => /[\u0400-\u052F\u2116]/u.test(ch);

// TrueType simple glyph from a fontkit path (moveTo/lineTo/quadraticCurveTo/closePath). Coordinates are
// rounded to font units; every delta is written as int16 (no compression flags) - simple and always valid.
export function encodeGlyph(glyphPath) {
  const contours = [];
  let cur = null;
  const pt = (x, y, on) => [Math.round(x), Math.round(y), on];
  for (const c of (glyphPath && glyphPath.commands) || []) {
    const a = c.args || [];
    if (c.command === "moveTo") {
      if (cur && cur.length) contours.push(cur);
      cur = [pt(a[0], a[1], 1)];
    } else if (!cur) {
      continue;
    } else if (c.command === "lineTo") {
      cur.push(pt(a[0], a[1], 1));
    } else if (c.command === "quadraticCurveTo") {
      cur.push(pt(a[0], a[1], 0), pt(a[2], a[3], 1));
    } else if (c.command === "bezierCurveTo") {
      cur.push(pt(a[4], a[5], 1)); // not used by TrueType outlines; keeps the end point
    } else if (c.command === "closePath") {
      if (cur.length) contours.push(cur);
      cur = null;
    }
  }
  if (cur && cur.length) contours.push(cur);
  const pts = contours.flat();
  if (!pts.length) return new Uint8Array(0);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const n = pts.length;
  const size = 10 + 2 * contours.length + 2 + n + 4 * n;
  const buf = new Uint8Array(size + ((4 - (size % 4)) % 4));
  const view = new DataView(buf.buffer);
  let o = 0;
  const i16 = (v) => { view.setInt16(o, Math.max(-32768, Math.min(32767, v))); o += 2; };
  i16(contours.length);
  i16(minX); i16(minY); i16(maxX); i16(maxY);
  let end = -1;
  for (const c of contours) { end += c.length; view.setUint16(o, end); o += 2; }
  view.setUint16(o, 0); o += 2; // no instructions
  for (const p of pts) buf[o++] = p[2] ? 1 : 0; // ON_CURVE only: x/y are int16 deltas
  let last = 0;
  for (const p of pts) { i16(p[0] - last); last = p[0]; }
  last = 0;
  for (const p of pts) { i16(p[1] - last); last = p[1]; }
  return buf;
}

// Replaces the glyph step of a fontkit TTFSubset (only for WOFF2 sources; plain TTF files keep fontkit's code).
export function patchSubset(subset) {
  if (!subset || subset.__tedPatched || typeof subset._addGlyph !== "function") return subset;
  subset.__tedPatched = true;
  subset._addGlyph = function addGlyph(gid) {
    const glyph = this.font.getGlyph(gid);
    const buffer = encodeGlyph(glyph.path);
    this.loca.version = 1; // long offsets: re-encoded glyphs may be larger than the originals
    this.glyf.push(buffer);
    this.loca.offsets.push(this.offset);
    let lsb = 0;
    try { lsb = glyph._getMetrics().leftBearing; } catch { lsb = 0; }
    this.hmtx.metrics.push({ advance: glyph.advanceWidth, bearing: Number.isFinite(lsb) ? lsb : 0 });
    this.offset += buffer.length;
    return this.glyf.length - 1;
  };
  return subset;
}

// pdfkit keeps the code points of the first layout that used a glyph. A glyph that first appears as a part of a
// decomposed letter (й -> и + breve in Roboto's ccmp) gets an empty entry, and text copied from the PDF loses
// that letter. Before the ToUnicode map is written, empty entries are filled from the font's own cmap.
export function patchToUnicode(embedded) {
  if (!embedded || embedded.__tedUnicode || typeof embedded.toUnicodeCmap !== "function") return embedded;
  embedded.__tedUnicode = true;
  const original = embedded.toUnicodeCmap.bind(embedded);
  embedded.toUnicodeCmap = function toUnicodeCmap() {
    this.unicode = this.unicode.map((cps, gid) => {
      if (gid === 0 || (Array.isArray(cps) && cps.length)) return cps;
      try {
        const own = this.font.getGlyph(this.subset.glyphs[gid]).codePoints;
        return Array.isArray(own) && own.length ? own.slice(0, 1) : cps || [];
      } catch {
        return cps || [];
      }
    });
    return original();
  };
  return embedded;
}

const isWoff2 = (buf) => buf && buf.length > 4 && buf.toString("latin1", 0, 4) === "wOF2";

// Reads the bundled font files once. -> {body:[Buffer…], bold:[…], head:[…], fallback:[Buffer…]}
export function loadFonts({ dir = FONTS_DIR, fallbacks = SYSTEM_FALLBACKS, readFile = fs.readFileSync } = {}) {
  const read = (file) => { try { return readFile(file); } catch { return null; } };
  const out = { fallback: fallbacks.map(read).filter(Boolean).slice(0, 1) };
  for (const [role, files] of Object.entries(FONT_FILES)) out[role] = files.map((f) => read(path.join(dir, f))).filter(Boolean);
  return out;
}

// Registers the fonts in a pdfkit document. Returns {pick(role, ch) -> font name, roles}.
// Every embedded WOFF2 font gets the patched subsetter before any text is laid out.
export function registerFonts(doc, fonts) {
  const names = {};
  let n = 0;
  const add = (buf) => {
    const name = `ted${++n}`;
    doc.registerFont(name, buf);
    doc.font(name);
    if (isWoff2(buf)) patchSubset(doc._font && doc._font.subset);
    patchToUnicode(doc._font);
    return { name, font: doc._font && doc._font.font };
  };
  const fb = (fonts.fallback || []).map(add);
  for (const role of Object.keys(FONT_FILES)) names[role] = [...(fonts[role] || []).map(add), ...fb];
  if (!names.body.length) throw new Error("Няма шрифт за PDF документа.");
  if (!names.bold.length) names.bold = names.body;
  if (!names.head.length) names.head = names.bold;

  const has = (entry, cp) => {
    try { return !!(entry.font && entry.font.hasGlyphForCodePoint(cp)); } catch { return false; }
  };
  // The first font of the role that has the character: the Cyrillic subset first for Cyrillic letters, the
  // Latin one first for everything else (the Cyrillic subset has no space, digits or punctuation).
  const cache = new Map();
  function pick(role, ch) {
    const key = `${role}\u0000${ch}`;
    if (cache.has(key)) return cache.get(key);
    const list = names[role] || names.body;
    const cp = ch.codePointAt(0);
    const order = isCyrillic(ch) ? list : [...list.slice(1, 2), list[0], ...list.slice(2)];
    const found = order.find((entry) => has(entry, cp)) || order[0];
    cache.set(key, found.name);
    return found.name;
  }
  return { pick, names };
}

// Splits text into runs that share one font.
export function splitRuns(text, role, pick) {
  const runs = [];
  for (const ch of String(text)) {
    const font = pick(role, ch);
    if (runs.length && runs[runs.length - 1].font === font) runs[runs.length - 1].text += ch;
    else runs.push({ font, text: ch });
  }
  return runs;
}
