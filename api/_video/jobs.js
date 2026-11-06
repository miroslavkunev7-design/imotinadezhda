// Trusted-context job create / status helpers (actor from server auth, never $fromAI).
"use strict";

const crypto = require("crypto");
const prompts = require("./prompts.js");

const SB_URL = process.env.ND_SUPABASE_URL || "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_PUB = process.env.ND_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const BUCKET = "nd-files";
const SKILL = "property_cinematic_video";

class VideoError extends Error {
  constructor(m, status) { super(m); this.status = status || 400; }
}

function envOn(name) {
  const v = String(process.env[name] || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Master pipeline flag (also used for rollout). Site chat must stay off. */
function featureEnabled() {
  return envOn("VIDEO_FEATURE_ENABLED") || envOn("SETTINGS_VIDEO_ENABLED");
}

/** Settings Electron client gate — public site TED must not call create. */
function assertSettingsClient(headers) {
  const h = headers || {};
  const client = String(h["x-imoti-client"] || h["X-Imoti-Client"] || "").toLowerCase();
  if (client !== "settings") {
    throw new VideoError("cinematic_property_video is Settings-app only (x-imoti-client: settings)", 403);
  }
}

function budgetDefault() {
  const n = Number(process.env.VIDEO_MAX_JOB_USD || 15);
  return isFinite(n) && n > 0 ? n : 15;
}

function serviceHeaders() {
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sr) throw new VideoError("SUPABASE_SERVICE_ROLE_KEY missing on server", 503);
  return { apikey: sr, Authorization: "Bearer " + sr, "Content-Type": "application/json", Prefer: "return=representation" };
}

async function rest(path, opts) {
  const res = await fetch(SB_URL + "/rest/v1/" + path, opts);
  const text = await res.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch (e) { j = { raw: text }; }
  if (!res.ok) throw new VideoError((j && (j.message || j.error || j.hint)) || ("rest " + res.status), res.status);
  return j;
}

async function storageUpload(path, buf, mime) {
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sr) throw new VideoError("SUPABASE_SERVICE_ROLE_KEY missing", 503);
  const res = await fetch(SB_URL + "/storage/v1/object/" + BUCKET + "/" + path.split("/").map(encodeURIComponent).join("/"), {
    method: "POST",
    headers: { apikey: sr, Authorization: "Bearer " + sr, "Content-Type": mime || "application/octet-stream", "x-upsert": "true" },
    body: buf
  });
  if (!res.ok) {
    const t = await res.text();
    throw new VideoError("storage upload failed: " + t.slice(0, 200), 500);
  }
}

async function signedUrl(path, secs) {
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(SB_URL + "/storage/v1/object/sign/" + BUCKET + "/" + path.split("/").map(encodeURIComponent).join("/"), {
    method: "POST",
    headers: { apikey: sr, Authorization: "Bearer " + sr, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: secs || 86400 })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new VideoError((j && j.message) || "sign failed", res.status);
  const u = j.signedURL || j.signedUrl;
  return u.startsWith("http") ? u : (SB_URL + "/storage/v1" + u);
}

async function registryRow() {
  const rows = await rest("ai_video_skill_registry?skill_key=eq." + encodeURIComponent(SKILL) + "&select=*", {
    method: "GET", headers: serviceHeaders()
  });
  return (rows && rows[0]) || null;
}

function stageLabel(status) {
  const map = {
    queued: "На опашка",
    planning: "Планиране",
    prep: "Подготовка на кадри",
    clipping: "Генериране на клипове",
    assembling: "Сглобяване",
    qa: "Проверка",
    ready: "Готово",
    failed: "Неуспех",
    cancelled: "Отменено"
  };
  return map[status] || status;
}

/**
 * Idempotent create. Trusted context: actor_user_id / email from auth — never from client body.
 * photos: [{ mime, data_base64, name? }] length 4–10
 */
async function createJob(trusted, input, headers) {
  assertSettingsClient(headers || trusted.headers || {});
  if (!featureEnabled()) {
    const reg = await registryRow().catch(() => null);
    if (!(reg && reg.enabled)) {
      throw new VideoError("Видео за имот е изключено (SETTINGS_VIDEO_ENABLED / VIDEO_FEATURE_ENABLED / registry)", 403);
    }
  }
  const mode = input.mode === "PROJECT_VISUALIZATION" ? "PROJECT_VISUALIZATION" : "REAL_PROPERTY";
  if (mode === "PROJECT_VISUALIZATION" && !input.explicit_project_viz) {
    throw new VideoError("PROJECT_VISUALIZATION изисква изрично потвърждение", 400);
  }
  const photos = Array.isArray(input.photos) ? input.photos : [];
  if (photos.length < 4 || photos.length > 10) throw new VideoError("Нужни са 4–10 снимки (получени: " + photos.length + ")", 400);

  const idem = String(input.idempotency_key || "").trim() || crypto.randomUUID();
  const existing = await rest("ai_video_jobs?idempotency_key=eq." + encodeURIComponent(idem) + "&select=*", {
    method: "GET", headers: serviceHeaders()
  });
  if (existing && existing[0]) {
    return { job: existing[0], created: false, reused: true };
  }

  const jobRows = await rest("ai_video_jobs", {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      idempotency_key: idem,
      skill_key: SKILL,
      status: "queued",
      mode,
      actor_user_id: trusted.userId,
      actor_email: trusted.email || null,
      property_id: input.property_id || null,
      session_id: input.session_id || null,
      photo_count: photos.length,
      budget_usd: budgetDefault(),
      progress: { stage: "queued", label: stageLabel("queued"), pct: 2, message: "Задачата е приета" }
    })
  });
  const job = Array.isArray(jobRows) ? jobRows[0] : jobRows;
  if (!job || !job.id) throw new VideoError("Неуспешен запис на задача", 500);

  const assetRows = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const mime = p.mime || "image/jpeg";
    const buf = Buffer.from(p.data || p.data_base64 || "", "base64");
    if (!buf.length) throw new VideoError("Празна снимка #" + (i + 1), 400);
    if (buf.length > 12 * 1048576) throw new VideoError("Снимка #" + (i + 1) + " е над 12 MB", 400);
    const ext = /png/i.test(mime) ? "png" : (/webp/i.test(mime) ? "webp" : (/heic/i.test(mime) ? "heic" : "jpg"));
    const path = "video/" + job.id + "/source/" + String(i + 1).padStart(2, "0") + "." + ext;
    await storageUpload(path, buf, mime);
    assetRows.push({
      job_id: job.id,
      kind: "source_photo",
      storage_path: path,
      mime,
      bytes: buf.length,
      meta: { index: i, name: p.name || null }
    });
  }
  await rest("ai_video_assets", { method: "POST", headers: serviceHeaders(), body: JSON.stringify(assetRows) });

  await rest("ai_video_events", {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ job_id: job.id, kind: "job.created", payload: { photo_count: photos.length, mode, prompts: prompts.list().map((x) => x.key) } })
  });

  await rest("ai_video_outbox", {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      job_id: job.id,
      topic: "ted.video.dispatch",
      payload: { job_id: job.id, mode, photo_count: photos.length },
      status: "pending"
    })
  });

  // Best-effort kick to n8n dispatcher if configured
  const hook = process.env.VIDEO_DISPATCH_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.id, topic: "ted.video.dispatch" })
      });
    } catch (e) { /* reconciler will retry outbox */ }
  }

  return { job, created: true, reused: false };
}

async function getJob(jobId, actorUserId) {
  const rows = await rest("ai_video_jobs?id=eq." + encodeURIComponent(jobId) + "&select=*", {
    method: "GET", headers: serviceHeaders()
  });
  const job = rows && rows[0];
  if (!job) throw new VideoError("Задачата не е намерена", 404);
  if (actorUserId && job.actor_user_id !== actorUserId) throw new VideoError("Няма достъп до тази задача", 403);
  return job;
}

async function listJobsForActor(actorUserId, limit) {
  const lim = Math.min(50, Math.max(1, Number(limit) || 10));
  return rest(
    "ai_video_jobs?actor_user_id=eq." + encodeURIComponent(actorUserId) +
      "&select=*&order=created_at.desc&limit=" + lim,
    { method: "GET", headers: serviceHeaders() }
  );
}

async function jobPublicView(job) {
  const view = {
    job_id: job.id,
    status: job.status,
    mode: job.mode,
    progress: job.progress || {},
    label: stageLabel(job.status),
    photo_count: job.photo_count,
    cost_usd: job.cost_usd,
    budget_usd: job.budget_usd,
    error: job.error || null,
    created_at: job.created_at,
    updated_at: job.updated_at,
    play_url: null,
    download_url: null
  };
  if (job.status === "ready" && job.result && job.result.storage_path) {
    try {
      const url = await signedUrl(job.result.storage_path, 7 * 86400);
      view.play_url = url;
      view.download_url = url;
      view.duration_sec = job.result.duration_sec || null;
    } catch (e) {
      view.error = view.error || "Подписаният линк не е наличен";
    }
  }
  return view;
}

async function applyEvent(body) {
  const jobId = body.job_id;
  if (!jobId) throw new VideoError("job_id required", 400);
  const job = await getJob(jobId);
  const patch = {};
  if (body.status) patch.status = body.status;
  if (body.progress) patch.progress = body.progress;
  if (body.result) patch.result = Object.assign({}, job.result || {}, body.result);
  if (body.error != null) patch.error = body.error;
  if (body.cost_usd != null) patch.cost_usd = body.cost_usd;
  patch.updated_at = new Date().toISOString();
  if (Object.keys(patch).length) {
    await rest("ai_video_jobs?id=eq." + encodeURIComponent(jobId), {
      method: "PATCH", headers: serviceHeaders(), body: JSON.stringify(patch)
    });
  }
  await rest("ai_video_events", {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({ job_id: jobId, kind: body.kind || "pipeline.event", payload: body })
  });
  return getJob(jobId);
}

module.exports = {
  VideoError,
  SKILL,
  featureEnabled,
  assertSettingsClient,
  createJob,
  getJob,
  listJobsForActor,
  jobPublicView,
  applyEvent,
  signedUrl,
  stageLabel,
  registryRow,
  prompts,
  SB_URL,
  SB_PUB
};
