// Durable admission controls shared by public onboarding and admin queues.
export class OnboardingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const responseHeaders = {'Cache-Control':'private, no-store', 'Vary':'Cookie', 'X-Content-Type-Options':'nosniff'};
export const reply = (data, status = 200) => Response.json(data, {status, headers:responseHeaders});
export function clean(value, maximum, label) {
  if (typeof value !== 'string') throw new OnboardingError(`${label} is required.`);
  const text=value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/u.test(text)) throw new OnboardingError(`Enter a valid ${label} (up to ${maximum} characters).`);
  return text;
}
export function companyKey(value) { const key=clean(value,180,'company name').toLowerCase().replace(/[\p{P}\p{Z}]+/gu,''); if(key.length<2)throw new OnboardingError('Enter a valid company name.'); return key; }
export function contactEmail(value) {
  const email=clean(value,254,'contact email').toLowerCase();
  if (!/^[^\s@<>]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) throw new OnboardingError('Enter a valid contact email.');
  return email;
}
export function pageCursor(search) {
  const cursor=search.get('before');
  if (!cursor) return null;
  if (cursor.length>200 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new OnboardingError('Invalid page cursor.');
  try {
    const [at,id]=JSON.parse(atob(cursor.replaceAll('-','+').replaceAll('_','/')));
    if (typeof at!=='string'||typeof id!=='string'||!/^\d{4}-\d\d-\d\dT/.test(at)||!/^[a-z]+_[a-f0-9-]{36}$/.test(id)) throw Error();
    return {at,id};
  } catch {throw new OnboardingError('Invalid page cursor.');}
}
export function nextCursor(rows, limit=25) {
  if(rows.length<=limit)return null;
  const last=rows[limit-1];
  return btoa(JSON.stringify([last.created_at,last.id])).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export async function queuePage(db,table,search) {
  // Table is supplied only by server code, never by request input.
  if(!['lab_applications','supplier_applications'].includes(table))throw Error('Unknown queue');
  const cursor=pageCursor(search),status=search.get('status');
  const allowed=table==='lab_applications'?['PENDING','APPROVED','REJECTED']:['PENDING_REVIEW','APPROVED','REJECTED'];
  if(status&&!allowed.includes(status))throw new OnboardingError('Invalid status filter.');
  const clauses=[],args=[];
  if(status){clauses.push('status=?');args.push(status);}
  if(cursor){clauses.push('(created_at,id)<(?,?)');args.push(cursor.at,cursor.id);}
  const rows=(await db.prepare(`SELECT * FROM ${table} ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY created_at DESC,id DESC LIMIT 26`).bind(...args).all()).results;
  return {applications:rows.slice(0,25),nextCursor:nextCursor(rows),pageSize:25};
}
export function sameOrigin(request) {
  const origin=request.headers.get('origin');
  if ((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site') throw new OnboardingError('Same-origin request required.',403);
}
export async function boundedRequest(request, maximum) {
  if(Number(request.headers.get('content-length'))>maximum)throw new OnboardingError('Submission is too large.',413);
  const reader=request.body?.getReader();if(!reader)return request;
  let total=0;const parts=[];
  try {while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maximum)throw new OnboardingError('Submission is too large.',413);parts.push(value);}}
  finally {void reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  return new Request(request,{body:bytes});
}
export async function admit(db,scope,principal,limit,windowMs=3600000,at=Date.now()) {
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope+'\n'+principal))),b=>b.toString(16).padStart(2,'0')).join('');
  if(Math.random()<0.01)await db.prepare('DELETE FROM onboarding_rate_limits WHERE key IN (SELECT key FROM onboarding_rate_limits WHERE started_at<? LIMIT 100)').bind(at-86400000).run();
  const row=await db.prepare(`INSERT INTO onboarding_rate_limits (key,count,started_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN started_at<=? THEN 1 ELSE count+1 END,started_at=CASE WHEN started_at<=? THEN excluded.started_at ELSE started_at END RETURNING count`).bind(hash,at,at-windowMs,at-windowMs).first();
  if(!row||row.count>limit)throw new OnboardingError('Too many applications. Try again later.',429);
}
export function errorResponse(error) {
  const known=error instanceof OnboardingError;
  const response=reply({error:known?error.message:'Onboarding is temporarily unavailable. Please try again.'},known?error.status:503);
  if(known&&error.status===429)response.headers.set('Retry-After','3600');
  return response;
}
