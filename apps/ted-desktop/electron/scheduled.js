// Scheduled tasks (docs/CONTRACT.md §13): reminders and prompts of the signed-in CRM user, kept in the secure
// store "scheduled-<CRM user id>". They run only while the program is open; runs missed while it was closed are
// reported once with missed:true and are never executed silently. Times are wall-clock times in Europe/Sofia.
import crypto from "node:crypto";

export const MAX_TASKS = 200;
export const TICK_MS = 30_000;
const TZ = "Europe/Sofia";
const REPEAT = ["none", "daily", "weekdays", "weekly", "monthly"];

// Wall-clock parts of an instant in Sofia.
export function sofiaParts(date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second, wd };
}

// The instant of a Sofia wall-clock time. An ambiguous time (autumn) takes the earlier instant; a time skipped by
// the spring change (03:00–03:59) moves forward by the gap (03:30 -> 04:30).
export function fromSofia(y, m, d, hh, mm) {
  const want = Date.UTC(y, m - 1, d, hh, mm);
  const offset = (t) => { const p = sofiaParts(new Date(t)); return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - t; };
  const before = offset(want - 6 * 3600_000);
  const after = offset(want + 6 * 3600_000);
  const same = (t) => { const p = sofiaParts(new Date(t)); return p.y === y && p.m === m && p.d === d && p.hh === hh && p.mm === mm; };
  for (const t of [want - before, want - after]) if (same(t)) return new Date(t);
  return new Date(want - before);
}

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// Next run strictly after `after` for a task that started at `at` (ISO) with the given repeat; null when none.
export function nextRun(at, repeat, after) {
  const first = new Date(at);
  if (!Number.isFinite(first.getTime())) return null;
  if (first > after) return first;
  if (repeat === "none" || !REPEAT.includes(repeat)) return null;
  const base = sofiaParts(first);
  const cur = sofiaParts(after);
  // Day-by-day walk from the day of `after` (≤ 400 days, enough for monthly ends of month).
  for (let k = 0; k <= 400; k++) {
    const dayUtc = Date.UTC(cur.y, cur.m - 1, cur.d + k);
    const dt = new Date(dayUtc);
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    const wd = ((dt.getUTCDay() + 6) % 7) + 1;
    let match = false;
    if (repeat === "daily") match = true;
    else if (repeat === "weekdays") match = wd <= 5;
    else if (repeat === "weekly") match = wd === base.wd;
    else if (repeat === "monthly") match = d === Math.min(base.d, daysIn(y, m));
    if (!match) continue;
    const candidate = fromSofia(y, m, d, base.hh, base.mm);
    if (candidate > after && candidate >= first) return candidate;
  }
  return null;
}

const isStr = (v, max, min = 0) => typeof v === "string" && v.length >= min && v.length <= max;

// Validates and normalises a task from the renderer. -> task | null
export function cleanTask(t, nowDate = new Date()) {
  if (!t || typeof t !== "object") return null;
  if (!isStr(t.title, 120, 1) || !t.title.trim()) return null;
  if (!["reminder", "prompt"].includes(t.kind)) return null;
  if (!isStr(t.text || "", 4000)) return null;
  if (t.kind === "prompt" && !String(t.text || "").trim()) return null;
  const engine = t.engine === "realgpt" ? "realgpt" : "server";
  if (!isStr(t.at, 40, 10) || !Number.isFinite(Date.parse(t.at))) return null;
  const repeat = REPEAT.includes(t.repeat) ? t.repeat : "none";
  const out = {
    id: isStr(t.id, 64, 8) && /^[a-z0-9_-]+$/i.test(t.id) ? t.id : `t_${crypto.randomBytes(6).toString("hex")}`,
    title: t.title.trim(), kind: t.kind, text: String(t.text || ""), engine, at: new Date(t.at).toISOString(), repeat,
    enabled: t.enabled !== false,
  };
  if (t.lastRun && Number.isFinite(Date.parse(t.lastRun))) out.lastRun = new Date(t.lastRun).toISOString();
  if (t.lastResult && typeof t.lastResult === "object") {
    out.lastResult = { ok: !!t.lastResult.ok, ...(isStr(t.lastResult.chatId, 64, 1) ? { chatId: t.lastResult.chatId } : {}), ...(isStr(t.lastResult.error, 300, 1) ? { error: t.lastResult.error } : {}) };
  }
  // The next run after now: a time already past is never run by saving (missed runs are reported by tick()).
  const next = nextRun(out.at, repeat, nowDate);
  out.nextRun = next ? next.toISOString() : null;
  if (!next) out.enabled = false;
  return out;
}

// notify(title, body) -> shows a Windows notification (main.js: Electron Notification, click focuses the window).
export function createScheduled({ secureStore, owner, notify = () => {}, emitDue = () => {}, getSettings = () => ({}), log, now = () => new Date(), setTimer = setInterval, clearTimer = clearInterval }) {
  let timer = null;
  let checkedFor = null; // CRM user whose missed runs were reported in this run of the program

  const uid = () => {
    const id = typeof owner === "function" ? owner() : null;
    return typeof id === "string" && id ? id : null;
  };
  const load = (id) => {
    const saved = id && secureStore.available() ? secureStore.read(`scheduled-${id}`) : null;
    return saved && Array.isArray(saved.items) ? saved.items : [];
  };
  const store = (id, items) => secureStore.write(`scheduled-${id}`, { v: 1, items });

  function list() {
    return { ok: true, items: load(uid()).map((t) => ({ ...t })) };
  }

  function save(task) {
    const id = uid();
    if (!id) return { ok: false, code: "invalid", error: "Не сте влезли в профила си." };
    if (!secureStore.available()) return { ok: false, code: "storage", error: "Шифрирането на Windows не е достъпно – планираните задачи не могат да се пазят." };
    const clean = cleanTask(task, now());
    if (!clean) return { ok: false, code: "invalid", error: "Невалидна задача: заглавие, вид, текст и начален час са задължителни." };
    const items = load(id);
    const i = items.findIndex((t) => t.id === clean.id);
    if (i < 0 && items.length >= MAX_TASKS) return { ok: false, code: "invalid", error: `Най-много ${MAX_TASKS} планирани задачи.` };
    if (i >= 0) items[i] = clean; else items.push(clean);
    store(id, items);
    return { ok: true, item: { ...clean } };
  }

  function remove(taskId) {
    const id = uid();
    if (!id) return { ok: true };
    store(id, load(id).filter((t) => t.id !== taskId));
    return { ok: true };
  }

  function fire(task, missed) {
    const s = (getSettings() || {}).notify || {};
    if (s.scheduled !== false) {
      try {
        if (task.kind === "reminder") notify(missed ? `Пропуснато напомняне: ${task.title}` : task.title, task.text || "Напомняне от Тед");
        else if (missed) notify(`Пропусната задача: ${task.title}`, "Програмата беше затворена. Отворете Тед и натиснете „Изпълни сега“.");
        // A question to Тед that runs on time: the answer appears in a new chat „Планирано: …“ (Настройки → Известия).
        else notify(`Задача на Тед: ${task.title}`, "Тед започна задачата – отговорът е в нов чат „Планирано“.");
      } catch { /* notifications are optional */ }
    }
    try { emitDue({ task: { ...task }, missed: !!missed }); } catch { /* window gone */ }
  }

  // One pass: due tasks fire; runs missed while the program was closed are reported once, never executed.
  function tick() {
    const id = uid();
    if (!id) return;
    const t = now();
    const items = load(id);
    let changed = false;
    const first = checkedFor !== id;
    checkedFor = id;
    for (const task of items) {
      if (!task.enabled || !task.nextRun) continue;
      const due = new Date(task.nextRun);
      if (due > t) continue;
      const missed = first && t - due > 2 * TICK_MS;
      fire(task, missed);
      task.lastRun = t.toISOString();
      const next = nextRun(task.at, task.repeat, t);
      task.nextRun = next ? next.toISOString() : null;
      if (!next) task.enabled = false;
      changed = true;
    }
    if (changed) store(id, items);
  }

  function start() {
    if (timer) return;
    timer = setTimer(() => { try { tick(); } catch (e) { if (log) log.warn("scheduled.tick_failed", { message: String(e.message) }); } }, TICK_MS);
    if (timer && timer.unref) timer.unref();
    try { tick(); } catch { /* next tick */ }
  }
  function stop() {
    if (timer) clearTimer(timer);
    timer = null;
  }
  // CRM user changed: the next tick reports that user's missed runs once.
  function ownerChanged() {
    checkedFor = null;
  }

  return { list, save, remove, tick, start, stop, ownerChanged };
}
