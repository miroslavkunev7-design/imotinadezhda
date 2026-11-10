// Тест: четене на ZIP и правила за безопасност (TASK-006, ARCHIVE_SAFETY.md). Чист node + assert, без мрежа.  node api/_nc-import-zip.test.js
"use strict";
const assert = require("assert");
const zlib = require("zlib");
const Z = require("./_nc-import-zip.js"), F = require("./_nc-import-fixtures.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("PASS  " + name); };

t("нормален архив: имената (UTF-8 и кирилица), размерите и CRC се проверяват; файлът се разархивира точно", () => {
  const z = F.makeZip([{ name: "PROJECT_PACKAGE/unit-data/TEST-Обекти.csv", data: "Обект;Етаж\nTEST-A1;1\n" }, { name: "PROJECT_PACKAGE/floor-plans/", data: "" }, { name: "a.txt", data: "TEST", method: 0 }]);
  const l = Z.listZip(z);
  assert.ok(l.ok && !l.unsafe); assert.strictEqual(l.entries.filter((e) => !e.dir).length, 2);
  const e = l.entries.find((x) => x.path.endsWith(".csv"));
  assert.strictEqual(e.path, "PROJECT_PACKAGE/unit-data/TEST-Обекти.csv");
  const r = Z.extractEntry(z, e); assert.ok(r.ok); assert.strictEqual(r.buf.toString("utf8"), "Обект;Етаж\nTEST-A1;1\n");
});

t("„../“, „..\\“, абсолютен път, буква на диск и контролни знаци → целият архив е отказан", () => {
  for (const name of ["../evil.txt", "a/../../evil.txt", "..\\evil.txt", "/etc/passwd", "C:\\Windows\\x.dll", "a/\u0001b.txt", "a/ ../b"]) {
    const l = Z.listZip(F.makeZip([{ name: "ok.txt", data: "x" }, { name, data: "TEST" }]));
    assert.ok(!l.ok && l.unsafe, "трябва да е отказан: " + JSON.stringify(name));
    assert.ok(l.issues.some((i) => i.code === "unsafe_path"), name);
  }
  assert.deepStrictEqual(Z.safeEntryPath("./a//b/./c.txt"), { path: "a/b/c.txt", dir: false });
});

t("zip bomb: (а) обявен огромен общ размер, (б) огромно съотношение, (в) лъжлив размер → отказ; изходът е с таван", () => {
  const big = Buffer.alloc(30 * 1048576, 0);       // 30 MB нули → компресира се до ~30 KB
  const l1 = Z.listZip(F.makeZip([{ name: "zeros.bin", data: big }]));
  assert.ok(!l1.ok && l1.issues.some((i) => i.code === "bomb_ratio"), "съотношение");
  const many = []; for (let i = 0; i < 12; i++) many.push({ name: "p" + i + ".bin", data: Buffer.alloc(1, i), lie_usize: 39 * 1048576 });
  const l2 = Z.listZip(F.makeZip(many), { maxRatio: 1e12 });
  assert.ok(!l2.ok && l2.issues.some((i) => i.code === "bomb_total"), "общ размер");
  // лъжлив обявен размер: 1 KB обявени, реално 2 MB → таванът на изхода спира разархивирането
  const liar = F.makeZip([{ name: "liar.txt", data: Buffer.alloc(2 * 1048576, 65), lie_usize: 1024 }]);
  const l3 = Z.listZip(liar); assert.ok(l3.ok);
  const r = Z.extractEntry(liar, l3.entries[0]);
  assert.strictEqual(r.ok, false); assert.strictEqual(r.code, "bomb_size");
});

t("криптиран архив, символна връзка, дублирани имена и разлика между локално и централно име → отказ", () => {
  const enc = Z.listZip(F.makeZip([{ name: "secret.xlsx", data: "TEST", encrypt: true }]));
  assert.ok(!enc.ok && enc.encrypted && enc.issues[0].code === "encrypted");
  const sym = Z.listZip(F.makeZip([{ name: "link", data: "/etc/passwd", symlink: true }]));
  assert.ok(!sym.ok && sym.issues[0].code === "symlink");
  const dup = Z.listZip(F.makeZip([{ name: "a.txt", data: "1" }, { name: "A.TXT", data: "2" }]));
  assert.ok(!dup.ok && dup.issues[0].code === "duplicate_name");
  const mis = F.makeZip([{ name: "plan.pdf", local_name: "../plan.pdf", data: "%PDF-1.7" }]);
  const lm = Z.listZip(mis); assert.ok(lm.ok);
  assert.strictEqual(Z.extractEntry(mis, lm.entries[0]).code, "name_mismatch");
});

t("твърде много файлове (2001) → отказ; вложен архив се отбелязва (не се разархивира); системни файлове се пропускат", () => {
  const files = []; for (let i = 0; i < 2001; i++) files.push({ name: "f" + i + ".txt", data: "x", method: 0 });
  const l = Z.listZip(F.makeZip(files)); assert.ok(!l.ok && l.issues[0].code === "too_many");
  const z = Z.listZip(F.makeZip([{ name: "inner/pack.zip", data: F.makeZip([{ name: "x.txt", data: "x" }]) }, { name: "__MACOSX/._a", data: "x" }, { name: "dir/.DS_Store", data: "x" }]));
  assert.ok(z.ok); assert.ok(z.entries.find((e) => e.path === "inner/pack.zip").nested);
  assert.strictEqual(z.entries.filter((e) => e.ignored).length, 2);
});

t("повреден / съкратен архив, лош CRC, неподдържан метод и файл над 40 MB → ясна причина, без изключение", () => {
  const good = F.makeZip([{ name: "a.txt", data: "TEST TEST TEST" }]);
  for (const b of [Buffer.alloc(0), Buffer.from("PK\u0003\u0004 not a zip"), good.slice(0, good.length - 30), Buffer.concat([good.slice(0, 20), Buffer.alloc(40), good.slice(60)])]) {
    const l = Z.listZip(b); assert.ok(!l.ok, "повреден");
  }
  const crc = F.makeZip([{ name: "a.txt", data: "TEST", bad_crc: true }]);
  assert.strictEqual(Z.extractEntry(crc, Z.listZip(crc).entries[0]).code, "crc");
  const m = F.makeZip([{ name: "a.txt", data: "TEST", method: 0 }]); m.writeUInt16LE(12, m.indexOf(Buffer.from([0x50, 0x4b, 1, 2])) + 10);
  const lm = Z.listZip(m); assert.ok(lm.ok && lm.entries[0].unsupported);
  const huge = Z.listZip(F.makeZip([{ name: "big.bin", data: Buffer.alloc(16), lie_usize: 41 * 1048576 }]), { maxRatio: 1e12 });
  assert.ok(huge.ok && huge.entries[0].too_large);
});

t("име без флаг UTF-8 в кодировка cp866 (български Windows) се чете правилно", () => {
  const raw = Buffer.from(new Uint8Array([0x8e, 0xa1, 0xa5, 0xaa, 0xe2, 0xa8, 0x2e, 0x63, 0x73, 0x76]));   // „Обекти.csv“ в cp866
  const l = Z.listZip(F.makeZip([{ name: "x", raw_name: raw, utf8: false, data: "TEST" }]));
  assert.ok(l.ok); assert.strictEqual(l.entries[0].path, "Обекти.csv");
});

t("inflate с таван: дори без лъжа в заглавието изходът никога не надхвърля обявения размер + 1 байт", () => {
  const data = Buffer.alloc(3 * 1048576, 7);
  const z = F.makeZip([{ name: "a.bin", data }]);
  const l = Z.listZip(z, { maxRatio: 1e12 }); const r = Z.extractEntry(z, l.entries[0]);
  assert.ok(r.ok && r.buf.length === data.length);
  assert.throws(() => zlib.inflateRawSync(zlib.deflateRawSync(data), { maxOutputLength: 1024 }));
});

console.log("\n" + n + "/" + n + " минали");
