// Real GPT with the CRM skills of the site (0.1.5): project_folder (create / add / list / export_zip / save_to_crm) and
// the property upload with the chat photos in the gallery – every CRM write behind the employee's card. All fakes.
import { describe, it, expect } from "vitest";
import os from "node:os";
import { unzipSync } from "fflate";
import { createAgent, CASE_TTL_MS } from "../../electron/agent/loop.js";
import { createUploads } from "../../electron/agent/uploads.js";
import { createFiles } from "../../electron/files.js";
import { createProjects } from "../../electron/projects.js";
import { STAFF_TOOLS } from "../../electron/agent/tools-spec.js";
import { AGENT_RULES } from "../../electron/agent/instructions.js";
import { consumeStream } from "../../electron/realgpt/responses.js";

const enc = new TextEncoder();
const sse = (obj) => `event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`;
async function round({ text = "", calls = [] } = {}) {
  const items = [];
  if (text) items.push({ type: "message", id: "msg_1", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [] }] });
  calls.forEach((c, i) => items.push({ type: "function_call", id: `fc_${i}`, call_id: `call_${i}`, namespace: "ted", name: c.name, arguments: JSON.stringify(c.args || {}), status: "completed" }));
  let wire = text ? sse({ type: "response.output_text.delta", delta: text }) : "";
  for (const it of items) wire += sse({ type: "response.output_item.done", item: it });
  wire += sse({ type: "response.completed", response: { model: "gpt-test", status: "completed", output: items } });
  return consumeStream(new ReadableStream({ start(c) { c.enqueue(enc.encode(wire)); c.close(); } }));
}
// Over 15 000 bytes: the site's gallery skips smaller photos, and MAIN leaves them out before the card (review F12).
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(20_000).fill(3)]);
const manifest = STAFF_TOOLS.map((name) => ({ name, description: "" }));

function env({ rounds = [], approvals = [], toolsAnswer, now = () => 0 } = {}) {
  let n = 0;
  const files = createFiles({ library: null, tempRoot: os.tmpdir(), shell: {}, dialog: {}, confirm: async () => true, newId: () => `file${String(++n).padStart(6, "0")}` });
  const toolCalls = [];
  const signed = [];
  const tools = {
    manifest: async () => manifest,
    rolePrompt: async () => null,
    call: async (tool, input) => {
      toolCalls.push([tool, structuredClone(input)]);
      if (toolsAnswer) { const r = toolsAnswer(tool, input); if (r) return r; }
      if (tool === "cases.create") return { ok: true, result: { id: "case-new", title: input.title } };
      if (tool === "cases.get") return { ok: true, result: { kase: { id: input.id, title: "Продажба · къща", client: "Тестов Клиент А", client_id: "cl-1" }, facts: [] } };
      if (tool === "cases.list") return { ok: true, result: { cases: [{ id: "case-2", title: "Наем · студио", client: "Тестов Клиент Б" }] } };
      if (tool === "properties.create") return { ok: true, result: { id: "pr-1", code: "P-1042", title: input.title } };
      if (tool === "images.download") return { ok: true, result: { downloaded: input.urls.length, of: input.urls.length, saved_to: `имот ${input.property_code} (снимки)` } };
      return { ok: true, result: { ok: 1 } };
    },
  };
  const session = { authed: async (o) => {
    if (/object\/sign/.test(o.url)) { signed.push(o.json); return { ok: true, status: 200, json: o.json.paths.map((p) => ({ path: p, signedURL: `/object/sign/nd-files/${p}?token=t` })) }; }
    return { ok: true, status: 200, text: "{}" };
  } };
  const uploads = createUploads({ session, files, now: () => new Date(Date.UTC(2026, 10, 17)) });
  const projects = createProjects({ files, uploads, tools, session, dialog: {}, confirm: async () => true });
  const events = [];
  let i = 0;
  const bodies = [];
  const stream = async (body) => { bodies.push(structuredClone(body)); const r = rounds[i++]; if (!r) throw new Error("no more rounds"); return { ok: true, outcome: typeof r === "function" ? await r(body) : r }; };
  let agent;
  agent = createAgent({
    tools, files, uploads, projects, http: { request: async () => ({ ok: false, status: 404 }) }, confirm: async () => true, now,
    newId: (() => { let k = 0; return () => `id${++k}`; })(),
  });
  const emit = (ev) => {
    events.push(ev);
    if (ev.type === "approval") { const d = approvals.shift() || { decision: "allow" }; setTimeout(() => agent.approve({ requestId: "r1", approvalId: ev.approval.id, ...d }), 0); }
  };
  const run = (extra = {}) => agent.run({ requestId: "r1", model: "gpt-test", messages: [{ role: "user", text: "Събирай всичко за клиента в папка" }], stream, emit, ...extra });
  return { run, files, toolCalls, signed, events, bodies, agent, rounds };
}
const outputs = (body) => body.input.filter((x) => x.type === "function_call_output").map((x) => JSON.parse(x.output));
const approvalsOf = (events) => events.filter((e) => e.type === "approval").map((e) => e.approval);

describe("project_folder", () => {
  it("create: a card for cases.create; after „Разреши“ the files Ted makes in this answer go into the new folder", async () => {
    const e = env({ rounds: [
      await round({ calls: [{ name: "project_folder", args: { action: "create", project: "Тестов клиент В", client_name: "Тестов Клиент В" } }] }),
      await round({ calls: [{ name: "create_document", args: { format: "md", title: "Досие", content: "# Досие" } }] }),
      await round({ text: "Готово." }),
    ] });
    const r = await e.run({ chatId: "c_1" });
    expect(r.ok).toBe(true);
    const ap = approvalsOf(e.events);
    expect(ap).toHaveLength(1);
    expect(ap[0]).toMatchObject({ kind: "crm_write", tool: "cases.create" });
    expect(e.toolCalls[0]).toEqual(["cases.create", { title: "Тестов клиент В", client_name: "Тестов Клиент В" }]);
    expect(outputs(e.bodies[1])[0]).toMatchObject({ ok: true, project: { id: "case-new", title: "Тестов клиент В" } });
    const doc = e.files.list({}).items.find((f) => f.name === "Досие.md");
    expect(doc).toMatchObject({ caseId: "case-new", caseTitle: "Тестов клиент В", chatId: "c_1" });
  });

  it("create refused: nothing is created and no file goes into a folder", async () => {
    const e = env({ approvals: [{ decision: "deny" }], rounds: [
      await round({ calls: [{ name: "project_folder", args: { action: "create", project: "Х" } }] }),
      await round({ text: "Добре." }),
    ] });
    await e.run();
    expect(e.toolCalls.filter(([t]) => t === "cases.create")).toEqual([]);
    expect(outputs(e.bodies[1])[0]).toMatchObject({ ok: false, error: "Служителят отказа." });
  });

  it("add and list are local only (no card, no request); the chat's own Проект is the default", async () => {
    const e = env({ rounds: [] });
    const a = e.files.add({ name: "оферта.pdf", mime: "", data: Buffer.from("%PDF-1.4 x"), origin: "user" }).file;
    e.rounds.push(
      await round({ calls: [{ name: "project_folder", args: { action: "add", files: [`file:${a.id}`, "file:nonexistent9"] } }] }),
      await round({ calls: [{ name: "project_folder", args: { action: "list" } }] }),
      await round({ text: "Добавих го." }),
    );
    const r = await e.run({ caseId: "case-1" });
    expect(r.ok).toBe(true);
    expect(approvalsOf(e.events)).toEqual([]);
    expect(e.toolCalls.map(([t]) => t)).toEqual(["cases.get"]); // the case context only
    expect(e.files.ref(a.id)).toMatchObject({ caseId: "case-1", caseTitle: "Продажба · къща" });
    expect(outputs(e.bodies[1])[0]).toMatchObject({ ok: true, added: ["оферта.pdf"], missing: 1, folder_count: 1 });
    expect(outputs(e.bodies[2])[1]).toMatchObject({ ok: true, count: 1, files: [{ file: `file:${a.id}`, name: "оферта.pdf" }] });
  });

  it("export_zip: one ZIP as a file card (outside the folder), nothing sent anywhere", async () => {
    const e = env();
    e.files.add({ name: "скица.pdf", mime: "", data: Buffer.from("%PDF-1.4 x"), origin: "user", caseId: "case-1", caseTitle: "Продажба · къща" });
    e.rounds.push(await round({ calls: [{ name: "project_folder", args: { action: "export_zip" } }] }), await round({ text: "Ето ZIP-а." }));
    const r = await e.run({ caseId: "case-1", chatId: "c_1" });
    const zipRef = r.files.find((f) => /\.zip$/.test(f.name));
    expect(zipRef).toMatchObject({ name: "Продажба · къща.zip", origin: "ted", chatId: "c_1" });
    expect(zipRef).not.toHaveProperty("caseId");
    expect(Object.keys(unzipSync(new Uint8Array(e.files.get(zipRef.id).bytes)))).toContain("скица.pdf");
    expect(e.events.some((ev) => ev.type === "file" && ev.file.id === zipRef.id)).toBe(true);
    expect(e.toolCalls.map(([t]) => t)).toEqual(["cases.get"]);
  });

  it("save_to_crm: a card listing the files and the target; deny = nothing uploaded; allow = upload + files.attach", async () => {
    for (const decision of ["deny", "allow"]) {
      const e = env({ approvals: [{ decision }] });
      e.files.add({ name: "скица.pdf", mime: "", data: Buffer.from("%PDF-1.4 x"), origin: "user", caseId: "case-1", caseTitle: "Продажба · къща" });
      e.rounds.push(await round({ calls: [{ name: "project_folder", args: { action: "save_to_crm" } }] }), await round({ text: "." }));
      await e.run({ caseId: "case-1" });
      const ap = approvalsOf(e.events);
      expect(ap).toHaveLength(1);
      expect(ap[0]).toMatchObject({ kind: "crm_write", tool: "files.attach" });
      expect(ap[0].lines.find(([k]) => k === "Файлове")[1]).toContain("скица.pdf");
      expect(ap[0].lines.find(([k]) => k === "Къде")[1]).toContain("клиент Тестов Клиент А");
      const attach = e.toolCalls.filter(([t]) => t === "files.attach");
      if (decision === "deny") expect(attach).toEqual([]);
      else {
        expect(attach).toHaveLength(1);
        expect(attach[0][1]).toMatchObject({ client_id: "cl-1", name: "скица.pdf", folder: "Проект: Продажба · къща" });
        expect(attach[0][1].path).toMatch(/^ted-chat\/2026-11\//);
      }
    }
  });

  it("an unknown project is found by title through cases.list; several matches ask which", async () => {
    const e = env({ rounds: [
      await round({ calls: [{ name: "project_folder", args: { action: "list", project: "Наем · студио" } }] }),
      await round({ text: "." }),
    ] });
    await e.run();
    expect(e.toolCalls[0]).toEqual(["cases.list", { status: "all", query: "Наем · студио" }]);
    expect(outputs(e.bodies[1])[0]).toMatchObject({ ok: true, project: { id: "case-2", title: "Наем · студио" }, count: 0 });
  });

  it("a temporary chat never fills a folder", async () => {
    const e = env({ rounds: [await round({ calls: [{ name: "project_folder", args: { action: "add", files: ["file:file000001"] } }] }), await round({ text: "." })] });
    await e.run({ temporary: true });
    expect(outputs(e.bodies[1])[0].ok).toBe(false);
  });
});

describe("property upload with the chat photos (CRM parity)", () => {
  it("properties.create behind a card, then images.download with the photos as signed links of their CRM copies", async () => {
    const e = env();
    const p1 = e.files.add({ name: "хол.jpg", mime: "", data: JPEG, origin: "user" }).file;
    const p2 = e.files.add({ name: "кухня.jpg", mime: "", data: JPEG, origin: "user" }).file;
    e.rounds.push(
      await round({ calls: [{ name: "crm", args: { tool: "properties.create", input: { title: "Двустаен, Център", deal: "sale", type: "Апартамент", price: 99000, area: 65, city: "Тестоград", desc: "Описание от GPT." } } }] }),
      await round({ calls: [{ name: "crm", args: { tool: "images.download", input: { urls: [`file:${p1.id}`, `file:${p2.id}`], property_code: "P-1042" } } }] }),
      await round({ text: "Създадох P-1042 и добавих 2 снимки." }),
    );
    const r = await e.run({ messages: [{ role: "user", text: "Качи нов имот", files: [p1.id, p2.id] }] });
    expect(r.ok).toBe(true);
    const ap = approvalsOf(e.events);
    expect(ap.map((a) => a.tool)).toEqual(["properties.create", "images.download"]);
    // The card names the photos, the exact data stays what the model sent.
    const urlsLine = ap[1].lines.find(([, v]) => /хол\.jpg/.test(v));
    expect(urlsLine[1]).toContain("„кухня.jpg“");
    expect(ap[1].json).toContain(`file:${p1.id}`);
    const create = e.toolCalls.find(([t]) => t === "properties.create")[1];
    expect(create).toMatchObject({ title: "Двустаен, Център", price: 99000, desc: "Описание от GPT." });
    const dl = e.toolCalls.find(([t]) => t === "images.download")[1];
    expect(dl.property_code).toBe("P-1042");
    expect(dl.urls).toHaveLength(2);
    for (const u of dl.urls) expect(u).toMatch(/^https:\/\/hyvwfsmjbaynozceookv\.supabase\.co\/storage\/v1\/object\/sign\/nd-files\/ted-chat\/2026-11\/.+\.jpg\?token=t$/);
    expect(e.signed[0]).toMatchObject({ expiresIn: 900 });
    expect(e.signed[0].paths).toHaveLength(2);
    // The uploads were steps of the answer; the photos keep their CRM copy path.
    expect(r.steps.filter((s) => s.kind === "upload" && s.status === "ok")).toHaveLength(2);
    expect(e.files.ref(p1.id).crm.path).toMatch(/^ted-chat\//);
  });

  it("refused photo card: nothing is uploaded or signed", async () => {
    const e = env({ approvals: [{ decision: "deny" }] });
    const p1 = e.files.add({ name: "хол.jpg", mime: "", data: JPEG, origin: "user" }).file;
    e.rounds.push(await round({ calls: [{ name: "crm", args: { tool: "images.download", input: { urls: [`file:${p1.id}`], property_code: "P-1042" } } }] }), await round({ text: "." }));
    await e.run();
    expect(e.toolCalls.filter(([t]) => t === "images.download")).toEqual([]);
    expect(e.signed).toEqual([]);
    expect(e.files.ref(p1.id).crm).toBeUndefined();
  });

  it("the instructions teach the upload step by step and that the CRM skills of the site work here", () => {
    for (const s of ["Качване на имот", "properties.create", "Задължително за качване", "images.download {urls:[\"file:<id>\"", "files.attach {path:\"file:<id>\", property_code}", "project_folder", "Не казвай „това става само в CRM на сайта“"]) {
      expect(AGENT_RULES, s).toContain(s);
    }
  });
});

describe("the selected Проект is not read again for every answer", () => {
  it("cases.get once within 90 s; again after a CRM change or the time", async () => {
    let t = 0;
    const e = env({ now: () => t });
    const ask = async (calls) => { e.rounds.push(...calls); return e.run({ caseId: "case-1" }); };
    await ask([await round({ text: "1" })]);
    await ask([await round({ text: "2" })]);
    expect(e.toolCalls.filter(([x]) => x === "cases.get")).toHaveLength(1);
    await ask([await round({ calls: [{ name: "crm", args: { tool: "clients.create", input: { name: "Тест" } } }] }), await round({ text: "3" })]);
    await ask([await round({ text: "4" })]);
    expect(e.toolCalls.filter(([x]) => x === "cases.get")).toHaveLength(2); // answer 3 used the cache, answer 4 reads again
    t += CASE_TTL_MS;
    await ask([await round({ text: "5" })]);
    expect(e.toolCalls.filter(([x]) => x === "cases.get")).toHaveLength(3);
  });
});
