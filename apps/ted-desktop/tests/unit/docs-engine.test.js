// Local document engine (docs/CONTRACT.md §10.2/§10.3): create -> read round trips with Cyrillic text, the
// WOFF2 font embedding in PDF, sanitising of model HTML and the CSV/XLSX rules. No network, no Electron.
import { describe, it, expect } from "vitest";
import { createDocument, fileName, htmlToBlocks } from "../../electron/docs/create.js";
import { readDocument, parseCsv } from "../../electron/docs/read.js";
import { normalizeBlocks, imageSize } from "../../electron/docs/blocks.js";
import { encodeGlyph, loadFonts, splitRuns } from "../../electron/docs/fonts.js";

const LINE = "Договор за наем – гр. Шумен, 2026 г.";
const CONTRACT = [
  { type: "h1", text: "ДОГОВОР ЗА НАЕМ" },
  { type: "p", text: LINE },
  { type: "p", runs: [{ text: "Наемател: ", bold: true }, { text: "Тест Тестов", italic: true }, { text: " (ЕГН ………)", underline: true }], align: "justify" },
  { type: "ol", items: ["Срок – 12 месеца.", "Наем – 450 € месечно."] },
  { type: "ul", items: ["Депозит: един наем", { runs: [{ text: "Ключове: ", bold: true }, { text: "2 броя" }] }] },
  { type: "table", header: ["Помещение", "Площ"], rows: [["Хол", "24 м²"], ["Спалня", "14 м²"]], widths: [70, 30] },
  { type: "hr" },
  { type: "small", text: "Тестов документ – не е заверен." },
  { type: "pagebreak" },
  { type: "h2", text: "Подписи" },
  { type: "signature", lines: [{ label: "Наемодател", name: "Тест Първи" }, { label: "Наемател" }] },
];

const flat = (s) => s.replace(/\s+/g, " ").trim();

describe("create_document -> read_document round trip", () => {
  it("PDF embeds the program's WOFF2 fonts and the Cyrillic text reads back exactly", async () => {
    const out = await createDocument({ format: "pdf", title: "Договор за наем", content: CONTRACT, letterhead: true });
    expect(out.name).toBe("Договор за наем.pdf");
    expect(out.mime).toBe("application/pdf");
    expect(out.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(out.pages).toBe(2);
    // fonts are embedded (FontFile2 = TrueType program), not the 14 standard fonts
    expect(out.buffer.toString("latin1")).toMatch(/FontFile2/);
    const doc = await readDocument({ buffer: out.buffer, kind: "pdf", name: out.name });
    expect(doc.pages).toBe(2);
    const text = flat(doc.text);
    expect(text).toContain(LINE);
    expect(text).toContain("ДОГОВОР ЗА НАЕМ");
    expect(text).toContain("Наемател: Тест Тестов (ЕГН ………)");
    expect(text).toContain("Наем – 450 € месечно.");
    expect(text).toContain("24 м²");
    expect(text).toContain("Недвижими Имоти Надежда");
    expect(text).toContain("1 / 2");
    expect(doc.note).toBeUndefined();
  });

  it("DOCX keeps headings, runs, lists and tables; mammoth reads the Cyrillic back", async () => {
    const out = await createDocument({ format: "docx", title: "Договор", filename: "договор-тест.docx", content: CONTRACT });
    expect(out.name).toBe("договор-тест.docx");
    expect(out.buffer.subarray(0, 2).toString()).toBe("PK");
    const doc = await readDocument({ buffer: out.buffer, kind: "docx", name: out.name });
    const text = flat(doc.text);
    expect(text).toContain(LINE);
    expect(text).toContain("Наемател: Тест Тестов (ЕГН ………)");
    expect(doc.sheets).toEqual([{ name: "Таблица 1", rows: [["Помещение", "Площ"], ["Хол", "24 м²"], ["Спалня", "14 м²"]] }]);
    expect(doc.text).toContain("Хол\t24 м²");
  });

  it("XLSX: sheets with headers and typed cells read back as rows", async () => {
    const out = await createDocument({
      format: "xlsx", title: "Наеми",
      content: { sheets: [{ name: "Шумен/Варна?", columns: [{ header: "Имот", width: 30 }, { header: "Наем €" }], rows: [["Апартамент – център", 450], ["=HYPERLINK(1)", 3.5], [null, true]] }, { name: "Шумен/Варна?", rows: [["втори"]] }] },
    });
    expect(out.sheets).toBe(2);
    const doc = await readDocument({ buffer: out.buffer, kind: "xlsx", name: out.name });
    expect(doc.sheets.map((s) => s.name)).toEqual(["Шумен Варна", "Шумен Варна (2)"]);
    expect(doc.sheets[0].rows[0]).toEqual(["Имот", "Наем €"]);
    expect(doc.sheets[0].rows[1]).toEqual(["Апартамент – център", 450]);
    expect(doc.sheets[0].rows[2][0]).toBe("=HYPERLINK(1)"); // stored as text, never as a formula
    expect(doc.text).toContain("## Шумен Варна");
  });

  it("CSV: BOM, ';' separator, quoting and formula neutralising; parser reads it back", async () => {
    const out = await createDocument({ format: "csv", title: "списък", content: { rows: [["Име", "Бележка"], ["Тест; Тестов", 'казва "здравей"'], ["=1+2", -5], ["-12,5", "@x"]] } });
    const text = out.buffer.toString("utf8");
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toContain('"Тест; Тестов";"казва ""здравей"""');
    expect(text).toContain("'=1+2;-5");
    expect(text).toContain("-12,5;'@x");
    const doc = await readDocument({ buffer: out.buffer, kind: "csv", name: out.name });
    expect(doc.sheets[0].rows[1]).toEqual(["Тест; Тестов", 'казва "здравей"']);
    expect(parseCsv("a,b\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("MD/TXT/JSON/HTML", async () => {
    const md = await createDocument({ format: "md", title: "Бележки", content: "# Заглавие\nТекст" });
    expect(md.buffer.toString("utf8")).toBe("# Заглавие\nТекст");
    const txt = await createDocument({ format: "txt", title: "Бележки", content: "ред 1\nред 2" });
    expect(txt.buffer.toString("utf8")).toBe("﻿ред 1\r\nред 2");
    const json = await createDocument({ format: "json", title: "данни", content: { a: [1, "б"] } });
    expect(JSON.parse(json.buffer.toString("utf8"))).toEqual({ a: [1, "б"] });
    const html = await createDocument({ format: "html", title: "Оферта", content: [{ type: "h1", text: "Оферта <script>" }, { type: "p", text: "Цена: 100 €" }] });
    const h = html.buffer.toString("utf8");
    expect(h).toContain("Content-Security-Policy");
    expect(h).toContain("Оферта &lt;script&gt;");
    expect(h).not.toMatch(/<script/i);
    const back = await readDocument({ buffer: html.buffer, kind: "text", name: html.name, mime: html.mime });
    expect(back.text).toContain("Цена: 100 €");
  });

  it("refuses unknown formats and oversized content", async () => {
    await expect(createDocument({ format: "exe", title: "x", content: "" })).rejects.toMatchObject({ code: "invalid" });
    await expect(createDocument({ format: "pdf", title: "x", content: 5 })).rejects.toMatchObject({ code: "invalid" });
    await expect(createDocument({ format: "pdf", title: "x", content: Array(2001).fill({ type: "p", text: "a" }) })).rejects.toMatchObject({ code: "invalid" });
    await expect(createDocument({ format: "pdf", title: "x", content: [{ type: "p", text: "а".repeat(400_001) }] })).rejects.toMatchObject({ code: "invalid" });
    await expect(readDocument({ buffer: Buffer.from("x"), kind: "other" })).rejects.toMatchObject({ code: "unsupported" });
  });

  it("reports a PDF without a text layer as scanned", async () => {
    const out = await createDocument({ format: "pdf", title: "празен", content: [{ type: "hr" }] });
    const doc = await readDocument({ buffer: out.buffer, kind: "pdf", name: "scan.pdf" });
    expect(doc.note).toMatch(/Сканиран PDF/);
  });
});

describe("document helpers", () => {
  it("file names are Windows-safe, keep Cyrillic and get the format's extension", () => {
    expect(fileName("Оферта: ап. 3/Шумен", undefined, "pdf")).toBe("Оферта ап. 3 Шумен.pdf");
    expect(fileName("x", "con", "txt")).toBe("con_.txt");
    expect(fileName("", "", "docx")).toBe("Документ.docx");
    expect(fileName("a", "отчет.xlsx", "csv")).toBe("отчет.csv");
  });

  it("model HTML as a string is never kept as HTML: only its text, rendered by our own escaped template with the CSP first", async () => {
    // The three bypasses of the old regex sanitizer (security review) and a plain one.
    const payloads = [
      `<header>Оферта</header><scr<script>ipt>document.title="PWNED"</scr<script>ipt>`,
      `<header>Оферта</header><img src="x"/onerror="document.title='PWNED'">`,
      `<p>Оферта</p><me<meta>ta http-equiv="refresh" content="0;url=https://phish.example/login">`,
      `<html><head><title>t</title><script>alert(1)</script></head><body onload="x()"><a href="javascript:alert(1)">a</a><iframe src="https://e.test"></iframe><p>текст</p></body></html>`,
    ];
    for (const content of payloads) {
      const html = (await createDocument({ format: "html", title: "Оферта", content })).buffer.toString();
      const body = html.slice(html.indexOf("<body>"));
      expect(body).not.toMatch(/<(script|img|meta|iframe|a)\b|on(error|load)\s*=|javascript:/i);
      expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf("<body>"));
      expect(html.match(/<head>/g)).toHaveLength(1); // our template's head only; model text only inside <body>
      expect(html.match(/<meta\b/g)).toHaveLength(3); // charset, CSP, viewport – all ours
    }
    expect(htmlToBlocks("<h1>Оферта</h1><p>Цена &amp; условия</p><ul><li>едно</li></ul>")).toEqual([
      { type: "h1", text: "Оферта" }, { type: "p", text: "Цена & условия" }, { type: "p", text: "• едно" },
    ]);
  });

  it("normalizes blocks: strings become paragraphs, unknown types are text, image refs must be file ids", () => {
    expect(normalizeBlocks("а\n\nб")).toEqual([{ type: "p", text: "а", align: "left" }, { type: "p", text: "б", align: "left" }]);
    expect(normalizeBlocks([{ type: "weird", text: "x" }, { type: "image", file: "http://e.test/a.png" }, { type: "image", file: "file:abcdefgh12" }])).toEqual([
      { type: "p", text: "x", align: "left" }, { type: "image", file: "abcdefgh12" },
    ]);
  });

  it("encodes TrueType simple glyphs from outlines and splits runs by script", () => {
    expect(encodeGlyph({ commands: [] }).length).toBe(0);
    const g = encodeGlyph({ commands: [{ command: "moveTo", args: [0, 0] }, { command: "lineTo", args: [100, 0] }, { command: "quadraticCurveTo", args: [100, 100, 0, 100] }, { command: "closePath", args: [] }] });
    const v = new DataView(g.buffer);
    expect(v.getInt16(0)).toBe(1); // one contour
    expect([v.getInt16(2), v.getInt16(4), v.getInt16(6), v.getInt16(8)]).toEqual([0, 0, 100, 100]);
    expect(g.length % 4).toBe(0);
    const pick = (role, ch) => (/[Ѐ-ӿ]/.test(ch) ? "cy" : "la");
    expect(splitRuns("Тест abc тест", "body", pick)).toEqual([{ font: "cy", text: "Тест" }, { font: "la", text: " abc " }, { font: "cy", text: "тест" }]);
    const fonts = loadFonts({ fallbacks: [] });
    expect(fonts.body).toHaveLength(2);
    expect(fonts.head).toHaveLength(2);
  });

  it("reads PNG and JPEG sizes", () => {
    const png = Buffer.alloc(24);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);
    expect(imageSize(png)).toEqual({ width: 640, height: 480, type: "png" });
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(imageSize(jpg)).toEqual({ width: 640, height: 480, type: "jpg" });
    expect(imageSize(Buffer.from("GIF89a................."))).toBeNull();
  });
});
