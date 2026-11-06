// Video skill tools for /api/tools gateway + shared helpers.
"use strict";

const jobs = require("./jobs.js");
const fal = require("./fal.js");
const prompts = require("./prompts.js");

function schema(spec) {
  return {
    safeParse(input) {
      const out = {}, issues = [];
      input = input && typeof input === "object" ? input : {};
      for (const k of Object.keys(spec)) {
        const s = spec[k], v = input[k];
        if (v === undefined || v === null || v === "") {
          if (s.required) issues.push({ path: [k], message: "required" });
          else if (s.default !== undefined) out[k] = s.default;
          continue;
        }
        if (s.type === "string") {
          if (typeof v !== "string") { issues.push({ path: [k], message: "string" }); continue; }
          if (s.max && v.length > s.max) { issues.push({ path: [k], message: "max " + s.max }); continue; }
          if (s.enum && !s.enum.includes(v)) { issues.push({ path: [k], message: "one of " + s.enum.join("|") }); continue; }
          out[k] = v;
        } else if (s.type === "number") {
          const n = Number(v);
          if (!isFinite(n)) { issues.push({ path: [k], message: "number" }); continue; }
          out[k] = n;
        } else if (s.type === "boolean") {
          out[k] = v === true || v === "true" || v === 1;
        } else if (s.type === "array") {
          if (!Array.isArray(v)) { issues.push({ path: [k], message: "array" }); continue; }
          out[k] = v;
        } else if (s.type === "object") {
          if (typeof v !== "object") { issues.push({ path: [k], message: "object" }); continue; }
          out[k] = v;
        }
      }
      return issues.length ? { success: false, error: { issues } } : { success: true, data: out };
    }
  };
}
const S = (type, o) => Object.assign({ type }, o || {});

const tools = {
  cinematic_property_video: {
    description: "Стартира кинематографично видео за имот (skill property_cinematic_video). Trusted context: actor от сървъра. Input: photos (4–10 base64), idempotency_key, mode REAL_PROPERTY (по подразбиране) или PROJECT_VISUALIZATION + explicit_project_viz. Връща job_id. Изборът на skill без снимки НЕ таксува.",
    input: schema({
      photos: S("array", { required: true, max: 10 }),
      idempotency_key: S("string", { max: 120 }),
      mode: S("string", { enum: ["REAL_PROPERTY", "PROJECT_VISUALIZATION"], default: "REAL_PROPERTY" }),
      explicit_project_viz: S("boolean", { default: false }),
      property_id: S("string"),
      session_id: S("string", { max: 120 })
    }),
    run: async (ctx, i) => {
      // Bound to Settings agent path only — requires x-imoti-client: settings (never site TED).
      const r = await jobs.createJob(
        { userId: ctx.userId, email: (ctx.user && ctx.user.email) || "", headers: ctx.headers || {} },
        i,
        ctx.headers || {}
      );
      const view = await jobs.jobPublicView(r.job);
      return { job_id: r.job.id, created: r.created, reused: r.reused, ...view };
    }
  },
  "video.job_status": {
    description: "Статус на видео задача по job_id (същият чат / reload).",
    input: schema({ job_id: S("string", { required: true }) }),
    run: async (ctx, i) => {
      const job = await jobs.getJob(i.job_id, ctx.userId);
      return jobs.jobPublicView(job);
    }
  },
  "video.fal_submit": {
    description: "Вътрешен/операторски: fal submit (Nano Banana / Kling O1). Изисква FAL_KEY. Не за крайния потребителски чат.",
    input: schema({
      model_key: S("string", { required: true, enum: ["nano_banana_edit", "kling_o1_i2v"] }),
      input: S("object", { required: true }),
      job_id: S("string"),
      webhook_url: S("string", { max: 500 })
    }),
    run: async (ctx, i) => {
      const sub = await fal.submit(i.model_key, i.input, { webhookUrl: i.webhook_url });
      return sub;
    }
  },
  "video.fal_status": {
    description: "Вътрешен: fal status по request_id.",
    input: schema({
      model_key: S("string", { required: true }),
      request_id: S("string", { required: true })
    }),
    run: async (ctx, i) => fal.status(i.model_key, i.request_id)
  },
  "video.fal_cancel": {
    description: "Вътрешен: fal cancel по request_id.",
    input: schema({
      model_key: S("string", { required: true }),
      request_id: S("string", { required: true })
    }),
    run: async (ctx, i) => fal.cancel(i.model_key, i.request_id)
  }
};

const SPEC = Object.entries(tools).map(([n, t]) => "- " + n + ": " + t.description).join("\n");

module.exports = {
  tools,
  names: Object.keys(tools),
  SPEC,
  jobs,
  fal,
  prompts
};
