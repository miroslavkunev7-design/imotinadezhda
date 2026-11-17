import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

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
  const open = (id, e, data) => {
    const el = e.currentTarget; const r = el.getBoundingClientRect();
    setPop((p) => (p && p.id === id ? null : { id, r, data, el }));
  };
  return [pop, open, () => setPop(null)];
}

export function Pop({ pop, onClose, children, align, width }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const vw = window.innerWidth, vh = window.innerHeight; const r = pop.r;
    const w = m.offsetWidth, h = m.offsetHeight;
    let left = align === "right" ? r.right - w : r.left;
    left = Math.max(12, Math.min(left, vw - w - 12));
    let top = r.bottom + 6;
    if (top + h > vh - 12) top = Math.max(44, r.top - h - 6); // 44: stay below the window title bar
    setPos({ left, top });
  }, [pop]);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    const d = (e) => { if (ref.current && !ref.current.contains(e.target) && !(pop.el && pop.el.contains(e.target))) onClose(); };
    document.addEventListener("keydown", k); document.addEventListener("mousedown", d); document.addEventListener("touchstart", d);
    return () => { document.removeEventListener("keydown", k); document.removeEventListener("mousedown", d); document.removeEventListener("touchstart", d); };
  }, [pop]);
  return <div className="pop" ref={ref} role="menu" style={{ left: pos.left, top: pos.top, width: width || undefined }}>{children}</div>;
}

export function It({ icon, em, title, sub, onClick, check, danger, prov, right, disabled }) {
  return (
    <button className={"it" + (danger ? " danger" : "") + (disabled ? " dis" : "")} role="menuitem" onClick={disabled ? undefined : onClick} aria-disabled={disabled || undefined}>
      {em ? <span className="em">{em}</span> : icon ? <Icon n={icon} /> : null}
      <span className="tx">{title}{sub ? <small>{sub}</small> : null}</span>
      {prov ? <span className="prov">{prov}</span> : null}
      {right}
      {check ? <Icon n="check" cls="chk" /> : null}
    </button>
  );
}

export function Modal({ title, onClose, children, foot, size }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }, []);
  return (
    <div className="back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"modal " + (size || "")} role="dialog" aria-modal="true" aria-label={title}>
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
