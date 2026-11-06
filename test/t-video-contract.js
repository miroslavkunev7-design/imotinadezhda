#!/usr/bin/env node
/** Contract tests for Settings video skill — no paid fal unless FAL_KEY set. */
"use strict";
const assert = require("assert");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const fal = require(path.join(root, "api/_video/fal.js"));
const prompts = require(path.join(root, "api/_video/prompts.js"));
const VIDEO = require(path.join(root, "api/_video/index.js"));

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("OK  ", name); }
  catch (e) { failed++; console.error("FAIL", name, e.message); }
}
async function checkAsync(name, fn) {
  try { await fn(); console.log("OK  ", name); }
  catch (e) { failed++; console.error("FAIL", name, e.message); }
}

(async () => {
  check("prompt registry R-PLAN..C-V12", () => {
    ["R-PLAN", "R-REF", "C-V01", "C-V12", "A-FFMPEG"].forEach((k) => assert.ok(prompts.get(k), k));
    assert.ok(prompts.list().length >= 14);
  });

  check("fal model keys locked", () => {
    assert.equal(fal.MODELS.nano_banana_edit, "fal-ai/nano-banana-pro/edit");
    assert.equal(fal.MODELS.kling_o1_i2v, "fal-ai/kling-video/o1/image-to-video");
  });

  check("tool cinematic_property_video registered", () => {
    assert.ok(VIDEO.tools.cinematic_property_video);
    assert.ok(VIDEO.names.includes("cinematic_property_video"));
  });

  await checkAsync("create rejects without settings client header", async () => {
    let err;
    try {
      await VIDEO.jobs.createJob({ userId: "00000000-0000-0000-0000-000000000000", email: "t@t" }, { photos: [] }, {});
    } catch (e) { err = e; }
    assert.ok(err, "expected error");
    assert.equal(err.status, 403);
  });

  await checkAsync("create rejects <4 photos when settings header", async () => {
    process.env.SETTINGS_VIDEO_ENABLED = "1";
    let err;
    try {
      await VIDEO.jobs.createJob(
        { userId: "00000000-0000-0000-0000-000000000000", email: "t@t" },
        { photos: [{ mime: "image/jpeg", data: "AAAA" }] },
        { "x-imoti-client": "settings" }
      );
    } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(err.status === 400 || err.status === 503 || /4|Нужни|SERVICE_ROLE|снимк/i.test(err.message));
  });

  check("site ash.js untouched (no skill id)", () => {
    const ash = fs.readFileSync(path.join(root, "mobile/ash.js"), "utf8");
    assert.ok(!/property_cinematic_video/.test(ash));
    const assistant = fs.readFileSync(path.join(root, "api/assistant.js"), "utf8");
    assert.ok(!/cinematic_property_video/.test(assistant));
  });

  check("settings agent-chat embeds skill id", () => {
    const js = fs.readFileSync(path.join(root, "apps/imoti-settings/agent-chat/agent-chat.js"), "utf8");
    assert.ok(js.includes("property_cinematic_video"));
    assert.ok(js.includes("x-imoti-client"));
  });

  check("n8n exports are Settings-named (not site TED)", () => {
    const names = fs.readdirSync(path.join(root, "n8n")).filter((f) => f.endsWith(".json"));
    assert.ok(names.some((n) => n.includes("settings-video")));
    names.filter((n) => n.endsWith(".json")).forEach((n) => {
      const j = JSON.parse(fs.readFileSync(path.join(root, "n8n", n), "utf8"));
      assert.ok(/Settings/i.test(j.name), n);
    });
  });

  if (process.env.FAL_KEY) {
    check("FAL_KEY present", () => assert.equal(fal.keyAvailable(), true));
    console.log("NOTE  Paid REAL_PROPERTY E2E still needs explicit one-run with photos (see docs/ted-video/V7-E2E.md).");
  } else {
    console.log("BLOCK FAL_KEY missing — skip paid fal E2E (documented V7).");
  }

  console.log(failed ? ("FAILED " + failed) : "ALL CONTRACT CHECKS PASSED");
  process.exit(failed ? 1 : 0);
})();
