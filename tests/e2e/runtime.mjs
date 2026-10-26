// Derived from tests/passkey-phone.http.test.mjs. Only D1/R2 are emulated;
// every business request crosses loopback HTTP into the compiled router.
import {createServer} from 'node:http';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {Miniflare} from 'miniflare';
import {chromium} from 'playwright';
export const reviewers=['a','b','c','d'].map(id=>'synthetic-reviewer-'+id+'@ics.test');
export async function runtime(output){
 await mkdir(output,{recursive:true});
 const mf=new Miniflare({modules:true,script:'export default{fetch(){return new Response("fixture")}}',compatibilityDate:'2026-05-22',d1Databases:['DB'],r2Buckets:['DOCUMENTS']});
 const DB=await mf.getD1Database('DB'),DOCUMENTS=await mf.getR2Bucket('DOCUMENTS');
 const migrations=(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort();
 for(const f of migrations)for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await DB.prepare(sql).run();
 const mail=new Map(),rows=[],contexts=[];let origin,worker,browser,phase='setup',interceptedMail=0,blockedExternal=0,serverErrors=0;
 const normalize=path=>path.replace(/issuer_app_[^/]+/g,':application').replace(/reservation_[^/]+/g,':reservation').replace(/issuer_doc_[^/]+/g,':document').replace(/TECRID[^/]+/gi,':tecrid').replace(/\/api\/auth\/magic-link\/verify.*/, '/api/auth/magic-link/verify');
 const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
 const nativeFetch=globalThis.fetch;
 const server=createServer(async(req,res)=>{const t=performance.now();const requestPhase=phase;let status=500;const url=new URL(req.url,origin);
  try{
   if(url.pathname.startsWith('/_next/')||/\.(svg|png|ico|woff2|webmanifest)$/.test(url.pathname))for(const dir of ['dist/client','public']){const base=resolve(dir),path=resolve(base,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(base+'/'))continue;try{const bytes=await readFile(path);status=200;res.writeHead(status,{'content-type':types[extname(path)]||'application/octet-stream'});res.end(bytes);return;}catch{/* Try next asset root. */}}
   const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const response=await worker.fetch(new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),globalThis.__TECRID_WORKER_TEST_BINDINGS__,{waitUntil(){},passThroughOnException(){}});
   const out=Object.fromEntries(response.headers),cookies=response.headers.getSetCookie();if(cookies.length)out['set-cookie']=cookies;
   const body=Buffer.from(await response.arrayBuffer());status=response.status;res.writeHead(status,out);res.end(body);
  }catch{serverErrors++;res.writeHead(500);res.end('Synthetic rehearsal request failed.');}
  finally{rows.push({phase:requestPhase,method:req.method,path:normalize(url.pathname),status,ms:+(performance.now()-t).toFixed(3)});}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://localhost:'+server.address().port;
 globalThis.__TECRID_WORKER_TEST_BINDINGS__={DB,DOCUMENTS,TECRID_AUTH_URL:origin,TECRID_AUTH_SECRET:randomBytes(48).toString('base64url'),TECRID_EMAIL_RELAY_SECRET:randomBytes(32).toString('base64url'),TECRID_EMAIL_RELAY_URL:'https://mail.synthetic.test/relay',ICS_ADMIN_EMAILS:reviewers.join(',')};
 globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'?input:input.url||String(input));
  if(url.href==='https://mail.synthetic.test/relay'){const body=JSON.parse(init.body);mail.set(body.email,body.url);interceptedMail++;return Response.json({id:'synthetic-no-delivery'});}
  if(url.origin===origin)return nativeFetch(input,init);blockedExternal++;throw Error('External application transport blocked.');
 };
 try{
  ({default:worker}=await import(pathToFileURL(resolve('dist/server/index.js'))));
  browser=await chromium.launch({headless:true,...(process.env.TECRID_TEST_BROWSER_EXECUTABLE?{executablePath:process.env.TECRID_TEST_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
 }catch(error){globalThis.fetch=nativeFetch;await new Promise(r=>server.close(r));await mf.dispose();throw error;}
 async function person(email){
  // Controlled onboarding fixtures only. Load/abuse phases keep ONE fixed IP.
  const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'cf-connecting-ip':'192.0.2.'+(contexts.length+1)}});contexts.push(context);
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',ctap2Version:'ctap2_1',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  const response=await context.request.post(origin+'/api/auth/sign-in/magic-link',{headers:{origin},data:{email,name:'SYNTHETIC test person '+contexts.length,callbackURL:'/account/passkeys'}});
  if(response.status()!==200||!mail.has(email))throw Error('Synthetic email enrollment unavailable: HTTP '+response.status());
  await page.goto(mail.get(email));await page.getByRole('button',{name:'Save a passkey',exact:true}).click();await page.getByText('Passkey saved. Your device confirms future sign-ins and each approval.',{exact:true}).waitFor();
  const user=await DB.prepare('SELECT id FROM auth_user WHERE email=?').bind(email).first();
  return {context,page,email,userId:'email:'+user.id};
 }
 async function request(person,path,data,method='POST',extraHeaders={}){
  const client=person?.context.request||browser.contexts()[0].request;
  const response=await client.fetch(origin+path,{method,headers:{origin,'cf-connecting-ip':'198.51.100.77',...extraHeaders},...(data===undefined?{}:{data})});
  const raw=await response.text();let body;try{body=JSON.parse(raw);}catch{body=null;}
  return {status:response.status(),body,text:raw,headers:response.headers()};
 }
 return {DB,browser,origin,rows,migrations,person,request,setPhase:value=>{phase=value;},
  async save(extra={}){await writeFile(resolve(output,'http-statuses.csv'),'phase,method,path,status,ms\n'+rows.map(r=>[r.phase,r.method,r.path,r.status,r.ms].join(',')).join('\n')+'\n');await writeFile(resolve(output,'runtime-receipt.json'),JSON.stringify({synthetic:true,migrations,interceptedMail,blockedExternal,actualExternalApplicationCalls:0,serverErrors,httpRequests:rows.length,...extra},null,2)+'\n');},
  async close(){globalThis.fetch=nativeFetch;await browser.close();await new Promise(r=>server.close(r));await mf.dispose();delete globalThis.__TECRID_WORKER_TEST_BINDINGS__;}
 };
}
