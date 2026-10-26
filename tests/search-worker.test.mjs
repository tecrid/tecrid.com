import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {JSDOM} from 'jsdom';
const outbound=[];
const mf=new Miniflare({modulesRoot:resolve('dist/server'),modules:[{type:'ESModule',path:resolve('dist/server/index.js')},...readdirSync('dist/server',{recursive:true}).filter(f=>/\.m?js$/.test(f)&&f!=='index.js').map(f=>({type:'ESModule',path:resolve('dist/server',f)}))],compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['DOCUMENTS'],serviceBindings:{ASSETS:async request=>{
 const path=new URL(request.url).pathname;const file=resolve('dist/client','.'+path);
 if(!file.startsWith(resolve('dist/client')+'/')||!existsSync(file))return new Response('Not found',{status:404});
 return new Response(readFileSync(file),{headers:{'content-type':path.endsWith('.txt')?'text/plain; charset=utf-8':path.endsWith('.css')?'text/css':'application/octet-stream'}});
}},outboundService:async request=>{outbound.push(request.url);return new Response('Offline local test',{status:503});}});
const rows=[];
const get=path=>mf.dispatchFetch('https://tecrid.com'+path,{redirect:'manual'});
try{
 const db=await mf.getD1Database('DB');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 const sitemap=await (await get('/sitemap.xml')).text();const paths=[...sitemap.matchAll(/<loc>https:\/\/tecrid.com([^<]*)<\/loc>/g)].map(m=>m[1]||'/');
 for(const path of paths){
  const r=await get(path);assert.equal(r.status,200,path);const html=await r.text();const dom=new JSDOM(html);const d=dom.window.document;
  const canonical=d.querySelector('link[rel=canonical]')?.href;assert.equal(canonical?.replace(/\/$/,''),('https://tecrid.com'+path).replace(/\/$/,''),path);
  const schemas=[...d.querySelectorAll('script[type="application/ld+json"]')].map(el=>JSON.parse(el.textContent));const policy=r.headers.get('content-security-policy');assert(policy,path);
  for(const el of d.querySelectorAll('script,style'))el.remove();assert.doesNotMatch(d.body.textContent,/\b(?:pricing|plans?|prices?)\b|unpriced/i,path);assert.equal(d.querySelectorAll('[href*="/pricing"]').length,0,path);
  rows.push({path,status:r.status,canonical,csp:true,schemaTypes:schemas.flatMap(s=>(s['@graph']||[s]).map(n=>n['@type']))});dom.window.close();
 }
 for(const path of ['/pricing','/pricing/','/pricing?source=old','/pricing/?source=old']){const r=await get(path);assert.equal(r.status,404);assert.equal(r.headers.get('location'),null);rows.push({path,status:r.status,location:null,body:await r.text()});}
 for(const path of ['/llms.txt','/robots.txt']){const r=await get(path);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/^text\/plain/);rows.push({path,status:r.status,contentType:r.headers.get('content-type'),body:await r.text()});}
 const r=await get('/unknown-search-worker');assert.equal(r.status,404);rows.push({path:'/unknown-search-worker',status:r.status});
 for(const path of ['/dashboard','/admin/issuers']){const r=await get(path);assert.equal(r.status,307);assert.match(r.headers.get('location'),/^\/sign-in\?/);rows.push({path,status:r.status,location:r.headers.get('location')});}
 assert.equal(outbound.length,0);writeFileSync('../evidence/tecrid-worker.json',JSON.stringify({rows,outbound,localDisposableDatabase:true},null,2));console.log(`PASS ${rows.length} compiled Worker responses, ${paths.length} sitemap pages; zero outbound`);
}finally{await mf.dispose();}
