// Pure conversation logic of the renderer (src/lib/chat.js): the typed-confirmation guard, the e-mail
// watermark and the "interrupted" answers. No DOM, no network.
import { describe, it, expect } from "vitest";
import {
  AFFIRM_BLOCK_TEXT, AFFIRM_CASE_TEXT, affirmGuard, cleanChats, emailBlock, lastAssistant, markFromReply, newestEmailId,
  newestInterrupted, raiseMark, readMark, safeFileName, serverHistory,
} from "../../src/lib/chat.js";
import { AFFIRM, AFFIRM_START, INTERRUPTED_TEXT, RG_NEW_ACCOUNT_CODES } from "../../src/lib/consts.js";

describe("safeFileName", () => {
  it("cuts by code points: an emoji on the 80-character boundary is dropped whole, never left as a lone surrogate", () => {
    const name = safeFileName("а".repeat(79) + "👋 и още", "md");
    expect(name.isWellFormed()).toBe(true);
    expect(name).toBe("а".repeat(79) + "👋.md");           // 80 code points kept
    expect(safeFileName("🏠".repeat(90), "md")).toBe("🏠".repeat(80) + ".md");
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j', "md")).toBe("a-b-c-d-e-f-g-h-i-j.md");
    expect(safeFileName("", "md")).toBe("чат.md");
  });
});

describe("Real GPT sign-in codes", () => {
  it("a sign-in timeout offers a fresh registration (a dead issued client id never calls back)", () => {
    expect(RG_NEW_ACCOUNT_CODES).toEqual(["registration", "account_mismatch", "oauth", "id_token", "signin_timeout"]);
  });
});

const T = 1_800_000_000_000;
const user = (id, text, extra = {}) => ({ id, role: "user", text, time: T, ...extra });
const ted = (id, text, extra = {}) => ({ id, role: "assistant", engine: "server", text, time: T, ...extra });
const card = (id, time = T, extra = {}) => ted(id, "Подготвих имейл. Да го изпратя ли?", { time, email: { to: "a@example.test", subject: "x", can_send: true }, ...extra });

describe("AFFIRM_START catches every reply that begins with a confirmation", () => {
  it("matches the strict server pattern and longer confirmations", () => {
    for (const t of ["да", "Да.", "ок", "окей", "изпрати", "Да, моля", "да, изпрати го веднага", "Да, прати го на Иван",
      "Давай!", "ОК, благодаря", "Потвърждавам.", "yes please", "Добре, изпрати го", "Разбира се", "„Да“", "да - прати"]) {
      expect(AFFIRM_START.test(t), t).toBe(true);
    }
    expect(AFFIRM.test("Да, моля")).toBe(false); // the server's anchored pattern misses it; the guard must not
  });

  it("does not match words that only start with the same letters or other requests", () => {
    for (const t of ["Дай ми справка", "Дали има нови клиенти?", "Окачи обявата", "Пратката пристигна ли?", "Изпратих го вчера",
      "Намери тристайни апартаменти", "Добрева се обади", "Покажи черновата"]) {
      expect(AFFIRM_START.test(t), t).toBe(false);
    }
  });
});

describe("affirmGuard", () => {
  const newestId = "a1";

  it("a bare yes under a sendable card goes to the native confirmation of that card", () => {
    const prior = [user("u1", "прати имейл"), card("a1")];
    expect(affirmGuard({ text: "да", prior, newestId, at: T + 1000 })).toEqual({ kind: "confirm", id: "a1" });
  });

  it("a longer confirmation or one with attachments is answered locally, never sent", () => {
    const prior = [user("u1", "прати имейл"), card("a1")];
    for (const text of ["Да, моля", "да, изпрати го веднага", "Да, прати го на Иван", "ок, благодаря"]) {
      expect(affirmGuard({ text, prior, newestId, at: T + 1000 })).toEqual({ kind: "block", text: AFFIRM_BLOCK_TEXT });
    }
    expect(affirmGuard({ text: "да", hasFiles: true, prior, newestId, at: T + 1000 })).toEqual({ kind: "block", text: AFFIRM_BLOCK_TEXT });
  });

  it("blocks after a send question without a card", () => {
    const prior = [user("u1", "x"), ted("a1", "Да го изпратя ли?")];
    expect(affirmGuard({ text: "да", prior, newestId: null })).toEqual({ kind: "block", text: AFFIRM_BLOCK_TEXT });
    expect(affirmGuard({ text: "Да, моля", prior, newestId: null })).toEqual({ kind: "block", text: AFFIRM_BLOCK_TEXT });
  });

  it("a blocked card is reported, not confirmed", () => {
    const prior = [user("u1", "x"), card("a1")];
    const g = affirmGuard({ text: "да", prior, newestId: "other" });
    expect(g.kind).toBe("block");
    expect(g.text).toMatch(/^Нищо не е изпратено\. Има по-нова чернова/);
  });

  it("outside a case and outside an e-mail context the reply goes to the server", () => {
    const prior = [user("u1", "x"), ted("a1", "Да добавя ли бележка към клиента?")];
    expect(affirmGuard({ text: "да", prior })).toBeNull();
    expect(affirmGuard({ text: "Да, моля", prior })).toBeNull();
    expect(affirmGuard({ text: "Намери имоти", prior: [user("u1", "x"), card("a1")], newestId })).toBeNull();
  });

  it("in a case chat any confirmation is stopped, whatever the local last message (server history is case memory)", () => {
    const prior = [user("u1", "x"), ted("a1", "Да добавя ли бележка към клиента?")];
    expect(affirmGuard({ text: "да", prior, inCase: true })).toEqual({ kind: "block", text: AFFIRM_CASE_TEXT });
    expect(affirmGuard({ text: "Да, добави я", prior, inCase: true })).toEqual({ kind: "block", text: AFFIRM_CASE_TEXT });
    expect(affirmGuard({ text: "ок", prior: [], inCase: true })).toEqual({ kind: "block", text: AFFIRM_CASE_TEXT });
    expect(affirmGuard({ text: "Добави бележката към клиента", prior, inCase: true })).toBeNull();
    // A sendable card in this case chat is still confirmed natively.
    expect(affirmGuard({ text: "да", prior: [user("u1", "x"), card("a1")], inCase: true, newestId, at: T + 1 })).toEqual({ kind: "confirm", id: "a1" });
  });

  it("checks the same last assistant message the server will see (errors and streaming skipped)", () => {
    const failed = ted("a2", "частичен отговор", { error: { text: "x", code: "http" } });
    const prior = [user("u1", "x"), ted("a1", "Да го изпратя ли?"), user("u2", "y"), failed];
    expect(lastAssistant(prior).id).toBe("a1");
    expect(serverHistory(prior).filter((m) => m.role === "assistant").slice(-1)[0].text).toBe("Да го изпратя ли?");
    expect(affirmGuard({ text: "да", prior })).toEqual({ kind: "block", text: AFFIRM_BLOCK_TEXT });
    expect(lastAssistant([user("u1", "x"), ted("a1", "", { streaming: true })])).toBeNull();
  });

  it("Real GPT: only a bare yes under a card is intercepted", () => {
    const prior = [user("u1", "x"), card("a1")];
    expect(affirmGuard({ text: "да", prior, newestId, at: T + 1, realgpt: true })).toEqual({ kind: "confirm", id: "a1" });
    expect(affirmGuard({ text: "Да, обясни", prior, newestId, realgpt: true })).toBeNull();
    expect(affirmGuard({ text: "да", prior: [user("u1", "x"), ted("a1", "Въпрос?")], inCase: true, realgpt: true })).toBeNull();
  });
});

describe("e-mail watermark", () => {
  it("an older card stays blocked after the newer card's chat is deleted", () => {
    const old = card("a1", T);
    const newer = card("a2", T + 5000);
    let mark = raiseMark(readMark(null), markFromReply({ ok: true, email: newer.email, actions: [] }, newer.time));
    // Chat with the newer card deleted: only the old card is left locally.
    const id = newestEmailId([{ messages: [old] }]);
    expect(id).toBe("a1");
    expect(emailBlock(old, id, T + 6000, mark)).toMatch(/Има по-нова чернова/);
    expect(emailBlock(newer, "a2", T + 6000, mark)).toBeNull();
    // A card-less reply that ran email.preview raises it too.
    mark = raiseMark(mark, markFromReply({ ok: true, email: null, actions: [{ tool: "email.preview", ok: true }] }, T + 9000));
    expect(emailBlock(newer, "a2", T + 9500, mark)).toMatch(/Има по-нова чернова/);
  });

  it("a failed reply with an unknown outcome and a server-side send block older cards", () => {
    const c = card("a1", T);
    expect(emailBlock(c, "a1", T + 1, raiseMark(null, markFromReply({ ok: false, code: "quota", maybeExecuted: true }, T + 10)))).toMatch(/без ясен резултат/);
    expect(markFromReply({ ok: false, code: "invalid", maybeExecuted: false }, T)).toEqual({});
    expect(emailBlock(c, "a1", T + 1, raiseMark(null, markFromReply({ ok: true, actions: [{ tool: "email.send", ok: true }] }, T + 10)))).toMatch(/вече изпрати/);
    expect(markFromReply({ ok: true, actions: [{ tool: "email.send", ok: false }] }, T)).toEqual({});
  });

  it("raiseMark only moves forward and readMark sanitises", () => {
    expect(raiseMark({ previewAt: 50 }, { previewAt: 10, sentAt: 7 })).toEqual({ previewAt: 50, sentAt: 7, unsureAt: 0 });
    expect(readMark({ previewAt: "x", sentAt: -1, unsureAt: 3 })).toEqual({ previewAt: 0, sentAt: 0, unsureAt: 3 });
  });
});

describe("interrupted requests", () => {
  it("a saved pending question becomes an interrupted answer with the may-have-run warning and a retry", () => {
    const [c] = cleanChats([{ id: "c1", title: "Чат", messages: [user("u1", "запиши оглед", { pending: true })] }]);
    expect(c.messages).toHaveLength(2);
    expect(c.messages[0]).toEqual(user("u1", "запиши оглед"));
    expect(c.messages[1]).toMatchObject({
      role: "assistant", engine: "server", retry: "u1", interrupted: true,
      error: { text: INTERRUPTED_TEXT, code: "interrupted", maybeExecuted: true },
    });
    expect(INTERRUPTED_TEXT).toBe("Прекъснато при затваряне – възможно е действия да са изпълнени.");
    expect(newestInterrupted([c])).toBe(T);
    // Not part of the history sent to the server.
    expect(serverHistory(c.messages)).toEqual([{ role: "user", text: "запиши оглед" }]);
  });

  it("answered questions and streaming leftovers are handled as before", () => {
    const [c] = cleanChats([{ id: "c1", messages: [user("u1", "x"), ted("a1", "ok"), ted("a2", "ча", { streaming: true })] }]);
    expect(c.messages.map((m) => m.id)).toEqual(["u1", "a1", "a2"]);
    expect(c.messages[2]).toMatchObject({ streaming: false, stopped: true });
    expect(newestInterrupted([c])).toBe(0);
  });
});
