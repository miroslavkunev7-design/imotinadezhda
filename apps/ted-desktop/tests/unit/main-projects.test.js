// Project folders (docs/CONTRACT.md §8.12, 0.1.5): the local folder of a Проект, its ZIP, „Запази в сайта“ only after the
// approval, the IPC checks and the speed caches of the model list / manifest. All fakes – no network, no Electron.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { createFiles } from "../../electron/files.js";
import { createProjects, uniqueNames, indexText, ZIP_MAX_BYTES } from "../../electron/projects.js";
import { createHandlers } from "../../electron/ipc.js";
import { createAssistant, MODELS_TTL_MS, RETRY_AFTER_MS } from "../../electron/backend/assistant.js";
import { createTools } from "../../electron/backend/tools.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(64).fill(7)]);
// A gallery photo must be over 15 000 bytes – the site skips smaller ones (api/_ted-skills.js images.download).
const PHOTO = Buffer.concat([JPEG, Buffer.alloc(20_000, 7)]);
const PDF = Buffer.from("%PDF-1.4\n% тест\n");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "ted-proj-"));

function store() {
  let n = 0;
  return createFiles({ library: null, tempRoot: tmp(), shell: {}, dialog: {}, confirm: async () => true, newId: () => `file${String(++n).padStart(6, "0")}`, now: () => new Date(Date.UTC(2026, 10, 17, 9, 0, n)) });
}

function env({ confirmAnswer = true, toolAnswer, savePath } = {}) {
  const files = store();
  const calls = { tools: [], uploads: [], sign: [], confirms: [], dialogs: [] };
  const uploads = { ensure: async (id) => { calls.uploads.push(id); return { path: `ted-chat/2026-11/${id}.bin`, name: files.ref(id).name, mime: files.ref(id).mime }; } };
  const tools = { call: async (tool, input) => { calls.tools.push([tool, structuredClone(input)]); return toolAnswer ? toolAnswer(tool, input) : { ok: true, result: tool === "images.download" ? { downloaded: input.urls.length } : { client: { name: "Тестов Клиент А" } } }; } };
  const session = { authed: async (opts) => { calls.sign.push(opts); return { ok: true, status: 200, json: opts.json.paths.map((p) => ({ path: p, signedURL: `/object/sign/nd-files/${p}?token=t` })) }; } };
  const dialog = { showSaveDialog: async (o) => { calls.dialogs.push(o); return savePath === null ? { canceled: true } : { canceled: false, filePath: savePath }; } };
  const projects = createProjects({ files, uploads, tools, session, dialog, getWindow: () => null, confirm: async (...a) => { calls.confirms.push(a); return confirmAnswer; }, documentsDir: () => "C:\\Docs" });
  const put = (name, data, extra = {}) => files.add({ name, mime: "", data, origin: "user", caseId: "case-1", caseTitle: "Продажба · къща", ...extra }).file;
  return { files, projects, calls, put };
}

describe("files store: folders of projects", () => {
  it("files carry the project; list filters by it; assign moves and takes out", () => {
    const { files, put } = env();
    const a = put("снимка.jpg", JPEG);
    put("скица.pdf", PDF);
    const other = files.add({ name: "друг.pdf", mime: "", data: PDF, origin: "user" }).file;
    expect(a).toMatchObject({ caseId: "case-1", caseTitle: "Продажба · къща", kind: "image" });
    expect(files.list({ caseId: "case-1" }).items.map((f) => f.name).sort()).toEqual(["скица.pdf", "снимка.jpg"]);
    expect(files.assign([other.id], { caseId: "case-1", caseTitle: "Продажба · къща" })).toHaveLength(1);
    expect(files.list({ caseId: "case-1" }).count).toBe(3);
    const out = files.assign([a.id], null);
    expect(out[0]).not.toHaveProperty("caseId");
    expect(files.list({ caseId: "case-1" }).count).toBe(2);
    expect(files.assign(["bad id!", "nonexistent1"], { caseId: "case-1" })).toEqual([]);
  });
});

describe("ZIP of a project folder", () => {
  it("holds every file of the folder with unique UTF-8 names and a Bulgarian index; photos/PDF are stored, text compressed", async () => {
    const { projects, put } = env();
    put("снимка.jpg", JPEG);
    put("снимка.jpg", JPEG);
    put("бележки.txt", Buffer.from("Текст ".repeat(200)));
    const z = await projects.zip({ caseId: "case-1", title: "Продажба · къща", client: "Тестов Клиент А" });
    expect(z).toMatchObject({ ok: true, count: 3, name: "Продажба · къща.zip" });
    const entries = unzipSync(new Uint8Array(z.buffer));
    expect(Object.keys(entries).sort()).toEqual(["Съдържание на папката.txt", "бележки.txt", "снимка (2).jpg", "снимка.jpg"].sort());
    expect(Buffer.from(entries["снимка.jpg"]).equals(JPEG)).toBe(true);
    const index = strFromU8(entries["Съдържание на папката.txt"]);
    expect(index).toContain("Проект: Продажба · къща");
    expect(index).toContain("Клиент: Тестов Клиент А");
    expect(index).toContain("снимка (2).jpg – снимка");
    // Local file headers: UTF-8 names (bit 11), the JPEG stored (method 0), the text deflated (method 8).
    const buf = z.buffer;
    const headers = [];
    for (let i = 0; i < buf.length - 4; i++) if (buf.readUInt32LE(i) === 0x04034b50) headers.push({ flags: buf.readUInt16LE(i + 6), method: buf.readUInt16LE(i + 8), name: buf.toString("utf8", i + 30, i + 30 + buf.readUInt16LE(i + 26)) });
    expect(headers.every((h) => h.flags & 0x800)).toBe(true);
    expect(headers.find((h) => h.name === "снимка.jpg").method).toBe(0);
    expect(headers.find((h) => h.name === "бележки.txt").method).toBe(8);
  });

  it("an empty folder or one over the size cap makes no ZIP", async () => {
    const { projects } = env();
    expect(await projects.zip({ caseId: "case-1", title: "x" })).toMatchObject({ ok: false, code: "empty" });
    const big = env();
    big.put("a.pdf", PDF);
    const ref = big.files.list({ caseId: "case-1" }).items[0];
    big.files.update(ref.id, { size: ZIP_MAX_BYTES + 1 });
    expect(await big.projects.zip({ caseId: "case-1", title: "x" })).toMatchObject({ ok: false, code: "too_large" });
  });

  it("„Изтегли папката“ writes only where the employee picked in the native dialog", async () => {
    const dir = tmp();
    const target = path.join(dir, "Папка");
    const e = env({ savePath: target });
    e.put("скица.pdf", PDF);
    const r = await e.projects.exportZip({ caseId: "case-1", title: "Продажба · къща" });
    expect(r).toMatchObject({ ok: true, path: `${target}.zip`, count: 1 });
    expect(e.calls.dialogs[0].defaultPath).toBe(path.join("C:\\Docs", "Продажба · къща.zip"));
    expect(Object.keys(unzipSync(new Uint8Array(fs.readFileSync(`${target}.zip`))))).toContain("скица.pdf");
    const c = env({ savePath: null });
    c.put("скица.pdf", PDF);
    expect(await c.projects.exportZip({ caseId: "case-1", title: "x" })).toEqual({ ok: false, canceled: true });
  });

  it("names: unique per archive, Windows-safe; the index lists every file", () => {
    expect(uniqueNames(["a.pdf", "A.pdf", "a.pdf", "x/y:z.txt"])).toEqual(["a.pdf", "A (2).pdf", "a (3).pdf", "x_y_z.txt"]);
    const t = indexText({ title: "П", items: [{ name: "a.pdf", kind: "pdf", size: 2048, createdAt: "2026-11-17T09:00:00Z", origin: "ted", savedTo: "клиент А" }], names: ["a.pdf"] });
    expect(t.startsWith("\ufeff")).toBe(true);
    expect(t).toContain("1. a.pdf – PDF, 2 KB");
    expect(t).toContain("в CRM: клиент А");
  });
});

describe("„Запази в сайта“ – only after the approval", () => {
  it("a refused native confirmation uploads and calls nothing", async () => {
    const e = env({ confirmAnswer: false });
    e.put("скица.pdf", PDF);
    const r = await e.projects.saveToCrm({ caseId: "case-1", caseTitle: "Продажба · къща", target: { clientName: "Тестов Клиент А" } });
    expect(r).toEqual({ ok: false, canceled: true });
    expect(e.calls.confirms).toHaveLength(1);
    expect(e.calls.confirms[0][0]).toContain("клиент Тестов Клиент А");
    expect(e.calls.confirms[0][1]).toContain("скица.pdf");
    expect(e.calls.uploads).toEqual([]);
    expect(e.calls.tools).toEqual([]);
  });

  it("to a client: every file uploaded once and attached with files.attach in the project's folder", async () => {
    const e = env();
    const a = e.put("скица.pdf", PDF);
    const b = e.put("снимка.jpg", JPEG);
    const r = await e.projects.saveToCrm({ caseId: "case-1", caseTitle: "Продажба · къща", target: { clientName: "Тестов Клиент А" } });
    expect(r).toMatchObject({ ok: true, saved: 2, failed: 0, target: "клиент Тестов Клиент А" });
    expect(e.calls.uploads.sort()).toEqual([a.id, b.id].sort());
    expect(e.calls.tools.map(([t]) => t)).toEqual(["files.attach", "files.attach"]);
    expect(e.calls.tools[0][1]).toMatchObject({ client_name: "Тестов Клиент А", folder: "Проект: Продажба · къща" });
    expect(e.calls.tools[0][1].path).toMatch(/^ted-chat\//);
    expect(e.files.ref(a.id).savedTo).toMatch(/^CRM: клиент/);
  });

  it("to a property: photos into its gallery through signed links (images.download), other files into its documents", async () => {
    const e = env();
    e.put("снимка.jpg", PHOTO);
    e.put("скица.pdf", PDF);
    const r = await e.projects.saveToCrm({ caseId: "case-1", caseTitle: "П", target: { propertyCode: "P-1042" } });
    expect(r).toMatchObject({ ok: true, saved: 2, target: "имот P-1042" });
    const attach = e.calls.tools.find(([t]) => t === "files.attach")[1];
    expect(attach).toMatchObject({ property_code: "P-1042", name: "скица.pdf" });
    const dl = e.calls.tools.find(([t]) => t === "images.download")[1];
    expect(dl.property_code).toBe("P-1042");
    expect(dl.urls).toHaveLength(1);
    expect(dl.urls[0]).toMatch(/^https:\/\/hyvwfsmjbaynozceookv\.supabase\.co\/storage\/v1\/object\/sign\/nd-files\/ted-chat\//);
    expect(e.calls.sign[0]).toMatchObject({ url: "https://hyvwfsmjbaynozceookv.supabase.co/storage/v1/object/sign/nd-files", method: "POST" });
    expect(e.calls.sign[0].json.expiresIn).toBe(900);
  });

  it("no target, empty folder or a server failure are reported honestly", async () => {
    const e = env({ toolAnswer: () => ({ ok: false, error: "Грешка от сървъра (HTTP 502).", maybeExecuted: true }) });
    expect(await e.projects.saveToCrm({ caseId: "case-1", target: { clientName: "А" } })).toMatchObject({ ok: false, code: "empty" });
    e.put("скица.pdf", PDF);
    expect(await e.projects.saveToCrm({ caseId: "case-1", target: {} })).toMatchObject({ ok: false, code: "invalid" });
    const r = await e.projects.saveToCrm({ caseId: "case-1", target: { clientName: "А" } });
    expect(r).toMatchObject({ ok: false, saved: 0, failed: 1 });
    expect(r.results[0]).toMatchObject({ ok: false, maybeExecuted: true });
  });

  it("an answer kept in the folder is a Markdown file made by Ted", () => {
    const e = env();
    const r = e.projects.saveAnswer({ caseId: "case-1", caseTitle: "П", chatId: "c_1", title: "Отговор: оферта", text: "# Оферта\n\nТекст" });
    expect(r.ok).toBe(true);
    expect(r.file).toMatchObject({ name: "Отговор_ оферта.md", origin: "ted", caseId: "case-1", chatId: "c_1", kind: "text" });
  });
});

describe("IPC of the folders (§8.12)", () => {
  const handlers = (projects, files) => createHandlers({ projects, files, settings: { get: () => ({}) } });
  it("validates every argument before anything runs", async () => {
    const seen = [];
    const projects = { saveToCrm: async (a) => { seen.push(a); return { ok: true }; }, exportZip: async (a) => { seen.push(a); return { ok: true }; }, saveAnswer: (a) => { seen.push(a); return { ok: true, file: {} }; } };
    const files = { assign: (ids, p) => { seen.push([ids, p]); return ids.map((id) => ({ id })); } };
    const h = handlers(projects, files);
    expect(h["ted:projects.assign"]({ caseId: "case-1", fileIds: ["../x"] })).toMatchObject({ ok: false, code: "invalid" });
    expect(h["ted:projects.assign"]({ caseId: "case-1", fileIds: [] })).toMatchObject({ code: "invalid" });
    expect(h["ted:projects.assign"]({ caseId: null, fileIds: ["file000001"] })).toMatchObject({ ok: true });
    expect(seen.pop()).toEqual([["file000001"], null]);
    expect(await h["ted:projects.saveToCrm"]({ caseId: "case-1" })).toMatchObject({ code: "invalid" });
    expect(await h["ted:projects.saveToCrm"]({ caseId: "case-1", target: { propertyCode: "x".repeat(41) } })).toMatchObject({ code: "invalid" });
    await h["ted:projects.saveToCrm"]({ caseId: "case-1", caseTitle: "П", target: { clientName: "А", extra: 1 }, junk: true });
    expect(seen.pop()).toEqual({ caseId: "case-1", caseTitle: "П", fileIds: null, target: { clientId: "", clientName: "А", propertyCode: "" } });
    expect(await h["ted:projects.exportZip"]({ caseId: "" })).toMatchObject({ code: "invalid" });
    expect(h["ted:projects.saveAnswer"]({ caseId: "case-1", text: "" })).toMatchObject({ code: "invalid" });
  });
  it("files.add puts an attachment into the project's folder (never a temporary one)", () => {
    const added = [];
    const h = createHandlers({ files: { add: (a) => { added.push(a); return { ok: true, file: { id: "file000001" } }; } } });
    h["ted:files.add"]({ name: "a.pdf", data: PDF.toString("base64"), caseId: "case-1", caseTitle: "П" });
    h["ted:files.add"]({ name: "b.pdf", data: PDF.toString("base64"), caseId: "case-1", temporary: true });
    expect(added[0]).toMatchObject({ caseId: "case-1", caseTitle: "П" });
    expect(added[1]).not.toHaveProperty("caseId");
    expect(h["ted:files.add"]({ name: "c.pdf", data: PDF.toString("base64"), caseId: "x".repeat(65) })).toMatchObject({ code: "invalid" });
  });
});

describe("no repeated identical requests to the site (0.1.5 speed)", () => {
  const signedIn = { state: () => ({ status: "signedIn", user: { id: "u1" } }) };
  it("the server model list is asked once per 10 minutes (fresh:true for the connection check)", async () => {
    let t = 0;
    const sent = [];
    const session = { ...signedIn, authed: async (o) => { sent.push(o.json && o.json.action); return { ok: true, status: 200, json: { ok: true, models: [{ id: "m", name: "M" }], modes: [] } }; } };
    const a = createAssistant({ session, now: () => t });
    await a.models(); await a.models(); t += MODELS_TTL_MS - 1; await a.models();
    expect(sent).toEqual(["models"]);
    await a.models({ fresh: true });
    t += MODELS_TTL_MS; await a.models();
    expect(sent).toEqual(["models", "models", "models"]);
  });
  it("a failed tool manifest is not asked again for 5 minutes; parallel asks share one request", async () => {
    let t = 0;
    let n = 0;
    let ok = false;
    const http = { request: async () => { n++; return ok ? { ok: true, status: 200, json: { tools: [{ name: "clients.search" }] } } : { ok: false, status: 503, json: null }; } };
    const tools = createTools({ session: {}, http, now: () => t });
    expect(await tools.manifest()).toBeNull();
    expect(await tools.manifest()).toBeNull();
    expect(n).toBe(1);
    t += RETRY_AFTER_MS; ok = true;
    const [x, y] = await Promise.all([tools.manifest(), tools.manifest()]);
    expect(x).toEqual(y);
    expect(n).toBe(2);
    await tools.manifest();
    expect(n).toBe(2);
  });
});
