import { describe, it, expect, vi } from "vitest";
import { withServerFallback, parseServerAnswer, SERVER_ENGINE, serverPrompt } from "../../electron/browse/fallback.js";

const SERVER_TEXT = [
  "1. Къща в с. Ново село – 85 000 € – тел. 0888 123 456",
  "Двуетажна къща с двор 900 кв.м.",
  "",
  "Източници:",
  "• imot.bg – Къща Ново село – https://www.imot.bg/obiava-1a2b3c-prodava-kashta",
  "• alo.bg – Къщи Велико Търново – https://www.alo.bg/obiavi/kashti/?page=2.",
].join("\n");

describe("search fallback through Ted's server", () => {
  it("returns the local result untouched when DuckDuckGo answers", async () => {
    const local = vi.fn(async () => ({ ok: true, query: "къща", engine: "DuckDuckGo", results: [{ title: "a", url: "https://a.bg/", snippet: "" }] }));
    const assistant = { chat: vi.fn(), cancel: vi.fn() };
    const r = await withServerFallback(local, assistant)({ query: "къща" });
    expect(r.engine).toBe("DuckDuckGo");
    expect(assistant.chat).not.toHaveBeenCalled();
  });

  it("does not retry invalid input", async () => {
    const local = async () => ({ ok: false, code: "invalid", error: "Въведете какво да търся." });
    const assistant = { chat: vi.fn(), cancel: vi.fn() };
    const r = await withServerFallback(local, assistant)({ query: "" });
    expect(r.code).toBe("invalid");
    expect(assistant.chat).not.toHaveBeenCalled();
  });

  it("goes to the server once when the local search is rate-limited and labels the engine", async () => {
    const local = async () => ({ ok: false, code: "rate_limited", error: "Търсачката временно ограничи заявките." });
    const assistant = { chat: vi.fn(async () => ({ ok: true, text: SERVER_TEXT })), cancel: vi.fn() };
    const r = await withServerFallback(local, assistant, { newId: () => "srch-1" })({ query: "къща Ново село", n: 5 });
    expect(assistant.chat).toHaveBeenCalledTimes(1);
    const call = assistant.chat.mock.calls[0][0];
    expect(call.requestId).toBe("srch-1");
    expect(call.messages).toEqual([{ role: "user", text: serverPrompt("къща Ново село") }]);
    expect(r.ok).toBe(true);
    expect(r.engine).toBe(SERVER_ENGINE);
    expect(r.note).toMatch(/сървъра на Тед/);
    expect(r.results.map((x) => x.url)).toEqual(["https://www.imot.bg/obiava-1a2b3c-prodava-kashta", "https://www.alo.bg/obiavi/kashti/?page=2"]);
    expect(r.results[0].title).toMatch(/imot\.bg – Къща Ново село/);
    expect(r.answer).toContain("0888 123 456");
  });

  it("reports both failures honestly when the server also fails", async () => {
    const local = async () => ({ ok: false, code: "network", error: "Няма връзка." });
    const assistant = { chat: vi.fn(async () => ({ ok: false, code: "quota", error: "Лимитът на AI модела е изчерпан." })), cancel: vi.fn() };
    const r = await withServerFallback(local, assistant)({ query: "къща" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("network");
    expect(r.error).toMatch(/Няма връзка\..*сървъра на Тед също не успя: Лимитът/);
  });

  it("cancels the server request when the answer is stopped", async () => {
    const ctrl = new AbortController();
    const local = async () => ({ ok: false, code: "timeout", error: "Бавно." });
    let release;
    const assistant = {
      chat: vi.fn(() => new Promise((res) => { release = res; })),
      cancel: vi.fn(() => release({ ok: false, code: "network", error: "Прекъснато." })),
    };
    const p = withServerFallback(local, assistant, { newId: () => "srch-x" })({ query: "къща" }, { signal: ctrl.signal });
    await new Promise((r) => setTimeout(r, 0));
    ctrl.abort();
    const r = await p;
    expect(assistant.cancel).toHaveBeenCalledWith("srch-x");
    expect(r.ok).toBe(false);
  });

  it("parses links only once, drops trailing punctuation and keeps http(s) only", () => {
    const out = parseServerAnswer("a https://x.bg/1.\nb https://x.bg/1\nc javascript:alert(1)\nd ftp://x.bg/f\ne http://y.bg/p?q=1)", 8);
    expect(out.map((x) => x.url)).toEqual(["https://x.bg/1", "http://y.bg/p?q=1"]);
  });
});
