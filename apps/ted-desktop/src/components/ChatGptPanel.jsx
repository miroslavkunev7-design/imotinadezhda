import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { ted } from "../bridge.js";
import { PANEL_NARROW, boundsOf, coveredBy, sameBounds } from "../lib/panel.js";

// „ChatGPT панел“ (0.1.7, docs/CONTRACT.md §23): a side panel like Canvas. The page itself is MAIN's native view
// (chatgpt.com in its own partition); this component draws the header in our styling and a placeholder whose rectangle
// it reports to MAIN on every layout change – with visible:false while a menu, dialog, Settings, the picture preview,
// the quick window, the voice mode or the phone drawer overlaps it (a native view always lies above the page).
// Ted never reads the page: a finished picture is copied by the employee and „📋 Добави снимката в чата“ takes it from
// the clipboard (MAIN, only on that click) into the composer, exactly like an attached file.
// Props: phone (the narrow layout ≤ 899 px: the panel takes the whole content area, with „Назад“), st = the state MAIN pushes
// ({open, visible, loading, host, error, blocked}), onClose, onAddImage, adding, onRect(bounds|null), toast, notice (the
// phone layout: the current toast is shown in the panel's own status line – the page would cover a floating one).
export const HIDDEN = { x: 0, y: 0, width: 0, height: 0, visible: false };

// The panel's narrow layout (≤ 899 px, the breakpoint of its CSS – as Canvas): it then covers the whole content area.
export function usePanelNarrow() {
  const [m, setM] = useState(() => { try { return window.matchMedia(PANEL_NARROW).matches; } catch { return false; } });
  useEffect(() => {
    let mq; try { mq = window.matchMedia(PANEL_NARROW); } catch { return undefined; }
    const f = () => setM(mq.matches); f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return m;
}

export default function ChatGptPanel({ phone, st, onClose, onAddImage, adding, onRect, toast, notice }) {
  const hostRef = useRef(null);
  const rectCb = useRef(onRect); rectCb.current = onRect;

  // The placeholder's rectangle -> MAIN, only when it changed: on resize (window, layout, the placeholder itself), on any
  // change of the document (a menu or dialog appears), and every 0,5 s as a safety net.
  useEffect(() => {
    let last = null;
    let raf = 0;
    let off = false;
    const send = () => {
      raf = 0;
      const el = hostRef.current;
      if (off || !el) return;
      const b = boundsOf(el, coveredBy(document, el.getBoundingClientRect()));
      if (sameBounds(b, last)) return;
      last = b;
      if (typeof rectCb.current === "function") rectCb.current(b);
      Promise.resolve(ted.chatgpt.setBounds(b)).catch(() => {});
    };
    const soon = () => { if (!raf && !off) raf = requestAnimationFrame(send); };
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(soon) : null;
    if (ro) { ro.observe(hostRef.current); ro.observe(document.documentElement); }
    const mo = new MutationObserver(soon);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    window.addEventListener("resize", soon);
    const t = setInterval(soon, 500);
    soon();
    return () => {
      off = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", soon);
      clearInterval(t);
      if (typeof rectCb.current === "function") rectCb.current(null);
      Promise.resolve(ted.chatgpt.setBounds(HIDDEN)).catch(() => {});
    };
  }, []);

  const s = st && typeof st === "object" ? st : {};
  const host = typeof s.host === "string" && s.host && s.host !== "chatgpt.com" && !s.host.endsWith(".chatgpt.com") ? s.host : null;
  const say = (t) => { if (typeof toast === "function") toast(t); };
  async function reload() {
    let r; try { r = await ted.chatgpt.reload(); } catch { r = null; }
    if (!r || !r.ok) say((r && r.error) || "ChatGPT не можа да се зареди отново.");
  }
  async function browser() {
    let r; try { r = await ted.chatgpt.openInBrowser(); } catch { r = null; }
    say(r && r.ok ? "Отворих ChatGPT във вашия браузър." : (r && r.error) || "Браузърът не можа да се отвори.");
  }
  const blocked = s.blocked && typeof s.blocked === "object" && s.blocked.host ? s.blocked : null;
  // The note's „Отвори в браузъра“: the address MAIN refused (it keeps it) – only now, on this click.
  async function openBlocked() {
    let r; try { r = await ted.chatgpt.openInBrowser({ blocked: true }); } catch { r = null; }
    say(r && r.ok ? "Отворих връзката във вашия браузър." : (r && r.error) || "Браузърът не можа да се отвори.");
  }

  return (
    <section className={"cgp" + (phone ? " ph" : "")} aria-label="ChatGPT" data-testid="chatgpt-panel">
      <div className="cgp-h">
        {phone ? <button className="b cgp-back" data-testid="chatgpt-back" onClick={onClose}><Icon n="chevL" />Назад</button> : null}
        <span className="cgp-ttl"><b>ChatGPT</b><small>вашият ChatGPT план</small></span>
        <button className="b wine cgp-add" data-testid="chatgpt-add" onClick={onAddImage} disabled={!!adding}
          title="Добавя към съобщението в Тед снимката, която сте копирали в ChatGPT (десен бутон → „Копирай изображението“)">
          <span aria-hidden="true">📋</span><span className="cgp-long">Добави снимката в чата</span><span className="cgp-short">Добави в чата</span>
        </button>
        <button className="ibtn" data-testid="chatgpt-reload" onClick={reload} title="Зареди отново (↻)" aria-label="Зареди отново"><Icon n="refresh" /></button>
        <button className={phone ? "ibtn" : "b cgp-br"} data-testid="chatgpt-browser" onClick={browser} title="Отвори в браузъра" aria-label="Отвори в браузъра">
          {phone ? <Icon n="external" /> : <><Icon n="external" /><span className="cgp-bt">Отвори в браузъра</span></>}
        </button>
        {phone ? null : <button className="ibtn" data-testid="chatgpt-close" onClick={onClose} title="Затвори ChatGPT (×)" aria-label="Затвори ChatGPT"><Icon n="x" /></button>}
      </div>
      {host ? <div className="cgp-note signin" data-testid="chatgpt-host">Вход през {host} – страницата на доставчика на входа, в панела на ChatGPT.</div> : null}
      {blocked ? (
        <div className="cgp-note" role="status" data-testid="chatgpt-blocked">
          {blocked.download
            ? <>Изтеглянето от „{blocked.host}“ е спряно – от панела се запазват само снимки и документи от ChatGPT, след ваше натискане. Ако файлът ви трябва, отворете ChatGPT в браузъра.</>
            : blocked.external
              ? <>„{blocked.host}“ не се отваря в панела – отворих го във вашия браузър.</>
              : blocked.canOpen
                ? <>„{blocked.host}“ не се отваря в панела.{" "}<button className="b cgp-nb" data-testid="chatgpt-blocked-open" onClick={openBlocked}><Icon n="external" />Отвори в браузъра</button></>
                : <>„{blocked.host}“ не се отваря в панела. Ако ви трябва, отворете ChatGPT в браузъра.</>}
        </div>
      ) : null}
      <div className="cgp-view" ref={hostRef} data-testid="chatgpt-view">
        <div className="cgp-ph">
          {s.error
            ? <><span>⚠️ {s.error}</span><button className="b" onClick={reload}><Icon n="refresh" />Зареди отново</button></>
            : <><span className="cgp-logo" aria-hidden="true"><Icon n="sparkle" /></span><span>{s.loading ? "Зареждам chatgpt.com…" : "chatgpt.com се показва тук."}</span>
              <small>Ако е скрит – затворете менюто или прозореца над него.</small></>}
        </div>
      </div>
      {notice
        ? <div className="cgp-foot notice" role="status" data-testid="chatgpt-notice">{notice}</div>
        : <div className="cgp-foot">Готова снимка: десен бутон → „Копирай изображението“ (или бутона за копиране), после „📋 Добави снимката в чата“. Тед не чете страницата на ChatGPT; заявките изпращате вие.</div>}
    </section>
  );
}
