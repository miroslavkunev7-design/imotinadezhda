// TASK-009 · mobile/nc-model.js – двигателят за 3D модела (ES модул): износ по договора на страницата, политика за разрешени адреси,
// състояния/текст без измислици, без външни CDN. Пуска се с node --test api/_nc-cad*.test.js (без браузър; визуалните проверки са в screens/).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "mobile", "nc-model.js");
const SRC = fs.readFileSync(FILE, "utf8");
global.location = { href: "https://imotinadezhda.bg/mobile/nc.html?p=test", origin: "https://imotinadezhda.bg" };
const mod = () => import(FILE);

test("износ по договора на crm-nc.js (window.NCModel / NC.ENGINE_URL.model)", async () => {
  const m = await mod();
  for (const k of ["building", "webglOk", "name", "install", "status", "stateHtml", "allowedUrl", "refresh"]) assert.ok(k in m, k);
  assert.equal(m.name, "TASK-009");
  assert.equal(typeof m.default.building, "function");
});

test("разрешени адреси: само /model/<сграда> и подписани производни в nd-files; оригинали, blob:, data:, чужди хостове – отказ", async () => {
  const { allowedUrl } = await mod();
  const SB = "https://hyvwfsmjbaynozceookv.supabase.co/storage/v1/object/sign/nd-files/";
  assert.equal(allowedUrl("/model/bld009test000000000000000000000a"), true);
  assert.equal(allowedUrl("https://imotinadezhda.bg/model/bld009test000000000000000000000a"), true);
  assert.equal(allowedUrl(SB + "projects/e5e5e5e5test0000000000000000p005/private/derived/models/00000000-0000-4000-8000-00000000c009/a1-model.glb?token=x"), true);
  assert.equal(allowedUrl(SB + "projects/a1a1a1a1test0000000000000000p001/public/models/test-building-a.glb?token=x"), true, "медия вид model (TASK-007/008)");
  assert.equal(allowedUrl(SB + "projects/a1a1a1a1test0000000000000000p001/private/cad/original.ifc?token=x"), false, "оригинал");
  assert.equal(allowedUrl(SB + "projects/a1a1a1a1test0000000000000000p001/private/imports/x.glb?token=x"), false, "оригинал glb в imports");
  assert.equal(allowedUrl("https://evil.example/storage/v1/object/sign/nd-files/projects/a1a1a1a1test0000000000000000p001/public/models/x.glb"), false, "чужд хост");
  assert.equal(allowedUrl("http://imotinadezhda.bg/model/bld009test000000000000000000000a"), false, "без TLS");
  assert.equal(allowedUrl("blob:https://imotinadezhda.bg/1"), false);
  assert.equal(allowedUrl("data:model/gltf-binary;base64,Z2xURg=="), false);
  assert.equal(allowedUrl("/model/../api/tools"), false);
  assert.equal(allowedUrl(""), false); assert.equal(allowedUrl(null), false); assert.equal(allowedUrl({ url: "/model/bld009test000000000000000000000a" }), false);
});

test("състояние по сграда: без данни = „няма модел“; текстът не измисля и обозначава илюстрацията", async () => {
  const { status, stateHtml } = await mod();
  assert.deepEqual(status("bld009test000000000000000000000a"), { state: "none" });
  const h = stateHtml({ id: "bld009test000000000000000000000a", name: "TEST Сграда" });
  assert.match(h, /Илюстрация – не е този проект/);
  assert.match(h, /още не е подготвен/);
  assert.match(h, /ph44\.webp/);
  assert.doesNotMatch(h, /<script/i);
  const x = stateHtml({ id: "bld009test000000000000000000000a", name: "<img src=x onerror=1>" });
  assert.doesNotMatch(x, /<img src=x/);
});

test("без външни CDN и без тайни: three.js идва само през локалния crm-nc-3d.js; само публичният ключ на сайта", () => {
  assert.doesNotMatch(SRC, /https?:\/\/[^"'\s]*(cdn\.|unpkg|jsdelivr|cdnjs|threejs\.org)/i);
  assert.match(SRC, /crm-nc-3d\.js/);
  assert.doesNotMatch(SRC, /service_role|sb_secret|eyJhbGci/i);
  assert.match(SRC, /sb_publishable_/);
  assert.match(SRC, /MAX_GLB = 64 \* 1024 \* 1024/);
  assert.match(SRC, /URL\.revokeObjectURL/);
  assert.match(SRC, /webglcontextlost/);
});
