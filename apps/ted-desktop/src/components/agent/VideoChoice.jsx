import React from "react";
import { fmtUsd, videoEstimate } from "../../lib/agent.js";

// Closest allowed clip length (MAIN durFor): the engine's own list, nearest to `wanted`.
export function durFor(engine, wanted = 5) {
  const durs = engine && Array.isArray(engine.durs) && engine.durs.length ? engine.durs : [wanted];
  return durs.reduce((a, x) => (Math.abs(x - wanted) < Math.abs(a - wanted) ? x : a), durs[0]);
}

export function initialChoice(engines, defaults) {
  const list = Array.isArray(engines) ? engines : [];
  const d = defaults || {};
  const eng = list.find((e) => e.id === d.engine) || list[0] || null;
  if (!eng) return { engine: "", duration: 0 };
  return { engine: eng.id, duration: Array.isArray(eng.durs) && eng.durs.includes(Number(d.duration)) ? Number(d.duration) : durFor(eng) };
}

// Engine, clip length and the honest estimate of a paid AI video (same price list and formula as the site).
export default function VideoChoice({ engines, gateway, parts, aspect, value, onChange, disabled, idp }) {
  const list = Array.isArray(engines) ? engines : [];
  const eng = list.find((e) => e.id === value.engine) || list[0];
  if (!eng) return null;
  const est = videoEstimate(parts, eng, value.duration);
  const id = (k) => (idp || "vc") + "-" + k;
  return (
    <div className="vchoice">
      <div className="hrow vc-row">
        <div className="fld"><label htmlFor={id("engine")}>Двигател</label>
          <select id={id("engine")} className="inp auto" value={eng.id} disabled={disabled}
            onChange={(e) => { const n = list.find((x) => x.id === e.target.value) || eng; onChange({ engine: n.id, duration: durFor(n, value.duration || 5) }); }}>
            {list.map((e) => <option key={e.id} value={e.id}>{e.name} · {fmtUsd(e.price)}/сек</option>)}
          </select></div>
        <div className="fld"><label htmlFor={id("dur")}>Дължина на част</label>
          <select id={id("dur")} className="inp auto" value={value.duration} disabled={disabled} onChange={(e) => onChange({ engine: eng.id, duration: Number(e.target.value) })}>
            {(eng.durs && eng.durs.length ? eng.durs : [value.duration]).map((d) => <option key={d} value={d}>{d} сек</option>)}
          </select></div>
      </div>
      {eng.note ? <div className="note vc-enote">{eng.note}{eng.frames > 1 ? " · ползва първи и последен кадър" : " · ползва само първия кадър"}</div> : null}
      <dl className="kv vc-kv" data-testid="video-estimate">
        <dt>Части</dt><dd>{est.n}{aspect ? " · формат " + aspect : ""}</dd>
        <dt>≈ Дължина</dt><dd>{est.sec} сек</dd>
        <dt>≈ Цена</dt><dd data-testid="video-cost">{fmtUsd(est.cost)}</dd>
        <dt>≈ Време</dt><dd>около {est.min} мин</dd>
        {gateway && gateway.ok && gateway.balance != null ? <><dt>Баланс на сървъра</dt><dd>{fmtUsd(gateway.balance)}</dd></> : null}
      </dl>
      <div className="note">Цената е приблизителна, по цените на сървъра на Тед, и се плаща от кредитите на агенцията. Видеото е AI визуализация от снимките.</div>
    </div>
  );
}
