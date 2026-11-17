// Real GPT agent state in the renderer (docs/CONTRACT.md §8.2, §8.3, §16). Pure reducer + one subscription.
// Every status shown comes from an AgentEvent that MAIN built from a real tool result; nothing is invented here.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ted } from "../bridge.js";
import { rgHistory } from "./chat.js";
import { ensureStitch } from "./stitch.js";

export const AGENT_INIT = {};

const STEP_STATUS = ["run", "ok", "fail", "wait", "denied"];
const MAX_STEPS = 200;
const MAX_FILES = 100;
const EMPTY = Object.freeze({ steps: [], files: [], approvals: [], limited: null, video: null, email: null, canvas: 0 });

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

// One step as MAIN sends it (§8.3). Unknown fields are kept out; label/tool/detail are text only.
function cleanStep(s, old) {
  const base = old || {};
  const out = { ...base, id: String(s.id).slice(0, 40) };
  if (typeof s.kind === "string") out.kind = s.kind.slice(0, 20);
  if (typeof s.label === "string") out.label = s.label.slice(0, 200);
  if (STEP_STATUS.includes(s.status)) out.status = s.status;
  else if (!out.status) out.status = "run";
  if (typeof s.detail === "string") out.detail = s.detail.slice(0, 300);
  if (typeof s.tool === "string") out.tool = s.tool.slice(0, 80);
  if (typeof s.mutating === "boolean") out.mutating = s.mutating;
  if (typeof s.startedAt === "string") out.startedAt = s.startedAt;
  if (typeof s.endedAt === "string") out.endedAt = s.endedAt;
  if (!out.label) out.label = "Стъпка";
  return out;
}

const upsert = (list, item, max) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) return list.map((x, k) => (k === i ? item : x));
  return list.length >= max ? list : [...list, item];
};

// Pure: (state, AgentEvent) -> state. State is keyed by requestId; an unknown or malformed event leaves it unchanged.
// Renderer-internal event: {type:"decided", requestId, approvalId} drops an answered approval.
export function agentReduce(state, ev) {
  const s = isObj(state) ? state : AGENT_INIT;
  if (!isObj(ev) || typeof ev.requestId !== "string" || !ev.requestId || typeof ev.type !== "string") return s;
  const rid = ev.requestId;
  const cur = s[rid] || EMPTY;
  let next = cur;
  switch (ev.type) {
    case "step": {
      if (!isObj(ev.step) || ev.step.id == null) return s;
      const old = cur.steps.find((x) => x.id === String(ev.step.id).slice(0, 40));
      next = { ...cur, steps: upsert(cur.steps, cleanStep(ev.step, old), MAX_STEPS) };
      break;
    }
    case "file": {
      if (!isObj(ev.file) || typeof ev.file.id !== "string") return s;
      const f = { ...ev.file, ...(typeof ev.stepId === "string" ? { stepId: ev.stepId } : {}) };
      next = { ...cur, files: upsert(cur.files, f, MAX_FILES) };
      break;
    }
    case "approval": {
      if (!isObj(ev.approval) || typeof ev.approval.id !== "string") return s;
      next = { ...cur, approvals: upsert(cur.approvals, ev.approval, 20) };
      break;
    }
    case "decided": {
      if (typeof ev.approvalId !== "string" || !cur.approvals.some((a) => a.id === ev.approvalId)) return s;
      next = { ...cur, approvals: cur.approvals.filter((a) => a.id !== ev.approvalId) };
      break;
    }
    case "limit":
      next = { ...cur, limited: { rounds: Number(ev.rounds) || 0, calls: Number(ev.calls) || 0 } };
      break;
    case "email":
      if (!isObj(ev.email)) return s;
      next = { ...cur, email: ev.email };
      break;
    case "video":
      if (!isObj(ev.job) || typeof ev.job.id !== "string") return s;
      next = { ...cur, video: { jobId: ev.job.id, status: str(ev.job.status, 20) } };
      break;
    case "canvas":
      // The shell stores the canvas text itself (a NEW version); here only the count is kept.
      if (!isObj(ev.canvas)) return s;
      next = { ...cur, canvas: (cur.canvas || 0) + 1 };
      break;
    default:
      return s;
  }
  return next === cur ? s : { ...s, [rid]: next };
}

// What is persisted on the finished message (no bytes, no pending approvals – §16 "Message data").
export function agentSnapshot(state, requestId) {
  const a = (isObj(state) && state[requestId]) || EMPTY;
  return {
    steps: a.steps.map((x) => ({ ...x })),
    files: a.files.map((f) => {
      const { stepId: _s, ...rest } = f;
      return rest;
    }),
    ...(a.limited ? { limited: { ...a.limited } } : {}),
    ...(a.video ? { video: { ...a.video } } : {}),
    ...(a.email ? { email: a.email } : {}),
  };
}

// The messages array of ted.realgpt.send (§8.2): earlier Real GPT exchanges (rgHistory) + the current question.
// payload = {text, images?:[{mime,data}], fileIds?:[id]} as prepared by the shell; files only on user messages, ≤ 10.
export function rgMessages(prior, userMsg, payload) {
  const p = payload || {};
  const out = rgHistory(Array.isArray(prior) ? prior : []);
  const cur = { role: "user", text: String(p.text != null ? p.text : (userMsg && userMsg.text) || "") };
  if (Array.isArray(p.images) && p.images.length) cur.images = p.images.filter((i) => i && i.mime && i.data);
  const ids = (Array.isArray(p.fileIds) ? p.fileIds : []).filter((id) => typeof id === "string" && /^[a-z0-9_-]{8,64}$/.test(id));
  if (ids.length) cur.files = ids.slice(0, 10);
  out.push(cur);
  return out;
}

/* ---------- Video jobs that wait for the agent's approval card ----------
   The chat shows both the „Платено AI видео“ approval card and the VideoCard of the same job; only the approval
   card may start it (MAIN's loop waits for that answer). This small store tells the VideoCard which jobs are
   waiting there, so it shows a pointer instead of a second „Започни“ button. */
const lastJobOf = new Map();       // requestId -> jobId of the newest "video" event
const viaApproval = new Set();     // jobIds whose approval card is (or was) shown in a chat
const approvalSubs = new Set();
const notify = () => approvalSubs.forEach((f) => f());
export function noteAgentEvent(ev) {
  if (!isObj(ev) || typeof ev.requestId !== "string") return;
  if (ev.type === "video" && isObj(ev.job) && typeof ev.job.id === "string") lastJobOf.set(ev.requestId, ev.job.id);
  else if (ev.type === "approval" && isObj(ev.approval) && ev.approval.kind === "video") {
    const jobId = lastJobOf.get(ev.requestId);
    if (jobId && !viaApproval.has(jobId)) { viaApproval.add(jobId); notify(); }
  }
}
export function useVideoViaApproval(jobId) {
  return useSyncExternalStore(
    (cb) => { approvalSubs.add(cb); return () => approvalSubs.delete(cb); },
    () => !!jobId && viaApproval.has(jobId),
    () => false,
  );
}

const has = (group, fn) => !!(ted && ted[group] && typeof ted[group][fn] === "function");

// Subscribes ted.realgpt.onEvent once (and ted.video.onEvent, so a finished set of video parts is stitched even
// when its card is not on screen). Returns [state, reset(requestId)].
export function useAgentEvents() {
  const [state, setState] = useState(AGENT_INIT);
  useEffect(() => {
    const offs = [];
    if (has("realgpt", "onEvent")) {
      offs.push(ted.realgpt.onEvent((ev) => { noteAgentEvent(ev); setState((st) => agentReduce(st, ev)); }));
    }
    if (has("video", "onEvent")) offs.push(ted.video.onEvent((job) => { if (isObj(job) && job.status === "stitch") ensureStitch(job); }));
    return () => offs.forEach((un) => { if (typeof un === "function") un(); });
  }, []);
  const reset = useCallback((requestId) => setState((st) => {
    if (!st[requestId]) return st;
    const n = { ...st };
    delete n[requestId];
    return n;
  }), []);
  return [state, reset];
}

/* ---------- Plain Bulgarian texts shared by the cards ---------- */
export const STEP_TEXT = { run: "изпълнява се", ok: "готово", fail: "неуспешно", wait: "чака вашето решение", denied: "отказано" };
export const STEP_DOT = { run: "running", ok: "succeeded", fail: "failed", wait: "waiting_for_input", denied: "cancelled" };

// Header status of the „Изпълнение“ card from the real step statuses.
export function stepsSummary(steps, live) {
  const list = Array.isArray(steps) ? steps : [];
  const n = (st) => list.filter((x) => x.status === st).length;
  const changed = list.some((x) => x.mutating && x.status === "ok");
  if (!list.length) return { status: "queued", label: "Няма стъпки", changed };
  if (n("wait")) return { status: "waiting_for_input", label: "Чака вашето решение", changed };
  if (n("run")) return live ? { status: "running", label: "Изпълнява се", changed } : { status: "cancelled", label: "Прекъснато", changed };
  const ok = n("ok");
  if (ok === list.length) return { status: "succeeded", label: "Изпълнено", changed };
  if (!ok) return { status: "failed", label: n("denied") === list.length ? "Отказано" : "Неуспешно", changed };
  return { status: "partially_succeeded", label: "Частично изпълнено", changed };
}

// Seconds between two ISO times, or "".
export function stepTime(s) {
  const a = Date.parse(s && s.startedAt);
  const b = Date.parse(s && s.endedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return "";
  const sec = (b - a) / 1000;
  return sec < 1 ? "< 1 с" : sec < 60 ? Math.round(sec) + " с" : Math.floor(sec / 60) + " мин " + Math.round(sec % 60) + " с";
}

// Video estimate exactly as MAIN/crm-video.js: parts × length × price ($/s), minutes ≈ max(2, ceil(parts/3) × 2).
export function videoEstimate(parts, engine, duration) {
  const n = Math.max(0, Number(parts) || 0);
  const d = Number(duration) || 0;
  const price = Number(engine && engine.price) || 0;
  return { n, sec: n * d, cost: Math.round(n * d * price * 100) / 100, min: Math.max(2, Math.ceil(n / 3) * 2) };
}
export const fmtUsd = (v) => "$" + (Number(v) || 0).toFixed(2).replace(".", ",");
