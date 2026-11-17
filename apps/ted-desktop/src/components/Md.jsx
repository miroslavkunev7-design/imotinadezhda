import React, { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";
import { ted } from "../bridge.js";
import { domainOf, parseBlocks, safeHref } from "../lib/md.js";
import { loadFileImage, loadWebImage } from "../lib/images.js";

// Markdown like ChatGPT (docs/CONTRACT.md §16 „Markdown“). Safe: src/lib/md.js builds a plain tree and this file turns
// it into React nodes – never HTML. Links are limited to https: and mailto: and always leave through the main process
// (system browser / mail program) with the REAL address; a link shows its text, a source shows a domain chip.
// Pictures: shown inline only when the exact address came from a tool result of the same answer (`media`, built by
// lib/agent.js answerMedia) – any other picture is a chip „Снимка: domain ›“ that loads only after a click.

const open = (href) => { if (safeHref(href)) Promise.resolve(ted.app.openExternal(href)).catch(() => {}); };

export function ExtLink({ href, children, className, title }) {
  const go = (e) => { e.preventDefault(); open(href); };
  return <a className={className} href={href} title={title} rel="noopener noreferrer" onClick={go} onAuxClick={go}>{children}</a>;
}

// A ChatGPT source pill: the domain, the full address on hover; one click opens the real address.
export function SourceChip({ href, label }) {
  return (
    <ExtLink className="src-chip" href={href} title={href}>
      <span className="src-d">{label || domainOf(href)}</span><span className="src-arr" aria-hidden="true">›</span>
    </ExtLink>
  );
}

const Media = createContext(null);

// The focus goes into the dialog („Затвори“) and back to the picture that opened it (review).
function Lightbox({ src, alt, href, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const back = document.activeElement;
    if (closeRef.current) closeRef.current.focus();
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", k, true);
    return () => {
      document.removeEventListener("keydown", k, true);
      if (back && typeof back.focus === "function" && document.contains(back)) back.focus();
    };
  }, []);
  return createPortal(
    <div className="lb" onClick={onClose} role="dialog" aria-label="Преглед на снимката" data-testid="md-lightbox">
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
      <div className="r">
        {alt ? <span>{alt}</span> : null}
        {href ? <button className="b" onClick={(e) => { e.stopPropagation(); open(href); }}><Icon n="external" />Отвори източника</button> : null}
        <button className="b" ref={closeRef} onClick={onClose}><Icon n="x" />Затвори</button>
      </div>
    </div>, document.body);
}

// One picture of an answer. state: "chip" (not from a tool result: loads only after a click) | "load" | "ok" | "err".
function MdImg({ src, alt, small }) {
  const media = useContext(Media);
  const isFile = src.startsWith("file:");
  const fileId = isFile ? src.slice(5) : media && media.bySource ? media.bySource.get(src) : undefined;
  const ownFile = !!(fileId && media && media.ids && media.ids.has(fileId));
  const allowed = isFile ? ownFile : !!(media && media.allowed && media.allowed.has(src));
  const [state, setState] = useState(allowed ? "load" : "chip");
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState("");
  const [zoom, setZoom] = useState(false);
  const [clicked, setClicked] = useState(false);
  useEffect(() => { if (allowed && state === "chip") setState("load"); }, [allowed]);
  useEffect(() => {
    if (state !== "load") return undefined;
    let off = false;
    const p = ownFile ? loadFileImage(fileId) : isFile ? Promise.resolve({ ok: false, error: "Файлът не е от този отговор." }) : loadWebImage(src, { clicked });
    p.then((r) => {
      if (off) return;
      if (r && r.ok) { setUrl(r.url); setState("ok"); } else { setErr((r && r.error) || "Снимката не можа да се зареди."); setState("err"); }
    });
    return () => { off = true; };
  }, [state]);
  const dom = isFile ? "файл" : domainOf(src);
  if (state === "chip") {
    return (
      <button type="button" className="src-chip img-chip" data-testid="img-chip" data-src={src} title={"Зареди снимката от " + src} onClick={() => { setClicked(true); setState("load"); }}>
        <Icon n="image" /><span className="src-d">Снимка: {dom}</span><span className="src-arr" aria-hidden="true">›</span>
      </button>
    );
  }
  if (state === "err") {
    return isFile
      ? <span className="src-chip img-chip bad" data-testid="img-err" title={err}><Icon n="image" /><span className="src-d">Снимката не е налична</span></span>
      : <ExtLink className="src-chip img-chip bad" href={src} title={err + " – " + src}><Icon n="image" /><span className="src-d" data-testid="img-err">Снимката не се зареди · {dom}</span><span className="src-arr" aria-hidden="true">›</span></ExtLink>;
  }
  return (
    <>
      <button type="button" className={"md-img" + (small ? " sm" : "") + (state === "load" ? " sk" : "")} data-testid="md-img" data-src={src} data-state={state}
        onClick={() => url && setZoom(true)} aria-label={alt ? "Преглед: " + alt : "Преглед на снимката"} disabled={!url}>
        {url ? <img src={url} alt={alt || ""} draggable={false} /> : <i className="spin" />}
      </button>
      {zoom && url ? <Lightbox src={url} alt={alt} href={isFile ? null : src} onClose={() => setZoom(false)} /> : null}
    </>
  );
}

function inline(nodes, kp, ctx = {}) {
  return nodes.map((n, k) => {
    const key = kp + "." + k;
    switch (n.t) {
      case "text": return <Fragment key={key}>{n.v}</Fragment>;
      case "br": return <br key={key} />;
      case "code": return <code key={key} className="ic">{n.v}</code>;
      case "b": return <b key={key}>{inline(n.c, key, ctx)}</b>;
      case "i": return <i key={key}>{inline(n.c, key, ctx)}</i>;
      case "s": return <s key={key}>{inline(n.c, key, ctx)}</s>;
      // The real domain is always shown with the link text (review F1): text alone can never disguise the destination.
      case "a": return <ExtLink key={key} className="md-a" href={n.href} title={n.href}>{inline(n.c, key, ctx)}{n.dom ? <small className="md-a-dom" data-testid="link-domain">{n.dom}</small> : null}</ExtLink>;
      case "chip": return <SourceChip key={key} href={n.href} label={n.label} />;
      case "nolink": return <span key={key} className="md-nolink" title="Адреси с http:// не се отварят от програмата – само https://">{inline(n.c, key, ctx)} <small>({n.href})</small></span>;
      case "img": return <MdImg key={key} src={n.src} alt={n.alt} small={!!ctx.cell} />;
      default: return null;
    }
  });
}

// A tight list item shows its first paragraph as plain text (no gap), like ChatGPT.
function itemBody(item, loose, kp, extra) {
  const bl = item.c;
  if (!loose && item.tight && bl.length && bl[0].t === "p") return <>{inline(bl[0].c, kp + "p")}{blocks(bl.slice(1), kp + "r", extra)}</>;
  return blocks(bl, kp, extra);
}

function blocks(list, kp, extra) {
  return list.map((n, k) => {
    const key = kp + "-" + k;
    switch (n.t) {
      case "p": return <p key={key}>{inline(n.c, key)}</p>;
      case "h": return React.createElement("h" + (n.level + 2), { key, className: "mdh l" + n.level }, inline(n.c, key));
      case "hr": return <hr key={key} />;
      case "code": return <CodeBlock key={key} lang={n.lang} code={n.code} onCanvas={extra && extra.onCanvas} copy={extra && extra.copy} />;
      case "quote": return <blockquote key={key}>{blocks(n.c, key, extra)}</blockquote>;
      case "gallery": return <div key={key} className={"md-gallery n" + Math.min(4, n.c.length)} data-testid="md-gallery">{n.c.map((im, q) => <MdImg key={q} src={im.src} alt={im.alt} />)}</div>;
      case "list": {
        const items = n.items.map((it, q) => (
          <li key={q} className={it.task == null ? undefined : "task"}>
            {it.task == null ? null : <span className={"md-task" + (it.task ? " on" : "")} role="img" aria-label={it.task ? "изпълнено" : "неизпълнено"}>{it.task ? <Icon n="check" /> : null}</span>}
            {itemBody(it, n.loose, key + "i" + q, extra)}
          </li>
        ));
        return n.ordered ? <ol key={key} start={n.start !== 1 ? n.start : undefined}>{items}</ol> : <ul key={key}>{items}</ul>;
      }
      case "table": {
        const al = (q) => (n.align[q] ? "al-" + n.align[q] : undefined);
        return (
          <div key={key} className="mdt" role="region" aria-label="Таблица" tabIndex={0} data-testid="md-table">
            <table>
              <thead><tr>{n.head.map((c, q) => <th key={q} className={al(q)}>{inline(c, key + "h" + q, { cell: true })}</th>)}</tr></thead>
              <tbody>{n.rows.map((r, q) => <tr key={q}>{r.map((c, w) => <td key={w} className={al(w)}>{inline(c, key + "d" + q + "_" + w, { cell: true })}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      }
      default: return null;
    }
  });
}

// media = {allowed:Set<url>, bySource:Map<url,fileId>, ids:Set<fileId>} (lib/agent.js answerMedia) or nothing.
export default function Md({ text, onCanvas, copy, media }) {
  const tree = useMemo(() => parseBlocks(String(text || "")), [text]);
  return <Media.Provider value={media || null}><div className="md">{blocks(tree, "b", { onCanvas, copy })}</div></Media.Provider>;
}

function CodeBlock({ lang, code, onCanvas, copy }) {
  return (
    <div className="cb"><div className="cb-h"><span>{lang || "код"}</span><span className="spacer" />
      {onCanvas ? <button onClick={() => onCanvas({ title: "Код" + (lang ? " · " + lang : ""), kind: "code", text: code })}>✍️ В Canvas</button> : null}
      {copy ? <button onClick={() => copy(code)}>📋 Копирай</button> : null}</div>
      <pre><code>{code}</code></pre></div>
  );
}
