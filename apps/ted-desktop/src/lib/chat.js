// Pure conversation logic: what is sent, how real results are summarised, when an e-mail card is live.
import { DRAFT_TTL_MS } from "./consts.js";

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

export const lastAssistant = (messages) => [...messages].reverse().find((m) => m.role === "assistant" && !m.local && (m.email || String(m.text || "").trim())) || null;

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

// null when the card may be sent, otherwise the Bulgarian reason why its button is off.
export function emailBlock(m, newestId, at = Date.now()) {
  if (m.emailState === "sent") return "Имейлът вече е изпратен.";
  if (m.emailState === "unknown") return "Не е ясно дали имейлът е изпратен. Проверете изпратените си писма, преди да опитате отново с нова чернова.";
  if (!m.email || !m.email.can_send) return "Няма настроена поща за изпращане.";
  if (m.id !== newestId) return "Има по-нова чернова. Изпраща се само последната подготвена.";
  if (at - m.time > DRAFT_TTL_MS) return "Черновата е по-стара от 6 часа и вече не се пази на сървъра. Помолете Тед да я подготви отново.";
  return null;
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

export const safeFileName = (title, ext) => (String(title || "чат").replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").trim().slice(0, 80) || "чат") + "." + ext;

// Normalised chats from the store: drops anything half-written by an older run.
export function cleanChats(list) {
  return (Array.isArray(list) ? list : []).filter((c) => c && typeof c.id === "string" && Array.isArray(c.messages)).map((c) => ({
    ...c,
    title: String(c.title || "Чат"),
    updatedAt: Number(c.updatedAt) || 0,
    messages: c.messages.filter((m) => m && typeof m.id === "string" && (m.role === "user" || m.role === "assistant")).map((m) => (
      m.streaming ? { ...m, streaming: false, stopped: true } : m
    )),
  }));
}
