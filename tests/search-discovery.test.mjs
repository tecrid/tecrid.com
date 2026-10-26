import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import worker from '../dist/server/index.js';

const env={DB:null, ASSETS:{fetch:async request=>{
 const path=new URL(request.url).pathname;
 if(path!=='/llms.txt')return new Response('Not found',{status:404});
 return new Response(await readFile(new URL('../public/llms.txt',import.meta.url),'utf8'),{headers:{'content-type':'text/plain; charset=utf-8'}});
}}};
async function fetchPage(path='/',headers={},method='GET'){
 return worker.fetch(new Request('https://tecrid.com'+path,{method,headers:{accept:'text/html',...headers}}),env,{waitUntil(){},passThroughOnException(){}});
}

test('public guide, robots and existing identity graph describe only linked public pages',async()=>{
 const response=await fetchPage('/llms.txt');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^text\/plain/);
 const guide=await response.text();assert.equal(guide,await readFile(new URL('../public/llms.txt',import.meta.url),'utf8'));
 assert.doesNotMatch(guide,/pricing|\bplans?\b|\bprices?\b|partners|[\u2013\u2014]/i);assert.match(guide,/## Citation/);assert.match(guide,/## Contact/);
 const robots=await (await fetchPage('/robots.txt')).text();assert.match(robots,/Allow: \/llms.txt/);
 for(const path of ['/admin/','/api/','/certify/','/confirm/','/dashboard/','/join/success'])assert(robots.includes('Disallow: '+path));
 const links=[...guide.matchAll(/\]\((https:\/\/tecrid.com[^)]*)\)/g)].map(m=>m[1]);
 for(const link of links){const r=await fetchPage(new URL(link).pathname);assert.equal(r.status,200,link);const dom=new JSDOM(await r.text());
 assert.equal(dom.window.document.querySelector('link[rel=canonical]')?.href.replace(/\/$/,''),link.replace(/\/$/,''));dom.window.close();}
 const home=new JSDOM(await (await fetchPage()).text());const graphs=[...home.window.document.querySelectorAll('script[type="application/ld+json"]')].flatMap(el=>JSON.parse(el.textContent)['@graph']||[]);
 for(const type of ['Organization','WebSite'])assert.equal(graphs.filter(n=>n['@type']===type).length,1,type);
 assert.equal(graphs.find(n=>n['@type']==='WebSite').name,'TECRID');assert.equal(graphs.find(n=>n['@type']==='Organization').name,'Institute of Contaminant Standards');home.window.close();
});

test('fresh CSP nonce covers executable bootstrap scripts and ignores browser policy injection',async()=>{
 const nonces=[];
 for(let i=0;i<2;i++){
  const r=await fetchPage('/',{'content-security-policy':"script-src 'unsafe-inline' 'nonce-forged'",'content-security-policy-report-only':"script-src 'nonce-forged'"});assert.equal(r.status,200);
  const policy=r.headers.get('content-security-policy');assert(policy);const nonce=policy.match(/'nonce-([a-f0-9]{32})'/)?.[1];assert(nonce);nonces.push(nonce);
  assert.doesNotMatch(policy,/forged|unsafe-eval/);assert.match(policy,/object-src 'none'/);assert.match(policy,/frame-ancestors 'none'/);assert.match(r.headers.get('cache-control'),/no-store/);
  const dom=new JSDOM(await r.text());const scripts=[...dom.window.document.querySelectorAll('script')].filter(el=>!['application/ld+json','application/json'].includes(el.type));assert(scripts.length>0);
  for(const el of scripts)assert.equal(el.nonce,nonce,el.outerHTML.slice(0,120));dom.window.close();
 }
 assert.notEqual(nonces[0],nonces[1]);
});

test('retired and unknown routes stay 404, public copy is clean and join keeps its canonical',async()=>{
 for(const path of ['/pricing','/pricing/','/pricing?old=1','/pricing/?old=1'])for(const method of ['GET','HEAD']){
  const r=await fetchPage(path,{},method);assert.equal(r.status,404);assert.equal(r.headers.get('location'),null);assert.equal(await r.text(),method==='HEAD'?'':'Not found');
 }
 assert.equal((await fetchPage('/unknown-search-check')).status,404);
 const unknownSlash=await fetchPage('/unknown-search-check/');assert.equal(unknownSlash.status,308);assert.equal(new URL(unknownSlash.headers.get('location'),'https://tecrid.com').href,'https://tecrid.com/unknown-search-check');
 for(const path of ['/','/join','/privacy','/developers','/laboratory-value','/demo/lab-defense']){
  const r=await fetchPage(path);assert.equal(r.status,200,path);const dom=new JSDOM(await r.text());for(const el of dom.window.document.querySelectorAll('script,style'))el.remove();
  assert.doesNotMatch(dom.window.document.body.textContent,/\b(?:pricing|plans?|prices?)\b|unpriced/i,path);
  assert.equal(dom.window.document.querySelectorAll('[href*="/pricing"]').length,0,path);
  if(path==='/join')assert.equal(dom.window.document.querySelector('link[rel=canonical]').href,'https://tecrid.com/join');dom.window.close();
 }
 assert.doesNotMatch(await (await fetchPage('/sitemap.xml')).text(),/\/pricing/);
});
