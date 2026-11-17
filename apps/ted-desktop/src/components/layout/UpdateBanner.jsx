import React from "react";
import Icon from "../Icon.jsx";

// Shown under the top bar when MAIN reports a downloaded update (status "ready").
export default function UpdateBanner({ upd, onInstall, onHide, busy }) {
  if (!upd || upd.status !== "ready") return null;
  const v = upd.available && upd.available.version ? upd.available.version : "";
  return (
    <div className="upd-banner" role="status" data-testid="upd-banner">
      <Icon n="download" cls="sm16" />
      <span>Има нова версия{v ? " " + v : ""}. {upd.auto ? "Ще се инсталира при затваряне." : "Ще се инсталира, когато натиснете „Рестартирай и обнови“."}</span>
      <button className="b wine" onClick={onInstall} disabled={busy}>{busy ? <i className="spin" /> : <Icon n="refresh" />}Рестартирай и обнови</button>
      <button className="ibtn" onClick={onHide} aria-label="Скрий"><Icon n="x" /></button>
    </div>
  );
}
