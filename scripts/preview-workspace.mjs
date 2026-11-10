// Local screenshot fixture only. Never imported by the application or deployed.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { workspaceFixture } from '../tests/support/workspace-fixture.mjs';
const fixture=await workspaceFixture();
Object.assign(globalThis.__TECRID_WORKER_TEST_BINDINGS__ ||= {},fixture.bindings);
const current=await import('../dist/server/index.js');
const before=process.env.WORKSPACE_BEFORE_DIST ? await import(resolve(process.env.WORKSPACE_BEFORE_DIST,'server/index.js')) : current;
const mime={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon','.jpg':'image/jpeg'};
createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost:4177');
  const isBefore=url.pathname.startsWith('/before/');
  const path=isBefore ? url.pathname.slice(7) : url.pathname;
  if(path.startsWith('/_next/static/')||path.startsWith('/assets/')||path.startsWith('/icons/')||path.startsWith('/brand/')) {
    const base=(path.startsWith('/assets/')||path.startsWith('/_next/static/')) ? (isBefore?process.env.WORKSPACE_BEFORE_DIST+'/client':'dist/client') : 'public';
    const data=await readFile(resolve(base,'.'+path));
    res.setHeader('content-type',mime[path.slice(path.lastIndexOf('.'))]||'application/octet-stream');res.end(data);return;
  }
  const worker=isBefore?before.default:current.default;
  const response=await worker.fetch(new Request('http://localhost'+path+url.search,{headers:fixture.headers}),{...fixture.bindings,ASSETS:{fetch:async()=>new Response('',{status:404})}},{waitUntil(){},passThroughOnException(){}});
  res.statusCode=response.status;res.setHeader('content-type','text/html');
  // Prevent a static fixture from sending any API request, emails, or real writes.
  let html=await response.text();html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
  if(isBefore) html=html.replaceAll('href="/_next/static/','href="/before/_next/static/');
  res.end(html);
 } catch(error){res.statusCode=500;res.end(String(error));}
}).listen(4177,'127.0.0.1',()=>console.log('Local screenshot fixture http://localhost:4177'));
