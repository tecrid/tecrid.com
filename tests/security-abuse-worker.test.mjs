import assert from 'node:assert/strict';
import test from 'node:test';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
const mf=new Miniflare({modulesRoot:resolve('dist/server'),modules:[{type:'ESModule',path:resolve('dist/server/index.js')},...readdirSync('dist/server',{recursive:true}).filter(f=>f.endsWith('.js')&&f!=='index.js').map(f=>({type:'ESModule',path:resolve('dist/server',f)}))],compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{TECRID_API_IP_LIMIT:'2',TECRID_API_GLOBAL_LIMIT:'100'},outboundService:()=>{throw Error('Unexpected external call');}});
const db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const s of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(s.trim())await db.prepare(s).run();
test.after(async()=>mf.dispose());
test.beforeEach(async()=>db.prepare("DELETE FROM auth_rate_limit WHERE key LIKE 'tecrid-budget:%'").run());
const options=(body,ip)=>({method:'POST',headers:{origin:'https://tecrid.com','content-type':'application/json','cf-connecting-ip':ip},body});
test('oversized JSON is rejected before route parsing',async()=>{assert.equal((await mf.dispatchFetch('https://tecrid.com/api/v1/share-codes/redeem',options(JSON.stringify({large:'x'.repeat(128001)}),'192.0.2.1'))).status,413);});
test('public mutation abuse has a durable IP budget',async()=>{let r;for(let i=0;i<3;i++)r=await mf.dispatchFetch('https://tecrid.com/api/v1/share-codes/redeem',options('{}','192.0.2.2'));assert.equal(r.status,429);});
test('one flooding client cannot deny another client access to mutation handlers',async()=>{
 const url='https://tecrid.com/api/v1/share-codes/redeem';
 // Exceed the entire configured global allowance from one IP, including
 // concurrent requests and rotating credentials that cannot bypass the IP cap.
 const responses=await Promise.all(Array.from({length:110},(_,i)=>{
  const init=options('{}','192.0.2.10');
  init.headers.authorization=`Bearer synthetic-flood-${i}`;
  return mf.dispatchFetch(url,init);
 }));
 assert.equal(responses.filter(r=>r.status===401).length,2);
 assert.equal(responses.filter(r=>r.status===429).length,108);
 for(let i=0;i<2;i++)assert.equal((await mf.dispatchFetch(url,options('{}','192.0.2.11'))).status,401,'fresh client must reach the authenticated handler');
 const denied=await mf.dispatchFetch(url,options('{}','192.0.2.11'));
 assert.equal(denied.status,429);
 assert.equal(denied.headers.get('Cache-Control'),'private, no-store');
 assert.equal(denied.headers.get('Retry-After'),'60');
});
