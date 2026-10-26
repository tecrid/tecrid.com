// PR0b-only HTTP/browser tests. Full issuance and volume E2E is a separate order.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Miniflare} from 'miniflare';
import {chromium} from 'playwright';
const reviewers=['a','b','c','d'].map(id=>({email:'synthetic-reviewer-'+id+'@ics.test',label:'Synthetic reviewer '+id.toUpperCase()}));
const pairs=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
function syntheticPdf(){
 const stream='BT /F1 14 Tf 36 100 Td (SYNTHETIC ISO 17025 scope. Test only.) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 390 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}const xref=Buffer.byteLength(pdf);
 return pdf+'xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
}
test('virtual platform passkeys and all six independent review pairs work on real HTTP at 390px',{timeout:180000},async()=>{
 const output=resolve(process.env.TECRID_TEST_OUTPUT||'../../outputs/PR0b'),shots=resolve(output,'screenshots');await mkdir(shots,{recursive:true});
 const mf=new Miniflare({modules:true,script:'export default{fetch(){return new Response("test")}}',compatibilityDate:'2026-05-22',d1Databases:['DB'],r2Buckets:['DOCUMENTS']});
 const DB=await mf.getD1Database('DB'),DOCUMENTS=await mf.getR2Bucket('DOCUMENTS'),mail=new Map(),transportCalls=[];
 const nativeFetch=globalThis.fetch;let browser,server,worker,origin;
 try{
  for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await DB.prepare(sql).run();
  const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
  server=createServer(async(req,res)=>{try{
   const url=new URL(req.url,origin);
   if(url.pathname.startsWith('/_next/')||/\.(svg|png|ico|woff2|webmanifest)$/.test(url.pathname))for(const dir of ['dist/client','public']){const base=resolve(dir),path=resolve(base,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(base+'/'))continue;try{res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});res.end(await readFile(path));return;}catch{/* Next root. */}}
   const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const response=await worker.fetch(new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),globalThis.__TECRID_WORKER_TEST_BINDINGS__,{waitUntil(){},passThroughOnException(){}});
   const out=Object.fromEntries(response.headers),cookies=response.headers.getSetCookie();if(cookies.length)out['set-cookie']=cookies;
   res.writeHead(response.status,out);res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Synthetic preview request failed.');}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://localhost:'+server.address().port;
  globalThis.__TECRID_WORKER_TEST_BINDINGS__={DB,DOCUMENTS,TECRID_AUTH_URL:origin,TECRID_AUTH_SECRET:'synthetic-local-auth-only-'.repeat(3),TECRID_EMAIL_RELAY_SECRET:'synthetic-mail-only',TECRID_EMAIL_RELAY_URL:'https://mail.synthetic.test/relay',ICS_ADMIN_EMAILS:reviewers.map(r=>r.email).join(',')};
  globalThis.fetch=async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input.url||String(input));
   if(url.hostname==='mail.synthetic.test'){const body=JSON.parse(init.body);mail.set(body.email,body.url);transportCalls.push('intercepted-mail');return Response.json({id:'synthetic-no-delivery'});}
   if(url.origin===origin)return nativeFetch(input,init);transportCalls.push('blocked-external');throw Error('External transport blocked in test.');
  };
  ({default:worker}=await import(pathToFileURL(resolve('dist/server/index.js'))));
  browser=await chromium.launch({headless:true,...(process.env.TECRID_TEST_BROWSER_EXECUTABLE?{executablePath:process.env.TECRID_TEST_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
  const contexts=[];
  async function person(index,email=reviewers[index].email){
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,extraHTTPHeaders:{"cf-connecting-ip":"192.0.2."+(contexts.length+1)}});contexts.push(context);
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');
   const virtual=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',ctap2Version:'ctap2_1',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
   const requested=await context.request.post(origin+'/api/auth/sign-in/magic-link',{headers:{origin},data:{email,callbackURL:'/account/passkeys'}});assert.equal(requested.status(),200);
   assert(mail.get(email));await page.goto(mail.get(email));await page.getByRole('button',{name:'Save a passkey',exact:true}).waitFor();
   await page.getByRole('button',{name:'Save a passkey',exact:true}).click();await page.getByText('Passkey saved. Your device confirms future sign-ins and each approval.',{exact:true}).waitFor();
   const keys=await cdp.send('WebAuthn.getCredentials',{authenticatorId:virtual.authenticatorId});assert.equal(keys.credentials.length,1);
   const u=await DB.prepare('SELECT id FROM auth_user WHERE email=?').bind(email).first();await DB.prepare('UPDATE auth_user SET name=? WHERE id=?').bind(email===reviewers[index].email?reviewers[index].label:'Synthetic non-approver',u.id).run();
   return {context,page,cdp,userId:u.id};
  }
  const people=[];for(let i=0;i<4;i++)people.push(await person(i));
  await people[0].context.request.post(origin+'/api/auth/sign-out',{headers:{origin},data:{}});
  await people[0].page.goto(origin+'/sign-in?return_to=/account/passkeys');await people[0].page.getByRole('button',{name:'Use Face ID',exact:true}).click();await people[0].page.waitForURL('**/account/passkeys');
  assert.equal((await DB.prepare('SELECT id FROM auth_passkey').all()).results.length,4);
  const stolen=await browser.newContext();contexts.push(stolen);await stolen.addCookies((await people[0].context.cookies()).filter(cookie=>cookie.name.includes('session_token')));
  assert.equal((await stolen.request.get(origin+'/api/auth/passkey/generate-register-options')).status(),403);
  const other=await person(0,'synthetic-non-approver@account.test');
  assert.equal((await other.context.request.get(origin+'/admin/issuers')).status(),403);
  assert.equal((await other.context.request.post(origin+'/api/admin/issuer-applications/not-real/step-up',{headers:{origin},data:{decision:'reject',reviewNote:'Synthetic'}})).status(),403);
  async function seed(index){
   const id='synthetic-phone-'+index,org='org-'+id,at=new Date(Date.now()+index).toISOString();
   await DB.prepare("INSERT INTO organizations(id,name,slug,organization_type,owner_user_id,owner_email,issuer_code,issuer_status) VALUES(?,?,?,'laboratory',?,'quality@synthetic-lab.test',?,'application_submitted')").bind(org,'SYNTHETIC Northstar Analytical',org,'synthetic-lab-owner','SYNTHETIC'+index).run();
   await DB.prepare("INSERT INTO issuer_applications(id,organization_id,legal_name,laboratory_address,laboratory_website,authority_role,accreditation_body,accreditation_number,accreditation_url,scope_summary,method_families,contact_name,contact_email,public_key_jwk,key_id,submitted_at) VALUES(?,?,?,'Synthetic laboratory address','https://synthetic-lab.test','Synthetic quality director','SYNTHETIC accreditation body','FAKE-17025','https://register.synthetic.test/FAKE','SYNTHETIC testing scope only','SYNTHETIC method','Synthetic contact','quality@synthetic-lab.test','{}','synthetic-key',?)").bind(id,org,'SYNTHETIC Northstar Analytical',at).run();
   await DB.prepare("INSERT INTO audit_events(id,organization_id,event_type,entity_type,entity_id,payload) VALUES(?,?,'issuer.application_submitted','issuer_application',?,'{\"signupVerificationVersion\":1}')").bind('audit-'+id,org,id).run();
   await DOCUMENTS.put('synthetic/'+id+'.pdf',syntheticPdf(),{httpMetadata:{contentType:'application/pdf'}});
   await DB.prepare("INSERT INTO issuer_application_documents(id,application_id,organization_id,document_type,object_key,filename,mime_type,size,sha256,uploaded_by_user_id) VALUES(?,?,?,'accreditation_scope',?,'SYNTHETIC-scope.pdf','application/pdf',?,'synthetic-only','synthetic-lab-owner')").bind('doc-'+id,id,org,'synthetic/'+id+'.pdf',Buffer.byteLength(syntheticPdf())).run();
   for(const type of ['key_control','conformance'])await DB.prepare("INSERT INTO issuer_verification_checks(id,application_id,organization_id,check_type,status) VALUES(?,?,?,?,'passed')").bind(id+'-'+type,id,org,type).run();return id;
  }
  const results=[];let views=0;
  for(let i=0;i<pairs.length;i++){
   const id=await seed(i),[a,b]=pairs[i],endpoint=origin+'/api/admin/issuer-applications/'+id;
   const input={decision:'approve',reviewNote:'Synthetic HTTP review',confirmations:{identity:true,accreditation:true,scope:true},registerUrl:'https://register.synthetic.test/FAKE',registerResult:'SYNTHETIC current certificate and scope match',registerCheckedAt:'2026-01-01'};
   assert.equal((await people[a].context.request.post(endpoint,{headers:{origin},data:input})).status(),403);
   async function approve(personIndex,second=false){
    const {page,context}=people[personIndex];await page.goto(origin+'/admin/issuers/'+id);await page.getByRole('heading',{name:'Your three checks',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>innerWidth),390);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));views++;
    assert.equal(await page.locator('.phone-review-actions button').count(),2);if(second)assert(await page.getByText(reviewers[a].label,{exact:false}).count()>0);
    const pdf=await context.request.get(origin+'/api/issuer-application/evidence/doc-'+id);assert.equal(pdf.status(),200);assert.match(pdf.headers()['content-type'],/application\/pdf/);
    for(const text of ['Identity and authority match the laboratory.','ISO/IEC 17025 certificate is current in the public register.','The scope PDF covers the requested methods and scope.'])await page.getByLabel(text,{exact:true}).check();
    await page.getByLabel('Register lookup result',{exact:true}).fill(input.registerResult);await page.getByLabel('Register lookup date',{exact:true}).fill(input.registerCheckedAt);await page.getByLabel('Decision reason',{exact:true}).fill(input.reviewNote);
    if(i===0)await page.screenshot({path:resolve(shots,second?'review-second-390.png':'review-first-390.png'),fullPage:true});
    await page.getByRole('button',{name:'Approve',exact:true}).click();try{await page.waitForURL('**/admin/issuers',{timeout:12000});}catch{await page.screenshot({path:resolve(shots,'review-failure-390.png'),fullPage:true});throw Error(await page.locator('.phone-review-decision [role=status]').innerText());}
   }
   await approve(a);assert.equal((await DB.prepare('SELECT status FROM issuer_applications WHERE id=?').bind(id).first()).status,'submitted');
   assert.equal((await people[a].context.request.post(endpoint+'/step-up',{headers:{origin},data:input})).status(),403);
   await approve(b,true);assert.equal((await DB.prepare('SELECT status FROM issuer_applications WHERE id=?').bind(id).first()).status,'approved');
   assert.equal((await DB.prepare('SELECT id FROM issuer_review_approvals WHERE application_id=?').bind(id).all()).results.length,2);
   const audits=(await DB.prepare("SELECT payload FROM audit_events WHERE entity_id=? AND event_type IN ('issuer.application_approval_recorded','issuer.application_approved')").bind(id).all()).results;assert.equal(audits.length,2);
   for(const event of audits){const p=JSON.parse(event.payload);assert.equal(p.passkeyUserVerified,true);assert(p.credentialId);assert(p.passkeyVerifiedAt);}
   results.push({pair:[a,b],approved:true,missingStepUpDenied:true,sameApproverDenied:true});
  }
  let labPeople=null;
  if(process.env.TECRID_TEST_LAB_PEOPLE==='1'){
   const owner=await person(0,'owner@synthetic-lab.test'),staff=await person(0,'staff@synthetic-lab.test');
   await DB.prepare("UPDATE organizations SET owner_user_id=?,owner_email='owner@synthetic-lab.test' WHERE id='org-synthetic-phone-0'").bind('email:'+owner.userId).run();
   await DB.prepare("INSERT INTO organization_members(organization_id,user_id,email,role) VALUES('org-synthetic-phone-0',?,'owner@synthetic-lab.test','owner')").bind('email:'+owner.userId).run();
   await staff.page.goto(origin+'/dashboard/team');
   await staff.page.getByLabel('Laboratory code',{exact:true}).fill('SYNTHETIC0');
   await staff.page.getByRole('button',{name:'Request membership',exact:true}).click();
   await staff.page.getByText(/identity pending/).first().waitFor();
   const request=await DB.prepare("SELECT id FROM issuer_people WHERE user_id=?").bind('email:'+staff.userId).first();assert(request);
   await owner.page.goto(origin+'/dashboard/team');await owner.page.getByRole('button',{name:'Approve membership',exact:true}).waitFor();
   assert.match((await owner.context.request.get(origin+'/dashboard/team')).headers()['cache-control'],/private.*no-store/);
   assert(await owner.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await owner.page.screenshot({path:resolve(shots,'lab-owner-team-390.png'),fullPage:true});
   const pendingCard=owner.page.locator('article').filter({hasText:'staff@synthetic-lab.test'});
   await pendingCard.getByLabel('Reason',{exact:true}).first().fill('Synthetic lab owner approval');
   await pendingCard.getByRole('button',{name:'Approve membership',exact:true}).click();
   await owner.page.getByText('Membership active · identity pending',{exact:true}).waitFor();
   const denied=await staff.context.request.post(origin+'/api/keys',{headers:{origin},data:{label:'Synthetic denied issuance',scopes:['credentials:write']}});assert.equal(denied.status(),403);
   const forbiddenRoster=await other.context.request.get(origin+'/api/lab-team?lab=SYNTHETIC0');assert.equal(forbiddenRoster.status(),403);
   assert.equal((await other.context.request.get(origin+'/dashboard/team?lab=SYNTHETIC0')).status(),404);
   await people[0].page.goto(origin+'/dashboard/team?lab=SYNTHETIC0');
   assert(await people[0].page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await people[0].page.screenshot({path:resolve(shots,'ics-team-390.png'),fullPage:true});
   const personCard=people[0].page.locator('article').filter({hasText:'staff@synthetic-lab.test'});
   await personCard.getByLabel('Reason',{exact:true}).fill('Synthetic ICS person suspension');
   await personCard.getByRole('button',{name:'Suspend person and revoke keys',exact:true}).click();
   await people[0].page.getByText('Membership suspended · identity pending',{exact:true}).waitFor();
   assert.equal((await DB.prepare('SELECT status FROM issuer_people WHERE id=?').bind(request.id).first()).status,'suspended');
   assert.equal((await DB.prepare("SELECT id FROM audit_events WHERE entity_id=? AND event_type='issuer_person.suspend'").bind(request.id).all()).results.length,1);
   labPeople={scope:'PR0c team HTTP only; synthetic identity remains pending',enrolledAdditionalPlatformAuthenticators:2,joinRequestViaPhone:true,ownerApprovalViaPhone:true,pendingIdentityWriteKeyDenied:true,foreignRosterDenied:true,icsSuspensionViaPhone:true,privateNoStore:true,phoneWidth:390,teamViewsWithoutOverflow:2,externalCalls:0};
   await writeFile(resolve(output,'lab-people-http-receipt.json'),JSON.stringify(labPeople,null,2)+'\n');
  }
  await people[0].page.goto(origin+'/admin/issuers');await people[0].page.screenshot({path:resolve(shots,'waiting-list-390.png'),fullPage:true});
  await writeFile(resolve(output,'http-browser-receipt.json'),JSON.stringify({scope:'PR0b passkey and phone approval HTTP only',synthetic:true,reviewerCount:4,virtualPlatformAuthenticators:5,enrolled:5,passkeyOnlySignIn:true,sessionOnlyEnrollmentDenied:true,nonApproverDenied:true,allSixPairs:results,phoneWidth:390,phoneViewsWithoutHorizontalOverflow:views,pdfHttpReads:12,interceptedEmailLinks:transportCalls.filter(c=>c==='intercepted-mail').length,actualExternalCalls:0,physicalFaceIdSafariHomeScreen:'UNVERIFIED',fullIssuanceVolumeHarness:'NOT PERFORMED'},null,2)+'\n');
  for(const context of contexts)await context.close();
 }finally{await browser?.close();globalThis.fetch=nativeFetch;await new Promise(done=>server?server.close(done):done());await mf.dispose();}
});
