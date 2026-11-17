// Pure conversation logic of the renderer (src/lib/chat.js): the typed-confirmation guard, the e-mail
// watermark and the "interrupted" answers. No DOM, no network.
import { describe, it, expect } from "vitest";
import {
  AFFIRM_BLOCK_TEXT, AFFIRM_CASE_TEXT, affirmGuard, answerChanged, cleanChats, unfinished, emailBlock, lastAssistant, markFromReply, newestEmailId,
  newestInterrupted, raiseMark, readMark, rgHistory, safeFileName, serverHistory,
} from "../../src/lib/chat.js";
import { AFFIRM, AFFIRM_START, DEF_SETTINGS, EFFORTS, HINTS, INTERRUPTED_TEXT, MODES, RG_NEW_ACCOUNT_CODES, effortName, modeOf } from "../../src/lib/consts.js";
import { LIMITS, chipOf, composeText, engineProblem, libItem } from "../../src/lib/files.js";

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

// 0.1.3 shell (docs/CONTRACT.md §8.2, §15): Чат | Работа, effort names, hints, attachments per engine, regenerate/edit checks.
describe("0.1.3 layout constants", () => {
  it("Чат | Работа with the ChatGPT greetings and placeholders", () => {
    expect(MODES.map((m) => [m.id, m.name])).toEqual([["chat", "Чат"], ["work", "Работа"]]);
    expect(modeOf("work").hello).toBe("Върху какво ще работим?");
    expect(modeOf("chat").ph).toBe("Попитайте каквото и да е");
    expect(modeOf("work").ph).toBe("Направете каквото и да е");
    expect(modeOf("x").id).toBe("chat");
  });
  it("effort: Стандартно sends nothing, Мигновено = none, values accepted by MAIN", () => {
    expect(EFFORTS.map((e) => e.id)).toEqual(["none", "low", "medium", "high", "xhigh"]);
    expect(effortName("")).toBe("Стандартно");
    expect(effortName("none")).toBe("Мигновено");
    expect(effortName("xhigh")).toBe("Много високо");
  });
  it("hints of the „+“ menu are the contract words, each with a visible server prefix", () => {
    expect(HINTS.map((h) => h.id)).toEqual(["image", "thinking", "research", "search"]);
    for (const h of HINTS) expect(h.prefix).toMatch(/: $/);
  });
  it("new settings keys have safe defaults; the consent is never a setting", () => {
    expect(DEF_SETTINGS).toMatchObject({ mode: "chat", nick: "", instructions: "", browse: { enabled: true, robots: true, blocked: [] }, notify: { scheduled: true, updates: true }, theme: "ted", accent: "ted" });
    expect(Object.keys(DEF_SETTINGS).some((k) => /consent|updates/i.test(k))).toBe(false);
  });
});

describe("attachments per engine", () => {
  const img = { id: "f1", kind: "image", name: "a.jpg", mime: "image/jpeg", data: "QUJD", size: 3 };
  const pdf = { id: "f2", kind: "pdf", name: "b.pdf", mime: "application/pdf", data: "QUJD", size: 3 };
  const doc = { id: "f3", kind: "doc", name: "c.docx", mime: "x", data: "QUJD", size: 3, text: "Текст от Word" };
  const docNo = { ...doc, id: "f4", text: null };
  const other = { id: "f5", kind: "other", name: "d.zip", mime: "application/zip", data: "QUJD", size: 3 };
  const lib = libItem({ id: "lib-1", name: "e.pdf", kind: "pdf", size: 9 });
  it("Тед (сървър): images/PDF as files, Word as local text; other files and library ids are refused with a reason", () => {
    expect(engineProblem("server", [img, pdf, doc], false)).toBeNull();
    expect(engineProblem("server", [other], false)).toMatch(/„d.zip“ не може да се изпрати към Тед \(сървър\)/);
    expect(engineProblem("server", [docNo], false)).toMatch(/c.docx/);
    expect(engineProblem("server", [lib], false)).toMatch(/e.pdf/);
    expect(engineProblem("server", [img, img, img, pdf], false)).toMatch(/до 3/);
  });
  it("Real GPT: without the tools only images and text; with them any file up to 10", () => {
    expect(engineProblem("realgpt", [img, doc], false)).toBeNull();
    expect(engineProblem("realgpt", [pdf], false)).toMatch(/Настройки → Безопасност/);
    expect(engineProblem("realgpt", [pdf, other, lib], true)).toBeNull();
    expect(engineProblem("realgpt", Array.from({ length: LIMITS.rgFiles + 1 }, (_, i) => ({ ...other, id: "o" + i })), true)).toMatch(/10 файла/);
  });
  it("Word text is inlined for the server (8000 limit) and left out when Real GPT reads the file itself", () => {
    expect(composeText("Обобщи", [doc], LIMITS.serverText).text).toBe("Обобщи\n\n[Прикачен файл „c.docx“ – съдържание:]\nТекст от Word");
    expect(composeText("Обобщи", [doc], 0, false).text).toBe("Обобщи");
    const long = composeText("x", [{ ...doc, text: "а".repeat(9000) }], LIMITS.serverText);
    expect(long.cut).toBe(true);
    expect(long.text.length).toBeLessThanOrEqual(LIMITS.serverText);
  });
  it("history chips keep the store id, never the bytes", () => {
    expect(chipOf({ ...lib, data: "QUJD" })).toEqual({ id: lib.id, name: "e.pdf", size: 9, kind: "lib", fileId: "lib-1" });
    expect(chipOf(img)).not.toHaveProperty("data");
  });
});

describe("Real GPT history and answer changes", () => {
  it("earlier Real GPT questions keep their file ids (≤ 10), server answers stay out", () => {
    const prior = [
      user("u1", "преведи", { files: [{ id: "c1", name: "a.pdf", kind: "pdf", fileId: "file-1" }, { id: "c2", name: "b", kind: "ref" }] }),
      { id: "a1", role: "assistant", engine: "realgpt", text: "Готово", time: T },
      user("u2", "справка"), ted("a2", "CRM данни"),
    ];
    expect(rgHistory(prior)).toEqual([{ role: "user", text: "преведи", files: ["file-1"] }, { role: "assistant", text: "Готово" }]);
  });
  it("regenerate/edit ask first only after a real CRM change", () => {
    expect(answerChanged(ted("a", "x", { actions: [{ ok: true, mutating: false }] }))).toBe(false);
    expect(answerChanged(ted("a", "x", { actions: [{ ok: true, mutating: true }] }))).toBe(true);
    expect(answerChanged(ted("a", "x", { actions: [{ ok: false, mutating: true }] }))).toBe(false);
    expect(answerChanged({ id: "a", role: "assistant", engine: "realgpt", agent: { steps: [{ id: "s", status: "ok", mutating: true }] } })).toBe(true);
    expect(answerChanged({ id: "a", role: "assistant", engine: "realgpt", agent: { steps: [{ id: "s", status: "denied", mutating: true }, { id: "t", status: "ok" }] } })).toBe(false);
    expect(answerChanged(user("u", "x"))).toBe(false);
  });
});

describe("an agent answer cut by a restart", () => {
  it("with Ted's tools it is reported as interrupted (actions may have run); without them as stopped", () => {
    const run = { id: "a1", role: "assistant", engine: "realgpt", text: "част", streaming: true, retry: "u1", time: T, agentOn: true };
    const [c] = cleanChats([{ id: "c1", messages: [user("u1", "запиши"), run] }]);
    expect(c.messages[1]).toMatchObject({ streaming: false, interrupted: true, retry: "u1", error: { text: INTERRUPTED_TEXT, code: "interrupted", maybeExecuted: true } });
    expect(answerChanged(c.messages[1])).toBe(false);
    expect(unfinished({ ...run, agentOn: undefined })).toMatchObject({ streaming: false, stopped: true });
    expect(newestInterrupted([c])).toBe(T);
  });
});
