// DOCX writer of create_document (docx, MIT). Body text in Arial, headings in Georgia: both are Windows fonts
// with Cyrillic, and Word substitutes a Cyrillic-capable font where they are missing. Result: a Buffer.
import { dateLine, imageSize, LETTERHEAD } from "./blocks.js";

const INK = "2B1216";
const HEAD = "6B0A1C";
const MUTED = "6B5A52";
const RULE = "C9A46A";
const FILL = "F6EBE1";

export async function renderDocx({ title, blocks, letterhead = false, images = () => null, now = new Date() }) {
  const D = await import("docx");
  const {
    AlignmentType, BorderStyle, Document, Header, HeadingLevel, ImageRun, LevelFormat, Packer, PageBreak, Paragraph,
    ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
  } = D;
  const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };

  const textRuns = (list, extra = {}) => list.flatMap((r) => {
    const parts = String(r.text || "").split("\n");
    return parts.map((t, i) => new TextRun({
      text: t, break: i > 0 ? 1 : undefined, bold: r.bold || extra.bold || undefined, italics: r.italic || undefined,
      underline: r.underline ? {} : undefined, color: extra.color, size: extra.size,
    }));
  });

  const children = [];
  let listNo = 0;
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: RULE };
  const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  for (const b of blocks) {
    if (b.type === "h1" || b.type === "h2" || b.type === "h3") {
      const level = { h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3 }[b.type];
      children.push(new Paragraph({ heading: level, alignment: b.type === "h1" ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: b.text })] }));
    } else if (b.type === "p") {
      children.push(new Paragraph({ alignment: ALIGN[b.align] || AlignmentType.LEFT, children: textRuns(b.runs || [{ text: b.text }]) }));
    } else if (b.type === "small") {
      children.push(new Paragraph({ children: textRuns([{ text: b.text }], { size: 18, color: MUTED }) }));
    } else if (b.type === "ul" || b.type === "ol") {
      const instance = ++listNo; // every numbered list starts again at 1
      for (const it of b.items) {
        children.push(new Paragraph({
          numbering: { reference: b.type === "ol" ? "ted-num" : "ted-bullet", level: 0, instance },
          children: textRuns(typeof it === "string" ? [{ text: it }] : it.runs),
        }));
      }
    } else if (b.type === "table") {
      const cols = Math.max(b.header ? b.header.length : 0, ...b.rows.map((r) => r.length), 1);
      const raw = b.widths && b.widths.length === cols ? b.widths : Array(cols).fill(1);
      const sum = raw.reduce((x, y) => x + y, 0);
      const pct = raw.map((w) => Math.max(1, Math.round((w / sum) * 100)));
      const mkRow = (cells, header) => new TableRow({
        tableHeader: header || undefined,
        children: Array.from({ length: cols }, (_, i) => new TableCell({
          borders,
          width: { size: pct[i], type: WidthType.PERCENTAGE },
          shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: FILL } : undefined,
          margins: { top: 60, bottom: 60, left: 90, right: 90 },
          children: [new Paragraph({ children: textRuns([{ text: cells[i] == null ? "" : String(cells[i]) }], header ? { bold: true, color: HEAD } : {}) })],
        })),
      });
      const rows = [...(b.header ? [mkRow(b.header, true)] : []), ...b.rows.map((r) => mkRow(r, false))];
      if (rows.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
      children.push(new Paragraph({ children: [] }));
    } else if (b.type === "pagebreak") {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    } else if (b.type === "hr") {
      children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 1 } }, children: [] }));
    } else if (b.type === "signature") {
      for (const l of b.lines) {
        children.push(new Paragraph({ spacing: { before: 360 }, children: [new TextRun({ text: `${l.label}: `, bold: true }), new TextRun({ text: "_______________________________" })] }));
        if (l.name) children.push(new Paragraph({ indent: { left: 2400 }, children: textRuns([{ text: `(${l.name})` }], { size: 18, color: MUTED }) }));
      }
    } else if (b.type === "image") {
      const img = images(b.file);
      const size = img && imageSize(img.buffer);
      if (size && size.width > 0 && size.height > 0) {
        const maxW = 600 * ((b.width || 100) / 100); // pixels at 96 dpi within the text width (≈ 16 cm)
        const w = Math.min(maxW, size.width);
        const h = Math.round((size.height / size.width) * w);
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: size.type, data: img.buffer, transformation: { width: Math.round(w), height: h } })] }));
      } else {
        children.push(new Paragraph({ children: textRuns([{ text: "[Снимката не е добавена: файлът не е намерен или форматът не се поддържа (JPEG/PNG).]", italic: true }], { color: MUTED, size: 18 }) }));
      }
    }
  }

  const headers = letterhead
    ? { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 2 } }, children: [new TextRun({ text: `${LETTERHEAD} · ${dateLine(now)}`, size: 18, color: HEAD })] })] }) }
    : undefined;

  const doc = new Document({
    title: String(title || "Документ"),
    creator: "Тед за Windows",
    styles: {
      default: { document: { run: { font: "Arial", size: 22, color: INK }, paragraph: { spacing: { after: 120, line: 276 } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Georgia", size: 36, bold: true, color: HEAD }, paragraph: { spacing: { before: 240, after: 200 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Georgia", size: 30, bold: true, color: HEAD }, paragraph: { spacing: { before: 220, after: 140 } } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Georgia", size: 25, bold: true, color: HEAD }, paragraph: { spacing: { before: 180, after: 100 } } },
      ],
    },
    numbering: {
      config: [
        { reference: "ted-bullet", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
        { reference: "ted-num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1247, right: 1134 } } },
      ...(headers ? { headers } : {}),
      children: children.length ? children : [new Paragraph({ children: [] })],
    }],
  });
  return { buffer: await Packer.toBuffer(doc) };
}
