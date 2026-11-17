import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon.jsx";
import { ted } from "../../bridge.js";
import { extOf, fmtSize } from "../../lib/format.js";

const call = async (fn) => { try { return await fn(); } catch { return { ok: false, error: "Вътрешна грешка в програмата." }; } };
const KIND = { image: "Снимка", pdf: "PDF", docx: "Word", xlsx: "Excel", csv: "CSV", text: "Текст", video: "Видео", other: "Файл" };
const ORIGIN = { user: "прикачен от вас", ted: "направен от Тед", web: "от интернет", crm: "от сървъра на Тед" };
const EXT_KIND = { jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image", pdf: "pdf", docx: "docx", xlsx: "xlsx", csv: "csv", txt: "text", md: "text", json: "text", html: "text", mp4: "video", webm: "video" };
const kindOf = (f) => (KIND[f.kind] ? f.kind : EXT_KIND[extOf(f.name)] || "other");
const MAX_PREVIEW = { image: 25 * 1048576, video: 150 * 1048576 };

// The bytes of a file of MAIN's store as a blob URL (preview only; revoked when the card goes away).
function useBlobUrl() {
  const ref = useRef(null);
  const [url, setUrl] = useState(null);
  useEffect(() => () => { if (ref.current) URL.revokeObjectURL(ref.current); }, []);
  const load = async (file, kind) => {
    if (ref.current) return { ok: true, url: ref.current };
    const r = await call(() => ted.files.read({ id: file.id, max: MAX_PREVIEW[kind] }));
    if (!r || !r.ok || !r.data) return { ok: false, error: (r && r.error) || "Файлът не можа да се прочете." };
    const u = URL.createObjectURL(new Blob([r.data], { type: r.mime || file.mime || "" }));
    ref.current = u; setUrl(u);
    return { ok: true, url: u };
  };
  return [url, load];
}

// A file Ted made, downloaded or the user attached (docs/CONTRACT.md §8.1, §16): preview (image thumb → full
// Same allowlist as MAIN's files.open (electron/files.js OPENABLE): other types get only „Запази…“.
const OPENABLE = /\.(pdf|docx|xlsx|csv|txt|md|json|jpe?g|png|webp|gif|mp4|webm)$/i;
export const openable = (f) => !!f && (OPENABLE.test(String(f.name || "")) || (f.origin === "ted" && /\.html?$/i.test(String(f.name || ""))));

// picture, video player from a blob, PDF/Word/Excel as an icon with pages/sheets), „Отвори“ (a copy in the
// program's own temporary folder, opened by Windows) and „Запази…“ (native save dialog). Nothing is claimed that
// the FileRef does not say: `savedTo` is copied verbatim from the server's result.
export default function FileCard({ file, compact, onToast }) {
  const f = file && typeof file === "object" ? file : null;
  const [url, load] = useBlobUrl();
  const [view, setView] = useState(null);     // null | "image" (lightbox) | "video" (inline player)
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const toast = (m) => { if (typeof onToast === "function") onToast(m); };
  useEffect(() => {
    if (view !== "image") return undefined;
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); setView(null); } };
    document.addEventListener("keydown", k, true);
    return () => document.removeEventListener("keydown", k, true);
  }, [view]);
  if (!f || typeof f.id !== "string") return null;
  const name = String(f.name || "файл");
  const kind = kindOf({ kind: f.kind, name });
  const ext = (extOf(name) || (kind === "other" ? "file" : kind)).slice(0, 4).toUpperCase();
  const canPreview = (kind === "image" || kind === "video") && !!(ted && ted.files && ted.files.read);
  const meta = [
    KIND[kind],
    f.size > 0 ? fmtSize(f.size) : "",
    f.pages ? f.pages + " стр." : "",
    Array.isArray(f.sheets) && f.sheets.length ? f.sheets.length + (f.sheets.length === 1 ? " лист" : " листа") : "",
    !compact ? ORIGIN[f.origin] || "" : "",
  ].filter(Boolean).join(" · ");

  async function preview() {
    if (!canPreview || busy) return;
    setErr("");
    setBusy("preview");
    const r = await load(f, kind);
    setBusy("");
    if (!r.ok) { setErr(r.error); return; }
    setView(kind);
  }
  async function open() {
    setBusy("open");
    const r = await call(() => ted.files.open(f.id));
    setBusy("");
    if (!r || !r.ok) toast((r && r.error) || "Файлът не можа да се отвори.");
  }
  async function save() {
    setBusy("save");
    const r = await call(() => ted.files.save(f.id));
    setBusy("");
    if (r && r.ok) toast("✅ Запазено: " + r.path);
    else if (r && !r.canceled) toast(r.error || "Файлът не можа да се запише.");
  }

  const thumb = typeof f.thumb === "string" && /^data:image\/(jpeg|png|webp|gif);base64,/.test(f.thumb) ? f.thumb : null;
  let face;
  if (kind === "image" && (thumb || url)) face = <button className="fc-face fc-img" onClick={preview} aria-label={"Преглед на „" + name + "“"} title="Преглед"><img src={url || thumb} alt="" /></button>;
  else if (kind === "image" || kind === "video") face = <button className={"fc-face ficon " + (kind === "video" ? "fc-vid" : "")} onClick={preview} aria-label={"Преглед на „" + name + "“"} title="Преглед">{thumb ? <img src={thumb} alt="" /> : null}<Icon n={kind === "video" ? "play" : "image"} /></button>;
  else face = <span className={"ficon " + extOf(name)} aria-hidden="true">{ext}</span>;

  return (
    <div className={"card file fcard" + (compact ? " fc-compact" : "") + (view === "video" ? " fc-playing" : "")} data-testid="file-card" data-kind={kind} data-file={f.id}>
      <div className="fc-main">
        {face}
        <div className="fx">
          <b title={name}>{name}</b>
          <span className="meta">{meta}</span>
          {f.savedTo ? <span className="meta fc-saved" data-testid="file-saved">Записано: {String(f.savedTo)}</span> : null}
          {!f.savedTo && f.crm && (f.crm.documentId || f.crm.path) ? <span className="meta fc-saved">Копие има в хранилището на CRM</span> : null}
          {f.origin === "web" && f.sourceUrl ? <span className="meta fc-src" title={f.sourceUrl}>Източник: {String(f.sourceUrl).replace(/^https?:\/\//, "").slice(0, 70)}</span> : null}
        </div>
        <div className="fc-acts">
          {canPreview && view !== kind ? <button className="b" onClick={preview} disabled={!!busy}>{busy === "preview" ? <i className="spin" /> : <Icon n="eye" />}Преглед</button> : null}
          {openable(f) ? <button className="b" onClick={open} disabled={!!busy}>{busy === "open" ? <i className="spin" /> : <Icon n="external" />}Отвори</button> : null}
          <button className="b" onClick={save} disabled={!!busy}>{busy === "save" ? <i className="spin" /> : <Icon n="download" />}Запази…</button>
        </div>
      </div>
      {err ? <div className="note fc-err" role="alert">⚠️ {err}</div> : null}
      {view === "video" && url ? (
        <div className="fc-video">
          {/* Plays the bytes from MAIN's store; a format this player cannot show is reported, „Отвори“ still works. */}
          <video src={url} controls autoPlay muted playsInline preload="metadata" data-testid="file-video" onError={() => setErr("Видеото не може да се покаже тук – натиснете „Отвори“.")} />
          <button className="lnk" onClick={() => setView(null)}>Скрий прегледа</button>
        </div>
      ) : null}
      {view === "image" && url ? createPortal(
        <div className="lb" onClick={() => setView(null)} role="dialog" aria-label="Преглед" data-testid="file-lightbox">
          <img src={url} alt={name} onClick={(e) => e.stopPropagation()} />
          <div className="r"><span>{name}</span><button className="b" onClick={(e) => { e.stopPropagation(); save(); }}><Icon n="download" />Запази…</button><button className="b" onClick={() => setView(null)}><Icon n="x" />Затвори</button></div>
        </div>, document.body) : null}
    </div>
  );
}
