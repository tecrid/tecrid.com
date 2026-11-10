// Local-only signed-in preview using the same isolated D1/auth fixture as rendered tests.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {workspaceFixture} from './workspace-fixture.mjs';
const fixture=await workspaceFixture();
fixture.bindings.TECRID_AUTH_URL='http://localhost:3100';
Object.assign(globalThis.__TECRID_WORKER_TEST_BINDINGS__ ||= {},fixture.bindings);
for(const [id,title,path] of [['preview-lab','Lab application submitted','/dashboard/laboratory'],['preview-record','New TECRID issued','/records/TECRID%C2%B7DEMO-26-HM0001']])await fixture.bindings.DB.prepare("INSERT INTO organization_notifications (id,organization_id,event_type,title,body,action_path,entity_type,entity_id,created_at) VALUES (?,'fixture','credential.issued',?,'Local preview update',?,'credential',?,'2026-11-10T12:00:00Z')").bind(id,title,path,id).run();
const {default:worker}=await import('../../dist/server/index.js');
const types={js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',woff2:'font/woff2'};
createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost:3100');
 if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/_')){try{const bytes=await readFile(new URL('../../dist/client'+url.pathname,import.meta.url));res.writeHead(200,{'content-type':types[url.pathname.split('.').pop()]||'application/octet-stream'});res.end(bytes);return;}catch{}}
 const headers=new Headers(req.headers);for(const [k,v]of Object.entries(fixture.headers))if(!['host','accept'].includes(k))headers.set(k,v);
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const response=await worker.fetch(new Request(url,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})}),fixture.bindings,{waitUntil(){},passThroughOnException(){}});
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.writeHead(500);res.end(String(e));}
}).listen(3100,'127.0.0.1',()=>console.log('Signed-in fixture preview: http://localhost:3100/dashboard'));
