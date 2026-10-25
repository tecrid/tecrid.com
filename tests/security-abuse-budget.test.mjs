import assert from 'node:assert/strict';
import test from 'node:test';
import {Miniflare} from 'miniflare';
import {guardMutationRequest} from '../lib/abuse-budget.js';

// Exercise real atomic D1 counters without application handlers or transports.
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response(null)}}',d1Databases:['DB']});
const db=await mf.getD1Database('DB');
await db.prepare('CREATE TABLE auth_rate_limit (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, count INTEGER NOT NULL, last_request INTEGER NOT NULL)').run();
test.after(async()=>mf.dispose());
test.beforeEach(async()=>db.prepare('DELETE FROM auth_rate_limit').run());
function mutation(ip,principal){
 return new Request('https://tecrid.com/api/auth/sign-in/magic-link',{
  method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip,...(principal?{authorization:principal}:{})},body:'{}',
 });
}

test('a low global override cannot let one client exhaust the shared ceiling',async()=>{
 const env={DB:db,TECRID_API_IP_LIMIT:'2',TECRID_API_GLOBAL_LIMIT:'1'};
 const outcomes=await Promise.all(Array.from({length:60},()=>guardMutationRequest(mutation('192.0.2.20'),env)));
 assert.equal(outcomes.filter(r=>r instanceof Request).length,2);
 assert.equal(outcomes.filter(r=>r.status===429).length,58);
 assert.ok(await guardMutationRequest(mutation('192.0.2.21'),env) instanceof Request);
});

test('principal-denied requests do not spend the shared budget across IPs',async()=>{
 const env={DB:db,TECRID_API_IP_LIMIT:'1',TECRID_API_PRINCIPAL_LIMIT:'2',TECRID_API_GLOBAL_LIMIT:'30'};
 const outcomes=await Promise.all(Array.from({length:40},(_,i)=>guardMutationRequest(mutation(`198.51.100.${i+1}`,'Bearer synthetic-shared-principal'),env)));
 assert.equal(outcomes.filter(r=>r instanceof Request).length,2);
 assert.equal(outcomes.filter(r=>r.status===429).length,38);
 assert.ok(await guardMutationRequest(mutation('192.0.2.30'),env) instanceof Request);
});

test('the global ceiling still bounds aggregate traffic from many clients',async()=>{
 const env={DB:db,TECRID_API_IP_LIMIT:'1',TECRID_API_GLOBAL_LIMIT:'30'};
 const outcomes=await Promise.all(Array.from({length:31},(_,i)=>guardMutationRequest(mutation(`203.0.113.${i+1}`),env)));
 assert.equal(outcomes.filter(r=>r instanceof Request).length,30);
 assert.equal(outcomes.filter(r=>r.status===429).length,1);
});

test('mutation budgets still fail closed when storage is unavailable',async()=>{
 const result=await guardMutationRequest(mutation('192.0.2.40'),{});
 assert.equal(result.status,503);
 assert.equal(result.headers.get('Cache-Control'),'private, no-store');
});
