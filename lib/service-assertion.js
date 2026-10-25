// Identical protocol module on both sides of the TECRID/VLE service boundary.
const keys={
 'mail-issuance':'TECRID_MAIL_ISSUANCE_SECRET',
 'report-read':'TECRID_REPORT_READ_SECRET',
 'report-workspace':'TECRID_REPORT_READ_SECRET',
 'report-permission':'TECRID_REPORT_PERMISSION_SECRET',
 'report-import':'TECRID_REPORT_IMPORT_SECRET',
 'notifications-to-vle':'TECRID_NOTIFICATION_SERVICE_SECRET',
 'notifications-to-tecrid':'TECRID_NOTIFICATION_SERVICE_SECRET',
 'notification-worker':'TECRID_NOTIFICATION_SERVICE_SECRET',
};
const encoder=new TextEncoder();
function credential(env,audience){
 const name=keys[audience],secret=name&&env[name];
 if(typeof secret!=='string'||secret.length<32||secret===env.TECRID_EMAIL_RELAY_SECRET)return null;
 for(const other of new Set(Object.values(keys)))if(other!==name&&env[other]===secret)return null;
 return secret;
}
function message(url,audience,timestamp,nonce,body){return ['tecrid-service/1',audience,'POST',new URL(url).origin+new URL(url).pathname,timestamp,nonce,body].join('\n');}
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const key=secret=>crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export async function signedServiceInit(url,input,env,audience,{at=Date.now(),nonce=crypto.randomUUID()}={}){
 const secret=credential(env,audience);if(!secret)throw Error('Scoped service credential is not configured.');
 const body=typeof input==='string'?input:JSON.stringify(input),timestamp=String(Math.floor(at/1000));
 const signature=hex(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(message(url,audience,timestamp,nonce,body))));
 return {method:'POST',headers:{'content-type':'application/json',authorization:`TECRID-HMAC t=${timestamp},n=${nonce},v1=${signature}`},body};
}
export async function boundedText(request,maximum){
 const reader=request.clone().body?.getReader();if(!reader)return '';
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum)throw Error('Too large');chunks.push(value);}}
 finally{void reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function verifyServiceAssertion(request,env,audience,at=Date.now()){
 try{
  const secret=credential(env,audience);if(!secret||!env.DB||request.method!=='POST')return false;
  const parts=(request.headers.get('authorization')||'').match(/^TECRID-HMAC t=(\d{10}),n=([a-f0-9-]{36}),v1=([a-f0-9]{64})$/);
  if(!parts)return false;
  const [,timestamp,nonce,signature]=parts,age=at-Number(timestamp)*1000;
  if(age>60000||age< -15000)return false;
  const body=await boundedText(request,128000);
  const bytes=Uint8Array.from(signature.match(/../g),s=>parseInt(s,16));
  if(!await crypto.subtle.verify('HMAC',await key(secret),bytes,encoder.encode(message(request.url,audience,timestamp,nonce,body))))return false;
  // Reserved rate-limiter namespace: hashed single-use nonces, no actor or body.
  // The existing unique key makes claims atomic across Workers and instances.
  const digest=hex(await crypto.subtle.digest('SHA-256',encoder.encode(audience+'\n'+nonce)));
  const nonceKey='tecrid-service-nonce:'+digest;
  await env.DB.prepare("DELETE FROM auth_rate_limit WHERE key LIKE 'tecrid-service-nonce:%' AND last_request<?").bind(at-300000).run();
  const result=await env.DB.prepare('INSERT OR IGNORE INTO auth_rate_limit (id,key,count,last_request) VALUES (?,?,1,?)').bind(nonceKey,nonceKey,at).run();
  return result.meta.changes===1;
 }catch{return false;}
}
export function permissionAudience(input){return ['notifications','notification-read'].includes(input?.action)?'notifications-to-vle':['workspace','status'].includes(input?.action)?'report-workspace':'report-permission';}
