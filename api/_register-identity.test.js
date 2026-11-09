"use strict";
const { test, after } = require("node:test"), assert = require("node:assert/strict");
const originalFetch = global.fetch, oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY, oldCode = process.env.ND_REG_CODE;
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-key";
process.env.ND_REG_CODE = "TEST-REGISTRATION-CODE";
const register = require("./register.js");
after(() => { global.fetch = originalFetch; for (const [key,value] of [["SUPABASE_SERVICE_ROLE_KEY",oldKey],["ND_REG_CODE",oldCode]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
async function request(kind) {
  const calls = [], uid = "00000000-0000-4000-8000-000000000001";
  global.fetch = async (url, init = {}) => {
    calls.push({url, init});
    let body;
    if (url.includes("/nd_brokers?")) body = kind === "phone-card" ? [{data:{phone:"+359 888 123 456",user_id:uid}}] : [];
    else if (url.endsWith("/rpc/nd_admin_user_id")) body = kind === "new" ? null : uid;
    else if (url.includes("/nd_staff?")) body = [{user_id:uid}];
    else if (url.endsWith("/auth/v1/admin/users") && kind === "new") body = {id:uid};
    else if (url.endsWith("/nd_reg_pending") && kind === "new") body = [{id:"00000000-0000-4000-8000-000000000002"}];
    else if (url.includes("/webhook/reg-sms") && kind === "new") body = {ok:true,via:"sms"};
    else throw Error("Unexpected registration request");
    return {ok:true,status:200,json:async()=>body};
  };
  let output,status;
  const body = {action:"start",code:process.env.ND_REG_CODE,name:"Тест Брокер",phone:"0888123456",password:"Test-password-2026!"};
  if (kind !== "phone-login") body.email = "test@example.invalid";
  await register({method:"POST",headers:{"x-forwarded-for":"test-"+kind},body},{setHeader(){},set statusCode(n){status=n},end(s){output=JSON.parse(s)}});
  return {status,output,calls};
}
test("an existing email reports an email conflict and never resets that account", async()=>{
  const r=await request("email-login");assert.equal(r.status,409);assert.equal(r.output.code,"EMAIL_EXISTS");assert.match(r.output.error,/имейл/);assert.doesNotMatch(r.output.error,/С този телефон/);assert.equal(r.calls.filter(c=>c.init.method==="PUT").length,0);
});
test("a registered phone reports a phone conflict", async()=>{
  for(const kind of ["phone-card","phone-login"]){const r=await request(kind);assert.equal(r.status,409);assert.equal(r.output.code,"PHONE_EXISTS");assert.match(r.output.error,/телефон/);}
});
test("free phone and email proceed to the registration code step",async()=>{
  const r=await request("new");assert.equal(r.status,200);assert.equal(r.output.ok,true);assert.ok(r.output.id);const create=r.calls.find(c=>c.url.endsWith("/auth/v1/admin/users"));const sent=JSON.parse(create.init.body);assert.equal(sent.email,"test@example.invalid");assert.equal(sent.user_metadata.phone,"+359888123456");
});
