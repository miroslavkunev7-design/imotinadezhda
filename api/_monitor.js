// Сървърен сигнал при грешка на Тед. Работи само ако URL и ключ са в средата.
// Не праща лични данни, файлове, аудио, подписани адреси или тайни. Успехът на чата не зависи от него.
"use strict";
const crypto = require("crypto");
const seen = new Map();

function names() {
  return {
    url: process.env.TED_MONITOR_URL || process.env.CURSOR_AUTOMATION_WEBHOOK_URL || "",
    key: process.env.TED_MONITOR_KEY || process.env.CURSOR_AUTOMATION_WEBHOOK_KEY || ""
  };
}
function missing() {
  const c = names();
  const out = [];
  if (!c.url) out.push("TED_MONITOR_URL или CURSOR_AUTOMATION_WEBHOOK_URL");
  if (!c.key) out.push("TED_MONITOR_KEY или CURSOR_AUTOMATION_WEBHOOK_KEY");
  return out;
}
function status() {
  const miss = missing();
  return { enabled: miss.length === 0, missing: miss };
}

async function report(ev) {
  const c = names();
  const miss = missing();
  if (miss.length) return { sent: false, missing: miss };
  const release = String(process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 20);
  const endpoint = String((ev && ev.endpoint) || "").replace(/[?#].*$/, "").slice(0, 80);
  const errorCode = String((ev && ev.errorCode) || "error").slice(0, 80);
  const sig = crypto.createHash("sha256").update([errorCode, endpoint, release].join("|")).digest("hex").slice(0, 20);
  const now = Date.now();
  if (now - (seen.get(sig) || 0) < 30 * 60 * 1000) return { sent: false, dedup: true };
  if (seen.size > 200) seen.clear();
  seen.set(sig, now);
  const body = {
    source: "ted-monitor",
    event: String((ev && ev.event) || "error").slice(0, 40),
    errorCode,
    requestId: String((ev && ev.requestId) || "").slice(0, 80),
    release,
    timestamp: new Date().toISOString(),
    endpoint
  };
  try {
    const r = await fetch(c.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2500)
    });
    return { sent: r.ok };
  } catch (e) {
    return { sent: false };
  }
}

module.exports = { report, status, missing };
