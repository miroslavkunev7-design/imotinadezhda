// /api/video — Settings Electron trusted video API (NOT the public site TED chat).
// Requires Authorization: Bearer <staff> and x-imoti-client: settings.
"use strict";

const crypto = require("crypto");
const VIDEO = require("./_video/index.js");
const { jobs, fal } = VIDEO;

const SB_URL = jobs.SB_URL;
const SB_PUB = jobs.SB_PUB;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-imoti-client, x-video-hmac");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  req._rawBody = raw;
  if (!raw.length) return {};
  return JSON.parse(raw.toString("utf8"));
}

function hdrs(req) {
  return req.headers || {};
}

async function staffOf(token) {
  if (!token) return null;
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_PUB, Authorization: "Bearer " + token } });
  if (!u.ok) return null;
  const user = await u.json();
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", {
    method: "POST",
    headers: { apikey: SB_PUB, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: "{}"
  });
  return r.ok && (await r.json()) === true ? user : null;
}

function verifyHmac(raw, signature) {
  const secret = process.env.MEDIA_WORKER_SECRET || process.env.VIDEO_EVENTS_HMAC_SECRET || "";
  if (!secret) return false;
  const mac = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(String(signature || "").replace(/^sha256=/i, ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});

  const url = new URL(req.url || "/", "http://local");
  const action = (url.searchParams.get("action") || "").toLowerCase();

  try {
    // Internal events from media worker / Settings n8n (HMAC) — no staff bearer
    if (req.method === "POST" && (action === "events" || action === "event")) {
      const body = await readBody(req);
      const sig = hdrs(req)["x-video-hmac"] || hdrs(req)["x-hmac-signature"];
      const raw = req._rawBody || Buffer.from(JSON.stringify(body));
      if (!verifyHmac(raw, sig) && process.env.NODE_ENV === "production" && (process.env.MEDIA_WORKER_SECRET || process.env.VIDEO_EVENTS_HMAC_SECRET)) {
        return send(res, 401, { ok: false, error: "Invalid HMAC" });
      }
      const job = await jobs.applyEvent(body);
      return send(res, 200, { ok: true, job: await jobs.jobPublicView(job) });
    }

    // fal adapter passthrough for Settings worker / n8n (service HMAC or staff+settings)
    if (req.method === "POST" && action === "fal") {
      const body = await readBody(req);
      const sig = hdrs(req)["x-video-hmac"];
      const raw = req._rawBody || Buffer.from(JSON.stringify(body));
      const hmacOk = verifyHmac(raw, sig);
      if (!hmacOk) {
        const auth = String(hdrs(req).authorization || "");
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        const user = await staffOf(token);
        if (!user) return send(res, 401, { ok: false, error: "Unauthorized" });
        jobs.assertSettingsClient(hdrs(req));
      }
      const op = body.op || "submit";
      if (op === "submit") return send(res, 200, { ok: true, result: await fal.submit(body.model_key, body.input || {}, { webhookUrl: body.webhook_url }) });
      if (op === "status") return send(res, 200, { ok: true, result: await fal.status(body.model_key, body.request_id) });
      if (op === "cancel") return send(res, 200, { ok: true, result: await fal.cancel(body.model_key, body.request_id) });
      return send(res, 400, { ok: false, error: "Unknown fal op" });
    }

    const auth = String(hdrs(req).authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const user = await staffOf(token);
    if (!user) return send(res, 401, { ok: false, error: "Sign in as staff (Settings app)" });

    if (req.method === "GET" && (action === "skill" || action === "registry")) {
      const row = await jobs.registryRow();
      return send(res, 200, {
        ok: true,
        skill_id: jobs.SKILL,
        enabled: !!(row && row.enabled) || jobs.featureEnabled(),
        label_bg: (row && row.label_bg) || "Видео за имот",
        config: (row && row.config) || {},
        site_chat: false,
        note: "Settings Electron only — not registered on imotinadezhda.bg TED"
      });
    }

    if (req.method === "GET" && (action === "status" || action === "job")) {
      const id = url.searchParams.get("job_id");
      if (!id) return send(res, 400, { ok: false, error: "job_id required" });
      const job = await jobs.getJob(id, user.id);
      return send(res, 200, { ok: true, ...(await jobs.jobPublicView(job)) });
    }

    if (req.method === "GET" && action === "list") {
      const list = await jobs.listJobsForActor(user.id, url.searchParams.get("limit"));
      const views = [];
      for (const j of list || []) views.push(await jobs.jobPublicView(j));
      return send(res, 200, { ok: true, jobs: views });
    }

    if (req.method === "GET" && action === "download") {
      const id = url.searchParams.get("job_id");
      if (!id) return send(res, 400, { ok: false, error: "job_id required" });
      const job = await jobs.getJob(id, user.id);
      const view = await jobs.jobPublicView(job);
      if (!view.download_url) return send(res, 409, { ok: false, error: "Video not ready", status: job.status });
      return send(res, 200, { ok: true, download_url: view.download_url, play_url: view.play_url, job_id: id });
    }

    if (req.method === "POST" && (action === "create" || action === "" || !action)) {
      jobs.assertSettingsClient(hdrs(req));
      const body = await readBody(req);
      const r = await jobs.createJob(
        { userId: user.id, email: user.email || "", headers: hdrs(req) },
        body,
        hdrs(req)
      );
      const view = await jobs.jobPublicView(r.job);
      return send(res, r.created ? 201 : 200, { ok: true, job_id: r.job.id, created: r.created, reused: r.reused, ...view });
    }

    return send(res, 404, { ok: false, error: "Unknown action. Use create|status|list|download|skill|events|fal" });
  } catch (e) {
    const status = e && e.status ? e.status : 500;
    return send(res, status, { ok: false, error: e && e.message ? e.message : String(e) });
  }
};
