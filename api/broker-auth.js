/* Resolve phone login on the server; never disclose account existence or passwords. */
'use strict';
const URL='https://hyvwfsmjbaynozceookv.supabase.co';
const KEY='sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni';
const limits=new Map();
function phone(v){let d=String(v||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(/^0[89]\d{8}$/.test(d))d='359'+d.slice(1);else if(/^[89]\d{8}$/.test(d))d='359'+d;return /^\d{10,15}$/.test(d)?d:'';}
async function resolve(identifier,H){
 if(identifier.includes('@'))return identifier.toLowerCase();
 const p=phone(identifier);if(!p)return null;
 const r=await fetch(URL+'/rest/v1/nd_brokers?select=data',{headers:H});if(!r.ok)throw Error('lookup');
 const cards=await r.json();const matches=cards.filter(x=>phone(x.data&&x.data.phone)===p&&x.data.user_id);
 const ids=[...new Set(matches.map(x=>x.data.user_id))];if(ids.length>1)return null;
 if(!ids.length)return 'p'+p+'@tel.imotinadezhda.bg';
 const u=await fetch(URL+'/auth/v1/admin/users/'+encodeURIComponent(ids[0]),{headers:H});if(!u.ok)throw Error('user');return (await u.json()).email||null;
}
module.exports=async(req,res)=>{
 const send=(s,b)=>{res.statusCode=s;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(b));};
 if(req.method!=='POST')return send(405,{error:'POST only'});
 const origin=req.headers.origin;if(origin&&origin!=='https://imotinadezhda.bg'&&origin!=='https://'+req.headers.host)return send(403,{error:'Невалидна заявка.'});
 const ip=String(req.headers['x-forwarded-for']||'').split(',')[0];const now=Date.now();let l=limits.get(ip);if(!l||now-l.at>900000)l={at:now,n:0};l.n++;limits.set(ip,l);if(limits.size>10000)for(const[k,v]of limits)if(now-v.at>900000)limits.delete(k);if(l.n>15)return send(429,{error:'Твърде много опити. Опитайте след 15 минути.'});
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)return send(503,{error:'Входът временно не е достъпен.'});
 const H={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 try{
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};const identifier=String(b.identifier||'').trim().slice(0,254);
 if(!identifier||!['login','reset'].includes(b.action))return send(400,{error:'Въведете телефон или имейл.'});
 const email=await resolve(identifier,H);
 if(b.action==='reset'){
  const generic={ok:true,message:'Ако профилът има имейл за възстановяване, ще получите писмо. При регистрация само с телефон се свържете с управителя.'};
  if(email&&!email.endsWith('@tel.imotinadezhda.bg')){
   const rr=await fetch(URL+'/auth/v1/recover?redirect_to='+encodeURIComponent('https://imotinadezhda.bg/mobile/crm/crm-nachalo.html'),{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email})});
   if(!rr.ok)return send(502,{error:'Възстановяването временно не е достъпно. Опитайте отново.'});
  }
  // Notification describes the request, never claims the password was changed.
  const token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;
  if(token&&chat)await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chat,text:'Заявка за възстановяване на парола\nВъведен телефон/имейл: '+identifier+'\n'+new Date().toISOString()+'\nТова е заявка, не потвърдена смяна на парола.'}),signal:AbortSignal.timeout(4000)}).catch(()=>null);
  return send(200,generic);
 }
 if(!email||!b.password)return send(401,{error:'Грешен телефон/имейл или парола.'});
 const r=await fetch(URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password:String(b.password)})});const j=await r.json();
 if(!r.ok)return send(r.status===429?429:401,{error:'Грешен телефон/имейл или парола.'});
 return send(200,{ok:true,access_token:j.access_token,refresh_token:j.refresh_token});
 }catch(e){return send(502,{error:'Няма връзка със сървъра. Опитайте отново.'});}
};
module.exports.phone=phone;
module.exports.resolve=resolve;
