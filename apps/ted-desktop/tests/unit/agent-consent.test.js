// Real GPT consent and the agent path inside createRealGpt (docs/CONTRACT.md §8.2): without consent "all" the
// request is exactly the 0.1.2 text-only one; the consent lives in MAIN's secure store per CRM user and ChatGPT
// account. Fake http, in-memory secure store; nothing leaves the machine.
import { describe, it, expect } from "vitest";
import os from "node:os";
import { createRealGpt } from "../../electron/realgpt/index.js";
import { createAgent } from "../../electron/agent/loop.js";
import { STAFF_TOOLS } from "../../electron/agent/tools-spec.js";

const enc = new TextEncoder();
const sse = (obj) => `event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`;
const RESPONSES_URL = "https://api.openai.com/v1/responses";

function streamRes(chunks) {
  const body = new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(enc.encode(x)); c.close(); } });
  return { status: 200, ok: true, headers: new Headers(), body };
}

function memStore() {
  const data = new Map();
  return {
    data,
    available: () => true,
    read: (n) => (data.has(n) ? structuredClone(data.get(n)) : null),
    write: (n, v) => { data.set(n, structuredClone(v)); return true; },
    remove: (n) => { data.delete(n); },
  };
}

const record = (subject = "sub-1") => ({
  email: "test@example.com", issuer: "https://auth.openai.com", subject, client_id: "oaiapp_test", ext_agent_host_id: "urn:uuid:x",
  id_token: "x.y.z", access_token: "at", refresh_token: "rt", token_type: "Bearer", expires_in: 3600,
  scopes: ["openid", "chatgpt.tokens.use.direct"], saved_at: new Date().toISOString(), earliest_refresh_at: null,
});

function setup({ withAgent = true, rounds } = {}) {
  const store = memStore();
  store.write("realgpt-u1", record());
  const bodies = [];
  const events = [];
  const queue = rounds || [];
  const http = {
    request: async (opts) => {
      if (opts.url !== RESPONSES_URL) throw new Error(`unexpected ${opts.url}`);
      bodies.push(JSON.parse(opts.body));
      expect(opts.headers.Authorization).toBe("Bearer at");
      const next = queue.shift() || [sse({ type: "response.output_text.delta", delta: "Здравейте" }), sse({ type: "response.completed", response: { model: "m", output: [] } })];
      return streamRes(next);
    },
  };
  const toolCalls = [];
  const agent = withAgent ? createAgent({
    tools: { manifest: async () => STAFF_TOOLS.map((name) => ({ name, description: "" })), rolePrompt: async () => null, call: async (t, i) => { toolCalls.push([t, i]); return { ok: true, result: { found: 0 } }; } },
    files: { ref: () => null, get: () => null, add: () => ({ ok: false }) },
    uploads: { hasRefs: () => false, resolve: async (x) => x },
    http: { request: async () => { throw new Error("no downloads"); } }, confirm: async () => false,
  }) : null;
  const rg = createRealGpt({
    http, secureStore: store, dataDir: os.tmpdir(), openExternal: async () => {}, owner: () => "u1",
    emit: (event, payload) => events.push([event, payload]), agent,
  });
  return { rg, store, bodies, events, toolCalls };
}

const hello = [{ role: "user", text: "Здравей", files: ["abcdefgh12"] }];

describe("consent", () => {
  it("starts empty; set per ChatGPT account in the secure store, never in settings", async () => {
    const { rg, store } = setup();
    expect(await rg.consent()).toEqual({ ok: true, consent: null, account: "test@example.com" });
    expect(await rg.setConsent("all")).toEqual({ ok: true, consent: "all" });
    expect(store.data.get("realgpt-consent-u1")).toEqual({ v: 1, bySubject: { "sub-1": "all" } });
    expect((await rg.consent()).consent).toBe("all");
    // another ChatGPT account of the same CRM user has its own choice
    store.write("realgpt-u1", record("sub-2"));
    rg.detach();
    expect((await rg.consent()).consent).toBeNull();
    expect(await rg.setConsent("everything")).toMatchObject({ ok: false, code: "invalid" });
    expect(await rg.setConsent(null)).toEqual({ ok: true, consent: null });
  });

  it("without consent: exactly the text-only request, labelled toolsOff; files are not read", async () => {
    const { rg, bodies } = setup();
    const r = await rg.send({ requestId: "r1", model: "m", messages: hello });
    expect(r).toMatchObject({ ok: true, text: "Здравейте", toolsOff: true });
    expect(Object.keys(bodies[0]).sort()).toEqual(["input", "instructions", "model", "store", "stream"]);
    expect(bodies[0].input[0].content[0].text).toMatch(/в режим „само текст“ Real GPT не чете файлове/);
    await rg.setConsent("text");
    const r2 = await rg.send({ requestId: "r2", model: "m", messages: hello });
    expect(r2.toolsOff).toBe(true);
    expect(bodies[1]).not.toHaveProperty("tools");
  });

  it("with consent 'all': the agent request with namespace tools; events carry the requestId", async () => {
    const call = { type: "function_call", id: "fc_1", call_id: "c1", namespace: "ted", name: "crm", arguments: JSON.stringify({ tool: "clients.search", input: { query: "Тест" } }) };
    const { rg, bodies, events, toolCalls } = setup({
      rounds: [
        [sse({ type: "response.output_item.done", item: call }), sse({ type: "response.completed", response: { model: "m", output: [call] } })],
        [sse({ type: "response.output_text.delta", delta: "Няма клиент „Тест“." }), sse({ type: "response.completed", response: { model: "m", output: [] } })],
      ],
    });
    await rg.setConsent("all");
    const r = await rg.send({ requestId: "r1", model: "m", messages: [{ role: "user", text: "Търси клиент Тест" }], mode: "work", effort: "medium" });
    expect(r).toMatchObject({ ok: true, text: "Няма клиент „Тест“." });
    expect(r.toolsOff).toBeUndefined();
    expect(r.steps).toEqual([expect.objectContaining({ kind: "crm", label: "CRM: клиенти.търсене", status: "ok" })]);
    expect(bodies[0].tools[0].type).toBe("namespace");
    expect(bodies[0].reasoning).toEqual({ effort: "medium" });
    expect(bodies[1].input.at(-1)).toEqual({ type: "function_call_output", call_id: "c1", output: JSON.stringify({ ok: true, result: { found: 0 } }) });
    expect(toolCalls).toEqual([["clients.search", { query: "Тест" }]]);
    const agentEvents = events.filter(([e]) => e === "realgpt:event").map(([, p]) => p);
    expect(agentEvents.every((p) => p.requestId === "r1")).toBe(true);
    expect(events.filter(([e]) => e === "realgpt:delta").at(-1)[1].text).toBe("Няма клиент „Тест“.");
  });

  it("without an agent (unit use of the module) nothing changes", async () => {
    const { rg, bodies } = setup({ withAgent: false });
    await rg.setConsent("all");
    const r = await rg.send({ requestId: "r1", model: "m", messages: [{ role: "user", text: "x" }] });
    expect(r).toEqual({ ok: true, text: "Здравейте", model: "m" });
    expect(bodies[0]).not.toHaveProperty("tools");
    expect(await rg.approve({ requestId: "r1", approvalId: "a", decision: "allow" })).toMatchObject({ ok: false });
  });
});
