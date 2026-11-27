import React, { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";
import { ted } from "../bridge.js";
import { boundsOf, coveredBy, sameBounds } from "../lib/panel.js";
import { HIDDEN } from "./ChatGptPanel.jsx";

// „Чатове“ (0.1.9, docs/CONTRACT.md §24): the agency's real Messenger (Meta Business Suite inbox of the page), Instagram
// Direct and WhatsApp Web in a rounded card next to the chat. The page itself is MAIN's native view (its own partition per
// site and CRM user, rounded corners); this component draws the header in our styling – the three round buttons to
// switch, ↻, „Отвори в браузъра“, × – and the placeholder whose rectangle it reports to MAIN, exactly like ChatGptPanel.
// Props: phone (narrow layout: the card takes the content area, „Назад“), st = MAIN's state ({open, site, visible,
// loading, error, blocked, unread}), onSite(site), onClose, toast.
export const SOCIAL = [
  { id: "messenger", name: "Messenger", sub: "страницата на агенцията" },
  { id: "instagram", name: "Instagram", sub: "директни съобщения" },
  { id: "whatsapp", name: "WhatsApp", sub: "WhatsApp Web" },
];

export function SocialLogo({ id }) {
  if (id === "messenger") return (
    <svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="tsm" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#0866ff" /><stop offset=".6" stopColor="#a033ff" /><stop offset="1" stopColor="#ff5c87" /></linearGradient></defs>
      <path fill="url(#tsm)" d="M24 4C12.7 4 4 12.3 4 23.5c0 5.9 2.4 11 6.4 14.5.3.3.5.7.5 1.2l.1 3.6c0 1.1 1.2 1.9 2.3 1.4l4-1.8c.3-.2.7-.2 1.1-.1 1.8.5 3.7.8 5.7.8 11.3 0 20-8.3 20-19.5S35.3 4 24 4z" />
      <path fill="#fff" d="m12 29.1 5.9-9.3c.9-1.5 2.9-1.8 4.3-.8l4.7 3.5c.4.3 1 .3 1.4 0l6.3-4.8c.8-.6 1.9.4 1.4 1.3l-5.9 9.3c-.9 1.5-2.9 1.8-4.3.8l-4.7-3.5c-.4-.3-1-.3-1.4 0l-6.3 4.8c-.8.6-1.9-.4-1.4-1.3z" /></svg>
  );
  if (id === "instagram") return (
    <svg viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="tsi" cx=".3" cy="1.05" r="1.25"><stop offset="0" stopColor="#ffd776" /><stop offset=".25" stopColor="#f3a554" /><stop offset=".45" stopColor="#e14f6f" /><stop offset=".75" stopColor="#b52f9c" /><stop offset="1" stopColor="#5a4bd6" /></radialGradient></defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#tsi)" /><rect x="12" y="12" width="24" height="24" rx="7.5" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="24" cy="24" r="5.6" fill="none" stroke="#fff" strokeWidth="3" /><circle cx="31.4" cy="16.6" r="1.9" fill="#fff" /></svg>
  );
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#25d366" d="M24 4C13 4 4 12.9 4 23.9c0 3.7 1 7.2 2.9 10.2L4.1 44l10.2-2.7c2.9 1.6 6.2 2.5 9.7 2.5 11 0 20-8.9 20-19.9S35 4 24 4z" />
      <path fill="#fff" d="M34.2 29.1c-.5-.3-3-1.5-3.5-1.6-.5-.2-.8-.3-1.1.2-.3.5-1.2 1.6-1.5 1.9-.3.3-.6.4-1 .1-.5-.3-2.1-.8-4-2.5-1.5-1.3-2.5-2.9-2.8-3.4-.3-.5 0-.8.2-1 .2-.2.5-.6.7-.9.2-.3.3-.5.5-.9.2-.3.1-.7 0-.9-.1-.3-1.1-2.7-1.5-3.7-.4-1-.8-.8-1.1-.8h-.9c-.3 0-.9.1-1.3.6-.5.5-1.7 1.7-1.7 4.1s1.8 4.8 2 5.1c.2.3 3.5 5.4 8.5 7.6 1.2.5 2.1.8 2.8 1 1.2.4 2.3.3 3.1.2.9-.1 3-1.2 3.4-2.4.4-1.2.4-2.2.3-2.4-.2-.2-.5-.3-1-.5z" /></svg>
  );
}

// The three round buttons (top bar and the card's header): the badge is the number the site itself shows in its title.
export function SocialDots({ unread, active, onSite, small }) {
  const u = unread && typeof unread === "object" ? unread : {};
  return (
    <div className={"soc-dots" + (small ? " sm" : "")} role="group" aria-label="Чатове на агенцията">
      {SOCIAL.map((s) => {
        const n = Math.max(0, Number(u[s.id]) || 0);
        return (
          <button key={s.id} type="button" className={"soc-dot" + (active === s.id ? " on" : "")} data-testid={"soc-" + s.id} onClick={() => onSite(s.id)}
            title={s.name + (n ? " – " + n + (n === 1 ? " ново" : " нови") : "")} aria-label={s.name + (n ? ", " + n + " нови" : "")} aria-pressed={active === s.id}>
            <SocialLogo id={s.id} />{n ? <span className="n">{n > 99 ? "99+" : n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default function SocialPanel({ phone, st, onSite, onClose, toast }) {
  const hostRef = useRef(null);
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
      Promise.resolve(ted.social.setBounds(b)).catch(() => {});
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
      Promise.resolve(ted.social.setBounds(HIDDEN)).catch(() => {});
    };
  }, []);

  const s = st && typeof st === "object" ? st : {};
  const site = SOCIAL.find((x) => x.id === s.site) || SOCIAL[0];
  const say = (t) => { if (typeof toast === "function") toast(t); };
  async function reload() {
    let r; try { r = await ted.social.reload(); } catch { r = null; }
    if (!r || !r.ok) say((r && r.error) || site.name + " не можа да се зареди отново.");
  }
  async function browser() {
    let r; try { r = await ted.social.openInBrowser(); } catch { r = null; }
    say(r && r.ok ? "Отворих " + site.name + " във вашия браузър." : (r && r.error) || "Браузърът не можа да се отвори.");
  }
  async function openBlocked() {
    let r; try { r = await ted.social.openInBrowser({ blocked: true }); } catch { r = null; }
    say(r && r.ok ? "Отворих връзката във вашия браузър." : (r && r.error) || "Браузърът не можа да се отвори.");
  }
  const blocked = s.blocked && typeof s.blocked === "object" && s.blocked.host ? s.blocked : null;

  return (
    <section className={"socp" + (phone ? " ph" : "")} aria-label={site.name} data-testid="social-panel">
      <div className="socp-h">
        {phone ? <button className="b cgp-back" data-testid="social-back" onClick={onClose}><Icon n="chevL" />Назад</button> : null}
        <span className="socp-ttl"><b>{site.name}</b><small>{site.sub}</small></span>
        <SocialDots unread={s.unread} active={site.id} onSite={onSite} small />
        <button className="ibtn" data-testid="social-reload" onClick={reload} title="Зареди отново (↻)" aria-label="Зареди отново"><Icon n="refresh" /></button>
        <button className="ibtn" data-testid="social-browser" onClick={browser} title="Отвори в браузъра" aria-label="Отвори в браузъра"><Icon n="external" /></button>
        {phone ? null : <button className="ibtn" data-testid="social-close" onClick={onClose} title="Затвори (×)" aria-label="Затвори"><Icon n="x" /></button>}
      </div>
      {blocked ? (
        <div className="cgp-note" role="status" data-testid="social-blocked">
          {blocked.download
            ? <>Изтеглянето от „{blocked.host}“ е спряно – запазват се само снимки, документи, гласови и видео от разговора, след ваше натискане.</>
            : blocked.external
              ? <>„{blocked.host}“ не се отваря тук – отворих го във вашия браузър.</>
              : blocked.canOpen
                ? <>„{blocked.host}“ не се отваря тук.{" "}<button className="b cgp-nb" onClick={openBlocked}><Icon n="external" />Отвори в браузъра</button></>
                : <>„{blocked.host}“ не се отваря тук.</>}
        </div>
      ) : null}
      <div className="socp-view" ref={hostRef} data-testid="social-view">
        <div className="cgp-ph">
          {s.error
            ? <><span>⚠️ {s.error}</span><button className="b" onClick={reload}><Icon n="refresh" />Зареди отново</button></>
            : <><span className="socp-logo" aria-hidden="true"><SocialLogo id={site.id} /></span><span>{s.loading ? "Зареждам " + site.name + "…" : site.name + " се показва тук."}</span>
              <small>Първия път влезте с профила на агенцията{site.id === "whatsapp" ? " (QR код от телефона)" : ""} – програмата го помни.</small></>}
        </div>
      </div>
      <div className="cgp-foot">Истинският {site.name} – пишете директно тук. Броят на новите съобщения идва от самия {site.name}; Тед не чете разговорите.</div>
    </section>
  );
}
