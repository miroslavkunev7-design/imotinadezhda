// PDF writer of create_document (pdfkit, MIT). Block[] -> A4 PDF with the program's own fonts (Cyrillic and
// Latin subsets, see fonts.js). No network, no files on disk: the result is a Buffer.
import { loadFonts, registerFonts, splitRuns } from "./fonts.js";
import { dateLine, LETTERHEAD } from "./blocks.js";

const INK = "#2b1216";
const HEAD = "#6b0a1c";
const MUTED = "#6b5a52";
const RULE = "#c9a46a";
const FILL = "#f6ebe1";
const SIZE = { h1: 20, h2: 15.5, h3: 12.5, p: 11, small: 9, table: 9.5 };

let fontCache = null;
const bundledFonts = () => (fontCache ??= loadFonts());

// -> {buffer, pages}. images(fileId) -> {buffer, mime} | null (only JPEG/PNG can go into a PDF).
export async function renderPdf({ title, blocks, letterhead = false, images = () => null, fonts = bundledFonts(), now = new Date() }) {
  const { default: PDFDocument } = await import("pdfkit");
  const doc = new PDFDocument({
    size: "A4", bufferPages: true, compress: true, font: null, autoFirstPage: true,
    margins: { top: letterhead ? 70 : 60, bottom: 62, left: 60, right: 60 },
    info: { Title: String(title || "Документ"), Creator: "Тед за Windows", Producer: "Тед за Windows" },
  });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const ended = new Promise((resolve, reject) => { doc.on("end", resolve); doc.on("error", reject); });

  const { pick } = registerFonts(doc, fonts);
  const left = () => doc.page.margins.left;
  const width = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom;

  const fontFor = (role, bold) => (role === "head" ? "head" : bold ? "bold" : "body");
  const lineHeight = (size) => { doc.font(pick("body", "a")).fontSize(size); return doc.currentLineHeight(true) + 2; };

  // Text layout is done here, not by pdfkit's `continued` fragments: a line mixes fonts (the Cyrillic and Latin
  // subsets are separate files and only the Latin one has spaces, digits and punctuation), and pdfkit would
  // wrap or align every fragment on its own ("наемодателя" / "." on two lines, lost spaces when centred).
  // Words are whitespace-separated tokens; each token is drawn as one or more font segments.
  function lay(runs, { role = "body", size = SIZE.p, w }) {
    const tokens = [];
    for (const r of runs) {
      for (const part of String(r.text == null ? "" : r.text).split(/(\n|[^\S\n]+)/)) if (part) tokens.push({ text: part, r });
    }
    const segsOf = (t) => splitRuns(t.text, fontFor(role, t.r.bold), pick).map((s) => ({ ...s, w: doc.font(s.font).fontSize(size).widthOfString(s.text) }));
    const lines = [{ tokens: [], end: false }];
    let lw = 0;
    const newLine = (end) => { lines[lines.length - 1].end = end; lines.push({ tokens: [], end: false }); lw = 0; };
    for (const t of tokens) {
      if (t.text === "\n") { newLine(true); continue; }
      const segs = segsOf(t);
      const tw = segs.reduce((s, x) => s + x.w, 0);
      const blank = /^\s+$/.test(t.text);
      const cur = lines[lines.length - 1].tokens;
      if (blank && !cur.length) continue;
      if (!blank && lw + tw > w && lw > 0) newLine(false);
      lines[lines.length - 1].tokens.push({ ...t, segs, w: tw, blank });
      lw += tw;
    }
    lines[lines.length - 1].end = true;
    for (const line of lines) {
      while (line.tokens.length && line.tokens[line.tokens.length - 1].blank) line.tokens.pop();
      line.width = line.tokens.reduce((s, t) => s + t.w, 0);
    }
    return { lines, lh: lineHeight(size) };
  }

  // runs: [{text, bold, italic, underline}] as one paragraph. `keep` = never start a new page (table cells).
  function writeRuns(runs, { role = "body", size = SIZE.p, align = "left", x, y, w, color = INK, keep = false } = {}) {
    const bx = x ?? left();
    const bw = w ?? width() - (bx - left());
    const { lines, lh } = lay(runs, { role, size, w: bw });
    let cy = y ?? doc.y;
    for (const line of lines) {
      if (!keep && cy + lh > bottom()) { doc.addPage(); cy = doc.page.margins.top; }
      const free = Math.max(0, bw - line.width);
      const gaps = line.tokens.filter((t) => t.blank).length;
      const stretch = align === "justify" && !line.end && gaps ? free / gaps : 0;
      let cx = bx + (align === "center" ? free / 2 : align === "right" ? free : 0);
      for (const t of line.tokens) {
        if (t.blank) {
          if (t.r.underline) doc.save().lineWidth(0.6).strokeColor(color).moveTo(cx, cy + size * 1.05).lineTo(cx + t.w + stretch, cy + size * 1.05).stroke().restore();
          cx += t.w + stretch;
          continue;
        }
        for (const s of t.segs) {
          doc.font(s.font).fontSize(size).fillColor(color);
          doc.text(s.text, cx, cy, { lineBreak: false, underline: !!t.r.underline, oblique: t.r.italic ? 12 : false });
          cx += s.w;
        }
      }
      cy += lh;
    }
    doc.x = left();
    doc.y = cy;
  }

  // Height of runs in a box of width w, with exactly the line breaks writeRuns makes.
  function measure(runs, opts) {
    const { lines, lh } = lay(runs, opts);
    return lines.length * lh;
  }

  const ensure = (h) => { if (doc.y + h > bottom()) doc.addPage(); };
  const gap = (pt) => { doc.y += pt; };

  function table(block) {
    const header = Array.isArray(block.header) && block.header.length ? block.header : null;
    const rows = block.rows || [];
    const cols = Math.max(header ? header.length : 0, ...rows.map((r) => r.length), 1);
    let widths = Array.isArray(block.widths) && block.widths.length === cols ? block.widths.map((v) => Math.max(1, Number(v) || 1)) : Array(cols).fill(1);
    const total = widths.reduce((a, b) => a + b, 0);
    widths = widths.map((v) => (v / total) * width());
    const pad = 4;
    const cellRuns = (v, bold) => [{ text: v == null ? "" : String(v), bold }];

    function row(cells, isHeader) {
      const runsOf = Array.from({ length: cols }, (_, i) => cellRuns(cells[i], isHeader));
      const h = Math.max(...runsOf.map((r, i) => measure(r, { size: SIZE.table, w: widths[i] - 2 * pad, role: isHeader ? "body" : "body" }))) + 2 * pad;
      if (doc.y + h > bottom()) {
        doc.addPage();
        if (!isHeader && header) row(header, true);
      }
      const y0 = doc.y;
      if (isHeader) doc.save().rect(left(), y0, width(), h).fill(FILL).restore();
      let x = left();
      let maxY = y0 + h;
      runsOf.forEach((runs, i) => {
        writeRuns(runs, { size: SIZE.table, x: x + pad, y: y0 + pad, w: widths[i] - 2 * pad, keep: true, color: isHeader ? HEAD : INK });
        maxY = Math.max(maxY, Math.min(doc.y + pad, bottom()));
        x += widths[i];
      });
      doc.save().lineWidth(0.6).strokeColor(RULE);
      x = left();
      for (const wd of widths) { doc.rect(x, y0, wd, maxY - y0).stroke(); x += wd; }
      doc.restore();
      doc.x = left();
      doc.y = maxY;
    }
    if (header) row(header, true);
    for (const r of rows) row(r, false);
    gap(8);
  }

  function list(block) {
    const ordered = block.type === "ol";
    (block.items || []).forEach((item, i) => {
      const runs = typeof item === "string" ? [{ text: item }] : Array.isArray(item && item.runs) ? item.runs : [{ text: item && item.text }];
      const marker = ordered ? `${i + 1}.` : "•";
      const indent = ordered ? 20 : 14;
      ensure(lineHeight(SIZE.p));
      const y0 = doc.y;
      writeRuns([{ text: marker }], { x: left(), y: y0, w: indent });
      writeRuns(runs, { x: left() + indent, y: y0, w: width() - indent });
      doc.x = left();
      gap(2);
    });
    gap(6);
  }

  function signature(block) {
    for (const line of block.lines || []) {
      ensure(lineHeight(SIZE.p) * 3);
      gap(14);
      const label = `${String(line.label || "").trim()}${line.label ? ":" : ""}`;
      const y0 = doc.y;
      writeRuns([{ text: label, bold: true }], { x: left(), y: y0, w: width() * 0.4 });
      const lineY = y0 + lineHeight(SIZE.p) - 4;
      const x1 = left() + width() * 0.42;
      doc.save().lineWidth(0.7).strokeColor(INK).moveTo(x1, lineY).lineTo(left() + width(), lineY).stroke().restore();
      doc.y = lineY + 3;
      if (line.name) writeRuns([{ text: `(${line.name})` }], { size: SIZE.small, x: x1, y: doc.y, w: width() * 0.58, color: MUTED, align: "center" });
      doc.x = left();
      gap(4);
    }
    gap(6);
  }

  function image(block) {
    const got = images(block.file);
    if (!got || !/^image\/(jpeg|png)$/.test(got.mime)) {
      writeRuns([{ text: `[Снимката не е добавена: ${got ? "форматът не се поддържа в PDF (само JPEG и PNG)" : "файлът не е намерен"}]`, italic: true }], { size: SIZE.small, color: MUTED });
      gap(6);
      return;
    }
    const img = doc.openImage(got.buffer);
    const w = Math.max(40, Math.min(100, Number(block.width) || 100)) / 100 * width();
    let h = (img.height / img.width) * w;
    let wd = w;
    const room = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
    if (h > room) { wd = (room / h) * w; h = room; }
    ensure(h);
    doc.image(img, left() + (width() - wd) / 2, doc.y, { width: wd, height: h });
    doc.y += h;
    doc.x = left();
    gap(8);
  }

  for (const block of blocks) {
    doc.x = left();
    switch (block.type) {
      case "h1": case "h2": case "h3": {
        const size = SIZE[block.type];
        ensure(lineHeight(size) * 2);
        if (doc.y > doc.page.margins.top + 1) gap(block.type === "h1" ? 10 : 8);
        writeRuns([{ text: block.text }], { role: "head", size, color: HEAD, align: block.type === "h1" ? "center" : "left" });
        gap(block.type === "h1" ? 8 : 5);
        break;
      }
      case "p": {
        const runs = Array.isArray(block.runs) && block.runs.length ? block.runs : [{ text: block.text || "" }];
        writeRuns(runs, { align: block.align || "left" });
        gap(6);
        break;
      }
      case "small":
        writeRuns([{ text: block.text }], { size: SIZE.small, color: MUTED });
        gap(5);
        break;
      case "ul": case "ol": list(block); break;
      case "table": table(block); break;
      case "pagebreak": doc.addPage(); break;
      case "hr":
        ensure(12);
        gap(4);
        doc.save().lineWidth(0.8).strokeColor(RULE).moveTo(left(), doc.y).lineTo(left() + width(), doc.y).stroke().restore();
        gap(8);
        break;
      case "signature": signature(block); break;
      case "image": image(block); break;
      default: break;
    }
  }

  // Letterhead and page numbers, written into the margins of every page at the end.
  const range = doc.bufferedPageRange();
  const pages = range.count;
  for (let i = range.start; i < range.start + pages; i++) {
    doc.switchToPage(i);
    const keep = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    if (letterhead) {
      writeRuns([{ text: `${LETTERHEAD} · ${dateLine(now)}` }], { size: SIZE.small, x: left(), y: 30, w: width(), color: HEAD, align: "left" });
      doc.save().lineWidth(0.6).strokeColor(RULE).moveTo(left(), 46).lineTo(left() + width(), 46).stroke().restore();
    }
    if (pages > 1) writeRuns([{ text: `${i - range.start + 1} / ${pages}` }], { size: SIZE.small, x: left(), y: doc.page.height - 40, w: width(), color: MUTED, align: "center" });
    doc.page.margins.bottom = keep;
  }
  doc.end();
  await ended;
  return { buffer: Buffer.concat(chunks), pages };
}
