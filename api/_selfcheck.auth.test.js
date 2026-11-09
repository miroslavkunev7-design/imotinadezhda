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
  if (prev === undefined) delete process.env.TED_PROBE_KEY; else process.env.TED_PROBE_KEY = prev;
  global.fetch = origFetch;
  MON.report = origReport;
  console.log("auth gate: anon 401, wrong probe 401, wrong bearer 401, no report");
})().catch((e) => {
  global.fetch = origFetch;
  MON.report = origReport;
  console.error(e);
  process.exit(1);
});
