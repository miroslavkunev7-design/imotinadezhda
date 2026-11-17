// Small pure helpers shared by the UI.
export const uid = (p) => (p || "") + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
export const now = () => Date.now();
export const DAY = 86400000;

export const fmtEUR = (n) => new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 2, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n) + " €";
export const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
export const extOf = (name) => { const s = String(name || ""); return s.includes(".") ? s.split(".").pop().toLowerCase().slice(0, 5) : ""; };
export const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

export function fmtDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function dayGroup(ts) {
  const n = new Date();
  const sd = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  if (ts >= sd) return "Днес";
  if (ts >= sd - DAY) return "Вчера";
  if (ts >= sd - 7 * DAY) return "Последните 7 дни";
  if (ts >= sd - 30 * DAY) return "Последните 30 дни";
  return "По-стари";
}

// "Иван Петров" -> "ИП"; falls back to the first letters of the login.
export function initials(name, fallback) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const src = parts.length ? parts : String(fallback || "").trim().split(/[\s@.]+/).filter(Boolean);
  const out = src.slice(0, 2).map((p) => p[0]).join("").toLocaleUpperCase("bg");
  return out || "•";
}
export const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

// Markdown -> plain text for reading aloud and short previews.
export const plainText = (t) => String(t || "").replace(/```[\s\S]*?```/g, " (код) ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[#*`>|_]/g, "").replace(/\n{2,}/g, "\n").trim();
