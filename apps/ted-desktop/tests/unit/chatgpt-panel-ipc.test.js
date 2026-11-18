// 0.1.7 „ChatGPT панел“ (docs/CONTRACT.md §23): the IPC channels ted:chatgpt.* – MAIN builds every address itself,
// numbers only for the rectangle, the clipboard picture copied field by field; the sender checks of every channel.
import { describe, it, expect } from "vitest";
import { createHandlers, registerIpc } from "../../electron/ipc.js";
import { createOriginCheck } from "../../electron/security.js";
import { CHATGPT_HOME, CHATGPT_PROMPT_MAX, chatgptUrl, panelLink } from "../../electron/agent/chatgpt-link.js";

function setup(panelOver = {}) {
  const calls = [];
  const rec = (name, result) => (...args) => { calls.push([name, ...args]); return typeof result === "function" ? result(...args) : result; };
  const chatgptPanel = {
    open: rec("open", { ok: true, extra: "x" }), setBounds: rec("setBounds", { ok: true }), reload: rec("reload", { ok: true }),
    openInBrowser: rec("openInBrowser", { ok: true }), close: rec("close", { ok: true }),
    clipboardImage: rec("clip", () => ({ ok: true, name: "Снимка от ChatGPT 2026-11-18 10.30.png", mime: "image/png", size: 3, width: 2, height: 1, data: new Uint8Array([1, 2, 3]).buffer, path: "C:/secret" })),
    ...panelOver,
  };
  return { h: createHandlers({ chatgptPanel, appApi: {}, settings: { get: () => ({}) } }), calls };
}

describe("ted:chatgpt.open", () => {
  it("{prompt} -> exactly chatgpt-link's https://chatgpt.com/?q=…; {bare:true} -> chatgpt.com; {} or nothing -> as it was", async () => {
    const { h, calls } = setup();
    expect(await h["ted:chatgpt.open"]({ prompt: "Снимка на хол\r\nтопли цветове" })).toEqual({ ok: true });
    expect(calls.at(-1)).toEqual(["open", { url: chatgptUrl("Снимка на хол\nтопли цветове") }]);
    expect(await h["ted:chatgpt.open"]({ bare: true })).toEqual({ ok: true });
    expect(calls.at(-1)).toEqual(["open", { url: CHATGPT_HOME }]);
    expect(await h["ted:chatgpt.open"]({})).toEqual({ ok: true });
    expect(calls.at(-1)).toEqual(["open", { url: null }]);
    expect(await h["ted:chatgpt.open"]()).toEqual({ ok: true });
    expect(calls.at(-1)).toEqual(["open", { url: null }]);
    // Nothing of the page's arguments reaches the controller besides the address MAIN built.
    await h["ted:chatgpt.open"]({ prompt: "x", url: "https://evil.example/", partition: "persist:other" });
    expect(calls.at(-1)).toEqual(["open", { url: chatgptUrl("x") }]);
  });

  it("refuses bad arguments and prompts that are empty, too long or too long for a link – before the controller", async () => {
    const { h, calls } = setup();
    for (const a of [42, "x", [], { prompt: 5 }, { prompt: "" }, { prompt: "   " }, { prompt: "x".repeat(CHATGPT_PROMPT_MAX * 2 + 1) }, { prompt: "x".repeat(CHATGPT_PROMPT_MAX + 1) }, { bare: "yes" }, { bare: 1 }, { prompt: "\uD800" }]) {
      expect(await h["ted:chatgpt.open"](a), JSON.stringify(a).slice(0, 60)).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(await h["ted:chatgpt.open"]({ prompt: "к".repeat(1400) })).toMatchObject({ ok: false, code: "too_long" });
    expect(calls).toEqual([]);
    expect(panelLink({ prompt: "x".repeat(CHATGPT_PROMPT_MAX) })).toEqual({ ok: true, url: chatgptUrl("x".repeat(CHATGPT_PROMPT_MAX)) });
  });

  it("the controller's answer is copied field by field", async () => {
    const { h } = setup({ open: () => ({ ok: false, code: "signed_out", error: "Влезте в CRM.", token: "LEAK" }) });
    expect(await h["ted:chatgpt.open"]({})).toEqual({ ok: false, code: "signed_out", error: "Влезте в CRM." });
  });
});

describe("ted:chatgpt.setBounds / reload / openInBrowser / close", () => {
  it("only the five numbers/flag of the rectangle reach the controller", async () => {
    const { h, calls } = setup();
    expect(await h["ted:chatgpt.setBounds"]({ x: 820, y: 163, width: 546, height: 605, visible: true, url: "https://evil.example/" })).toEqual({ ok: true });
    expect(calls.at(-1)).toEqual(["setBounds", { x: 820, y: 163, width: 546, height: 605, visible: true }]);
    for (const bad of [null, "x", [1, 2], { x: "1".repeat(600) }]) expect(await h["ted:chatgpt.setBounds"](bad)).toMatchObject({ ok: false, code: "invalid" });
    const refused = setup({ setBounds: () => ({ ok: false, code: "invalid" }) });
    expect(await refused.h["ted:chatgpt.setBounds"]({ x: 1 })).toMatchObject({ ok: false, code: "invalid" });
  });

  it("reload and close take no arguments; openInBrowser only nothing or {blocked:true} – never an address", async () => {
    const { h, calls } = setup();
    expect(await h["ted:chatgpt.reload"]("https://evil.example/")).toEqual({ ok: true });
    expect(await h["ted:chatgpt.openInBrowser"]()).toEqual({ ok: true });
    expect(await h["ted:chatgpt.openInBrowser"]({})).toEqual({ ok: true });
    expect(await h["ted:chatgpt.openInBrowser"]({ blocked: false })).toEqual({ ok: true });
    expect(await h["ted:chatgpt.close"]({ x: 1 })).toEqual({ ok: true });
    expect(calls).toEqual([["reload"], ["openInBrowser", undefined], ["openInBrowser", undefined], ["openInBrowser", undefined], ["close"]]);
    // The note's „Отвори в браузъра“: the address is MAIN's own (the refused one); the renderer only says which button.
    expect(await h["ted:chatgpt.openInBrowser"]({ blocked: true })).toEqual({ ok: true });
    expect(calls.at(-1)).toEqual(["openInBrowser", { blocked: true }]);
    const n = calls.length;
    for (const bad of ["https://evil.example/", 1, [], { url: "https://evil.example/" }, { blocked: true, url: "https://evil.example/" }, { blocked: "yes" }]) {
      expect(await h["ted:chatgpt.openInBrowser"](bad), JSON.stringify(bad)).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(calls).toHaveLength(n);
    const none = setup({ openInBrowser: () => ({ ok: false, code: "none", error: "Няма връзка за отваряне.", url: "LEAK" }) });
    expect(await none.h["ted:chatgpt.openInBrowser"]({ blocked: true })).toEqual({ ok: false, code: "none", error: "Няма връзка за отваряне." });
  });
});

describe("ted:chatgpt.clipboardImage", () => {
  it("returns only the PNG bytes, its name, size and dimensions", async () => {
    const { h } = setup();
    const r = await h["ted:chatgpt.clipboardImage"]("ignored");
    expect(Object.keys(r).sort()).toEqual(["data", "height", "mime", "name", "ok", "size", "width"]);
    expect(r).toMatchObject({ ok: true, mime: "image/png", size: 3, width: 2, height: 1 });
    expect(r.data).toBeInstanceOf(ArrayBuffer);
  });

  it("empty / too large / not an ArrayBuffer -> an honest refusal, nothing else", async () => {
    expect(await setup({ clipboardImage: () => ({ ok: false, code: "empty", error: "В клипборда няма снимка.", data: "x" }) }).h["ted:chatgpt.clipboardImage"]()).toEqual({ ok: false, code: "empty", error: "В клипборда няма снимка." });
    expect(await setup({ clipboardImage: () => ({ ok: true, data: "base64" }) }).h["ted:chatgpt.clipboardImage"]()).toMatchObject({ ok: false, code: "too_large" });
    expect(await setup({ clipboardImage: () => ({ ok: true, data: new ArrayBuffer(9 * 1024 * 1024) }) }).h["ted:chatgpt.clipboardImage"]()).toMatchObject({ ok: false, code: "too_large" });
    expect(await setup({ clipboardImage: () => ({ ok: true, data: new ArrayBuffer(0) }) }).h["ted:chatgpt.clipboardImage"]()).toMatchObject({ ok: false, code: "too_large" });
  });

  it("without a panel controller every channel answers „unavailable“ and nothing opens", async () => {
    const h = createHandlers({ appApi: {}, settings: { get: () => ({}) } });
    expect(await h["ted:chatgpt.open"]({ prompt: "x" })).toMatchObject({ ok: false, code: "unavailable" });
    expect(await h["ted:chatgpt.clipboardImage"]()).toMatchObject({ ok: false, code: "unavailable" });
    expect(await h["ted:chatgpt.setBounds"]({ x: 0, y: 0, width: 1, height: 1, visible: false })).toMatchObject({ ok: false, code: "invalid" });
  });
});

describe("sender checks", () => {
  it("the ChatGPT page, a sign-in pop-up or any other window can never call a ted:chatgpt channel", async () => {
    const handlers = new Map();
    const { calls } = setup();
    const panel = { open: () => { calls.push("open"); return { ok: true }; }, setBounds: () => ({ ok: true }), reload: () => ({ ok: true }), openInBrowser: () => ({ ok: true }), close: () => ({ ok: true }), clipboardImage: () => { calls.push("clip"); return { ok: false }; } };
    registerIpc({ ipcMain: { handle: (c, fn) => handlers.set(c, fn) }, isTrusted: createOriginCheck(null), isMainSender: (e) => !!e.sender && e.sender.id === 1, chatgptPanel: panel, appApi: {}, settings: { get: () => ({}) } });
    const channels = [...handlers.keys()].filter((c) => c.startsWith("ted:chatgpt."));
    expect(channels.sort()).toEqual(["ted:chatgpt.clipboardImage", "ted:chatgpt.close", "ted:chatgpt.open", "ted:chatgpt.openInBrowser", "ted:chatgpt.reload", "ted:chatgpt.setBounds"]);
    const strangers = [
      { senderFrame: { url: "https://chatgpt.com/", parent: null }, sender: { id: 7 } },
      { senderFrame: { url: "https://accounts.google.com/", parent: null }, sender: { id: 8 } },
      { senderFrame: { url: "app://ted/index.html", parent: null }, sender: { id: 7 } }, // the right page in another web contents
      { senderFrame: { url: "app://ted/index.html", parent: { url: "app://ted/index.html" } }, sender: { id: 1 } },
      { senderFrame: { url: "https://chatgpt.com/", parent: null }, sender: { id: 1 } },
    ];
    for (const c of channels) for (const ev of strangers) await expect(handlers.get(c)(ev, { prompt: "x" }), c).rejects.toThrow("forbidden");
    expect(calls).toEqual([]);
    expect(await handlers.get("ted:chatgpt.open")({ senderFrame: { url: "app://ted/index.html", parent: null }, sender: { id: 1 } }, { prompt: "x" })).toEqual({ ok: true });
    expect(calls).toEqual(["open"]);
  });
});
