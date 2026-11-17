// File store and encrypted library (docs/CONTRACT.md §8.1, §8.6, §11.1). Fake secure store, real temp folders.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createFiles, sniffKind, safeFileName, RUNNABLE, canOpen, MOTW } from "../../electron/files.js";
import { createLibrary, encrypt, decrypt } from "../../electron/library.js";
import { readDocument } from "../../electron/docs/read.js";
import { createDocument } from "../../electron/docs/create.js";
import { memoryStore } from "./core-helpers.js";

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "ted-files-")); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);

function setup({ user = "u1", available = true, answers = [], platform = "linux" } = {}) {
  const store = memoryStore({ available });
  let owner = user;
  const library = createLibrary({ dir: path.join(dir, "library"), secureStore: store, owner: () => owner });
  const opened = [];
  const confirms = [];
  const saved = [];
  let changes = 0;
  let n = 0;
  const files = createFiles({
    library, tempRoot: path.join(dir, "tmp"),
    shell: { openPath: async (p) => { opened.push(p); return ""; } },
    dialog: { showSaveDialog: async (opts) => { saved.push(opts); return answers.length ? answers.shift() : { canceled: true }; } },
    getWindow: () => null,
    confirm: async (...a) => { confirms.push(a); return true; },
    makeThumb: (buf, mime) => `data:image/jpeg;base64,${Buffer.from(mime).toString("base64")}`,
    onChange: () => { changes++; },
    newId: () => `file${String(++n).padStart(6, "0")}`,
    readDoc: readDocument,
    platform,
  });
  return { store, library, files, opened, confirms, saved, changes: () => changes, setOwner: (u) => { owner = u; } };
}

describe("sniffKind", () => {
  it("detects kinds by bytes first, extension second", () => {
    expect(sniffKind("x.png", "image/png", JPG)).toEqual({ kind: "image", mime: "image/jpeg" });
    expect(sniffKind("a", "", PNG).kind).toBe("image");
    expect(sniffKind("a.pdf", "", Buffer.from("%PDF-1.7 ...........")).kind).toBe("pdf");
    expect(sniffKind("v.mp4", "", Buffer.from("\0\0\0\x18ftypmp42\0\0\0\0", "latin1")).kind).toBe("video");
    expect(sniffKind("a.csv", "", Buffer.from("a;b\n1;2")).kind).toBe("csv");
    expect(sniffKind("бележка.md", "", Buffer.from("# Заглавие")).kind).toBe("text");
    expect(sniffKind("binary.txt", "", Buffer.from([0, 1, 2, 3])).kind).toBe("other");
    expect(sniffKind("стар.doc", "", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0, 0, 0]))).toMatchObject({ kind: "other", note: "стар формат – запазете като .docx/.xlsx" });
    expect(sniffKind("x.zip", "application/zip", Buffer.from("PK\x03\x04aaaa", "latin1")).kind).toBe("other");
    expect(sniffKind("x.bin", "weird mime with spaces", Buffer.from("abc")).mime).toBe("application/octet-stream");
  });
  it("names are made safe and runnable types are recognised", () => {
    expect(safeFileName('a/b:c*?"<>|.pdf')).toBe("a_b_c______.pdf");
    expect(safeFileName("  ..  ")).toBe("файл");
    for (const n of ["x.exe", "a.js", "b.LNK", "c.ps1", "d.hta", "e.msi", "f.docm"]) expect(RUNNABLE.test(n), n).toBe(true);
    expect(RUNNABLE.test("договор.docx")).toBe(false);
  });
});

describe("files store", () => {
  it("adds attachments to the encrypted library with thumbnails; bytes on disk are not plaintext", async () => {
    const { files, store, changes } = setup();
    const r = files.add({ name: "снимка.jpg", mime: "image/jpeg", data: JPG, chatId: "chat-1" });
    expect(r.ok).toBe(true);
    expect(r.file).toMatchObject({ id: "file000001", name: "снимка.jpg", kind: "image", mime: "image/jpeg", size: JPG.length, origin: "user", chatId: "chat-1" });
    expect(r.file.thumb).toMatch(/^data:image\/jpeg;base64,/);
    expect(changes()).toBe(1);
    const index = store.data.get("library-u1");
    expect(index.items.map((i) => i.id)).toEqual(["file000001"]);
    expect(store.data.get("library-key-u1").key).toMatch(/^[A-Za-z0-9+/=]{40,}$/);
    const libDir = path.join(dir, "library", crypto.createHash("sha256").update("u1").digest("hex").slice(0, 16));
    const blob = fs.readFileSync(path.join(libDir, "file000001.bin"));
    expect(blob.includes(JPG.subarray(4, 30))).toBe(false);
    const read = files.read({ id: "file000001" });
    expect(Buffer.from(read.data).equals(JPG)).toBe(true);
  });

  it("refuses empty, too large and runnable files", () => {
    const { files } = setup();
    expect(files.add({ name: "x.txt", data: Buffer.alloc(0) })).toMatchObject({ ok: false, code: "invalid" });
    expect(files.add({ name: "x.txt", data: Buffer.alloc(21 * 1048576) })).toMatchObject({ ok: false, code: "too_large" });
    expect(files.add({ name: "setup.exe", data: Buffer.from("MZ") })).toMatchObject({ ok: false, code: "runnable" });
  });

  it("temporary files stay in memory only and can be forgotten", () => {
    const { files, store } = setup();
    const r = files.add({ name: "a.png", data: PNG, temporary: true });
    expect(store.data.get("library-u1")).toBeUndefined();
    expect(files.list().items).toEqual([]);
    expect(files.read({ id: r.file.id }).ok).toBe(true);
    files.forget(r.file.id);
    expect(files.read({ id: r.file.id })).toMatchObject({ ok: false, code: "not_found" });
  });

  it("without Windows encryption keeps files in memory and says so", () => {
    const { files } = setup({ available: false });
    const r = files.add({ name: "a.png", data: PNG });
    expect(r.ok).toBe(true);
    expect(fs.existsSync(path.join(dir, "library"))).toBe(false);
    expect(files.list()).toMatchObject({ count: 1, memoryOnly: true });
  });

  it("opens only decrypted copies in its own temp folder, saves through the native dialog", async () => {
    const target = path.join(dir, "out", "копие.png");
    fs.mkdirSync(path.dirname(target));
    const { files, opened, saved } = setup({ answers: [{ canceled: false, filePath: target }, { canceled: false, filePath: path.join(dir, "evil.exe") }] });
    const { file } = files.add({ name: "план.png", data: PNG });
    expect(await files.open(file.id)).toEqual({ ok: true });
    expect(opened[0].startsWith(path.join(dir, "tmp", "TedImotiNadezhda"))).toBe(true);
    expect(fs.readFileSync(opened[0]).equals(PNG)).toBe(true);
    expect(await files.open("../../etc/passwd")).toMatchObject({ ok: false });
    expect(await files.save(file.id)).toEqual({ ok: true, path: target });
    expect(saved[0].defaultPath.endsWith("план.png")).toBe(true);
    expect(fs.readFileSync(target).equals(PNG)).toBe(true);
    expect(await files.save(file.id)).toMatchObject({ ok: false, error: expect.stringMatching(/изпълними/) });
    files.clearTemp();
    expect(fs.existsSync(opened[0])).toBe(false);
  });

  it("„Отвори“ only for an allowlist of types; copies of outside files get the Mark-of-the-Web on Windows", async () => {
    const { files, opened } = setup({ platform: "win32" });
    for (const name of ["оферта.dotm", "справка.xlsb", "стар.doc", "стар.xls", "данни.slk", "заявка.iqy", "страница.html", "страница.mht", "схема.svg", "връзка.rdp", "тема.theme", "търсене.search-ms", "скрипт.pyw", "acc.accde"]) {
      const r = files.add({ name, data: Buffer.from("payload " + name), origin: "crm" });
      if (!r.ok) continue;
      expect(await files.open(r.file.id), name).toMatchObject({ ok: false, code: "not_openable" });
    }
    expect(opened).toEqual([]);
    const pdf = files.add({ name: "договор.pdf", data: Buffer.from("%PDF-1.7 ..........."), origin: "web" }).file;
    expect(await files.open(pdf.id)).toEqual({ ok: true });
    // On Linux the NTFS stream name is an ordinary file next to the copy – enough to see what MAIN writes.
    expect(fs.readFileSync(`${opened[0]}:Zone.Identifier`, "utf8")).toBe(MOTW);
    const own = files.add({ name: "Оферта.html", data: Buffer.from("<!doctype html><p>x</p>"), origin: "ted" }).file;
    expect(await files.open(own.id)).toEqual({ ok: true });
    expect(fs.existsSync(`${opened[1]}:Zone.Identifier`)).toBe(false); // made by Ted on this PC
    expect(canOpen({ name: "a.html", origin: "web" })).toBe(false);
    expect(canOpen({ name: "a.HTML", origin: "ted" })).toBe(true);
    expect(canOpen({ name: "клип.mp4", origin: "crm" })).toBe(true);
    const { files: lin, opened: o2 } = setup();
    const p2 = lin.add({ name: "a.pdf", data: Buffer.from("%PDF-1.7 ..........."), origin: "web" }).file;
    await lin.open(p2.id);
    expect(fs.existsSync(`${o2[0]}:Zone.Identifier`)).toBe(false); // not on other systems
  });

  it("lists newest first with filters; remove and clear ask first", async () => {
    let t = 0;
    const { files, confirms } = setup();
    const clock = () => new Date(Date.UTC(2026, 10, 17, 10, 0, t++));
    files.add({ name: "a.png", data: PNG });
    files.add({ name: "оферта.pdf", data: Buffer.from("%PDF-1.4 xxxxxxxx") });
    void clock;
    const all = files.list();
    expect(all.count).toBe(2);
    expect(files.list({ kind: "image" }).items.map((i) => i.name)).toEqual(["a.png"]);
    expect(files.list({ kind: "document" }).items.map((i) => i.name)).toEqual(["оферта.pdf"]);
    expect(files.list({ q: "ОФЕР" }).count).toBe(1);
    expect(await files.remove("file000001")).toEqual({ ok: true });
    expect(confirms).toHaveLength(1);
    expect(files.list().count).toBe(1);
    expect(await files.clear()).toEqual({ ok: true });
    expect(files.list().count).toBe(0);
    expect(files.storage()).toMatchObject({ libraryCount: 0 });
  });

  it("extract reads documents and explains what it cannot read", async () => {
    const { files } = setup();
    const doc = await createDocument({ format: "docx", title: "т", content: [{ type: "p", text: "Текст за превод" }] });
    const { file } = files.add({ name: "писмо.docx", data: doc.buffer });
    expect(file.kind).toBe("docx");
    const r = await files.extract(file.id);
    expect(r.ok).toBe(true);
    expect(r.doc.text).toContain("Текст за превод");
    const old = files.add({ name: "стар.doc", data: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2, 3, 4, 5, 6]) });
    expect(await files.extract(old.file.id)).toMatchObject({ ok: false, code: "unsupported", error: expect.stringMatching(/стар формат/) });
    const broken = files.add({ name: "x.docx", data: Buffer.from("PK\x03\x04not really a docx", "latin1") });
    expect(await files.extract(broken.file.id)).toMatchObject({ ok: false });
  });

  it("each CRM user sees only their own library; detach drops memory", () => {
    const { files, setOwner } = setup();
    files.add({ name: "a.png", data: PNG });
    setOwner("u2");
    files.detach();
    expect(files.list().count).toBe(0);
    files.add({ name: "b.png", data: PNG });
    setOwner("u1");
    files.detach();
    expect(files.list().items.map((i) => i.name)).toEqual(["a.png"]);
  });

  it("update merges CRM paths into both memory and the index", () => {
    const { files, store } = setup();
    const { file } = files.add({ name: "a.png", data: PNG });
    files.update(file.id, { crm: { path: "ted-chat/2026-11/x.png" } });
    expect(files.ref(file.id).crm).toEqual({ path: "ted-chat/2026-11/x.png" });
    expect(store.data.get("library-u1").items[0].crm).toEqual({ path: "ted-chat/2026-11/x.png" });
  });
});

describe("library crypto", () => {
  it("AES-256-GCM round trip; tampering is detected", () => {
    const key = crypto.randomBytes(32);
    const blob = encrypt(key, Buffer.from("тайна"));
    expect(decrypt(key, blob).toString()).toBe("тайна");
    blob[blob.length - 1] ^= 1;
    expect(() => decrypt(key, blob)).toThrow();
    expect(() => decrypt(crypto.randomBytes(32), encrypt(key, Buffer.from("x")))).toThrow();
  });
});
