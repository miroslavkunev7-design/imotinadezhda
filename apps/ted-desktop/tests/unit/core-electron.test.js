// MAIN-side Electron glue, tested with plain-object stand-ins for the Electron APIs.
// (The real "electron" module is never imported: only electron/main.js does that.)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHandlers, registerIpc, createAppApi } from "../../electron/ipc.js";
import { createAppHandler, resolveAsset, CSP, SCHEME, APP_URL } from "../../electron/protocol.js";
import { installSecurity, createOriginCheck, externalUrl } from "../../electron/security.js";
import { createMainWindow, webPreferences, usableBounds } from "../../electron/window.js";
import { READ_ONLY } from "../../electron/backend/tools.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "ted-core-el-")); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

// The window.ted surface of docs/CONTRACT.md §2.
const SURFACE = {
  app: ["info", "setCompact", "getLaunchAtLogin", "setLaunchAtLogin", "openLogs", "openExternal", "copy", "saveFile"],
  auth: ["state", "login", "logout", "onChange"],
  api: ["models", "chat", "cancel"],
  crm: ["read"],
  cases: ["create"],
  memory: ["remember", "forget"],
  email: ["confirmSend"],
  voice: ["tts", "transcribe"],
  store: ["getSettings", "setSettings", "loadChats", "saveChats", "clearLocal"],
  realgpt: ["status", "signIn", "cancelSignIn", "signOut", "models", "send", "cancel", "onDelta"],
};
const SUBSCRIPTIONS = { "auth.onChange": "ted:auth.changed", "realgpt.onDelta": "ted:realgpt.delta" };

// Records calls into fake services; individual tests override what they need.
function services(over = {}) {
  const calls = [];
  const rec = (name, result) => (...args) => { calls.push([name, ...args]); return typeof result === "function" ? result(...args) : result; };
  const base = {
    appApi: { info: rec("app.info", { version: "0.1.0", platform: "win32", packaged: true }), setCompact: rec("app.setCompact", { ok: true }), getLaunchAtLogin: rec("app.getLaunchAtLogin", { enabled: false }), setLaunchAtLogin: rec("app.setLaunchAtLogin", { ok: true, enabled: true }), openLogs: rec("app.openLogs", { ok: true }), openExternal: rec("app.openExternal", { ok: true }), copy: rec("app.copy", { ok: true }), saveFile: rec("app.saveFile", { ok: false, canceled: true }) },
    session: { state: rec("session.state", { status: "signedOut" }), login: rec("session.login", { ok: true, user: { id: "u1", name: "", email: "", phoneMasked: "" } }), logout: rec("session.logout", { ok: true }) },
    assistant: { models: rec("assistant.models", { ok: true, models: [], modes: [] }), chat: rec("assistant.chat", { ok: true, text: "" }), cancel: rec("assistant.cancel", { ok: true }) },
    tools: { read: rec("tools.read", { ok: true, result: {} }), call: rec("tools.call", { ok: true, result: { id: "c1", title: "Казус", note: "x" } }) },
    email: { confirmSend: rec("email.confirmSend", { ok: false, canceled: true }) },
    voice: { tts: rec("voice.tts", { ok: true, wav: new ArrayBuffer(4) }), transcribe: rec("voice.transcribe", { ok: true, text: "" }) },
    settings: { get: rec("settings.get", { a: 1 }), set: rec("settings.set", (p) => ({ a: 1, ...p })) },
    chats: { load: rec("chats.load", { chats: [] }), save: rec("chats.save", { ok: true }), clear: rec("chats.clear", { ok: true }) },
    realgpt: { status: rec("rg.status", { connected: false }), signIn: rec("rg.signIn", { ok: false, error: "x", code: "canceled" }), cancelSignIn: rec("rg.cancelSignIn", { ok: true }), signOut: rec("rg.signOut", { ok: true, revoked: true }), models: rec("rg.models", { ok: true, models: [] }), send: rec("rg.send", { ok: true, text: "", model: "m" }), cancel: rec("rg.cancel", { ok: true }) },
    confirm: rec("confirm", true),
  };
  return { calls, deps: { ...base, ...over } };
}

function loadPreload() {
  const exposed = {};
  const invoked = [];
  const listeners = new Map();
  const electron = {
    contextBridge: { exposeInMainWorld: (key, api) => { exposed[key] = api; } },
    ipcRenderer: {
      invoke: (channel, ...args) => { invoked.push([channel, ...args]); return Promise.resolve("result"); },
      on: (channel, fn) => { listeners.set(channel, [...(listeners.get(channel) || []), fn]); },
      removeListener: (channel, fn) => { listeners.set(channel, (listeners.get(channel) || []).filter((f) => f !== fn)); },
    },
  };
  const required = [];
  // eslint-disable-next-line no-new-func
  new Function("require", read("electron/preload.cjs"))((name) => { required.push(name); return electron[name] ? electron[name] : electron; });
  return { exposed, invoked, listeners, required };
}

describe("preload (window.ted)", () => {
  it("exposes exactly the contract surface under the single key 'ted'", () => {
    const { exposed, required } = loadPreload();
    expect(required).toEqual(["electron"]);
    expect(Object.keys(exposed)).toEqual(["ted"]);
    expect(Object.keys(exposed.ted).sort()).toEqual(Object.keys(SURFACE).sort());
    for (const [group, fns] of Object.entries(SURFACE)) {
      expect(Object.keys(exposed.ted[group]).sort(), group).toEqual([...fns].sort());
      for (const fn of fns) expect(typeof exposed.ted[group][fn]).toBe("function");
    }
  });

  it("binds every function to its own fixed channel - there is no generic invoke", async () => {
    const { exposed, invoked } = loadPreload();
    for (const [group, fns] of Object.entries(SURFACE)) {
      for (const fn of fns) {
        if (SUBSCRIPTIONS[`${group}.${fn}`]) continue;
        invoked.length = 0;
        // Whatever the page passes first, the channel stays the same.
        await exposed.ted[group][fn]("ted:store.clearLocal", { channel: "ted:auth.logout" });
        expect(invoked).toHaveLength(1);
        expect(invoked[0][0]).toBe(`ted:${group}.${fn}`);
      }
    }
    const src = read("electron/preload.cjs");
    expect(src).not.toMatch(/ipcRenderer\.(send|sendSync|postMessage|sendToHost)\b/);
    expect(src).not.toMatch(/require\((?!"electron"\))/);
    expect(src).not.toMatch(/invoke:\s|\bipcRenderer\s*[,}]\s*\)/); // ipcRenderer itself is never exposed
  });

  it("every invoke channel has exactly one MAIN handler, and nothing more", () => {
    const expected = Object.entries(SURFACE).flatMap(([group, fns]) => fns.filter((fn) => !SUBSCRIPTIONS[`${group}.${fn}`]).map((fn) => `ted:${group}.${fn}`));
    expect(Object.keys(createHandlers(services().deps)).sort()).toEqual(expected.sort());
  });

  it("subscriptions deliver only the payload and return a working unsubscribe", () => {
    const { exposed, listeners } = loadPreload();
    for (const [name, channel] of Object.entries(SUBSCRIPTIONS)) {
      const [group, fn] = name.split(".");
      const got = [];
      const off = exposed.ted[group][fn]((payload, extra) => got.push([payload, extra]));
      expect(typeof off).toBe("function");
      listeners.get(channel).forEach((l) => l({ sender: "ipc event object" }, { n: 1 }));
      expect(got).toEqual([[{ n: 1 }, undefined]]); // the IPC event object never reaches the page
      off();
      expect(listeners.get(channel)).toEqual([]);
      expect(typeof exposed.ted[group][fn]("not a function")).toBe("function");
    }
  });
});

describe("ipc registration", () => {
  function register(over) {
    const handlers = new Map();
    const logged = [];
    const { calls, deps } = services(over);
    const channels = registerIpc({
      ipcMain: { handle: (channel, fn) => { if (handlers.has(channel)) throw new Error("duplicate " + channel); handlers.set(channel, fn); } },
      isTrusted: createOriginCheck(null),
      log: { warn: (e, f) => logged.push([e, f]), error: (e, f) => logged.push([e, f]), info: () => {} },
      ...deps,
    });
    const call = (channel, ...args) => handlers.get(channel)({ senderFrame: { url: "app://ted/index.html", parent: null } }, ...args);
    return { handlers, channels, calls, logged, call };
  }

  it("registers one handler per channel, all named ted:<group>.<fn>", () => {
    const { handlers, channels } = register();
    expect(channels).toHaveLength(33); // 35 window.ted functions minus the 2 subscriptions
    expect([...handlers.keys()]).toEqual(channels);
    for (const c of channels) expect(c).toMatch(/^ted:[a-z]+\.[A-Za-z]+$/);
  });

  it("rejects every call that does not come from app://ted/", async () => {
    const { handlers, calls, logged } = register();
    const senders = [
      { senderFrame: { url: "https://evil.example/" } },
      { senderFrame: { url: "file:///C:/x/index.html" } },
      { senderFrame: { url: "app://ted.evil/index.html" } },
      { senderFrame: { url: "app://other/index.html" } },
      { senderFrame: { url: "http://localhost:5173/" } }, // dev origin is not trusted in production
      { senderFrame: { url: "about:blank" } },
      { senderFrame: { url: "app://ted/index.html", parent: { url: "app://ted/index.html" } } }, // sub-frame
      { senderFrame: null },
      {},
    ];
    for (const [channel, fn] of handlers) {
      for (const event of senders) await expect(fn(event, {}), channel).rejects.toThrow("forbidden");
    }
    expect(calls).toHaveLength(0);
    expect(logged.every(([event]) => event === "ipc.rejected")).toBe(true);
  });

  it("accepts the dev server origin only when it was configured", async () => {
    const handlers = new Map();
    registerIpc({ ipcMain: { handle: (c, fn) => handlers.set(c, fn) }, isTrusted: createOriginCheck("http://localhost:5173"), ...services().deps });
    expect(await handlers.get("ted:app.info")({ senderFrame: { url: "http://localhost:5173/" } })).toMatchObject({ version: "0.1.0" });
    await expect(handlers.get("ted:app.info")({ senderFrame: { url: "http://localhost:5174/" } })).rejects.toThrow("forbidden");
  });

  it("turns an unexpected exception into a Bulgarian error without leaking details", async () => {
    const { call, logged } = register({ assistant: { models: () => { throw new Error("secret stack detail"); }, chat: () => ({}), cancel: () => ({}) } });
    const out = await call("ted:api.models");
    expect(out).toEqual({ ok: false, error: "Вътрешна грешка в програмата. Подробности има в логовете.", code: "internal" });
    expect(logged).toEqual([["ipc.failed", { channel: "ted:api.models", message: "secret stack detail" }]]);
  });

  it("passes only the contract fields on to the services", async () => {
    const { call, calls } = register();
    await call("ted:auth.login", { identifier: "a@b.bg", password: "pw", extra: "x" });
    await call("ted:api.chat", { requestId: "r1", messages: [{ role: "user", text: "x" }], model: "m", mode: "lawyer", caseId: "c1", page: "evil", action: "models" });
    await call("ted:email.confirmSend", { to: { email: "a@b.bg" }, subject: "S", attachments: [], tool: "clients.delete", input: { confirm: true } });
    await call("ted:voice.tts", { text: "x", voice: "Charon", style: "calm", url: "https://evil" });
    await call("ted:voice.transcribe", { mime: "audio/webm", data: "AAAA", fn: "x" });
    expect(calls).toEqual([
      ["session.login", { identifier: "a@b.bg", password: "pw" }],
      ["assistant.chat", { requestId: "r1", messages: [{ role: "user", text: "x" }], model: "m", mode: "lawyer", caseId: "c1" }],
      ["email.confirmSend", { to: { email: "a@b.bg" }, subject: "S", attachments: [] }],
      ["voice.tts", { text: "x", voice: "Charon", style: "calm" }],
      ["voice.transcribe", { mime: "audio/webm", data: "AAAA" }],
    ]);
  });

  it("validates argument types and sizes before touching a service", async () => {
    const { call, calls } = register();
    const bad = [
      ["ted:app.setCompact", "yes"], ["ted:app.setLaunchAtLogin", 1], ["ted:app.openExternal", 5], ["ted:app.openExternal", ""],
      ["ted:app.copy", { text: "x" }], ["ted:auth.login", "a@b.bg"], ["ted:api.chat", "x"], ["ted:api.chat", null],
      ["ted:api.cancel", ""], ["ted:api.cancel", { id: 1 }], ["ted:crm.read", 5, {}], ["ted:crm.read", "cases.list", "x"], ["ted:crm.read", "cases.list", []],
      ["ted:cases.create", {}], ["ted:cases.create", { title: "   " }], ["ted:cases.create", { title: "x".repeat(161) }], ["ted:cases.create", { title: "x", clientName: 5 }],
      ["ted:memory.remember", { text: "" }], ["ted:memory.remember", { text: "x".repeat(1501) }], ["ted:memory.remember", { text: "x", caseId: 5 }],
      ["ted:memory.forget", {}], ["ted:memory.forget", { id: "" }], ["ted:memory.forget", { id: 7 }],
      ["ted:email.confirmSend", "x"], ["ted:voice.tts", "x"], ["ted:voice.transcribe", { mime: "audio/webm" }],
      ["ted:store.saveChats", { chats: [] }], ["ted:store.saveChats", ["x"]], ["ted:store.saveChats", Array.from({ length: 2001 }, () => ({}))],
      ["ted:realgpt.cancel", 5],
      ["ted:realgpt.send", {}], ["ted:realgpt.send", { requestId: "r", model: "m", messages: [] }], ["ted:realgpt.send", { requestId: "r", model: "m", messages: [{ role: "system", text: "x" }] }],
      ["ted:realgpt.send", { requestId: "r", model: "", messages: [{ role: "user", text: "x" }] }],
      ["ted:realgpt.send", { requestId: "r", model: "m", messages: [{ role: "user", text: "x", images: [{ mime: "image/svg+xml", data: "AAAA" }] }] }],
    ];
    for (const [channel, ...args] of bad) {
      const out = await call(channel, ...args);
      expect(out, `${channel} ${JSON.stringify(args).slice(0, 60)}`).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(await call("ted:api.chat", { requestId: "r", messages: [{ role: "user", text: "x", files: [{ mime: "image/png", data: "A".repeat(7 * 1024 * 1024) }] }] }))
      .toMatchObject({ ok: false, code: "invalid", maybeExecuted: false });
    expect(calls).toHaveLength(0);
  });

  it("crm.read goes through tools.read only (the READ_ONLY gate), never tools.call", async () => {
    const { call, calls } = register();
    await call("ted:crm.read", "cases.list", { status: "open" });
    await call("ted:crm.read", "clients.delete", { id: "1", confirm: true });
    await call("ted:crm.read", "brokers.list");
    expect(calls).toEqual([["tools.read", "cases.list", { status: "open" }], ["tools.read", "clients.delete", { id: "1", confirm: true }], ["tools.read", "brokers.list", {}]]);
    expect(READ_ONLY).not.toContain("clients.delete"); // the real tools.read refuses it (see core-tools tests)
  });

  it("cases.create and memory.remember call exactly one fixed tool with mapped fields", async () => {
    const { call, calls } = register();
    expect(await call("ted:cases.create", { title: "  Сделка Иванови ", clientName: " Иван ", status: "closed", id: "x" })).toEqual({ ok: true, result: { id: "c1", title: "Казус" } });
    await call("ted:cases.create", { title: "Без клиент" });
    await call("ted:memory.remember", { text: " Клиентът предпочита обаждане след 17 ч. ", caseId: "c1", kind: "x" });
    await call("ted:memory.remember", { text: "Общо правило" });
    expect(calls).toEqual([
      ["tools.call", "cases.create", { title: "Сделка Иванови", client_name: "Иван" }],
      ["tools.call", "cases.create", { title: "Без клиент" }],
      ["tools.call", "memory.remember", { text: "Клиентът предпочита обаждане след 17 ч.", case_id: "c1" }],
      ["tools.call", "memory.remember", { text: "Общо правило" }],
    ]);
  });

  it("memory.forget asks in a native dialog first; cancel means no tool call", async () => {
    const no = register({ confirm: async () => false });
    expect(await no.call("ted:memory.forget", { id: "m1", preview: "Клиентът предпочита…" })).toEqual({ ok: false, canceled: true });
    expect(no.calls).toHaveLength(0);

    const asked = [];
    const yes = register({ confirm: async (...a) => { asked.push(a); return true; } });
    expect(await yes.call("ted:memory.forget", { id: "m1", preview: "Клиентът  предпочита\nобаждане" })).toEqual({ ok: true });
    expect(yes.calls).toEqual([["tools.call", "memory.forget", { id: "m1" }]]);
    expect(asked[0][0]).toBe("Да забрави ли Тед това?");
    expect(asked[0][1]).toContain("„Клиентът предпочита обаждане“");
    expect(asked[0][2]).toEqual({ okLabel: "Забрави", cancelLabel: "Отказ" });

    const failing = register({ tools: { read: () => ({}), call: async () => ({ ok: false, error: "Няма такъв факт", code: "http" }) } });
    expect(await failing.call("ted:memory.forget", { id: "m1" })).toEqual({ ok: false, error: "Няма такъв факт" });
  });

  it("store.clearLocal deletes local chats only after a native confirmation", async () => {
    const no = register({ confirm: async () => false });
    expect(await no.call("ted:store.clearLocal")).toEqual({ ok: false, canceled: true });
    expect(no.calls).toHaveLength(0);
    const asked = [];
    const yes = register({ confirm: async (...a) => { asked.push(a); return true; } });
    expect(await yes.call("ted:store.clearLocal")).toEqual({ ok: true });
    expect(yes.calls).toEqual([["chats.clear"]]);
    expect(asked[0][2]).toEqual({ okLabel: "Изтрий", cancelLabel: "Отказ" });
    expect(asked[0][1]).toMatch(/CRM .* не се променят/);
  });

  it("settings and chats round-trip; an invalid settings patch changes nothing", async () => {
    const { call, calls } = register();
    expect(await call("ted:store.setSettings", { big: true })).toEqual({ a: 1, big: true });
    expect(await call("ted:store.setSettings", "x")).toEqual({ a: 1 });
    expect(await call("ted:store.setSettings", { blob: "x".repeat(70000) })).toEqual({ a: 1 });
    expect(await call("ted:store.saveChats", [{ id: 1 }])).toEqual({ ok: true });
    expect(await call("ted:store.loadChats")).toEqual({ chats: [] });
    expect(calls.map((c) => c[0])).toEqual(["settings.set", "settings.get", "settings.get", "chats.save", "chats.load"]);
  });

  it("copies Real GPT results field by field, so credentials can never reach the page", async () => {
    const leak = { access_token: "at-LEAK", refresh_token: "rt-LEAK", id_token: "id-LEAK", client_id: "oaiapp_LEAK" };
    const { call, calls } = register({
      realgpt: {
        status: async () => ({ connected: true, email: "me@example.com", planEnabled: true, ...leak }),
        signIn: async () => ({ ok: true, status: { connected: true, email: "me@example.com", planEnabled: false, ...leak }, credentials: leak }),
        cancelSignIn: async () => ({ ok: true, ...leak }),
        signOut: async () => ({ ok: true, revoked: false, ...leak }),
        models: async () => ({ ok: true, models: [{ slug: "gpt-x", displayName: "GPT X", visibility: "list", ...leak }, { displayName: "no slug" }], ...leak }),
        send: async (args) => { calls.push(["rg.send", args]); return { ok: true, text: "Здравейте", model: "gpt-x", incomplete: true, ...leak }; },
        cancel: async () => ({ ok: true, ...leak }),
      },
    });
    const send = { requestId: "r1", model: "gpt-x", effort: "low", instructions: "Кратко.", messages: [{ role: "user", text: "здравей", images: [{ mime: "image/png", data: "AAAA", name: "x" }] }, { role: "assistant", text: "да", junk: 1 }], access_token: "x" };
    const results = [
      await call("ted:realgpt.status"), await call("ted:realgpt.signIn"), await call("ted:realgpt.cancelSignIn"), await call("ted:realgpt.signOut"),
      await call("ted:realgpt.models"), await call("ted:realgpt.send", send), await call("ted:realgpt.cancel", "r1"),
    ];
    expect(results).toEqual([
      { connected: true, email: "me@example.com", planEnabled: true },
      { ok: true, status: { connected: true, email: "me@example.com", planEnabled: false } },
      { ok: true },
      { ok: true, revoked: false },
      { ok: true, models: [{ slug: "gpt-x", displayName: "GPT X" }] },
      { ok: true, text: "Здравейте", model: "gpt-x", incomplete: true },
      { ok: true },
    ]);
    expect(JSON.stringify(results)).not.toContain("LEAK");
    expect(calls).toEqual([["rg.send", {
      requestId: "r1", model: "gpt-x", effort: "low", instructions: "Кратко.",
      messages: [{ role: "user", text: "здравей", images: [{ mime: "image/png", data: "AAAA" }] }, { role: "assistant", text: "да" }],
    }]]);
  });

  it("keeps the partial text of a failed Real GPT answer and maps failures", async () => {
    const { call } = register({
      realgpt: {
        status: () => ({}), cancelSignIn: () => ({}), signOut: () => ({}), cancel: () => ({}),
        signIn: async () => ({ ok: false, error: "Входът е отказан.", code: "access_denied", debug: "x" }),
        models: async () => ({ ok: false, error: "Не сте свързани.", code: "not_connected" }),
        send: async () => ({ ok: false, error: "Лимитът е изчерпан.", code: "usage_limit", text: "Частичен отго", raw: { token: "t" } }),
      },
    });
    expect(await call("ted:realgpt.signIn")).toEqual({ ok: false, error: "Входът е отказан.", code: "access_denied" });
    expect(await call("ted:realgpt.models")).toEqual({ ok: false, error: "Не сте свързани.", code: "not_connected" });
    expect(await call("ted:realgpt.send", { requestId: "r", model: "m", messages: [{ role: "user", text: "x" }] })).toEqual({ ok: false, error: "Лимитът е изчерпан.", code: "usage_limit", text: "Частичен отго" });
  });
});

describe("app api (native features)", () => {
  function make({ packaged = true, picked = { canceled: false, filePath: null }, openPath = "" } = {}) {
    const seen = { dialogs: [], clipboard: [], opened: [], login: { openAtLogin: false } };
    const api = createAppApi({
      app: {
        getVersion: () => "0.1.0", isPackaged: packaged, getPath: (n) => path.join(dir, n),
        getLoginItemSettings: () => seen.login, setLoginItemSettings: (s) => { seen.login = { openAtLogin: !!s.openAtLogin }; },
      },
      shell: { openPath: async (p) => { seen.opened.push(p); return openPath; } },
      clipboard: { writeText: (t) => seen.clipboard.push(t) },
      dialog: { showSaveDialog: async (...a) => { seen.dialogs.push(a); return picked; } },
      getWindow: () => null,
      setCompact: (on) => ({ ok: true, on }),
      openExternal: async () => ({ ok: true }),
      logDir: path.join(dir, "logs"),
    });
    return { api, seen };
  }

  it("info, copy, compact, logs folder", async () => {
    const { api, seen } = make();
    expect(api.info()).toEqual({ version: "0.1.0", platform: process.platform, packaged: true });
    expect(api.copy("текст")).toEqual({ ok: true });
    expect(seen.clipboard).toEqual(["текст"]);
    expect(api.setCompact(true)).toEqual({ ok: true, on: true });
    expect(await api.openLogs()).toEqual({ ok: true });
    expect(seen.opened).toEqual([path.join(dir, "logs")]);
    expect(fs.existsSync(path.join(dir, "logs"))).toBe(true);
    expect(await make({ openPath: "failed" }).api.openLogs()).toMatchObject({ ok: false });
  });

  it("launch at login uses the real Windows login item and is refused outside the installed app", () => {
    const { api, seen } = make();
    expect(api.getLaunchAtLogin()).toEqual({ enabled: false });
    expect(api.setLaunchAtLogin(true)).toEqual({ ok: true, enabled: true });
    expect(seen.login).toEqual({ openAtLogin: true });
    expect(api.getLaunchAtLogin()).toEqual({ enabled: true });
    expect(api.setLaunchAtLogin(false)).toEqual({ ok: true, enabled: false });
    const dev = make({ packaged: false });
    expect(dev.api.setLaunchAtLogin(true)).toMatchObject({ ok: false, enabled: false });
    expect(dev.seen.login).toEqual({ openAtLogin: false });
    expect(dev.api.getLaunchAtLogin()).toEqual({ enabled: false });
  });

  it("saveFile writes text where the user chose and reports the real path", async () => {
    const target = path.join(dir, "Договор.md");
    const { api, seen } = make({ picked: { canceled: false, filePath: target } });
    expect(await api.saveFile({ suggestedName: "../..\\Договор:чернова?.md", text: "# Договор\nтекст" })).toEqual({ ok: true, path: target });
    expect(fs.readFileSync(target, "utf8")).toBe("# Договор\nтекст");
    const options = seen.dialogs[0][0];
    expect(options.defaultPath).toBe(path.join(dir, "documents", "_.._Договор_чернова_.md")); // no path tricks in the suggested name
    expect(options.title).toBe("Запази като");
  });

  it("saveFile writes binary content from base64", async () => {
    const target = path.join(dir, "file.pdf");
    const { api } = make({ picked: { canceled: false, filePath: target } });
    expect(await api.saveFile({ suggestedName: "file.pdf", base64: Buffer.from([37, 80, 68, 70]).toString("base64") })).toEqual({ ok: true, path: target });
    expect([...fs.readFileSync(target)]).toEqual([37, 80, 68, 70]);
  });

  it("saveFile: cancel, invalid content, runnable target and write failure are all reported truthfully", async () => {
    const canceled = make({ picked: { canceled: true } });
    expect(await canceled.api.saveFile({ suggestedName: "a.txt", text: "x" })).toEqual({ ok: false, canceled: true });

    const { api, seen } = make({ picked: { canceled: false, filePath: path.join(dir, "a.txt") } });
    for (const args of [undefined, {}, { suggestedName: "a.txt" }, { text: "x", base64: "AAAA" }, { base64: "не е base64" }, { text: 5 }]) {
      expect(await api.saveFile(args)).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(seen.dialogs).toHaveLength(0);
    expect(fs.existsSync(path.join(dir, "a.txt"))).toBe(false);

    for (const name of ["run.exe", "start.BAT", "x.lnk", "script.ps1", "a.js"]) {
      const exe = make({ picked: { canceled: false, filePath: path.join(dir, name) } });
      expect(await exe.api.saveFile({ suggestedName: name, text: "x" })).toMatchObject({ ok: false });
      expect(fs.existsSync(path.join(dir, name))).toBe(false);
    }
    const missing = make({ picked: { canceled: false, filePath: path.join(dir, "no-such-folder", "a.txt") } });
    const out = await missing.api.saveFile({ suggestedName: "a.txt", text: "x" });
    expect(out.ok).toBe(false);
    expect(out.path).toBeUndefined();
  });
});

describe("app:// protocol", () => {
  const dist = () => {
    const d = path.join(dir, "dist");
    fs.mkdirSync(path.join(d, "assets"), { recursive: true });
    fs.writeFileSync(path.join(d, "index.html"), "<!doctype html><title>Тед</title>");
    fs.writeFileSync(path.join(d, "assets", "app.js"), "console.log(1)");
    fs.writeFileSync(path.join(d, "assets", "app.css"), "body{}");
    fs.writeFileSync(path.join(d, "assets", "f.woff2"), "font");
    fs.writeFileSync(path.join(d, "assets", "app.js.map"), "{}");
    fs.writeFileSync(path.join(dir, "secret.txt"), "outside dist");
    return d;
  };
  const get = (handler, url, method = "GET") => handler(new Request(url, { method }));

  it("registers as a standard, secure scheme with fetch and stream support", () => {
    expect(SCHEME).toEqual({ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } });
    expect(APP_URL).toBe("app://ted/index.html");
  });

  it("uses the agreed CSP: no network, no inline styles or scripts", () => {
    expect(CSP).toBe("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    expect(CSP).not.toContain("unsafe-inline");
    expect(CSP).not.toContain("unsafe-eval");
    expect(CSP).not.toMatch(/https?:/);
  });

  it("serves files from dist with the right MIME type, CSP and nosniff", async () => {
    const handler = createAppHandler({ root: dist() });
    const cases = [
      ["app://ted/index.html", "text/html; charset=utf-8"], ["app://ted/", "text/html; charset=utf-8"],
      ["app://ted/assets/app.js", "text/javascript; charset=utf-8"], ["app://ted/assets/app.css", "text/css; charset=utf-8"],
      ["app://ted/assets/f.woff2", "font/woff2"], ["app://ted/assets/app.js?v=1#x", "text/javascript; charset=utf-8"],
    ];
    for (const [url, type] of cases) {
      const res = await get(handler, url);
      expect(res.status, url).toBe(200);
      expect(res.headers.get("content-type")).toBe(type);
      expect(res.headers.get("content-security-policy")).toBe(CSP);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(await (await get(handler, "app://ted/index.html")).text()).toContain("<title>Тед</title>");
    const head = await get(handler, "app://ted/index.html", "HEAD");
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  it("blocks path traversal, foreign hosts, unknown types and other methods - always with CSP", async () => {
    const handler = createAppHandler({ root: dist() });
    const blocked = [
      "app://ted/../secret.txt", "app://ted/%2e%2e/secret.txt", "app://ted/..%2Fsecret.txt", "app://ted/assets/..%2F..%2Fsecret.txt",
      "app://ted/assets/%2e%2e%2f%2e%2e%2fsecret.txt", "app://ted/..%5Csecret.txt", "app://ted/assets/..\\..\\secret.txt",
      "app://ted/C:/Windows/win.ini", "app://ted/index.html%00.js", "app://other/index.html", "app://ted.evil/index.html",
      "app://ted/assets/app.js.map", "app://ted/missing.js", "app://ted/assets", "app://ted/%E0%A4%A",
    ];
    for (const url of blocked) {
      const res = await get(handler, url);
      expect([403, 404], url).toContain(res.status);
      expect(await res.text(), url).not.toContain("outside dist");
      expect(res.headers.get("content-security-policy")).toBe(CSP);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect((await get(handler, "app://ted/index.html", "POST")).status).toBe(405);
    expect(resolveAsset(path.join(dir, "dist"), "file:///etc/passwd")).toBeNull();
    expect(resolveAsset(path.join(dir, "dist"), "app://ted/assets/app.js")).toBe(path.join(dir, "dist", "assets", "app.js"));
  });
});

describe("security", () => {
  function install(devOrigin = null) {
    const appHandlers = {};
    const sessionHandlers = {};
    const opened = [];
    const fakeSession = {
      on: (event, fn) => { sessionHandlers[event] = fn; },
      setPermissionRequestHandler: (fn) => { sessionHandlers.request = fn; },
      setPermissionCheckHandler: (fn) => { sessionHandlers.check = fn; },
      setDevicePermissionHandler: (fn) => { sessionHandlers.device = fn; },
    };
    const api = installSecurity({
      app: { on: (event, fn) => { appHandlers[event] = fn; } },
      session: fakeSession,
      shell: { openExternal: async (url) => { opened.push(url); } },
      log: { warn: () => {} },
      devOrigin,
    });
    const contents = { handlers: {}, on(event, fn) { this.handlers[event] = fn; }, setWindowOpenHandler(fn) { this.open = fn; }, getURL: () => "app://ted/index.html" };
    appHandlers["web-contents-created"]({}, contents);
    return { api, contents, sessionHandlers, opened };
  }
  const nav = (handler, url, viaEvent = false) => {
    let prevented = false;
    const event = { preventDefault: () => { prevented = true; }, ...(viaEvent ? { url } : {}) };
    handler(event, viaEvent ? undefined : url);
    return prevented;
  };

  it("origin check accepts only the app (and the configured dev server)", () => {
    const prod = createOriginCheck(null);
    for (const ok of ["app://ted", "app://ted/", "app://ted/index.html", "app://ted/assets/a.js?x#y"]) expect(prod(ok), ok).toBe(true);
    for (const no of ["app://ted.evil/", "app://tedx/", "app://other/", "https://app/ted/", "http://localhost:5173/", "file:///x", "", null, undefined, 5, "APP://TED/"]) expect(prod(no), String(no)).toBe(false);
    const dev = createOriginCheck("http://localhost:5173");
    expect(dev("http://localhost:5173/src/main.jsx")).toBe(true);
    expect(dev("http://localhost:51730/")).toBe(false);
    expect(dev("app://ted/index.html")).toBe(true);
  });

  it("blocks navigation and redirects away from the app", () => {
    const { contents } = install();
    for (const event of ["will-navigate", "will-redirect", "will-frame-navigate"]) {
      const h = contents.handlers[event];
      expect(nav(h, "app://ted/index.html")).toBe(false);
      expect(nav(h, "app://ted/index.html", true)).toBe(false);
      for (const url of ["https://example.com/", "file:///C:/Windows/", "javascript:alert(1)", "app://evil/", "data:text/html,<script>1</script>", "ms-settings:privacy", "smb://host/share", "about:blank"]) {
        expect(nav(h, url), `${event} ${url}`).toBe(true);
        expect(nav(h, url, true), `${event} ${url}`).toBe(true);
      }
    }
  });

  it("denies every new window; only https: and mailto: go to the system browser", async () => {
    const { contents, opened } = install();
    for (const url of ["https://imotinadezhda.bg/crm", "mailto:a@b.bg?subject=x", "http://example.com/", "file:///C:/x.exe", "javascript:alert(1)", "ms-msdt:/id", "app://ted/index.html", "smb://x/y", "tel:+359000000000", ""]) {
      expect(contents.open({ url })).toEqual({ action: "deny" });
    }
    await new Promise((r) => setTimeout(r, 5));
    expect(opened).toEqual(["https://imotinadezhda.bg/crm", "mailto:a@b.bg?subject=x"]);
  });

  it("openExternal accepts https: and mailto: only", async () => {
    const { api, opened } = install();
    expect(await api.openExternal("https://imotinadezhda.bg/crm")).toEqual({ ok: true });
    expect(await api.openExternal("mailto:kalina%40example.com?subject=x&body=y")).toEqual({ ok: true });
    for (const url of ["http://imotinadezhda.bg/", "file:///C:/Windows/System32/calc.exe", "C:\\Windows\\System32\\calc.exe", "javascript:alert(1)", "ms-settings:", "\\\\server\\share\\x.exe", "smb://server/share", "https://user:pw@example.com/", "app://ted/", "", null, { href: "https://x" }, "https://" + "a".repeat(9000)]) {
      const out = await api.openExternal(url);
      expect(out.ok, String(url).slice(0, 40)).toBe(false);
      expect(typeof out.error).toBe("string");
    }
    expect(opened).toHaveLength(2);
    expect(externalUrl("HTTPS://Example.com/a b")).toBe("https://example.com/a%20b");
  });

  it("reports failure honestly when the system cannot open the link", async () => {
    const api = installSecurity({
      app: { on: () => {} },
      session: { on: () => {}, setPermissionRequestHandler: () => {}, setPermissionCheckHandler: () => {}, setDevicePermissionHandler: () => {} },
      shell: { openExternal: async () => { throw new Error("no handler"); } },
    });
    expect(await api.openExternal("https://example.com/")).toMatchObject({ ok: false });
  });

  it("blocks webviews and downloads", () => {
    const { contents, sessionHandlers } = install();
    let prevented = 0;
    contents.handlers["will-attach-webview"]({ preventDefault: () => prevented++ });
    sessionHandlers["will-download"]({ preventDefault: () => prevented++ }, {}, {});
    expect(prevented).toBe(2);
  });

  it("grants only the microphone, only to the app", () => {
    const { sessionHandlers, contents } = install();
    const ask = (permission, details, wc = contents) => {
      let granted = null;
      sessionHandlers.request(wc, permission, (ok) => { granted = ok; }, details);
      return granted;
    };
    expect(ask("media", { mediaTypes: ["audio"], requestingUrl: "app://ted/index.html" })).toBe(true);
    expect(ask("media", { mediaTypes: ["audio"] })).toBe(true); // falls back to the page URL of the window
    expect(ask("media", { mediaTypes: ["video"], requestingUrl: "app://ted/index.html" })).toBe(false);
    expect(ask("media", { mediaTypes: ["audio", "video"], requestingUrl: "app://ted/index.html" })).toBe(false);
    expect(ask("media", { mediaTypes: [], requestingUrl: "app://ted/index.html" })).toBe(false);
    expect(ask("media", { requestingUrl: "app://ted/index.html" })).toBe(false);
    expect(ask("media", { mediaTypes: ["audio"], requestingUrl: "https://evil.example/" })).toBe(false);
    expect(ask("media", undefined, { getURL: () => "https://evil.example/" })).toBe(false);
    for (const p of ["geolocation", "notifications", "display-capture", "clipboard-read", "midi", "midiSysex", "hid", "serial", "usb", "fullscreen", "openExternal", "pointerLock", "fileSystem", "unknown"]) {
      expect(ask(p, { mediaTypes: ["audio"], requestingUrl: "app://ted/index.html" }), p).toBe(false);
    }

    const check = sessionHandlers.check;
    expect(check(contents, "media", "app://ted/", { mediaType: "audio" })).toBe(true);
    expect(check(contents, "media", "app://ted", { mediaType: "audio" })).toBe(true);
    expect(check(null, "media", "", { mediaType: "audio", securityOrigin: "app://ted/" })).toBe(true);
    expect(check(contents, "media", "app://ted/", { mediaType: "video" })).toBe(false);
    expect(check(contents, "media", "app://ted/", { mediaType: "unknown" })).toBe(false);
    expect(check(contents, "media", "https://evil.example/", { mediaType: "audio" })).toBe(false);
    expect(check(contents, "geolocation", "app://ted/", {})).toBe(false);
    expect(check(contents, "clipboard-read", "app://ted/", undefined)).toBe(false);
    expect(sessionHandlers.device({ deviceType: "usb", origin: "app://ted" })).toBe(false);
  });
});

describe("window", () => {
  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };

  function fakeElectron() {
    const made = [];
    class BrowserWindow {
      constructor(options) {
        this.options = options;
        this.bounds = { x: options.x ?? 277, y: options.y ?? 90, width: options.width, height: options.height };
        this.events = {};
        this.onceEvents = {};
        this.maximized = false;
        this.shown = false;
        this.webContents = { handlers: {}, on: (e, fn) => { this.webContents.handlers[e] = fn; } };
        made.push(this);
      }
      on(e, fn) { this.events[e] = fn; }
      once(e, fn) { this.onceEvents[e] = fn; }
      loadURL(url) { this.url = url; return Promise.resolve(); }
      getBounds() { return { ...this.bounds }; }
      getNormalBounds() { return { ...(this.normalBounds || this.bounds) }; }
      setBounds(b) { this.bounds = { ...b }; }
      setSize(w, h) { this.bounds = { ...this.bounds, width: w, height: h }; }
      isDestroyed() { return false; }
      isMinimized() { return false; }
      isFullScreen() { return false; }
      setFullScreen() {}
      isVisible() { return this.shown; }
      isMaximized() { return this.maximized; }
      maximize() { this.normalBounds = { ...this.bounds }; this.maximized = true; }
      unmaximize() { this.maximized = false; if (this.normalBounds) this.bounds = { ...this.normalBounds }; }
      show() { this.shown = true; }
    }
    const menus = [];
    const Menu = { buildFromTemplate: (items) => ({ popup: () => menus.push(items) }) };
    const screen = { getAllDisplays: () => [display], getDisplayMatching: () => display };
    return { BrowserWindow, Menu, screen, made, menus };
  }

  function open(savedState = {}, packaged = true) {
    const el = fakeElectron();
    let saved = { ...savedState };
    const state = { get: () => ({ ...saved }), set: (patch) => { saved = { ...saved, ...patch }; for (const k of Object.keys(saved)) if (saved[k] === undefined) delete saved[k]; return saved; } };
    const ui = createMainWindow({ BrowserWindow: el.BrowserWindow, screen: el.screen, Menu: el.Menu, state, preload: "/app/electron/preload.cjs", url: "app://ted/index.html", packaged });
    return { ...el, ui, win: el.made[0], saved: () => saved };
  }

  it("creates a hardened window with the agreed chrome and sizes", () => {
    const { win } = open();
    const o = win.options;
    expect(o).toMatchObject({
      width: 1366, height: 860, minWidth: 360, minHeight: 560, show: false, title: "Тед – Имоти Надежда",
      titleBarStyle: "hidden", titleBarOverlay: { color: "#22030b", symbolColor: "#f3cf86", height: 36 },
    });
    expect(o.webPreferences).toEqual({
      preload: "/app/electron/preload.cjs", contextIsolation: true, sandbox: true, nodeIntegration: false, nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false, webSecurity: true, allowRunningInsecureContent: false, experimentalFeatures: false,
      webviewTag: false, navigateOnDragDrop: false, spellcheck: false, devTools: false,
    });
    expect(win.url).toBe("app://ted/index.html");
    expect(win.shown).toBe(false);
    win.onceEvents["ready-to-show"]();
    expect(win.shown).toBe(true);
  });

  it("shows the window after a few seconds even if ready-to-show never fires", () => {
    vi.useFakeTimers();
    try {
      const { win } = open();
      vi.advanceTimersByTime(4000);
      expect(win.shown).toBe(false);
      vi.advanceTimersByTime(1500);
      expect(win.shown).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("enables devtools only when not packaged", () => {
    expect(webPreferences({ preload: "p", packaged: false }).devTools).toBe(true);
    expect(webPreferences({ preload: "p", packaged: true }).devTools).toBe(false);
  });

  it("restores saved bounds only when they are still visible on a display", () => {
    const good = { x: 100, y: 80, width: 1200, height: 800 };
    expect(open({ bounds: good }).win.options).toMatchObject(good);
    for (const bounds of [{ x: 5000, y: 80, width: 1200, height: 800 }, { x: 0, y: 0, width: 100, height: 100 }, { x: "a", y: 0, width: 800, height: 600 }, null]) {
      const o = open({ bounds }).win.options;
      expect(o).toMatchObject({ width: 1366, height: 860 });
      expect(o.x).toBeUndefined();
    }
    expect(usableBounds(good, [])).toBeNull();
  });

  it("remembers size, position and the maximized state on close", () => {
    const { win, saved } = open();
    win.bounds = { x: 40, y: 50, width: 1000, height: 700 };
    win.events.close();
    expect(saved()).toEqual({ bounds: { x: 40, y: 50, width: 1000, height: 700 }, maximized: false, compact: false });
    const again = open(saved());
    expect(again.win.options).toMatchObject({ x: 40, y: 50, width: 1000, height: 700 });

    const max = open({ bounds: { x: 40, y: 50, width: 1000, height: 700 }, maximized: true });
    max.win.onceEvents["ready-to-show"]();
    expect(max.win.maximized).toBe(true);
  });

  it("setCompact resizes to 420x860 and back to the previous bounds", () => {
    const { ui, win, saved } = open({ bounds: { x: 300, y: 60, width: 1366, height: 860 } });
    expect(ui.isCompact()).toBe(false);
    expect(ui.setCompact(true)).toEqual({ ok: true });
    expect(win.bounds).toEqual({ x: 300, y: 60, width: 420, height: 860 });
    expect(ui.isCompact()).toBe(true);
    expect(saved()).toMatchObject({ compact: true, bounds: { x: 300, y: 60, width: 1366, height: 860 } });
    expect(ui.setCompact(true)).toEqual({ ok: true }); // idempotent
    win.bounds = { x: 900, y: 100, width: 420, height: 860 }; // moved around while compact
    win.events.close();
    expect(saved().bounds).toEqual({ x: 300, y: 60, width: 1366, height: 860 });

    expect(ui.setCompact(false)).toEqual({ ok: true });
    expect(win.bounds).toEqual({ x: 300, y: 60, width: 1366, height: 860 });
    expect(saved()).toMatchObject({ compact: false });
  });

  it("compact mode fits the screen and comes back maximized if it was", () => {
    const { ui, win } = open({ bounds: { x: 1700, y: 400, width: 1366, height: 860 } });
    win.maximize();
    ui.setCompact(true);
    expect(win.maximized).toBe(false);
    expect(win.bounds.width).toBe(420);
    expect(win.bounds.x + win.bounds.width).toBeLessThanOrEqual(1920);
    expect(win.bounds.y + win.bounds.height).toBeLessThanOrEqual(1040);
    ui.setCompact(false);
    expect(win.maximized).toBe(true);
  });

  it("reopens in compact mode when it was closed that way", () => {
    const { win, ui } = open({ bounds: { x: 300, y: 60, width: 1366, height: 860 }, compact: true });
    expect(win.options).toMatchObject({ x: 300, y: 60, width: 420, height: 860 });
    ui.setCompact(false);
    expect(win.bounds).toEqual({ x: 300, y: 60, width: 1366, height: 860 });
  });

  it("offers a Bulgarian edit menu on right click, only where it makes sense", () => {
    const { win, menus } = open();
    const menu = win.webContents.handlers["context-menu"];
    menu({}, { isEditable: true, editFlags: { canCut: true, canCopy: true, canPaste: false } });
    expect(menus[0].filter((i) => i.label).map((i) => [i.role, i.label, i.enabled])).toEqual([
      ["cut", "Изрежи", true], ["copy", "Копирай", true], ["paste", "Постави", false], ["selectAll", "Избери всичко", undefined],
    ]);
    menu({}, { isEditable: false, selectionText: " избран текст " });
    expect(menus[1]).toEqual([{ role: "copy", label: "Копирай" }]);
    menu({}, { isEditable: false, selectionText: "" });
    expect(menus).toHaveLength(2);
  });
});

describe("main.js wiring (static checks)", () => {
  const src = read("electron/main.js");

  it("locks to a single instance, enables the sandbox and registers the privileged scheme before ready", () => {
    expect(src).toMatch(/app\.requestSingleInstanceLock\(\)/);
    expect(src).toMatch(/app\.enableSandbox\(\)/);
    expect(src).toMatch(/protocol\.registerSchemesAsPrivileged\(\[SCHEME\]\)/);
    expect(src.indexOf("app.enableSandbox()")).toBeLessThan(src.indexOf("app.whenReady()"));
    expect(src.indexOf("registerSchemesAsPrivileged")).toBeLessThan(src.indexOf("app.whenReady()"));
    expect(src).toMatch(/if \(app\.isPackaged\) Menu\.setApplicationMenu\(null\)/);
    expect(src).toMatch(/second-instance/);
  });

  it("is the only module of this area that imports electron", () => {
    for (const file of ["log.js", "window.js", "protocol.js", "security.js", "ipc.js", "store/secure-file.js", "store/settings.js", "store/chats.js",
      "backend/config.js", "backend/http.js", "backend/session.js", "backend/assistant.js", "backend/tools.js", "backend/email.js", "backend/voice.js", "backend/labels.js"]) {
      expect(read("electron/" + file), file).not.toMatch(/from\s+["']electron["']|require\(["']electron["']\)/);
    }
    expect(src).toMatch(/from "electron"/);
  });

  it("loads the dev server only when not packaged and only from this computer", () => {
    expect(src).toMatch(/if \(app\.isPackaged \|\| !process\.env\.TED_DEV_URL\) return null/);
    expect(src).toMatch(/u\.hostname === "localhost" \|\| u\.hostname === "127\.0\.0\.1"/);
  });

  it("contains no secrets", () => {
    const all = fs.readdirSync(path.join(root, "electron"), { recursive: true })
      .filter((f) => /\.(js|cjs)$/.test(String(f)) && !String(f).startsWith("realgpt"))
      .map((f) => read(path.join("electron", String(f)))).join("\n");
    expect(all).not.toMatch(/service_role|SERVICE_ROLE|sk-[A-Za-z0-9]{20}|eyJ[A-Za-z0-9_-]{10,}\./);
  });
});
