// ИМОТИ НАДЕЖДА · импорт (TASK-006) · ТЕСТОВИ данни – само за тестовете (api/_nc-import-*.test.js) и за локалния харнес.
// Не се зарежда от сървърния код. Всички стойности са очевидно тестови (TEST-…), без реални имена, телефони или цени на реални имоти.
"use strict";
const zlib = require("zlib");
const { crc32 } = require("./_nc-import-zip.js");

/* ZIP писач: { name, data, method(0|8), utf8, encrypt, symlink, lie_usize, raw_name(Buffer) } */
function makeZip(files, opts) {
  opts = opts || {};
  const locals = [], central = [];
  let off = 0;
  for (const f of files) {
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data == null ? "" : String(f.data), "utf8");
    const method = f.method == null ? 8 : f.method;
    const comp = method === 8 ? zlib.deflateRawSync(data) : data;
    const nameB = f.raw_name || Buffer.from(f.name, "utf8");
    const flags = (f.utf8 === false ? 0 : 0x800) | (f.encrypt ? 1 : 0);
    const usize = f.lie_usize != null ? f.lie_usize : data.length;
    const crc = f.bad_crc ? (crc32(data) ^ 1) >>> 0 : crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(usize, 22);
    const lname = f.local_name ? Buffer.from(f.local_name, "utf8") : nameB;
    lh.writeUInt16LE(lname.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, lname, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(f.symlink ? (3 << 8) | 20 : 20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(flags, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(usize, 24);
    ch.writeUInt16LE(nameB.length, 28); ch.writeUInt32LE(f.symlink ? (0o120777 << 16) >>> 0 : 0, 38); ch.writeUInt32LE(off, 42);
    central.push(ch, nameB);
    off += 30 + lname.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(locals.concat([cd, end]));
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/* XLSX: sheets = [{ name, rows: [[value|{f:'формула', v}|null,...],...] }]; низовете отиват в sharedStrings (и някои inline) */
function makeXlsx(sheets, opts) {
  opts = opts || {};
  const sst = [], sstIdx = new Map();
  const si = (s) => { if (!sstIdx.has(s)) { sstIdx.set(s, sst.length); sst.push(s); } return sstIdx.get(s); };
  const files = [];
  files.push({ name: "[Content_Types].xml", data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>' });
  files.push({ name: "xl/workbook.xml", data: '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map((s, i) => '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + "</sheets></workbook>" });
  files.push({ name: "xl/_rels/workbook.xml.rels", data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="' + (i === 1 && opts.absTarget ? "/xl/" : "") + "worksheets/sheet" + (i + 1) + '.xml"/>').join("") +
    '<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>' });
  sheets.forEach((s, i) => {
    const rows = s.rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
      if (v == null || v === "") return "";
      const ref = colName(ci) + (ri + 1);
      if (typeof v === "number") return '<c r="' + ref + '"><v>' + v + "</v></c>";
      if (typeof v === "boolean") return '<c r="' + ref + '" t="b"><v>' + (v ? 1 : 0) + "</v></c>";
      if (typeof v === "object" && v.f) return '<c r="' + ref + '">' + "<f>" + esc(v.f) + "</f>" + (v.v != null ? "<v>" + v.v + "</v>" : "") + "</c>";
      if ((ci + ri) % 5 === 4) return '<c r="' + ref + '" t="inlineStr"><is><t>' + esc(v) + "</t></is></c>";
      return '<c r="' + ref + '" t="s"><v>' + si(String(v)) + "</v></c>";
    }).join("") + "</row>").join("");
    files.push({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", data: '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows + "</sheetData></worksheet>" });
  });
  files.push({ name: "xl/sharedStrings.xml", data: '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + sst.length + '">' +
    sst.map((s, k) => (k % 3 === 2 ? "<si><r><t>" + esc(s.slice(0, 2)) + "</t></r><r><t>" + esc(s.slice(2)) + "</t></r></si>" : "<si><t>" + esc(s) + "</t></si>")).join("") + "</sst>" });
  return makeZip(files);
}

/* ODS: sheets = [{ name, rows }] */
function makeOds(sheets) {
  const cell = (v) => v == null || v === "" ? "<table:table-cell/>" : typeof v === "number"
    ? '<table:table-cell office:value-type="float" office:value="' + v + '"><text:p>' + String(v).replace(".", ",") + "</text:p></table:table-cell>"
    : '<table:table-cell office:value-type="string"><text:p>' + esc(v) + "</text:p></table:table-cell>";
  const content = '<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:spreadsheet>' +
    sheets.map((s) => '<table:table table:name="' + esc(s.name) + '">' + s.rows.map((r) => "<table:table-row>" + r.map(cell).join("") + '<table:table-cell table:number-columns-repeated="1000"/></table:table-row>').join("") + '<table:table-row table:number-rows-repeated="1048000"><table:table-cell table:number-columns-repeated="1024"/></table:table-row></table:table>').join("") +
    "</office:spreadsheet></office:body></office:document-content>";
  return makeZip([{ name: "mimetype", data: "application/vnd.oasis.opendocument.spreadsheet", method: 0 }, { name: "content.xml", data: content }]);
}

/* PDF: vector = текст + линии; scan = само картина на цялата страница */
function makePdf(kind, opts) {
  opts = opts || {};
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  let content;
  if (kind === "scan") content = "q 595 0 0 842 0 0 cm /Im1 Do Q";
  else content = "BT /F1 18 Tf 50 780 Td (TEST Etazh 3 razpredelenie) Tj ET\n" + Array.from({ length: 40 }, (_, i) => (50 + i * 10) + " 100 m " + (50 + i * 10) + " 700 l S").join("\n") + "\n100 100 300 200 re S";
  const stream = opts.deflate === false ? Buffer.from(content) : zlib.deflateSync(Buffer.from(content));
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << " + (kind === "scan" ? "/XObject << /Im1 5 0 R >>" : "/Font << /F1 5 0 R >>") + " >> >>");
  add({ stream, dict: "<< /Length " + stream.length + (opts.deflate === false ? "" : " /Filter /FlateDecode") + " >>" });
  if (kind === "scan") { const img = zlib.deflateSync(Buffer.alloc(200 * 280, 200)); add({ stream: img, dict: "<< /Type /XObject /Subtype /Image /Width 200 /Height 280 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length " + img.length + " >>" }); }
  else add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const parts = [Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1")]; const xref = [];
  let pos = parts[0].length;
  objs.forEach((o, i) => {
    const head = Buffer.from((i + 1) + " 0 obj\n" + (typeof o === "string" ? o + "\n" : o.dict + "\nstream\n"), "latin1");
    const body = typeof o === "string" ? Buffer.alloc(0) : Buffer.concat([o.stream, Buffer.from("\nendstream\n")]);
    const tail = Buffer.from("endobj\n");
    xref.push(pos); parts.push(head, body, tail); pos += head.length + body.length + tail.length;
  });
  const trailer = "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + xref.map((x) => String(x).padStart(10, "0") + " 00000 n \n").join("") +
    "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R" + (opts.encrypt ? " /Encrypt << /Filter /Standard >>" : "") + " >>\nstartxref\n" + pos + "\n%%EOF\n";
  parts.push(Buffer.from(trailer, "latin1"));
  return Buffer.concat(parts);
}

function makePng(w, h) {
  const { PNG } = require("./_vendor/pngjs/lib/png.js");
  const p = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) { p.data[i * 4] = 240; p.data[i * 4 + 1] = 236; p.data[i * 4 + 2] = 228; p.data[i * 4 + 3] = 255; }
  for (let x = 10; x < w - 10; x++) for (const y of [10, h - 11]) { const o = (y * w + x) * 4; p.data[o] = p.data[o + 1] = p.data[o + 2] = 20; }
  return PNG.sync.write(p);
}
function makeJpeg(w, h) {
  const d = Buffer.alloc(w * h * 4, 200);
  return Buffer.from(require("./_vendor/jpeg-js").encode({ data: d, width: w, height: h }, 80).data);
}
const DXF = "  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1027\n  9\n$INSUNITS\n 70\n4\n  0\nENDSEC\n  0\nSECTION\n  2\nTABLES\n  0\nTABLE\n  2\nLAYER\n  0\nLAYER\n  2\nWALLS\n  0\nLAYER\n  2\nTEST-DOORS\n  0\nENDTAB\n  0\nENDSEC\n  0\nSECTION\n  2\nENTITIES\n  0\nLINE\n  8\nWALLS\n  0\nLINE\n  8\nWALLS\n  0\nENDSEC\n  0\nEOF\n";
const IFC = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('TEST'),'2;1');\nFILE_NAME('TEST.ifc','2026-01-01T00:00:00',(''),(''),'','','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n#1=IFCPROJECT('0TEST',$,'TEST',$,$,$,$,$,$);\n#2=IFCBUILDING('1TEST',$,'TEST',$,$,$,$,$,$,$,$,$);\n#3=IFCBUILDINGSTOREY('2TEST',$,'TEST-E1',$,$,$,$,$,.ELEMENT.,0.);\n#4=IFCBUILDINGSTOREY('3TEST',$,'TEST-E2',$,$,$,$,$,.ELEMENT.,3.);\n#5=IFCSPACE('4TEST',$,'TEST-A1',$,$,$,$,$,.ELEMENT.,.INTERNAL.,$);\nENDSEC;\nEND-ISO-10303-21;\n";
const DWG = Buffer.concat([Buffer.from("AC1032"), Buffer.alloc(200, 0)]);
function makeGlb(extUri) {
  const json = Buffer.from(JSON.stringify({ asset: { version: "2.0", generator: "TEST" }, meshes: [{ primitives: [] }], materials: [{}], buffers: extUri ? [{ uri: extUri, byteLength: 4 }] : [{ byteLength: 4 }] }), "utf8");
  const jpad = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const bin = Buffer.alloc(4);
  const total = 12 + 8 + jpad.length + (extUri ? 0 : 8 + bin.length);
  const h = Buffer.alloc(12); h.write("glTF", 0, "latin1"); h.writeUInt32LE(2, 4); h.writeUInt32LE(total, 8);
  const jc = Buffer.alloc(8); jc.writeUInt32LE(jpad.length, 0); jc.write("JSON", 4, "latin1");
  const parts = [h, jc, jpad];
  if (!extUri) { const bc = Buffer.alloc(8); bc.writeUInt32LE(bin.length, 0); bc.write("BIN\0", 4, "latin1"); parts.push(bc, bin); }
  return Buffer.concat(parts);
}

/* Пълен синтетичен ТЕСТОВ пакет (структура от 07_FILE_FORMATS/PACKAGE_STRUCTURE_EXAMPLE.txt) */
function testPackage() {
  const header = ["Обект", "Вход", "Етаж", "Обща площ (м²)", "Чиста площ", "Тераса", "Стаи", "Спални", "Бани", "Изложение", "Цена на кв.м", "Обща цена", "Статус", "Инвеститор"];
  const rows = [header,
    ["TEST-A1", "А", "1", "102,70", "88,10", "6,5", 3, 2, 1, "юг", "2 100 €", "", "продаден", "TEST-не се внася"],
    ["TEST-A2", "А", "1", 75.4, 63.2, "", 2, 1, 1, "Ю-И", 2000, "", "", ""],
    ["TEST-A3", "А", "2-ри", "60.00", "", "4", 2, 1, 1, "север", "", "120 000 €", "", ""],
    ["TEST-A4", "А", "Партер", "-5", "", "", "", "", "", "", "1950", "", "", ""],
    ["TEST-A5", "А", "3", "50", "60", "", 1, 0, 1, "", "2 050,00", "", "", ""],
    ["TEST-A5", "А", "3", "51", "", "", 1, 0, 1, "", "2050", "", "", ""],
    ["TEST-A6", "А", "мансарда", "70", "", "", 2, 1, 1, "", "2,100", "", "", ""]
  ];
  const xlsx = makeXlsx([{ name: "Обекти", rows: [["TEST ценова листа – само тестови данни"], [], ...rows] }, { name: "Бележки", rows: [["TEST"]] }]);
  const csv = Buffer.from("Апартамент;Вход;Етаж;Обща площ;Чиста площ;Цена на кв.м\r\nTEST-A1;А;1;103,10;88,10;2100\r\nTEST-A7;А;4;80;70;\r\n", "utf8");
  const info = Buffer.from(JSON.stringify({ schema: "nd-project-info/1", title: "TEST-ПРОЕКТ Импорт", city: "TEST-Град", hood: "TEST-Квартал", stage: "Акт 14", advantages: ["TEST-предимство"], builder: "TEST-не се внася" }), "utf8");
  return [
    { name: "PROJECT_PACKAGE/unit-data/TEST-Обекти.xlsx", data: xlsx },
    { name: "PROJECT_PACKAGE/unit-data/TEST-доп.csv", data: csv },
    { name: "PROJECT_PACKAGE/project-info/project.json", data: info },
    { name: "PROJECT_PACKAGE/floor-plans/TEST-Етаж-1.pdf", data: makePdf("vector") },
    { name: "PROJECT_PACKAGE/floor-plans/TEST-scan-etazh-2.pdf", data: makePdf("scan") },
    { name: "PROJECT_PACKAGE/unit-plans/TEST-A1.png", data: makePng(120, 90) },
    { name: "PROJECT_PACKAGE/visualizations/TEST-fasada.jpg", data: makeJpeg(160, 90) },
    { name: "PROJECT_PACKAGE/source-model/TEST-model.dwg", data: DWG },
    { name: "PROJECT_PACKAGE/source-model/TEST-model.dxf", data: Buffer.from(DXF) },
    { name: "PROJECT_PACKAGE/source-model/TEST-model.ifc", data: Buffer.from(IFC) },
    { name: "PROJECT_PACKAGE/source-model/TEST-model.glb", data: makeGlb() },
    { name: "PROJECT_PACKAGE/documents/TEST-бележка.txt", data: Buffer.from("TEST бележка – не се внася като данни") },
    { name: "PROJECT_PACKAGE/documents/TEST-копие.png", data: makePng(120, 90) }
  ];
}

module.exports = { makeZip, makeXlsx, makeOds, makePdf, makePng, makeJpeg, makeGlb, DXF, IFC, DWG, testPackage, colName };
