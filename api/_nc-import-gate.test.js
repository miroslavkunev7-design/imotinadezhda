// Тест: правата за импорта през ИСТИНСКИЯ handler на /api/tools (api/tools.js) – без вход, с изтекъл токен и с потребител,
// който не е служител (nd_is_staff = false). Инструментът изобщо не се изпълнява. Без мрежа: fetch е подменен,
// адресът на Supabase е фалшив (ND_SUPABASE_URL), токените са очевидно тестови.   node api/_nc-import-gate.test.js
"use strict";
const assert = require("assert");
const FAKE = "https://fake-supabase.test.local";
process.env.ND_SUPABASE_URL = FAKE;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const USERS = { "TEST-TOKEN-STAFF": { id: "00000000-0000-4000-8000-000000000002", staff: true }, "TEST-TOKEN-VISITOR": { id: "00000000-0000-4000-8000-000000000009", staff: false } };
const seen = [];
global.fetch = async (url, o) => {
  const u = new URL(String(url)), auth = String(((o && o.headers) && (o.headers.Authorization || o.headers.authorization || (typeof o.headers.get === "function" && o.headers.get("authorization")))) || "");
  const tok = auth.replace(/^Bearer /, ""), who = USERS[tok];
  seen.push(u.pathname);
  if (u.origin !== FAKE) throw new Error("неочаквана мрежа: " + url);
  const J = (s, b) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
  if (u.pathname === "/auth/v1/user") return who ? J(200, { id: who.id, aud: "authenticated", role: "authenticated", email: "test@test.local" }) : J(401, { code: 401, msg: "invalid JWT" });
  if (u.pathname === "/rest/v1/rpc/nd_is_staff") return J(200, !!(who && who.staff));
  return J(201, {});                                                       // одит и др. – без значение тук
};
const handler = require("./tools.js"), NC = require("./_nc-tools.js");
const IMPORT_TOOLS = ["imports.start", "imports.apply", "jobs.status", "jobs.result", "jobs.cancel"];
let ran = 0; IMPORT_TOOLS.forEach((k) => { NC.tools[k].run = async () => { ran++; return { ok: true }; }; });   // шпионин: не трябва да се стигне до тук без права
function call(token, tool, input) {
  return new Promise((ok) => {
    const req = { method: "POST", url: "/api/tools", headers: token ? { authorization: "Bearer " + token } : {}, body: { tool, input } };
    const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { ok({ status: this.statusCode, body: b ? JSON.parse(b) : null }); } };
    handler(req, res);
  });
}
let n = 0; const done = (m) => { n++; console.log("PASS  " + m); };
const P = "0123456789abcdef0123456789abcdef", J = "00000000-0000-4000-9000-000000000001";
const INPUT = { "imports.start": { project_id: P, files: [{ path: "projects/" + P + "/private/imports/aaaaaaaa/0000-a.csv", name: "a.csv" }] }, "imports.apply": { job_id: J, confirm: true, use_proposed: true }, "jobs.status": { id: J }, "jobs.result": { id: J }, "jobs.cancel": { id: J } };

(async () => {
  for (const k of IMPORT_TOOLS) { const r = await call(null, k, INPUT[k]); assert.strictEqual(r.status, 401, k); assert.strictEqual(r.body.ok, false); }
  assert.strictEqual(ran, 0);
  done("без вход: всички 5 инструмента на импорта → 401; нищо не е изпълнено");

  for (const k of IMPORT_TOOLS) { const r = await call("TEST-TOKEN-EXPIRED", k, INPUT[k]); assert.strictEqual(r.status, 401, k); }
  assert.strictEqual(ran, 0);
  done("изтекъл/невалиден токен → 401; нищо не е изпълнено");

  for (const k of IMPORT_TOOLS) { const r = await call("TEST-TOKEN-VISITOR", k, INPUT[k]); assert.strictEqual(r.status, 403, k); assert.ok(/no CRM access/.test(r.body.error)); }
  assert.strictEqual(ran, 0, "не-служител не стига до инструмента");
  done("влязъл потребител, който НЕ е служител (nd_is_staff=false) → 403 за imports.start/apply и jobs.*; нищо не е изпълнено");

  const bad = await call("TEST-TOKEN-STAFF", "imports.apply", { job_id: J, use_proposed: true });
  assert.strictEqual(bad.status, 400); assert.strictEqual(ran, 0);
  const pos = await call("TEST-TOKEN-STAFF", "imports.apply", INPUT["imports.apply"]);
  assert.strictEqual(pos.status, 200); assert.strictEqual(ran, 1);
  done("служител: без confirm → 400 (договорът важи през handler-а); с валиден вход → инструментът се изпълнява (контрола)");
  assert.ok(!seen.some((p) => /hyvwfsmjbaynozceookv/.test(p)));
  console.log("\n" + n + "/" + n + " минали");
})().catch((e) => { console.error(e); process.exit(1); });
