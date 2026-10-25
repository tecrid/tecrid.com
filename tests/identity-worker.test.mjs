import assert from 'node:assert/strict';
import test from 'node:test';
import {Miniflare} from 'miniflare';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const mf = new Miniflare({modulesRoot:resolve('dist/server'), modules:[{type:'ESModule',path:resolve('dist/server/index.js')}, ...readdirSync('dist/server',{recursive:true}).filter(f=>f.endsWith('.js')&&f!=='index.js').map(f=>({type:'ESModule',path:resolve('dist/server',f)}))], compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],outboundService:()=>{throw Error('Unexpected outbound call');}});
test.after(async()=>mf.dispose());
for (const origin of ['https://tecrid.com', 'https://www.tecrid.com', 'https://tec-registry.kmfp.chatgpt.site', 'https://alternate-origin.workers.dev']) {
 for (const cookie of ['', 'tecrid.session_token=forged', '__Secure-tecrid.session_token=forged']) {
  test(`built Worker rejects forged identity on ${origin} (${cookie || 'no cookie'})`, async () => {
   const r = await mf.dispatchFetch(origin + '/api/notifications', {redirect:'manual',headers:{cookie,'oai-authenticated-user-id':'forged-owner','oai-authenticated-user-email':'admin@example.test'}});
   if (origin.includes('www.tecrid.com')) {assert.equal(r.status,308); assert.equal(r.headers.get('location'),'https://tecrid.com/api/notifications');}
   else {assert.equal(r.status,401); assert.match(await r.text(),/Sign in/);}
  });
 }
}
