// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {Miniflare} from 'miniflare';
const native=vi.hoisted(()=>({fetch:function(this:unknown,_input:unknown,init:any){if(this!==globalThis)throw new TypeError('Illegal invocation');return Promise.resolve(Response.json({ok:true,cache:init.cache,redirect:init.redirect}));}}));
vi.mock('vinext/shims/fetch-cache',()=>({getOriginalFetch:()=>native.fetch}));
import {privateFetch,privateFetchWith} from '../lib/private-fetch';
it('retains the fetch receiver, disables caching and replaces unsupported redirect mode',async()=>{
 expect(()=>{const detached=native.fetch;return detached('https://relay.test',{});}).toThrow('Illegal invocation');
 const r=await privateFetch('https://relay.test',{method:'POST',redirect:'error',body:'synthetic',headers:{'content-type':'application/json'}});expect(await r.json()).toEqual({ok:true,cache:'no-store',redirect:'manual'});
});
it('sends private POSTs in real workerd and refuses redirects without forwarding credentials',async()=>{
 const calls:string[]=[];
 const mf=new Miniflare({modules:true,compatibilityDate:'2026-05-22',outboundService:async request=>{calls.push(request.url);expect(request.headers.get('authorization')).toBe('Bearer synthetic-test-only');return request.url.endsWith('/redirect')?new Response(null,{status:302,headers:{location:'https://unapproved.test/steal'}}):new Response('synthetic');},script:`const send=${privateFetchWith.toString()};export default {async fetch(){let nativeRejected=false,redirectRejected=false;try{await fetch('https://relay.test/send',{method:'POST',redirect:'error'});}catch(e){nativeRejected=e instanceof TypeError;}const r=await send(fetch,'https://relay.test/send',{method:'POST',redirect:'error',signal:AbortSignal.timeout(3000),headers:{authorization:'Bearer synthetic-test-only'}});try{await send(fetch,'https://relay.test/redirect',{method:'POST',redirect:'error',headers:{authorization:'Bearer synthetic-test-only'}});}catch(e){redirectRejected=e.message==='Private service redirects are not allowed.';}return Response.json({nativeRejected,status:r.status,redirectRejected});}}`});
 try{expect(await (await mf.dispatchFetch('https://worker.test')).json()).toEqual({nativeRejected:true,status:200,redirectRejected:true});expect(calls).toEqual(['https://relay.test/send','https://relay.test/redirect']);}finally{await mf.dispose();}
},30000);
