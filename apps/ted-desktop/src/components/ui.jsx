import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import ColorIcon from "./ColorIcon.jsx";

// Phone layout is the same breakpoint as the prototype; the window can be narrowed to it ("Компактен прозорец").
export function usePhone() {
  const q = "(max-width:640px)";
  const [m, setM] = useState(() => { try { return window.matchMedia(q).matches; } catch { return false; } });
  useEffect(() => {
    let mq; try { mq = window.matchMedia(q); } catch { return undefined; }
    const f = () => setM(mq.matches); f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return m;
}

export function usePop() {
  const [pop, setPop] = useState(null);
  // kb: opened from the keyboard (Enter/Space on the button gives a click with detail 0) – the menu then takes focus.
  const open = (id, e, data) => {
    const el = e.currentTarget; const r = el.getBoundingClientRect();
    setPop((p) => (p && p.id === id ? null : { id, r, data, el, kb: e.detail === 0 }));
  };
  return [pop, open, () => setPop(null)];
}

const menuItems = (m) => (m ? [...m.querySelectorAll('[role="menuitem"]')].filter((x) => x.getAttribute("aria-disabled") !== "true" && x.getClientRects().length) : []);

// side: "below" | "above" keeps a menu on one side of its anchor (sub-levels of the „+“ menu); minTop: never above
// this y (e.g. the bottom of the top bar); onPlaced(side) reports the side chosen. Without them: below if it fits.
// fit: when the menu fits in the window but on neither side of its anchor, it is moved (over the anchor's
// surroundings) so every item is visible instead of becoming a scroll box (the Home „+“ menu at 1366×768, review).
// Keyboard (review): opened from the keyboard the first item takes focus; ↑/↓/Home/End move between items, Tab stays
// in the menu, Esc closes it, and the focus goes back to the button that opened it.
export function Pop({ pop, onClose, children, align, width, side, minTop, onPlaced, fit, className }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const vw = window.innerWidth, vh = window.innerHeight; const r = pop.r;
    const w = m.offsetWidth, h = m.offsetHeight;
    let left = align === "right" ? r.right - w : r.left;
    left = Math.max(12, Math.min(left, vw - w - 12));
    if (!side && minTop == null) {
      let top = r.bottom + 6;
      if (top + h > vh - 12) top = Math.max(44, r.top - h - 6); // 44: stay below the window title bar
      setPos({ left, top });
    } else {
      const floor = Math.max(44, minTop || 0);
      const roomBelow = vh - 12 - (r.bottom + 6), roomAbove = r.top - 6 - floor;
      const chosen = side || (h <= roomBelow ? "below" : h <= roomAbove ? "above" : roomBelow >= roomAbove ? "below" : "above");
      const room = Math.max(160, chosen === "below" ? roomBelow : roomAbove);
      if (fit && h > room && h <= vh - 12 - floor) {
        setPos({ left, top: chosen === "below" ? vh - 12 - h : floor });
      } else {
        const height = Math.min(h, room);
        const top = chosen === "below" ? r.bottom + 6 : Math.max(floor, r.top - 6 - height);
        setPos({ left, top, ...(height < h ? { maxHeight: height } : {}) });
      }
      if (onPlaced) onPlaced(chosen);
    }
    if (pop.kb) { const first = menuItems(m)[0]; if (first) first.focus(); }
  }, [pop]);
  useEffect(() => {
    const node = ref.current;
    const k = (e) => {
      if (e.key === "Escape") { onClose(); if (pop.el && document.contains(pop.el)) pop.el.focus(); return; }
      const inside = node && node.contains(document.activeElement);
      const fromButton = pop.el && document.activeElement === pop.el;
      if (!inside && !(fromButton && (e.key === "ArrowDown" || e.key === "ArrowUp"))) return;
      const list = menuItems(node);
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      let to = null;
      if (e.key === "ArrowDown") to = list[(i + 1) % list.length];
      else if (e.key === "ArrowUp") to = list[i <= 0 ? list.length - 1 : i - 1];
      else if (e.key === "Home") to = list[0];
      else if (e.key === "End") to = list[list.length - 1];
      else if (e.key === "Tab") to = e.shiftKey ? list[i <= 0 ? list.length - 1 : i - 1] : list[(i + 1) % list.length];
      if (to) { e.preventDefault(); to.focus(); }
    };
    const d = (e) => { if (node && !node.contains(e.target) && !(pop.el && pop.el.contains(e.target))) onClose(); };
    document.addEventListener("keydown", k); document.addEventListener("mousedown", d); document.addEventListener("touchstart", d);
    return () => {
      document.removeEventListener("keydown", k); document.removeEventListener("mousedown", d); document.removeEventListener("touchstart", d);
      // Closed after keyboard use (the focus was in the menu, now gone with it): back to the button that opened it.
      if (pop.kb && pop.el && document.contains(pop.el) && (!document.activeElement || document.activeElement === document.body)) pop.el.focus();
    };
  }, [pop]);
  return <div className={"pop" + (className ? " " + className : "")} ref={ref} role="menu" style={{ left: pos.left, top: pos.top, width: width || undefined, ...(pos.maxHeight ? { maxHeight: pos.maxHeight } : {}) }}>{children}</div>;
}

// ci = a full-colour icon (ColorIcon.jsx) – the „+“ menu and the account menu (0.1.5); icon = the monochrome one.
export function It({ icon, ci, em, title, sub, onClick, check, danger, prov, right, disabled }) {
  return (
    <button className={"it" + (danger ? " danger" : "") + (disabled ? " dis" : "")} role="menuitem" onClick={disabled ? undefined : onClick} aria-disabled={disabled || undefined} title={typeof sub === "string" ? sub : undefined}>
      {ci ? <span className="em ci-tile" data-ci={ci}><ColorIcon n={ci} /></span> : em ? <span className="em">{em}</span> : icon ? <Icon n={icon} /> : null}
      <span className="tx">{title}{sub ? <small>{sub}</small> : null}</span>
      {prov ? <span className="prov">{prov}</span> : null}
      {right}
      {check ? <Icon n="check" cls="chk" /> : null}
    </button>
  );
}

export function Modal({ title, onClose, children, foot, size }) {
  const ref = useRef(null);
  useEffect(() => {
    // Only the topmost dialog answers the keyboard: a confirmation over Settings must not close both at once.
    const top = () => { const all = document.querySelectorAll(".modal"); return all[all.length - 1] === ref.current; };
    const k = (e) => {
      if (e.key === "Escape") { if (top()) onClose(); return; }
      // Tab stays inside the dialog: otherwise it reaches the composer behind it, where Enter would send a message.
      if (e.key !== "Tab" || !top() || !ref.current) return;
      const f = [...ref.current.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.getClientRects().length);
      const i = f.indexOf(document.activeElement);
      let to = null;
      if (!f.length || !ref.current.contains(document.activeElement)) to = e.shiftKey ? f[f.length - 1] : f[0];
      else if (e.shiftKey && i <= 0) to = f[f.length - 1];
      else if (!e.shiftKey && i === f.length - 1) to = f[0];
      if (to || !f.length) { e.preventDefault(); if (to) to.focus(); }
    };
    // Opened from the keyboard (Ctrl+/) the focus would stay in the composer behind the dialog, where Enter sends a
    // message: move it inside, unless something in the dialog (an autofocus input) already has it.
    // The dialog itself takes it (tabIndex -1), not a button: a stray Space/Enter must not press anything.
    if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus();
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }, []);
  return (
    <div className="back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"modal " + (size || "")} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="mh"><h2>{title}</h2><button className="ibtn" onClick={onClose} aria-label="Затвори"><Icon n="x" /></button></div>
        {children}
        {foot ? <div className="mf">{foot}</div> : null}
      </div>
    </div>
  );
}

export const Sw = ({ on, set, dis, id }) => <button id={id} className="sw" role="switch" aria-checked={!!on} disabled={dis} onClick={() => !dis && set(!on)} />;

export function Opt({ title, sub, children }) {
  return <div className="opt"><div className="tx"><b>{title}</b>{sub ? <small>{sub}</small> : null}</div>{children}</div>;
}

// Initials instead of a photo: the profile comes from the login, the program stores no pictures of people.
export const Avatar = ({ text }) => <span className="ini" aria-hidden="true">{text}</span>;
