"use strict";
const assert = require("assert");
const S = require("./_selfcheck.js");
const MON = require("./_monitor.js");

const origFetch = global.fetch;
const origReport = MON.report;
let fetches = 0;
let reports = 0;
global.fetch = async () => {
  fetches += 1;
  return { ok: false, status: 401, json: async () => ({ message: "bad" }) };
};
MON.report = async () => {
  reports += 1;
  return { sent: true };
};

function resCapture() {
  const out = { statusCode: 0, body: "" };
  return {
    statusCode: 0,
    setHeader() {},
    end(s) { out.body = s; out.statusCode = this.statusCode; },
    out
  };
}

(async () => {
  const prev = process.env.TED_PROBE_KEY;
  delete process.env.TED_PROBE_KEY;
  fetches = 0;
  const anon = await S.authorizeMonitor({ headers: {} });
  assert.strictEqual(anon.ok, false);
  assert.strictEqual(anon.status, 401);
  assert.strictEqual(fetches, 0);
  const badProbe = await S.authorizeMonitor({ headers: { "x-ted-probe": "wrong-credential" } });
  assert.strictEqual(badProbe.status, 401);
  assert.strictEqual(fetches, 0);
  const badBearer = await S.authorizeMonitor({ headers: { authorization: "Bearer not-a-session", "x-ted-probe": "also-wrong" } });
  assert.strictEqual(badBearer.status, 401);
  assert.ok(fetches >= 1);
  const reportsBefore = reports;
  const res = resCapture();
  await S.run(res, { action: "monitor", run: "selfcheck", signal: true }, "anon", null);
  const body = JSON.parse(res.out.body);
  assert.strictEqual(res.out.statusCode, 401);
  assert.strictEqual(body.ok, false);
  assert.strictEqual(reports, reportsBefore);
  const resClean = resCapture();
  await S.run(resClean, { action: "monitor", run: "cleanup" }, "anon", undefined);
  assert.strictEqual(resClean.out.statusCode, 401);
  assert.strictEqual(reports, reportsBefore);
  assert.strictEqual(typeof S.checkPublicGates, "function");
  const prevRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-secret";
  global.fetch = async (url) => {
    const u = String(url);
    const status = /\/api\/(tools|transcribe)/.test(u) ? 401 : 200;
    return { ok: status === 200, status, headers: { get: () => "" }, json: async () => [], text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const okRes = resCapture();
  await S.run(okRes, { action: "monitor", run: "selfcheck", signal: false }, "probe", { authorized: true });
  const okBody = JSON.parse(okRes.out.body);
  assert.strictEqual(okRes.out.statusCode, 200, okRes.out.body);
  assert.strictEqual(okBody.gate.tools, 401);
  assert.strictEqual(okBody.gate.voice, 401);
  assert.ok(!okBody.error || !/is not a function/.test(String(okBody.error)));
  if (prevRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = prevRole;
  if (prev === undefined) delete process.env.TED_PROBE_KEY; else process.env.TED_PROBE_KEY = prev;
  global.fetch = origFetch;
  MON.report = origReport;
  console.log("auth gate: anon 401, wrong probe 401, wrong bearer 401, protected selfcheck calls checkPublicGates");
})().catch((e) => {
  global.fetch = origFetch;
  MON.report = origReport;
  console.error(e);
  process.exit(1);
});
