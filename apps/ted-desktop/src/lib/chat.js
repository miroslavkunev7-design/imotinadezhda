// Pure conversation logic: what is sent, how real results are summarised, when an e-mail card is live.
import { AFFIRM, AFFIRM_START, ASKS_TO_SEND, DRAFT_TTL_MS, INTERRUPTED_TEXT } from "./consts.js";

const cap = (t, n) => String(t || "").slice(0, n);

// Text of an earlier message as it goes into the history (attachments only by name).
export function histText(m) {
  if (m.role !== "user") return String(m.text || "");
  return m.hist || m.text || "";
}

// Earlier turns for the server engine: only real exchanged messages, the first one from the employee.
export function serverHistory(prior, max = 14) {
  const out = prior
    .filter((m) => !m.local && !m.error && !m.streaming && String(histText(m)).trim())
    .slice(-max)
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: cap(histText(m), 8000) }));
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

// Earlier turns for Real GPT: only exchanges answered by Real GPT itself. Answers of Ted's server can
// hold CRM data, which must not be forwarded to OpenAI just because the engine was switched mid-chat.
export function rgHistory(prior, max = 20) {
  const out = [];
  for (let i = 0; i < prior.length; i++) {
    const m = prior[i];
    if (m.local || m.error || m.streaming || !String(histText(m)).trim()) continue;
    if (m.role === "assistant") { if (m.engine === "realgpt") out.push({ role: "assistant", text: histText(m) }); continue; }
    const next = prior.slice(i + 1).find((x) => x.role === "assistant" && !x.local);
    if (next && next.engine === "realgpt" && !next.error) out.push({ role: "user", text: histText(m) });
  }
  return out.slice(-max);
}

// The assistant message the server will see as the previous one: the same filter as serverHistory().
export const lastAssistant = (messages) =>
  [...messages].reverse().find((m) => m.role === "assistant" && !m.local && !m.error && !m.streaming && String(histText(m)).trim()) || null;

// Header of the actions card, from the real per-step results the server returned.
export function actionsSummary(actions) {
  const ok = actions.filter((a) => a.ok).length;
  const status = ok === actions.length ? "succeeded" : ok === 0 ? "failed" : "partially_succeeded";
  const label = { succeeded: "Изпълнено", partially_succeeded: "Частично изпълнено", failed: "Неуспешно" }[status];
  return { status, label, changed: actions.some((a) => a.ok && a.mutating) };
}

// The newest e-mail preview over all local chats: only that one can be the server's current draft.
export function newestEmailId(chats) {
  let best = null;
  for (const c of chats) for (const m of c.messages) if (m.email && (!best || m.time > best.time)) best = m;
  return best ? best.id : null;
}

// Per-profile e-mail watermark (kept in settings, so deleted or temporary chats cannot bring an old card back):
// previewAt = newest reply that prepared a draft, sentAt = newest send, unsureAt = newest server request that
// ended without a clear result (it may have prepared a draft that no card shows).
export const EMPTY_MARK = { previewAt: 0, sentAt: 0, unsureAt: 0 };
export function readMark(v) {
  const o = v && typeof v === "object" ? v : {};
  const n = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : 0);
  return { previewAt: n(o.previewAt), sentAt: n(o.sentAt), unsureAt: n(o.unsureAt) };
}
// Watermark fields raised by one server reply (ok or failed) that arrived at `at`.
export function markFromReply(r, at) {
  if (!r || !r.ok) return r && r.maybeExecuted ? { unsureAt: at } : {};
  const acts = Array.isArray(r.actions) ? r.actions : [];
  const out = {};
  if (r.email || acts.some((a) => a && a.ok && a.tool === "email.preview")) out.previewAt = at;
  if (acts.some((a) => a && a.ok && a.tool === "email.send")) out.sentAt = at;
  return out;
}
export const raiseMark = (mark, fields) => {
  const m = readMark(mark);
  for (const k of Object.keys(EMPTY_MARK)) if (fields && Number(fields[k]) > m[k]) m[k] = Number(fields[k]);
  return m;
};

// null when the card may be sent, otherwise the Bulgarian reason why its button is off.
export function emailBlock(m, newestId, at = Date.now(), mark = EMPTY_MARK) {
  const w = readMark(mark);
  if (m.emailState === "sent") return "Имейлът вече е изпратен.";
  if (m.emailState === "unknown") return "Не е ясно дали имейлът е изпратен. Проверете изпратените си писма, преди да опитате отново с нова чернова.";
  if (!m.email || !m.email.can_send) return "Няма настроена поща за изпращане.";
  if (m.id !== newestId || m.time < w.previewAt) return "Има по-нова чернова. Изпраща се само последната подготвена.";
  if (m.time < w.sentAt) return "След тази чернова Тед вече изпрати имейл. Помолете Тед да подготви писмото отново.";
  if (m.time < w.unsureAt) return "След тази чернова заявка към Тед завърши без ясен резултат и може да е подготвила друга чернова. Помолете Тед да покаже черновата отново.";
  if (at - m.time > DRAFT_TTL_MS) return "Черновата е по-стара от 6 часа и вече не се пази на сървъра. Помолете Тед да я подготви отново.";
  return null;
}

// A typed reply that the server could take as "send the e-mail" never goes to the server.
// The server sends the latest draft on a bare "да" after a question „…изпратя ли?“ (fast path), and its model may
// call email.send on any other confirmation. In a case chat the server rebuilds the history from case memory
// (every chat, device and user of that case), so the local last message proves nothing there.
// -> null (send normally) | {kind:"confirm", id} (native confirmation of that card) | {kind:"block", text}.
export const AFFIRM_BLOCK_TEXT = "Това съобщение не е изпратено към Тед: отговор, който започва с потвърждение („да“, „ок“, „изпрати“…), " +
  "сървърът може да приеме като „изпрати имейла“ и да изпрати последната подготвена чернова без прозореца за потвърждение. " +
  "За да изпратите черновата, натиснете „✅ Да, изпрати“ под нея (ако я няма, помолете Тед да покаже черновата). " +
  "За промени напишете какво да се промени, без „да“ в началото (напр. „Смени темата на …“).";
export const AFFIRM_CASE_TEXT = "Това съобщение не е изпратено към Тед: в казус Тед вижда разговорите по казуса от всички чатове, устройства и колеги, " +
  "затова кратко потвърждение („да“, „ок“, „изпрати“…) може да бъде прието като „изпрати имейла“ за чернова, подготвена другаде. " +
  "Напишете изцяло какво искате, без „да“ в началото (напр. „Добави бележката към клиента“). Имейл се изпраща само с бутона „✅ Да, изпрати“ под черновата.";
// realgpt: the message goes to Real GPT, which has no CRM and cannot send mail; only a bare "да" under an e-mail
// card is still taken as "send this card" (through the native confirmation).
export function affirmGuard({ text, hasFiles = false, prior = [], inCase = false, newestId = null, mark = EMPTY_MARK, at = Date.now(), realgpt = false }) {
  const t = String(text || "");
  const strict = AFFIRM.test(t);
  if (!strict && (realgpt || !AFFIRM_START.test(t))) return null;
  if (realgpt) {
    const a = lastAssistant(prior);
    if (!a || !a.email || hasFiles) return null;
  }
  const lastA = lastAssistant(prior);
  const emailCtx = !!lastA && (!!lastA.email || ASKS_TO_SEND.test(lastA.text || ""));
  if (!emailCtx && !inCase) return null;
  if (strict && !hasFiles && lastA && lastA.email) {
    const block = emailBlock(lastA, newestId, at, mark);
    return block ? { kind: "block", text: "Нищо не е изпратено. " + block } : { kind: "confirm", id: lastA.id };
  }
  return { kind: "block", text: emailCtx ? AFFIRM_BLOCK_TEXT : AFFIRM_CASE_TEXT };
}

// Follow-up message after ted.email.confirmSend, built ONLY from the returned result.
export function emailResult(r) {
  if (r && r.ok) {
    const x = r.result && typeof r.result === "object" ? r.result : {};
    if (x.sent) {
      const names = (Array.isArray(x.attachments) ? x.attachments : []).map((a) => (a && typeof a === "object" ? a.name : a)).filter(Boolean);
      return {
        state: "sent",
        text: "✔ Изпратено до " + (x.to_name ? x.to_name + " <" + x.to + ">" : x.to) + (x.from ? " от " + x.from : "") + (x.via ? " (" + x.via + ")" : "") + "." +
          (x.subject ? "\nТема: " + x.subject : "") + (names.length ? "\nПрикачени: " + names.join(", ") : ""),
      };
    }
    if (x.need_setup) {
      return { state: "setup", panel: "mail", text: (x.reason || "Няма настроена поща за изпращане.") + (x.mailto ? "\n[Изпрати от моята поща](" + x.mailto + ")" : "") };
    }
    return { state: "failed", text: "Имейлът не е изпратен: сървърът не потвърди изпращането." };
  }
  const error = String((r && r.error) || "грешка");
  if (r && r.maybeExecuted) return { state: "unknown", text: "⚠️ " + error };
  return { state: "failed", text: /^Имейлът не е изпратен/.test(error) ? error : "Имейлът не е изпратен: " + error };
}

export function recipientText(to) {
  if (to && typeof to === "object") return (to.name ? to.name + " " : "") + "<" + (to.email || "") + ">";
  return String(to || "");
}

export function chatMarkdown(chat) {
  const lines = ["# " + chat.title, ""];
  if (chat.caseTitle) lines.push("Казус: " + chat.caseTitle, "");
  for (const m of chat.messages) {
    if (m.role === "user") lines.push("**Вие:** " + (m.text || ""));
    else {
      lines.push("**Тед:** " + (m.text || (m.error ? "(грешка: " + m.error.text + ")" : m.stopped ? "(спряно)" : "")));
      if (m.actions && m.actions.length) lines.push("", "_Действия (статуси от сървъра):_ " + m.actions.map((a) => a.label + (a.ok ? " ✓" : " ✗")).join(", "));
    }
    lines.push("");
  }
  return lines.join("\n");
}

// Cut by code points, so an emoji at the limit is dropped whole instead of leaving a lone surrogate in the file name.
export const safeFileName = (title, ext) => (Array.from(String(title || "чат").replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").trim()).slice(0, 80).join("") || "чат") + "." + ext;

// A server request still marked `pending` when the chats were saved had no recorded answer: the program was
// closed, the session ended or the profile signed out meanwhile. It becomes an "interrupted" answer.
export function interruptedFor(userMsg) {
  return {
    id: "m_int_" + userMsg.id, role: "assistant", engine: "server", text: "", time: Number(userMsg.time) || 0, retry: userMsg.id,
    interrupted: true, error: { text: INTERRUPTED_TEXT, code: "interrupted", maybeExecuted: true },
  };
}

// Normalised chats from the store: drops anything half-written by an older run.
export function cleanChats(list) {
  return (Array.isArray(list) ? list : []).filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages)).map((c) => {
    const messages = [];
    for (const m of c.messages) {
      if (!m || typeof m.id !== "string" || (m.role !== "user" && m.role !== "assistant")) continue;
      if (m.role === "user" && m.pending) {
        const { pending, ...rest } = m; // eslint-disable-line no-unused-vars
        messages.push(rest, interruptedFor(rest));
      } else messages.push(m.streaming ? { ...m, streaming: false, stopped: true } : m);
    }
    return { ...c, title: String(c.title || "Чат"), updatedAt: Number(c.updatedAt) || 0, messages };
  });
}

// Newest time of an interrupted answer (0 if none): such a request may have prepared an e-mail draft.
export const newestInterrupted = (chats) => chats.reduce((t, c) => c.messages.reduce((u, m) => (m.interrupted && m.time > u ? m.time : u), t), 0);
