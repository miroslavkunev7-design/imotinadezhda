"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const handler = require("./_broker-account.js");
const realFetch = global.fetch, realKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SELF = "00000000-0000-4000-8000-000000000001", OTHER = "00000000-0000-4000-8000-000000000002";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-key";
after(() => { global.fetch = realFetch; if (realKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = realKey; });
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
async function run(options = {}) {
  const calls = [], secret = "  Test-password-2026!  ";
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/auth/v1/user") && init.method === "GET") return response(options.authFail ? 401 : 200, { id: SELF });
    if (url.endsWith("/rpc/nd_is_staff")) return response(200, options.staff !== false);
    if (url.endsWith("/rpc/nd_is_admin")) return response(200, !!options.admin);
    if (url.includes("/nd_brokers?")) return response(200, options.missing ? [] : [{ data: { user_id: options.legacy ? null : options.target || SELF, email: "test@example.invalid" } }]);
    if (url.endsWith("/rpc/nd_admin_user_id")) return response(200, OTHER);
    if (url.includes("/nd_staff?")) return response(200, options.targetNoAccess ? [] : [{ user_id: options.target || SELF }]);
    if (init.method === "PUT") return response(options.failSave ? 422 : 200, options.failSave ? { code: "weak_password" } : { id: options.admin && options.legacy ? OTHER : options.target || SELF });
    throw Error("Unexpected request");
  };
  let output, status;
  const req = { method: "POST", headers: { host: "imotinadezhda.bg", origin: options.origin || "https://imotinadezhda.bg", authorization: options.noAuth ? "" : "Bearer test-session" }, body: { brokerId: options.ownProfile ? "" : "test-card", password: options.short ? "short" : secret } };
  await handler(req, { setHeader() {}, set statusCode(v) { status = v; }, end(value) { output = JSON.parse(value); } });
  assert.ok(!JSON.stringify(output).includes(secret));
  return { output, status, calls, secret };
}
test("rejects unauthenticated, cross-origin and invalid password requests without updates", async () => {
  for (const option of [{ noAuth: true }, { origin: "https://example.invalid" }, { short: true }, { authFail: true }, { staff: false }]) {
    const r = await run(option); assert.equal(r.output.ok, false); assert.equal(r.calls.filter(c => c.init.method === "PUT").length, 0);
  }
});
test("a broker cannot change another broker's password", async () => {
  const r = await run({ target: OTHER }); assert.equal(r.status, 403); assert.equal(r.calls.filter(c => c.init.method === "PUT").length, 0);
});
test("own password uses the user Auth endpoint and preserves the exact password", async () => {
  const r = await run(); assert.equal(r.status, 200);
  const update = r.calls.find(c => c.init.method === "PUT"); assert.ok(update.url.endsWith("/auth/v1/user"));
  assert.equal(update.init.headers.Authorization, "Bearer test-session"); assert.equal(JSON.parse(update.init.body).password, r.secret);
});
test("admin changes resolve the actual registered account, including legacy cards", async () => {
  const r = await run({ admin: true, legacy: true }); assert.equal(r.status, 200);
  const update = r.calls.find(c => c.init.method === "PUT"); assert.ok(update.url.endsWith("/auth/v1/admin/users/" + OTHER));
  assert.equal(update.init.headers.Authorization, "Bearer test-server-key");
});
test("missing registration and rejected Auth updates never report success", async () => {
  for (const option of [{ missing: true }, { targetNoAccess: true }, { failSave: true }]) {
    const r = await run(option); assert.equal(r.output.ok, false); assert.notEqual(r.status, 200);
  }
});
