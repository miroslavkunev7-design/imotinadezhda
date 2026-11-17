import React, { useState } from "react";
import Icon from "../Icon.jsx";
import { ted } from "../../bridge.js";

// open_in_chatgpt (docs/CONTRACT.md §9.6): pictures, video (Sora) and other work that OpenAI does not give to external
// programs are made in the employee's own ChatGPT app. The card shows the exact prompt (editable, copyable); the link
// opens ONLY on the click of „Отвори в ChatGPT“ – MAIN builds it (https://chatgpt.com/?q=…), the page never does.
export const PROMPT_MAX = 4000;
// The link Windows receives (https://chatgpt.com/?q=…) may be at most 8000 characters: a Cyrillic letter takes 6 of
// them, so about 1 300 Bulgarian letters fit (= electron/agent/chatgpt-link.js CHATGPT_URL_MAX, review F5).
export const URL_MAX = 8000;
const PREFIX_LEN = "https://chatgpt.com/?q=".length;
export function linkLength(text) {
  try { return PREFIX_LEN + encodeURIComponent(String(text || "").replace(/\r\n?/g, "\n").trim()).length; } catch { return Infinity; }
}
const KIND = {
  image: { icon: "image", title: "Снимка с вашия ChatGPT план" },
  video: { icon: "film", title: "Видео с вашия ChatGPT план" },
  research: { icon: "telescope", title: "Проучване в ChatGPT" },
  other: { icon: "external", title: "Заявка за ChatGPT" },
};

export default function OpenInChatGptCard({ handoff, onToast }) {
  const h = handoff && typeof handoff === "object" ? handoff : {};
  const kind = KIND[h.kind] ? h.kind : "other";
  const [text, setText] = useState(String(h.prompt || "").slice(0, PROMPT_MAX));
  const [busy, setBusy] = useState(false);
  const toast = (t) => { if (typeof onToast === "function") onToast(t); };
  const empty = !text.trim();
  const len = linkLength(text);
  const fits = len <= URL_MAX;
  const used = Math.min(100, Math.round((len / URL_MAX) * 100));

  async function open() {
    if (empty || busy) return;
    setBusy(true);
    let r;
    if (fits) {
      try { r = await ted.realgpt.openInChatGpt({ prompt: text }); } catch { r = { ok: false, error: "ChatGPT не можа да се отвори." }; }
      setBusy(false);
      toast(r && r.ok ? "Отворих ChatGPT в браузъра – заявката е в полето за писане там." : (r && r.error) || "ChatGPT не можа да се отвори.");
      return;
    }
    // Too long for a link: the prompt is copied and chatgpt.com opens without it – the employee pastes it there.
    let c; try { c = await ted.app.copy(text); } catch { c = null; }
    if (!c || !c.ok) { setBusy(false); toast("Не успях да копирам заявката."); return; }
    try { r = await ted.realgpt.openInChatGpt({ bare: true }); } catch { r = null; }
    setBusy(false);
    toast(r && r.ok ? "Заявката е копирана и ChatGPT е отворен – поставете я там с Ctrl+V." : "Заявката е копирана, но ChatGPT не можа да се отвори.");
  }
  async function copy() {
    if (empty) return;
    let r;
    try { r = await ted.app.copy(text); } catch { r = null; }
    toast(r && r.ok ? "Заявката е копирана." : "Не успях да копирам.");
  }

  return (
    <div className="card cg-card" data-testid="chatgpt-card" data-kind={kind} role="group" aria-label={KIND[kind].title}>
      <h4><Icon n={KIND[kind].icon} />{KIND[kind].title}</h4>
      <p className="p0">{kind === "image" || kind === "video"
        ? "Създаването на снимки и видео с вашия ChatGPT план става в приложението ChatGPT. ChatGPT подготви заявката – прегледайте я и я отворете там."
        : "Това се прави в приложението ChatGPT с вашия план. ChatGPT подготви заявката – прегледайте я и я отворете там."}</p>
      <label className="cg-l" htmlFor={"cg-" + (h.id || "x")}>Заявка за ChatGPT</label>
      <textarea id={"cg-" + (h.id || "x")} className="cg-ta" data-testid="chatgpt-prompt" value={text} maxLength={PROMPT_MAX} rows={4}
        onChange={(e) => setText(e.target.value)} />
      <div className={"cg-meta" + (fits ? "" : " over")} data-testid="chatgpt-len">
        <small>{fits ? `${text.length} знака · линкът е ${used}% от допустимото` : "Твърде дълга за линк (кирилицата заема повече място) – ще я копирам, а вие я поставете в ChatGPT."}</small>
      </div>
      <div className="acts">
        <button className="b wine" onClick={open} disabled={empty || busy} data-testid="chatgpt-open"><Icon n="external" />{fits ? "Отвори в ChatGPT" : "Копирай и отвори ChatGPT"}</button>
        <button className="b" onClick={copy} disabled={empty} data-testid="chatgpt-copy"><Icon n="copy" />Копирай заявката</button>
      </div>
      <div className="note">Отваря chatgpt.com във вашия браузър с тази заявка – само когато натиснете бутона. Нищо не е създадено, докато не я изпратите там; снимката или видеото остават във вашия ChatGPT.</div>
    </div>
  );
}
