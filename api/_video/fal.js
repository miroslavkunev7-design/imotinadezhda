// fal.ai adapters: Nano Banana Pro Edit + Kling O1 — submit / status / cancel
// Header x-app-fal-disable-fallback: 1 — never silently swap models.
"use strict";

const FAL_BASE = "https://queue.fal.run";
const MODELS = {
  nano_banana_edit: "fal-ai/nano-banana-pro/edit",
  kling_o1_i2v: "fal-ai/kling-video/o1/image-to-video"
};

class FalError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status || 500;
    this.body = body;
  }
}

function key() {
  const k = process.env.FAL_KEY || "";
  if (!k) throw new FalError("FAL_KEY missing", 503);
  return k;
}

function headers(extra) {
  return Object.assign({
    Authorization: "Key " + key(),
    "Content-Type": "application/json",
    "x-app-fal-disable-fallback": "1"
  }, extra || {});
}

async function readJson(res) {
  const t = await res.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch (e) { j = { raw: t }; }
  return j;
}

async function submit(modelKey, input, opts) {
  opts = opts || {};
  const model = MODELS[modelKey] || modelKey;
  if (!MODELS[modelKey] && !String(modelKey).includes("/")) {
    throw new FalError("Unknown fal model key: " + modelKey, 400);
  }
  const url = FAL_BASE + "/" + model;
  const body = Object.assign({}, input);
  if (opts.webhookUrl) body.webhook_url = opts.webhookUrl;
  const res = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const j = await readJson(res);
  if (!res.ok) throw new FalError((j && (j.detail || j.error || j.message)) || ("fal submit HTTP " + res.status), res.status, j);
  return {
    provider: "fal",
    model,
    model_key: modelKey,
    request_id: j.request_id || j.requestId || null,
    status_url: j.status_url || null,
    response_url: j.response_url || null,
    raw: j
  };
}

async function status(modelKey, requestId) {
  const model = MODELS[modelKey] || modelKey;
  const url = FAL_BASE + "/" + model + "/requests/" + encodeURIComponent(requestId) + "/status";
  const res = await fetch(url, { method: "GET", headers: headers() });
  const j = await readJson(res);
  if (!res.ok) throw new FalError((j && (j.detail || j.error || j.message)) || ("fal status HTTP " + res.status), res.status, j);
  return {
    provider: "fal",
    model,
    request_id: requestId,
    status: j.status || j.state || "UNKNOWN",
    raw: j
  };
}

async function cancel(modelKey, requestId) {
  const model = MODELS[modelKey] || modelKey;
  const url = FAL_BASE + "/" + model + "/requests/" + encodeURIComponent(requestId) + "/cancel";
  const res = await fetch(url, { method: "PUT", headers: headers() });
  const j = await readJson(res);
  if (!res.ok && res.status !== 404) {
    throw new FalError((j && (j.detail || j.error || j.message)) || ("fal cancel HTTP " + res.status), res.status, j);
  }
  return { provider: "fal", model, request_id: requestId, cancelled: res.ok || res.status === 404, raw: j };
}

async function result(modelKey, requestId) {
  const model = MODELS[modelKey] || modelKey;
  const url = FAL_BASE + "/" + model + "/requests/" + encodeURIComponent(requestId);
  const res = await fetch(url, { method: "GET", headers: headers() });
  const j = await readJson(res);
  if (!res.ok) throw new FalError((j && (j.detail || j.error || j.message)) || ("fal result HTTP " + res.status), res.status, j);
  return { provider: "fal", model, request_id: requestId, raw: j };
}

module.exports = { MODELS, FalError, submit, status, cancel, result, keyAvailable: () => !!(process.env.FAL_KEY) };
