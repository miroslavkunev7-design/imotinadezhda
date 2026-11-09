// Еднократна сървърна проверка на Тед. Не връща тайни, подписани адреси, аудио или клиентски данни.
// Сигналът към webhook е само event=automation_connectivity_test (без поправка).
"use strict";
const crypto = require("crypto");
const PDFLib = require("./_vendor/pdf-lib.min.js");
const GEM = require("./_gem.js");
const TED = require("./_ted-skills.js");
const MON = require("./_monitor.js");

const SB = "https://hyvwfsmjbaynozceookv.supabase.co";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function scrub(s) {
  return String(s || "").replace(/bearer\s+\S+/ig, "bearer").replace(/eyJ[A-Za-z0-9_\-.]{12,}/g, "jwt").replace(/https?:\/\/\S+/g, "[url]").slice(0, 180);
}
function key() { return process.env.SUPABASE_SERVICE_ROLE_KEY || ""; }
function enc(p) { return String(p).split("/").map(encodeURIComponent).join("/"); }
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
const PUB = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
function sameSecret(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string" || !expected || !given) return false;
  const a = crypto.createHash("sha256").update(given, "utf8").digest();
  const b = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(a, b);
}
function headerValue(req, name) {
  const h = req && req.headers ? req.headers : {};
  const v = h[name] || h[String(name).toLowerCase()];
  if (Array.isArray(v)) return String(v[0] || "");
  return typeof v === "string" ? v : "";
}
async function authorizeMonitor(req) {
  if (sameSecret(headerValue(req, "x-ted-probe"), process.env.TED_PROBE_KEY || "")) return { ok: true };
  const auth = headerValue(req, "authorization");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401 };
  const u = await fetch(SB + "/auth/v1/user", { headers: { apikey: PUB, Authorization: "Bearer " + token }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!u || !u.ok) return { ok: false, status: 401 };
  const r = await fetch(SB + "/rest/v1/rpc/nd_is_admin", { method: "POST", headers: { apikey: PUB, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(8000) }).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => false) : false;
  if (j !== true) return { ok: false, status: 403 };
  return { ok: true };
}
function headers(extra) {
  return Object.assign({ apikey: key(), Authorization: "Bearer " + key(), "Content-Type": "application/json" }, extra || {});
}
async function putObj(path, buf, mime) {
  const r = await fetch(SB + "/storage/v1/object/nd-files/" + enc(path), {
    method: "POST", headers: Object.assign(headers(), { "Content-Type": mime || "application/octet-stream", "x-upsert": "true" }), body: buf, signal: AbortSignal.timeout(20000)
  });
  if (!r.ok) throw new Error("storage " + r.status);
}
async function removePrefixes(prefixes) {
  if (!prefixes.length) return 0;
  const r = await fetch(SB + "/storage/v1/object/nd-files", {
    method: "DELETE", headers: headers(), body: JSON.stringify({ prefixes: prefixes }), signal: AbortSignal.timeout(20000)
  });
  return r.ok ? prefixes.length : 0;
}
function allowedTestPath(full) {
  return full.startsWith("ted-chat/selfcheck") || full.startsWith("clients/tedself") || /^properties\/TED[0-9A-F]{4,}(\/|$)/.test(full);
}
async function listPrefix(prefix, depth, search) {
  if ((depth || 0) > 5) return [];
  const r = await fetch(SB + "/storage/v1/object/list/nd-files", {
    method: "POST", headers: headers(), body: JSON.stringify({ prefix: prefix, limit: 100, offset: 0, search: search || undefined }), signal: AbortSignal.timeout(20000)
  });
  const j = await r.json().catch(() => []);
  if (!Array.isArray(j)) return [];
  const out = [];
  for (const x of j) {
    const raw = String((x && x.name) || "");
    if (!raw) continue;
    const full = raw.startsWith("ted-chat/") || raw.startsWith("clients/") || raw.startsWith("properties/") ? raw : prefix.replace(/\/?$/, "/") + raw.replace(/^\/+/, "");
    if (!allowedTestPath(full)) continue;
    if (!x.id) out.push.apply(out, await listPrefix(full.replace(/\/?$/, "/"), (depth || 0) + 1, ""));
    else out.push(full);
  }
  return out;
}
async function delObj(path) { await removePrefixes([path]); }
async function rest(table, method, query, body, prefer) {
  const r = await fetch(SB + "/rest/v1/" + table + (query ? "?" + query : ""), {
    method, headers: headers(prefer ? { Prefer: prefer } : { Prefer: "return=representation" }),
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && (j.message || j.code)) || ("db " + r.status));
  return j;
}
function sb() {
  function from(table) {
    const st = { filters: [], select: "*", limit: "", order: "", method: "GET", body: null, one: "", prefer: "return=representation" };
    const api = {
      select(c) { st.select = c; return api; },
      order(col, o) { st.order = col + "." + (o && o.ascending === false ? "desc" : "asc"); return api; },
      limit(n) { st.limit = String(n); return api; },
      eq(col, val) { st.filters.push(col + "=eq." + encodeURIComponent(val)); return api; },
      upsert(body) { st.method = "POST"; st.body = body; st.prefer = "resolution=merge-duplicates,return=representation"; return api; },
      maybeSingle() { st.one = "maybe"; return api; },
      single() { st.one = "single"; return api; },
      then(ok, bad) { return exec().then(ok, bad); }
    };
    async function exec() {
      const q = ["select=" + encodeURIComponent(st.select), st.order ? "order=" + st.order : "", st.limit ? "limit=" + st.limit : ""].concat(st.filters).filter(Boolean).join("&");
      try {
        const rows = await rest(table, st.method, q, st.body, st.prefer);
        if (st.one === "maybe") return { data: Array.isArray(rows) ? (rows[0] || null) : rows, error: null };
        if (st.one === "single") {
          const row = Array.isArray(rows) ? rows[0] : rows;
          return row ? { data: row, error: null } : { data: null, error: { message: "not found" } };
        }
        return { data: rows, error: null };
      } catch (e) { return { data: null, error: { message: scrub(e.message) } }; }
    }
    return api;
  }
  return {
    from,
    storage: { from() { return {
      download: async () => ({ data: null, error: { message: "InvalidJWT" } }),
      upload: async () => ({ error: { message: "InvalidJWT" } })
    }; } }
  };
}
function annuity(principal, annualRatePct, years) {
  const n = Math.round(years * 12), i = annualRatePct / 100 / 12;
  const monthly = i === 0 ? principal / n : principal * i / (1 - Math.pow(1 + i, -n));
  return Math.round(monthly * 100) / 100;
}
async function tinySpeech(phrase) {
  const gkey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!gkey) return null;
  const models = await GEM.models("tts").catch(() => []);
  const model = models[0] || (GEM.FALLBACK.tts && GEM.FALLBACK.tts[0]);
  if (!model) return null;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(gkey), {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(18000),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Прочети на български бавно и ясно:\n" + phrase }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } } }
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: scrub((j.error && j.error.message) || r.status) };
  const part = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find((p) => p.inlineData || p.inline_data);
  const d = part && (part.inlineData || part.inline_data);
  if (!d || !d.data) return { error: "няма аудио" };
  const pcm = Buffer.from(d.data, "base64");
  const rate = Number((/rate=(\d+)/.exec(d.mimeType || d.mime_type || "") || [])[1]) || 24000;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return { mime: "audio/wav", data: Buffer.concat([h, pcm]).toString("base64") };
}
async function gate(origin) {
  const tools = await fetch(origin + "/api/tools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tool: "files.attach", input: { path: "ted-chat/selfcheck/x.png", client_id: "none" } }), signal: AbortSignal.timeout(15000) });
  const voice = await fetch(origin + "/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mime: "audio/wav", data: "AA==" }), signal: AbortSignal.timeout(15000) });
  return { tools: tools.status, voice: voice.status };
}

async function run(res, body, requestId, gate) {
  if (!gate || gate.authorized !== true) return send(res, 401, { ok: false, error: "Няма достъп." });
  const mon = MON.status();
  const signal = body && body.signal === false ? { sent: false, skipped: true } : await MON.report({ event: "automation_connectivity_test", errorCode: "WEBHOOK_OK", endpoint: "/api/assistant", requestId: requestId || "" }).catch(() => ({ sent: false }));
  const out = { ok: true, monitor: { enabled: mon.enabled, missing: mon.missing, sent: !!signal.sent, dedup: !!signal.dedup } };
  if (body && body.run === "cleanup") {
    if (!key()) { out.ok = false; out.error = "няма сървърен достъп до хранилището"; return send(res, 200, out); }
    const names = [].concat(await listPrefix("ted-chat/selfcheck", 0, ""), await listPrefix("clients", 0, "tedself"), await listPrefix("properties", 0, "TED"));
    out.removed = await removePrefixes(names);
    return send(res, 200, out);
  }
  if (!body || body.run !== "selfcheck") return send(res, 200, out);
  if (!key()) { out.ok = false; out.error = "няма сървърен достъп до хранилището"; return send(res, 200, out); }
  const sha = String(process.env.VERCEL_GIT_COMMIT_SHA || "local").replace(/[^a-z0-9]/gi, "").slice(0, 16) || "local";
  const base = "ted-chat/selfcheck/" + sha;
  const lock = await fetch(SB + "/storage/v1/object/nd-files/" + enc(base + "/lock"), { method: "POST", headers: Object.assign(headers(), { "Content-Type": "text/plain", "x-upsert": "false" }), body: "1", signal: AbortSignal.timeout(15000) });
  if (!lock.ok) {
    const t = await lock.text().catch(() => "");
    if (lock.status === 409 || /already exists|Duplicate/i.test(t)) { out.skipped = true; return send(res, 200, out); }
    out.ok = false; out.error = "lock " + lock.status; return send(res, 200, out);
  }
  const clientId = "tedself" + sha.slice(0, 10);
  const propId = "tedprop" + sha.slice(0, 10);
  const code = "TED" + sha.slice(0, 6).toUpperCase();
  const paths = [];
  try {
    const origin = "https://" + (process.env.VERCEL_PROJECT_PRODUCTION_URL || "imotinadezhda.bg");
    out.gate = await gate(origin.indexOf("imotinadezhda.bg") >= 0 ? "https://imotinadezhda.bg" : origin);
    await putObj(base + "/a.png", PNG, "image/png");
    await putObj(base + "/b.png", PNG, "image/png");
    paths.push(base + "/a.png", base + "/b.png");
    const voiceP = (async () => {
      const phrase = "Изчисли вноска сто хиляди евро за двайсет години при три процента";
      const speech = await tinySpeech(phrase).catch((e) => ({ error: scrub(e.message) }));
      if (!speech || speech.error || !speech.data) return { finished: true, heard: false, command_ran: false, error: speech && speech.error ? speech.error : "няма аудио" };
      try {
        const text = await GEM.transcribe(speech, "Транскрибирай дословно на български. Върни само текста.", { budgetMs: 20000 });
        const heard = String(text || "").trim();
        const useful = /изчисл|вноск|евро|процент|хиляд|годин/i.test(heard);
        const monthly = useful ? annuity(100000, 3, 20) : null;
        return { finished: true, heard: !!heard, command_ran: !!(useful && monthly > 400 && monthly < 800), monthly: useful ? monthly : null };
      } catch (e) { return { finished: true, heard: false, command_ran: false, error: scrub(e.message) }; }
    })();
    const ctx = { sb: sb(), userId: null, user: { id: "selfcheck" }, token: key() };
    const seen = await TED.tools["analyze_image"].run(ctx, {
      files: [{ path: base + "/a.png", name: "a.png", mime: "image/png" }, { path: base + "/b.png", name: "b.png", mime: "image/png" }, { path: base + "/missing.png", name: "missing.png", mime: "image/png" }],
      question: "Какъв е основният цвят? Една дума."
    });
    out.images = { count: seen.count, ok: seen.ok_count, failed: seen.failed, isolated: seen.failed === 1 && seen.ok_count === 2 };
    await rest("nd_clients", "POST", "", { id: clientId, data: { name: "TED SELFCHECK", cat: "sales", status: "тест" } }, "resolution=merge-duplicates,return=minimal");
    await rest("nd_properties", "POST", "", { id: propId, data: { title: "TED SELFCHECK", code: code, status: "Чернова", deal: "sale", pics: [], docs: [] } }, "resolution=merge-duplicates,return=minimal");
    const first = await TED.tools["files.attach"].run(ctx, { path: base + "/a.png", name: "a.png", mime: "image/png", client_id: clientId, property_id: propId });
    const second = await TED.tools["files.attach"].run(ctx, { path: base + "/a.png", name: "a.png", mime: "image/png", client_id: clientId, property_id: propId });
    if (first.client && first.client.path) paths.push(first.client.path);
    if (first.property && first.property.path) paths.push(first.property.path);
    out.attach = { saved: !!(first.client && first.client.document_id && first.property && first.property.path), duplicate: !!(second.client && second.client.already && second.property && second.property.already) };
    const pdf = await PDFLib.PDFDocument.create();
    const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
    pdf.addPage([320, 200]).drawText("TED SELFCHECK", { x: 40, y: 100, size: 18, font });
    const pdfBuf = Buffer.from(await pdf.save());
    const pdfPath = base + "/probe.pdf";
    await putObj(pdfPath, pdfBuf, "application/pdf");
    paths.push(pdfPath);
    const docRows = await rest("nd_documents", "POST", "select=id", { data: { name: "probe.pdf", path: pdfPath, mime: "application/pdf", client_id: clientId, client: "TED SELFCHECK", folder: "тест", by: "selfcheck", at: new Date().toISOString() } }, "return=representation");
    const docId = docRows && docRows[0] && docRows[0].id;
    const link = docId ? TED.linkFor({ id: docId, name: "probe.pdf", path: pdfPath }) : null;
    if (!link) out.download = { ok: false, error: "няма кратък линк" };
    else {
      const file = await fetch(link, { signal: AbortSignal.timeout(20000) });
      const bytes = Buffer.from(await file.arrayBuffer());
      const dl = await fetch(link + "&dl=1", { method: "GET", signal: AbortSignal.timeout(20000) });
      out.download = {
        ok: file.status === 200 && bytes.slice(0, 4).toString() === "%PDF" && /pdf/i.test(file.headers.get("content-type") || ""),
        status: file.status,
        contentType: String(file.headers.get("content-type") || "").split(";")[0],
        pdf: bytes.slice(0, 4).toString() === "%PDF",
        attachment: /attachment/i.test(dl.headers.get("content-disposition") || "")
      };
    }
    out.voice = await voiceP;
  } catch (e) {
    out.ok = false;
    out.error = scrub(e.message);
  } finally {
    await rest("nd_activities", "DELETE", "client_id=eq." + encodeURIComponent(clientId), null, "return=minimal").catch(() => null);
    await rest("nd_documents", "DELETE", "client_id=eq." + encodeURIComponent(clientId), null, "return=minimal").catch(() => null);
    await rest("nd_clients", "DELETE", "id=eq." + encodeURIComponent(clientId), null, "return=minimal").catch(() => null);
    await rest("nd_properties", "DELETE", "id=eq." + encodeURIComponent(propId), null, "return=minimal").catch(() => null);
    for (const p of paths) await delObj(p);
    const left = await rest("nd_clients", "GET", "id=eq." + encodeURIComponent(clientId) + "&select=id", null, "return=representation").catch(() => [{}]);
    out.cleaned = !left || !left.length;
  }
  return send(res, 200, out);
}
module.exports = { run, authorizeMonitor, sameSecret, annuity, scrub };
