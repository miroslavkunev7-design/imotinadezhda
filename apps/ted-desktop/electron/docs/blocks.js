// Structured document content of create_document (docs/CONTRACT.md §10.2): validation and normalisation of
// Block[] coming from the model, plus the small helpers shared by the DOCX, PDF and HTML writers.
export const LETTERHEAD = "Недвижими Имоти Надежда";
export const MAX_BLOCKS = 2000;
export const MAX_CHARS = 400_000;
const ALIGN = new Set(["left", "center", "right", "justify"]);

export class DocError extends Error {
  constructor(message, code = "invalid") {
    super(message);
    this.name = "DocError";
    this.code = code;
  }
}

export function dateLine(now = new Date()) {
  try {
    return new Intl.DateTimeFormat("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const str = (v, max = 20000) => (v == null ? "" : String(typeof v === "object" ? JSON.stringify(v) : v)).replace(/\r\n?/g, "\n").slice(0, max);

function runs(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const r of list.slice(0, 400)) {
    if (typeof r === "string") { out.push({ text: str(r) }); continue; }
    if (!r || typeof r !== "object") continue;
    out.push({ text: str(r.text), bold: r.bold === true, italic: r.italic === true, underline: r.underline === true });
  }
  return out;
}

const cell = (v) => (v == null ? "" : typeof v === "number" || typeof v === "boolean" ? String(v) : str(v, 4000));

// -> normalised Block[]; throws DocError for content that is not a block list or too large.
export function normalizeBlocks(content) {
  let list = content;
  if (typeof list === "string") list = list.split(/\n{2,}/).map((text) => ({ type: "p", text }));
  if (list && !Array.isArray(list) && Array.isArray(list.blocks)) list = list.blocks;
  if (!Array.isArray(list)) throw new DocError("Съдържанието трябва да е списък от блокове (заглавия, абзаци, списъци, таблици).");
  if (list.length > MAX_BLOCKS) throw new DocError(`Твърде много блокове (най-много ${MAX_BLOCKS}).`);
  let chars;
  try { chars = JSON.stringify(list).length; } catch { throw new DocError("Съдържанието не може да се прочете."); }
  if (chars > MAX_CHARS) throw new DocError("Документът е твърде голям (най-много 400 000 знака).");

  const out = [];
  for (const b of list) {
    if (typeof b === "string") { out.push({ type: "p", text: str(b) }); continue; }
    if (!b || typeof b !== "object") continue;
    const type = String(b.type || "p");
    if (type === "h1" || type === "h2" || type === "h3" || type === "small") out.push({ type, text: str(b.text, 2000) });
    else if (type === "p") {
      const r = runs(b.runs);
      out.push({ type, text: str(b.text), ...(r && r.length ? { runs: r } : {}), align: ALIGN.has(b.align) ? b.align : "left" });
    } else if (type === "ul" || type === "ol") {
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 500).map((it) => {
        if (it && typeof it === "object" && Array.isArray(it.runs)) return { runs: runs(it.runs) };
        return str(it && typeof it === "object" ? it.text : it, 4000);
      });
      out.push({ type, items });
    } else if (type === "table") {
      const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 2000).map((r) => (Array.isArray(r) ? r.slice(0, 30).map(cell) : [cell(r)]));
      const header = Array.isArray(b.header) ? b.header.slice(0, 30).map(cell) : undefined;
      const widths = Array.isArray(b.widths) ? b.widths.slice(0, 30).map((w) => Math.max(1, Math.min(100, Number(w) || 1))) : undefined;
      out.push({ type, rows, ...(header ? { header } : {}), ...(widths ? { widths } : {}) });
    } else if (type === "pagebreak" || type === "hr") out.push({ type });
    else if (type === "signature") {
      const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 12).map((l) => ({ label: str(l && l.label, 120), ...(l && l.name ? { name: str(l.name, 120) } : {}) }));
      out.push({ type, lines });
    } else if (type === "image") {
      const m = /^file:([a-z0-9_-]{8,64})$/.exec(String(b.file || ""));
      if (m) out.push({ type, file: m[1], ...(b.width ? { width: Math.max(10, Math.min(100, Number(b.width) || 100)) } : {}) });
    } else out.push({ type: "p", text: str(b.text), align: "left" });
  }
  return out;
}

// Plain text of blocks (used for .txt/.md exports and tests).
export function blocksToText(blocks) {
  const lines = [];
  for (const b of blocks) {
    if (b.type === "p") lines.push(b.runs ? b.runs.map((r) => r.text).join("") : b.text);
    else if (b.type === "ul" || b.type === "ol") b.items.forEach((it, i) => lines.push(`${b.type === "ol" ? `${i + 1}.` : "•"} ${typeof it === "string" ? it : it.runs.map((r) => r.text).join("")}`));
    else if (b.type === "table") { if (b.header) lines.push(b.header.join("\t")); for (const r of b.rows) lines.push(r.join("\t")); }
    else if (b.type === "signature") for (const l of b.lines) lines.push(`${l.label}: ______________${l.name ? ` (${l.name})` : ""}`);
    else if (b.text != null) lines.push(b.text);
  }
  return lines.join("\n");
}

export const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// A local HTML file opened by the default browser: no scripts, no remote loads (CSP in the file itself).
export const HTML_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

function runsHtml(list) {
  return list.map((r) => {
    let t = escHtml(r.text).replace(/\n/g, "<br>");
    if (r.bold) t = `<b>${t}</b>`;
    if (r.italic) t = `<i>${t}</i>`;
    if (r.underline) t = `<u>${t}</u>`;
    return t;
  }).join("");
}

export function blocksToHtml({ title, blocks, letterhead = false, now = new Date(), images = () => null }) {
  const body = [];
  if (letterhead) body.push(`<div class="lh">${escHtml(LETTERHEAD)} · ${escHtml(dateLine(now))}</div>`);
  for (const b of blocks) {
    if (/^h[123]$/.test(b.type)) body.push(`<${b.type}>${escHtml(b.text)}</${b.type}>`);
    else if (b.type === "p") body.push(`<p style="text-align:${b.align === "justify" ? "justify" : b.align || "left"}">${b.runs ? runsHtml(b.runs) : escHtml(b.text).replace(/\n/g, "<br>")}</p>`);
    else if (b.type === "small") body.push(`<p class="sm">${escHtml(b.text)}</p>`);
    else if (b.type === "ul" || b.type === "ol") body.push(`<${b.type}>${b.items.map((it) => `<li>${typeof it === "string" ? escHtml(it) : runsHtml(it.runs)}</li>`).join("")}</${b.type}>`);
    else if (b.type === "table") body.push(`<table>${b.header ? `<thead><tr>${b.header.map((c) => `<th>${escHtml(c)}</th>`).join("")}</tr></thead>` : ""}<tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    else if (b.type === "hr") body.push("<hr>");
    else if (b.type === "pagebreak") body.push('<div class="pb"></div>');
    else if (b.type === "signature") body.push(b.lines.map((l) => `<p class="sig"><b>${escHtml(l.label)}:</b> <span class="ln"></span>${l.name ? `<br><span class="sm">(${escHtml(l.name)})</span>` : ""}</p>`).join(""));
    else if (b.type === "image") {
      const img = images(b.file);
      if (img && /^image\/(jpeg|png|webp|gif)$/.test(img.mime)) body.push(`<p class="im"><img alt="" style="width:${b.width || 100}%" src="data:${img.mime};base64,${img.buffer.toString("base64")}"></p>`);
    }
  }
  return `<!doctype html>
<html lang="bg"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${HTML_CSP}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<style>body{font:15px/1.5 Arial,sans-serif;color:#2b1216;max-width:820px;margin:32px auto;padding:0 20px}h1,h2,h3{font-family:Georgia,serif;color:#6b0a1c}h1{text-align:center}table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #c9a46a;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f6ebe1;color:#6b0a1c}.sm{font-size:12px;color:#6b5a52}.lh{font-size:12px;color:#6b0a1c;border-bottom:1px solid #c9a46a;padding-bottom:6px;margin-bottom:18px}.sig .ln{display:inline-block;width:260px;border-bottom:1px solid #2b1216}.pb{page-break-after:always}.im{text-align:center}@media print{body{margin:0}}</style>
</head><body>
${body.join("\n")}
</body></html>
`;
}

// Width/height of a PNG or JPEG (for DOCX images); null for anything else.
export function imageSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  if (buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o += 1; continue; }
      const marker = buf[o + 1];
      const len = buf.readUInt16BE(o + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(o + 7), height: buf.readUInt16BE(o + 5), type: "jpg" };
      }
      o += 2 + len;
    }
  }
  return null;
}
