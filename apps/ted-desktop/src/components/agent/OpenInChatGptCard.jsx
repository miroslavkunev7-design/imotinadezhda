import React, { useState } from "react";
import Icon from "../Icon.jsx";
import { ted } from "../../bridge.js";

// open_in_chatgpt (docs/CONTRACT.md §9.6): pictures, video (Sora) and other work that OpenAI does not give to external
// programs are made in the employee's own ChatGPT. The card shows the exact prompt (editable, copyable).
// 0.1.7 (§23): the main button opens the ChatGPT panel INSIDE Ted at https://chatgpt.com/?q=<prompt> (MAIN builds the
// address; only on the click); „Отвори в браузъра“ keeps the 0.1.5 way (ted.realgpt.openInChatGpt). The prompt is only
// filled in – the employee sends it in ChatGPT himself. The same card appears when Ted's server could not make a
// picture (from:"server") or Real GPT gave no card for a picture request (from:"local"): „Направи снимката в ChatGPT“.
export const PROMPT_MAX = 4000;
// The link (https://chatgpt.com/?q=…) may be at most 8000 characters: a Cyrillic letter takes 6 of them, so about
// 1 300 Bulgarian letters fit (= electron/agent/chatgpt-link.js CHATGPT_URL_MAX, review F5).
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
const MAKE = "Направи снимката в ChatGPT";

export default function OpenInChatGptCard({ handoff, onToast, onPanel }) {
  const h = handoff && typeof handoff === "object" ? handoff : {};
  const kind = KIND[h.kind] ? h.kind : "other";
  const from = h.from === "server" || h.from === "local" ? h.from : null; // a failed server picture / no GPT card
  const [text, setText] = useState(String(h.prompt || "").slice(0, PROMPT_MAX));
  const [busy, setBusy] = useState(false);
  const toast = (t) => { if (typeof onToast === "function") onToast(t); };
  const empty = !text.trim();
  const len = linkLength(text);
  const fits = len <= URL_MAX;
  const used = Math.min(100, Math.round((len / URL_MAX) * 100));
  const title = from ? MAKE : KIND[kind].title;

  async function panel(args) {
    if (typeof onPanel === "function") return onPanel(args);
    try { return await ted.chatgpt.open(args); } catch { return { ok: false, error: "ChatGPT не можа да се отвори." }; }
  }
  // The main button: the ChatGPT panel in Ted with the prompt filled in (too long for a link: copied, panel without it).
  async function open() {
    if (empty || busy) return;
    setBusy(true);
    let r;
    if (fits) {
      r = await panel({ prompt: text });
      setBusy(false);
      toast(r && r.ok ? "ChatGPT е отворен в панела – заявката е попълнена там; изпратете я, когато сте готови." : (r && r.error) || "ChatGPT не можа да се отвори.");
      return;
    }
    let c; try { c = await ted.app.copy(text); } catch { c = null; }
    if (!c || !c.ok) { setBusy(false); toast("Не успях да копирам заявката."); return; }
    r = await panel({ bare: true });
    setBusy(false);
    toast(r && r.ok ? "Заявката е копирана и ChatGPT е отворен в панела – поставете я там с Ctrl+V." : "Заявката е копирана, но ChatGPT не можа да се отвори.");
  }
  // „Отвори в браузъра“ – the 0.1.5 way, kept as a secondary link.
  async function browser() {
    if (empty || busy) return;
    setBusy(true);
    let r;
    if (fits) {
      try { r = await ted.realgpt.openInChatGpt({ prompt: text }); } catch { r = { ok: false, error: "ChatGPT не можа да се отвори." }; }
      setBusy(false);
      toast(r && r.ok ? "Отворих ChatGPT в браузъра – заявката е в полето за писане там." : (r && r.error) || "ChatGPT не можа да се отвори.");
      return;
    }
    let c; try { c = await ted.app.copy(text); } catch { c = null; }
    if (!c || !c.ok) { setBusy(false); toast("Не успях да копирам заявката."); return; }
    try { r = await ted.realgpt.openInChatGpt({ bare: true }); } catch { r = null; }
    setBusy(false);
    toast(r && r.ok ? "Заявката е копирана и ChatGPT е отворен в браузъра – поставете я там с Ctrl+V." : "Заявката е копирана, но ChatGPT не можа да се отвори.");
  }
  async function copy() {
    if (empty) return;
    let r;
    try { r = await ted.app.copy(text); } catch { r = null; }
    toast(r && r.ok ? "Заявката е копирана." : "Не успях да копирам.");
  }

  const intro = from === "server"
    ? "Сървърът на Тед не можа да направи снимката (изчерпан безплатен лимит, няма кредити или друга грешка). Направете я с вашия ChatGPT план – в панела ChatGPT тук, в Тед."
    : from === "local"
      ? "Тук ChatGPT не рисува – снимката се прави в ChatGPT с вашия план, в панела ChatGPT тук, в Тед. Заявката е вашият въпрос – прегледайте я."
      : kind === "image" || kind === "video"
        ? "Създаването на снимки и видео с вашия ChatGPT план става в ChatGPT – в панела ChatGPT тук, в Тед. ChatGPT подготви заявката – прегледайте я и я отворете."
        : "Това се прави в ChatGPT с вашия план – в панела ChatGPT тук, в Тед. ChatGPT подготви заявката – прегледайте я и я отворете.";
  return (
    <div className="card cg-card" data-testid="chatgpt-card" data-kind={kind} data-from={from || "agent"} role="group" aria-label={title}>
      <h4><Icon n={KIND[kind].icon} />{title}</h4>
      <p className="p0">{intro}</p>
      <label className="cg-l" htmlFor={"cg-" + (h.id || "x")}>Заявка за ChatGPT</label>
      <textarea id={"cg-" + (h.id || "x")} className="cg-ta" data-testid="chatgpt-prompt" value={text} maxLength={PROMPT_MAX} rows={4}
        onChange={(e) => setText(e.target.value)} />
      <div className={"cg-meta" + (fits ? "" : " over")} data-testid="chatgpt-len">
        <small>{fits ? `${text.length} знака · линкът е ${used}% от допустимото` : "Твърде дълга за линк (кирилицата заема повече място) – ще я копирам, а вие я поставете в ChatGPT."}</small>
      </div>
      <div className="acts">
        <button className="b wine" onClick={open} disabled={empty || busy} data-testid="chatgpt-open"><Icon n={kind === "image" ? "image" : "external"} />{fits ? (from ? MAKE : "Отвори в ChatGPT") : "Копирай и отвори ChatGPT"}</button>
        <button className="b" onClick={copy} disabled={empty} data-testid="chatgpt-copy"><Icon n="copy" />Копирай заявката</button>
        <button className="lnk cg-br" onClick={browser} disabled={empty || busy} data-testid="chatgpt-open-browser" title="Отваря chatgpt.com във вашия браузър (както досега)">Отвори в браузъра</button>
      </div>
      <div className="note">Отваря chatgpt.com в панела ChatGPT в Тед с тази заявка – само когато натиснете бутона. Заявката само се попълва: изпращате я вие в ChatGPT. Готовата снимка: десен бутон → „Копирай изображението“, после „📋 Добави снимката в чата“.</div>
    </div>
  );
}
