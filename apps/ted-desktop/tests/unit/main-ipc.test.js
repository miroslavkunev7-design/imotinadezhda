// IPC additions of 0.1.3 (docs/CONTRACT.md §8, §8.11): every input validated in MAIN before a service is touched,
// results copied field by field, MAIN-only settings protected. Plain fakes, no Electron.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHandlers, cleanSettingsPatch, createAppApi } from "../../electron/ipc.js";

function setup(over = {}) {
  const calls = [];
  const rec = (name, result) => (...args) => { calls.push([name, ...args]); return typeof result === "function" ? result(...args) : result; };
  const deps = {
    appApi: { storage: rec("app.storage", { ok: true }), clearTemp: rec("app.clearTemp", { ok: true }), reportProblem: rec("app.reportProblem", { ok: true }) },
    settings: { get: rec("settings.get", {}), set: rec("settings.set", (p) => p) },
    realgpt: {
      send: rec("rg.send", { ok: true, text: "т", model: "m" }), consent: rec("rg.consent", { ok: true, consent: "all", account: "a@example.com", token: "LEAK" }),
      setConsent: rec("rg.setConsent", { ok: true }), approve: rec("rg.approve", { ok: true }), cancel: rec("rg.cancel", { ok: true }),
    },
    files: {
      add: rec("files.add", (a) => ({ ok: true, file: { id: "file000001", name: a.name } })), read: rec("files.read", { ok: true }), extract: rec("files.extract", { ok: true }),
      open: rec("files.open", { ok: true }), save: rec("files.save", { ok: true }), forget: rec("files.forget", { ok: true }), list: rec("files.list", { ok: true, items: [] }),
      remove: rec("files.remove", { ok: true }), clear: rec("files.clear", { ok: true }),
    },
    video: { prepare: rec("video.prepare", { ok: true }), start: rec("video.start", { ok: true }), cancel: rec("video.cancel", { ok: true }), finish: rec("video.finish", { ok: true }) },
    scheduled: { list: rec("sched.list", { ok: true, items: [] }), save: rec("sched.save", { ok: true }), remove: rec("sched.remove", { ok: true }) },
    updater: { state: rec("upd.state", { status: "disabled" }), check: rec("upd.check", {}), setAuto: rec("upd.setAuto", {}), download: rec("upd.download", { ok: false }), install: rec("upd.install", { ok: false }) },
    browser: { get: rec("browser.get", { status: 200, buffer: Buffer.from("<html><title> Обяви  за имоти </title></html>") }) },
    ...over,
  };
  const h = createHandlers(deps);
  return { h, calls };
}

const user = (text, extra = {}) => ({ role: "user", text, ...extra });

describe("validation before any service", () => {
  it("refuses bad inputs of every new channel with code invalid", async () => {
    const { h, calls } = setup();
    const bad = [
      ["ted:files.add", "x"], ["ted:files.add", { name: "", data: "AAAA" }], ["ted:files.add", { name: "a.txt", data: "не е base64!" }],
      ["ted:files.add", { name: "a.txt", data: "" }], ["ted:files.add", { name: "x".repeat(181), data: "AAAA" }], ["ted:files.add", { name: "a", data: "AAAA", temporary: "yes" }],
      ["ted:files.add", { name: "a", data: "A".repeat(28 * 1024 * 1024 + 4) }],
      ["ted:files.read", { id: "../x" }], ["ted:files.read", { id: "short" }], ["ted:files.read", { id: "abcdefgh", max: -1 }],
      ["ted:files.extract", "abcdefgh"], ["ted:files.open", "C:\\Windows\\x.exe"], ["ted:files.save", 5], ["ted:files.forget", "ABCDEFGH"],
      ["ted:realgpt.send", { requestId: "r", model: "m", messages: [user("x")], hints: ["shell"] }],
      ["ted:realgpt.send", { requestId: "r", model: "m", messages: [user("x")], mode: "agent" }],
      ["ted:realgpt.send", { requestId: "r", model: "m", messages: [user("x")], role: "auto" }],
      ["ted:realgpt.send", { requestId: "r", model: "m", messages: [user("x")], canvas: { text: "x".repeat(200001) } }],
      ["ted:realgpt.send", { requestId: "r", model: "m", messages: [user("x", { files: Array(11).fill("abcdefgh12") })] }],
      ["ted:realgpt.send", { requestId: "r", model: "m", messages: [{ role: "assistant", text: "x", files: ["abcdefgh12"] }, user("y")] }],
      ["ted:realgpt.send", { requestId: "r", model: "m", messages: [user("x", { files: ["../../etc"] })] }],
      ["ted:realgpt.send", { requestId: "r", model: "m", messages: [user("x")], temporary: 1 }],
      ["ted:realgpt.setConsent", "everything"], ["ted:realgpt.setConsent", true],
      ["ted:realgpt.approve", {}], ["ted:realgpt.approve", { requestId: "r", approvalId: "a", decision: "yes" }],
      ["ted:realgpt.approve", { requestId: "r", approvalId: "a", decision: "allow", options: { engine: "kling", duration: "5" } }],
      ["ted:browse.test", {}], ["ted:browse.test", { url: "x".repeat(2001) }],
      ["ted:video.prepare", {}], ["ted:video.prepare", { fileIds: ["bad id"] }], ["ted:video.prepare", { code: "x".repeat(61) }],
      ["ted:video.start", { jobId: "v", engine: "kling" }], ["ted:video.finish", { jobId: "v", fileId: "x" }], ["ted:video.cancel", "v"],
      ["ted:library.list", { q: "x".repeat(201) }], ["ted:library.list", "x"], ["ted:library.remove", "x"],
      ["ted:scheduled.save", "x"], ["ted:scheduled.save", { text: "x".repeat(17 * 1024) }], ["ted:scheduled.remove", 5],
      ["ted:updates.setAuto", "on"],
    ];
    for (const [channel, ...args] of bad) {
      const out = await h[channel](...args);
      expect(out, `${channel} ${JSON.stringify(args).slice(0, 80)}`).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(calls).toEqual([]);
  });

  it("passes valid inputs on with only the contract fields", async () => {
    const { h, calls } = setup();
    await h["ted:files.add"]({ name: "оферта.pdf", mime: "application/pdf", data: Buffer.from("%PDF-1.4").toString("base64"), chatId: "c1", temporary: true, path: "C:/x" });
    const added = calls.find((c) => c[0] === "files.add")[1];
    expect(Buffer.isBuffer(added.data)).toBe(true);
    expect(added).toMatchObject({ name: "оферта.pdf", mime: "application/pdf", chatId: "c1", temporary: true, origin: "user" });
    expect(added).not.toHaveProperty("path");
    await h["ted:realgpt.send"]({
      requestId: "r1", model: "m", effort: "low", messages: [user("x", { files: ["abcdefgh12"], junk: 1 })], mode: "work",
      hints: ["image", "image", "thinking"], canvas: { title: "Оферта", text: "# x", version: 2, html: "<x>" }, caseId: "c1", role: "rent",
      chatId: "chat-1", temporary: false, tools: [{ type: "web_search" }], instructions: "Кратко.",
    });
    expect(calls.find((c) => c[0] === "rg.send")[1]).toEqual({
      requestId: "r1", model: "m", effort: "low", instructions: "Кратко.", messages: [{ role: "user", text: "x", files: ["abcdefgh12"] }],
      mode: "work", hints: ["image", "thinking"], canvas: { title: "Оферта", text: "# x", version: 2 }, caseId: "c1", role: "rent", chatId: "chat-1",
    });
    await h["ted:realgpt.approve"]({ requestId: "r1", approvalId: "ap_1", decision: "allow", options: { engine: "kling", duration: 5, price: 0 } });
    expect(calls.find((c) => c[0] === "rg.approve")[1]).toEqual({ requestId: "r1", approvalId: "ap_1", decision: "allow", options: { engine: "kling", duration: 5 } });
    await h["ted:video.prepare"]({ code: "P-1", fileIds: [], extra: 1 });
    expect(calls.find((c) => c[0] === "video.prepare")[1]).toEqual({ code: "P-1", fileIds: [], prompt: undefined });
  });

  it("copies agent results field by field", async () => {
    const leak = { access_token: "LEAK" };
    const { h } = setup({
      realgpt: {
        send: async () => ({ ok: true, text: "т", model: "m", toolsOff: true, steps: [{ id: "s1", kind: "crm", label: "CRM: клиенти.търсене", status: "ok" }], files: [{ id: "file000001", name: "a.pdf" }], limited: { rounds: 8, calls: 7, ...leak }, ...leak }),
        consent: async () => ({ ok: true, consent: "all", account: "a@example.com", ...leak }),
      },
    });
    const r = await h["ted:realgpt.send"]({ requestId: "r", model: "m", messages: [user("x")] });
    expect(r).toEqual({ ok: true, text: "т", model: "m", toolsOff: true, steps: [{ id: "s1", kind: "crm", label: "CRM: клиенти.търсене", status: "ok" }], files: [{ id: "file000001", name: "a.pdf" }], limited: { rounds: 8, calls: 7 } });
    expect(await h["ted:realgpt.consent"]()).toEqual({ ok: true, consent: "all", account: "a@example.com" });
    const fail = setup({ realgpt: { send: async () => ({ ok: false, error: "x", code: "tools_unsupported", text: "част", steps: [], files: [], ...leak }) } });
    expect(await fail.h["ted:realgpt.send"]({ requestId: "r", model: "m", messages: [user("x")] })).toEqual({ ok: false, error: "x", code: "tools_unsupported", text: "част", steps: [], files: [] });
  });

  it("browse.test reports status and title only", async () => {
    const { h } = setup();
    expect(await h["ted:browse.test"]({ url: "https://imoti.example.com/" })).toEqual({ ok: true, status: 200, title: "Обяви за имоти" });
    const failing = setup({ browser: { get: async () => { throw Object.assign(new Error("Адреси от локалната мрежа и на този компютър не се отварят."), { code: "private" }); } } });
    expect(await failing.h["ted:browse.test"]({ url: "http://192.168.1.1/" })).toEqual({ ok: false, error: "Адреси от локалната мрежа и на този компютър не се отварят.", code: "private" });
  });
});

describe("settings written by the page", () => {
  it("cannot set updates.auto; browse/nick/instructions/notify are normalised", () => {
    expect(cleanSettingsPatch({ updates: { auto: false }, big: 1 })).toEqual({ big: 1 });
    expect(cleanSettingsPatch({ browse: { enabled: false, blocked: ["https://Spam.Example.com/path", "*.ads.example.com", "localhost", 5, "x"] } })).toEqual({
      browse: { enabled: false, robots: true, blocked: ["spam.example.com", "ads.example.com"] },
    });
    expect(cleanSettingsPatch({ nick: "x".repeat(100), instructions: "y".repeat(2000), mode: "turbo", notify: { scheduled: false } })).toEqual({
      nick: "x".repeat(60), instructions: "y".repeat(1500), mode: "chat", notify: { scheduled: false, updates: true },
    });
  });

  it("updates.download reaches the updater (no input)", async () => {
    const { h, calls } = setup();
    expect(await h["ted:updates.download"]()).toEqual({ ok: false });
    expect(calls.map((c) => c[0])).toContain("upd.download");
  });

  it("store.setSettings applies the cleaning", async () => {
    const { h, calls } = setup();
    await h["ted:store.setSettings"]({ updates: { auto: false }, mode: "work" });
    expect(calls.find((c) => c[0] === "settings.set")[1]).toEqual({ mode: "work" });
  });
});

describe("app additions", () => {
  it("storage sizes, clearTemp and reportProblem (logs folder + mailto without a recipient)", async () => {
    const opened = [];
    const ext = [];
    const logDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ted-ipc-")), "logs");
    const api = createAppApi({
      app: { getVersion: () => "0.1.3", isPackaged: true, getPath: () => "/tmp" }, shell: { openPath: async (p) => { opened.push(p); return ""; } },
      clipboard: {}, dialog: {}, getWindow: () => null, setCompact: () => ({}), openExternal: async (u) => { ext.push(u); return { ok: true }; },
      logDir, chatsFile: "/nonexistent/chats.bin",
      files: { storage: () => ({ libraryBytes: 10, libraryCount: 1, tempBytes: 5 }), clearTemp: () => { ext.push("cleared"); } },
    });
    expect(api.storage()).toEqual({ ok: true, chatsBytes: 0, libraryBytes: 10, libraryCount: 1, tempBytes: 5 });
    expect(api.clearTemp()).toEqual({ ok: true });
    expect(await api.reportProblem()).toEqual({ ok: true });
    expect(opened).toEqual([logDir]);
    fs.rmSync(path.dirname(logDir), { recursive: true, force: true });
    expect(ext[1]).toMatch(/^mailto:\?subject=/);
    expect(decodeURIComponent(ext[1])).toContain("Тед за Windows 0.1.3 – проблем");
  });
});
