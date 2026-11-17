import React, { Fragment } from "react";
import { ted } from "../bridge.js";

// Safe Markdown: builds React nodes only, never HTML. Links are limited to https: and mailto:
// and always leave through the main process (system browser / mail program).
const LINK_OK = /^(https:\/\/|mailto:)/i;

export function ExtLink({ href, children, className }) {
  const go = (e) => { e.preventDefault(); if (LINK_OK.test(href)) ted.app.openExternal(href); };
  return <a className={className} href={href} rel="noopener noreferrer" onClick={go} onAuxClick={go}>{children}</a>;
}

function inlineMd(s, kp) {
  const out = []; let k = 0; let last = 0; let m;
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s\n][^*\n]*\*)|(\[[^\]\n]+\]\(((?:https:\/\/|mailto:)[^\s)]+)\))|(https:\/\/[^\s<>"')\]]+)/g;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    let t = m[0];
    if (m[1]) out.push(<code key={kp + "c" + k++} className="ic">{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<b key={kp + "b" + k++}>{inlineMd(t.slice(2, -2), kp + "bb" + k)}</b>);
    else if (m[3]) out.push(<i key={kp + "i" + k++}>{t.slice(1, -1)}</i>);
    else if (m[4]) out.push(<ExtLink key={kp + "a" + k++} href={m[5]}>{t.slice(1, t.indexOf("]("))}</ExtLink>);
    else {
      // Bare address: sentence punctuation right after it is not part of the link.
      const url = t.replace(/[.,;:!?]+$/, "");
      re.lastIndex -= t.length - url.length; t = url;
      out.push(<ExtLink key={kp + "u" + k++} href={url}>{url.replace(/^https:\/\//, "").slice(0, 70) + (url.length > 78 ? "…" : "")}</ExtLink>);
    }
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

const LI_RE = /^\s*([-*•]|\d+[.)])\s+/;

export default function Md({ text, onCanvas, copy }) {
  const parts = String(text || "").split("```");
  const nodes = [];
  parts.forEach((p, idx) => {
    if (idx % 2 === 1) {
      const nl = p.indexOf("\n"); const lang = nl > 0 ? p.slice(0, nl).trim() : "";
      const code = (nl >= 0 ? p.slice(nl + 1) : p).replace(/\n$/, "");
      nodes.push(<CodeBlock key={"c" + idx} lang={lang} code={code} onCanvas={onCanvas} copy={copy} />); return;
    }
    const lines = p.split("\n"); let j = 0;
    while (j < lines.length) {
      const L = lines[j]; const key = idx + "-" + j;
      if (!L.trim()) { j++; continue; }
      const h = L.match(/^(#{1,4})\s+(.*)/);
      if (h) { nodes.push(React.createElement("h" + Math.min(6, h[1].length + 2), { key, className: "mdh" }, inlineMd(h[2], key))); j++; continue; }
      if (/^\s*(---|\*\*\*|___)\s*$/.test(L)) { nodes.push(<hr key={key} />); j++; continue; }
      if (/^\s*\|.*\|\s*$/.test(L) && j + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[j + 1])) {
        const row = (x) => x.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
        const head = row(L); j += 2; const body = [];
        while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) { body.push(row(lines[j])); j++; }
        nodes.push(<div key={key} className="mdt"><table><thead><tr>{head.map((c, q) => <th key={q}>{inlineMd(c, key + "h" + q)}</th>)}</tr></thead><tbody>{body.map((r, q) => <tr key={q}>{r.map((c, w) => <td key={w}>{inlineMd(c, key + "d" + q + w)}</td>)}</tr>)}</tbody></table></div>);
        continue;
      }
      if (LI_RE.test(L)) {
        const ordered = /^\s*\d+[.)]/.test(L); const items = [];
        while (j < lines.length && LI_RE.test(lines[j])) { items.push(lines[j].replace(LI_RE, "")); j++; }
        nodes.push(React.createElement(ordered ? "ol" : "ul", { key }, items.map((it, q) => <li key={q}>{inlineMd(it, key + "l" + q)}</li>)));
        continue;
      }
      if (/^>\s?/.test(L)) { const q = []; while (j < lines.length && /^>\s?/.test(lines[j])) { q.push(lines[j].replace(/^>\s?/, "")); j++; } nodes.push(<blockquote key={key}>{inlineMd(q.join(" "), key)}</blockquote>); continue; }
      const para = [];
      while (j < lines.length && lines[j].trim() && !(/^#{1,4}\s/.test(lines[j]) || LI_RE.test(lines[j]) || /^>/.test(lines[j]) || /^\s*\|.*\|\s*$/.test(lines[j]))) { para.push(lines[j]); j++; }
      if (!para.length) { para.push(L); j++; }
      nodes.push(<p key={key}>{para.map((x, q) => <Fragment key={q}>{q ? <br /> : null}{inlineMd(x, key + "p" + q)}</Fragment>)}</p>);
    }
  });
  return <div className="md">{nodes}</div>;
}

function CodeBlock({ lang, code, onCanvas, copy }) {
  return (
    <div className="cb"><div className="cb-h"><span>{lang || "код"}</span><span className="spacer" />
      {onCanvas ? <button onClick={() => onCanvas({ title: "Код" + (lang ? " · " + lang : ""), kind: "code", text: code })}>✍️ В Canvas</button> : null}
      {copy ? <button onClick={() => copy(code)}>📋 Копирай</button> : null}</div>
      <pre><code>{code}</code></pre></div>
  );
}
