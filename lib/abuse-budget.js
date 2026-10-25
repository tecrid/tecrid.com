import {boundedText} from './service-assertion.js';
const encoder=new TextEncoder();
export function configuredLimit(value,fallback){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=100000?n:fallback;}
export async function takeBudget(db,scope,principal,limit,windowMs,at=Date.now()){
 if(!db)throw Error('Security budget storage unavailable.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(scope+'\n'+principal))),b=>b.toString(16).padStart(2,'0')).join('');
 const key='tecrid-budget:'+digest;
 await db.prepare("DELETE FROM auth_rate_limit WHERE key LIKE 'tecrid-budget:%' AND last_request<?").bind(at-86400000).run();
 const row=await db.prepare(`INSERT INTO auth_rate_limit (id,key,count,last_request) VALUES (?,?,1,?)
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_rate_limit.last_request<=? THEN 1 ELSE auth_rate_limit.count+1 END,
 last_request=CASE WHEN auth_rate_limit.last_request<=? THEN excluded.last_request ELSE auth_rate_limit.last_request END RETURNING count`).bind(key,key,at,at-windowMs,at-windowMs).first();
 return !!row&&row.count<=limit;
}
const failure=(status,message)=>Response.json({error:message},{status,headers:{'Cache-Control':'private, no-store','Retry-After':'60'}});
export async function guardMutationRequest(request,env){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/')||['GET','HEAD','OPTIONS'].includes(request.method))return request;
 try{
  if(!await takeBudget(env.DB,'api-global','application',configuredLimit(env.TECRID_API_GLOBAL_LIMIT,3000),60000))return failure(429,'Too many requests. Try again shortly.');
  if(!await takeBudget(env.DB,'api-ip',request.headers.get('cf-connecting-ip')||'unavailable',configuredLimit(env.TECRID_API_IP_LIMIT,120),60000))return failure(429,'Too many requests. Try again shortly.');
  const principal=request.headers.get('authorization')||request.headers.get('cookie');
  if(principal&&!await takeBudget(env.DB,'api-principal',principal,configuredLimit(env.TECRID_API_PRINCIPAL_LIMIT,90),60000))return failure(429,'Too many requests. Try again shortly.');
  if(request.headers.get('content-type')?.includes('application/json')){
   try{const text=await boundedText(request,128000);return new Request(request,{body:text});}catch{return failure(413,'JSON request is too large.');}
  }
  return request;
 }catch{return failure(503,'Request security controls are temporarily unavailable.');}
}
