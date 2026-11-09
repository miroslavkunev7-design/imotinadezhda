'use strict';
const assert=require('node:assert/strict');
const handler=require('./_broker-auth');
(async()=>{
 assert.equal(handler.phone('0888 123 456'),'359888123456');assert.equal(handler.phone('+359888123456'),'359888123456');assert.equal(handler.phone('00359888123456'),'359888123456');
 const original=global.fetch;let calls=[];
 global.fetch=async(url,opts)=>{calls.push([url,opts]);return {ok:true,json:async()=>url.includes('/nd_brokers')?[{data:{phone:'0888 123 456',user_id:'uid'}}]:{email:'broker@example.com'}};};
 assert.equal(await handler.resolve('0888123456',{}),'broker@example.com');assert.equal(calls.length,2);calls=[];
 assert.equal(await handler.resolve('BROKER@example.com',{}),'broker@example.com');assert.equal(calls.length,0);
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 let body,status;const res={setHeader(){},end(v){body=JSON.parse(v);status=this.statusCode;}};
 global.fetch=async(url,opts)=>{assert.ok(!url.includes('telegram'));return {ok:false,status:400,json:async()=>({error:'Invalid login credentials'})};};
 await handler({method:'POST',headers:{host:'imotinadezhda.bg','x-forwarded-for':'test'},body:{action:'login',identifier:'broker@example.com',password:'wrong'}},res);
 assert.equal(status,401);assert.ok(!('access_token' in body));assert.ok(!JSON.stringify(body).includes('wrong'));
 global.fetch=original;if(key===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=key;
 console.log('Phone normalization, shared identity lookup and generic failed-login response passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
