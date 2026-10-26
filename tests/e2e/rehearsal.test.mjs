// TECRID-E2E-1: run only against disposable compiled local routes.
// No imports of private application issuers, no credentials read from disk.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {runtime,reviewers} from './runtime.mjs';
import {syntheticPdf} from './pdf.mjs';
test('disposable HTTP rehearsal (synthetic identity prerequisite explicitly separated)',{timeout:900000},async()=>{
const output=resolve(process.env.TECRID_E2E_OUTPUT||'../../outputs/rehearsal');
const full=process.env.TECRID_E2E_VOLUME==='1';
const checks=[],pairs=[],fixtures=[],failures=[];
const check=(name,condition,evidence={})=>{checks.push({name,pass:Boolean(condition),...evidence});if(!condition)failures.push(name);};
const keypair=()=>generateKeyPairSync('ed25519');
const signature=(key,payload)=>sign(null,Buffer.from(payload),key).toString('base64url');
const hash=value=>createHash('sha256').update(value).digest('hex');
const r=await runtime(output);
const {DB,origin}=r;
const scopes=['read','reports:write','credentials:write'];
const bearer=key=>({authorization:'Bearer '+key});
const intent={decision:'approve',reviewNote:'SYNTHETIC review; no actual accreditation/provider lookup',confirmations:{identity:true,accreditation:true,scope:true},registerUrl:'https://register.synthetic.test/FAKE-17025',registerResult:'SYNTHETIC current certificate fixture; no external lookup',registerCheckedAt:'2026-01-01'};
const reportInput={productName:'SYNTHETIC Northstar specimen',productSku:'SYNTHETIC-SKU',laboratoryReportNumber:'SYNTHETIC-COA',sourceSystem:'generic'};
const credentialInput={sampleName:'SYNTHETIC Northstar specimen',productSku:'SYNTHETIC-SKU',matrix:'Synthetic water',method:'SYNTHETIC ICP-MS',publish:true,results:[{analyte:'Synthetic analyte',resultText:'1.0',numericValue:1,unit:'synthetic-unit'}]};
async function key(person,permissions=scopes){return r.request(person,'/api/keys',{label:'SYNTHETIC rehearsal',scopes:permissions});}
async function form(person,signing,overrides={}){
 const values={legalName:'Northstar Analytical (SYNTHETIC)',laboratoryAddress:'SYNTHETIC test laboratory, no physical location',laboratoryWebsite:'https://northstar.synthetic.test',authorityRole:'SYNTHETIC quality officer',accreditationStatus:'accredited',accreditationBody:'SYNTHETIC body',accreditationNumber:'SYNTHETIC-17025',accreditationUrl:intent.registerUrl,scopeSummary:'SYNTHETIC water analysis only',methodFamilies:'SYNTHETIC ICP-MS',contactName:'SYNTHETIC laboratory applicant',contactEmail:person.email,keyId:'synthetic-ed25519',publicKeyJwk:JSON.stringify(signing.publicKey.export({format:'jwk'})),attested:'on',...overrides};
 const response=await person.context.request.post(origin+'/api/issuer-application',{headers:{origin},multipart:{...values,scopeDocument:{name:'SYNTHETIC-scope.pdf',mimeType:'application/pdf',buffer:Buffer.from(syntheticPdf())}}});
 return {status:response.status(),body:await response.json()};
}
async function approve(person,id){
 const path='/api/admin/issuer-applications/'+id;
 const ceremony=await r.request(person,path+'/step-up',intent);if(ceremony.status!==200)return ceremony;
 const response=await person.page.evaluate(async options=>{
  const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
  const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const c=await navigator.credentials.get({publicKey:{...options,challenge:decode(options.challenge),allowCredentials:options.allowCredentials.map(x=>({...x,id:decode(x.id)}))}});
  return {id:c.id,rawId:encode(c.rawId),type:c.type,authenticatorAttachment:c.authenticatorAttachment,clientExtensionResults:c.getClientExtensionResults(),response:{authenticatorData:encode(c.response.authenticatorData),clientDataJSON:encode(c.response.clientDataJSON),signature:encode(c.response.signature),userHandle:c.response.userHandle?encode(c.response.userHandle):null}};
 },ceremony.body.options);
 return r.request(person,path,{...intent,stepUp:{id:ceremony.body.id,response}});
}
async function signedInput(person,apiKey,input,signing){
 const canonical=await r.request(person,'/api/v1/credentials/canonicalize',input,'POST',bearer(apiKey));
 assert.equal(canonical.status,200,'Canonicalization HTTP status');
 return {...input,proof:{algorithm:'Ed25519',keyId:'synthetic-ed25519',signature:signature(signing.privateKey,canonical.body.canonicalPayload)}};
}
async function pool(n,concurrency,fn){let next=0;await Promise.all(Array.from({length:concurrency},async()=>{while(next<n){const i=next++;await fn(i);}}));}
let main,issuerKey,signing,personId;
const load={requested:full?{issuance:5000,keyRequests:1000}:{issuance:0,keyRequests:0},mode:'single-item HTTP; fixed synthetic trusted-edge IP; concurrency 4; no limiter bypass',issued:0,keyRequests:0,keyCreated:0,duplicateIds:0,statuses:{}};
try{
 r.setPhase('controlled-onboarding');
 const admins=[];for(const email of reviewers)admins.push(await r.person(email));
 const combinations=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
 for(let i=0;i<combinations.length;i++){
  const owner=await r.person('synthetic-owner-'+i+'@northstar.synthetic.test'),kp=keypair();
  const onboard=await r.request(owner,'/api/onboarding',{name:'Northstar Analytical SYNTHETIC '+i,organizationType:'laboratory',website:'https://northstar.synthetic.test'});assert.equal(onboard.status,201);
  if(i===0){
   main=owner;signing=kp;
   check('unverified laboratory cannot create write key',(await key(owner)).status===403);
   check('unverified laboratory cannot issue via signed-in HTTP',(await r.request(owner,'/api/credentials',credentialInput)).status===403);
   const freeMail=await r.request(owner,'/api/auth/sign-in/magic-link',{role:'laboratory',email:'synthetic-forbidden@gmail.com',laboratoryWebsite:'https://gmail.com',callbackURL:'/account/passkeys'});
   const webmailAccounts=await DB.prepare("SELECT COUNT(*) n FROM auth_user WHERE email NOT LIKE '%.test'").first();
   check('free-webmail lab signup rejected before account or email creation',freeMail.status===400&&webmailAccounts.n===0,{status:freeMail.status,nonTestAccounts:webmailAccounts.n});
   check('wrong laboratory website domain denied',(await form(owner,kp,{laboratoryWebsite:'https://wrong.synthetic.test'})).status===400);
  }
  const application=await form(owner,kp);assert.equal(application.status,201,'Application form must submit via HTTP');const appId=application.body.application.id;
  if(i===0){
   check('unapproved signing key cannot create write key',(await key(owner)).status===403);
   const bad=await r.request(owner,'/api/issuer-application/key-challenge');assert.equal(bad.status,201);
   const wrong=keypair();check('wrong Ed25519 challenge signature denied',(await r.request(owner,'/api/issuer-application/key-challenge/verify',{challengeId:bad.body.challenge.id,signature:signature(wrong.privateKey,bad.body.challenge.canonicalPayload)})).status===403);
  }
  const challenge=await r.request(owner,'/api/issuer-application/key-challenge');assert.equal(challenge.status,201);
  const challengeProof={challengeId:challenge.body.challenge.id,signature:signature(kp.privateKey,challenge.body.challenge.canonicalPayload)};
  check('challenge passes pair '+i,(await r.request(owner,'/api/issuer-application/key-challenge/verify',challengeProof)).status===200);
  check('replayed challenge denied pair '+i,(await r.request(owner,'/api/issuer-application/key-challenge/verify',challengeProof)).status===400);
  const [a,b]=combinations[i];
  check('missing approval step-up denied pair '+i,(await r.request(admins[a],'/api/admin/issuer-applications/'+appId,intent)).status===403);
  const first=await approve(admins[a],appId);assert.equal(first.status,200,'First distinct approval');
  const state=await DB.prepare('SELECT issuer_status FROM organizations WHERE id=?').bind(onboard.body.organization.id).first();
  check('single approver remains closed pair '+i,state.issuer_status==='application_submitted'&&(await key(owner)).status===403);
  check('same person twice denied pair '+i,(await approve(admins[a],appId)).status===403);
  const second=await approve(admins[b],appId);check('two distinct approvers pass pair '+i,second.status===200&&second.body.review?.status==='approved');
  const count=await DB.prepare('SELECT COUNT(*) n FROM issuer_review_approvals WHERE application_id=?').bind(appId).first();
  pairs.push({pair:[a,b],httpStatus:second.status,distinctVotes:count.n,applicationApproved:second.body.review?.status==='approved'});
  if(i===0){
   // Neither public nor admin HTTP can attest personal government identity.
   const team=await r.request(owner,'/api/lab-team',{action:'request',lab:onboard.body.organization.issuerCode});assert.equal(team.status,200);personId=team.body.id;
   assert.equal((await r.request(owner,'/api/lab-team',{action:'approve',lab:onboard.body.organization.issuerCode,personId,reason:'SYNTHETIC membership approval only'})).status,200);
   check('verified laboratory plus passkey still blocks pending person identity',(await key(owner)).status===403);
   const identitySet=await r.request(admins[0],'/api/lab-team',{action:'verify_identity',lab:onboard.body.organization.issuerCode,personId,reason:'SYNTHETIC attempted unsupported setter'});
   check('no admin identity-verification bypass endpoint',identitySet.status===400);
   // EXPLICIT STAGE BOUNDARY: throwaway external-provider prerequisite fixture.
   // This is not an HTTP provider proof and never changes any real person.
   r.setPhase('synthetic-external-identity-fixture');
   await DB.prepare("UPDATE issuer_people SET identity_status='verified',identity_verified_at=? WHERE id=?").bind(new Date().toISOString(),personId).run();
   r.setPhase('positive-issuance-with-synthetic-attestation');
   const created=await key(owner);assert.equal(created.status,201);issuerKey=created.body.key.plainTextKey;
   const reserve=await r.request(owner,'/api/v1/report-reservations',{...reportInput,idempotencyKey:'synthetic-first-reservation'},'POST',bearer(issuerKey));assert.equal(reserve.status,201);
   const reservation=reserve.body.reservation;
   const duplicate=await r.request(owner,'/api/v1/report-reservations',{...reportInput,idempotencyKey:'synthetic-first-reservation'},'POST',bearer(issuerKey));
   check('reservation HTTP idempotency preserves identifier',duplicate.body.reservation.tecrid===reservation.tecrid);
   const pdf=Buffer.from(syntheticPdf(reservation.tecrid));await writeFile(resolve(output,'SYNTHETIC-marked-COA.pdf'),pdf);
   const input={...credentialInput,sourceDocument:{sha256:hash(pdf),filename:'SYNTHETIC-marked-COA.pdf',reportNumber:reportInput.laboratoryReportNumber}};
   const signed=await signedInput(owner,issuerKey,input,kp);
   const finalPath='/api/v1/report-reservations/'+reservation.id+'/finalize';
   check('wrong payload signature fails closed',(await r.request(owner,finalPath,{...signed,proof:{...signed.proof,signature:signature(keypair().privateKey,'wrong')}},'POST',bearer(issuerKey))).status===403);
   check('unapproved signing key ID fails closed',(await r.request(owner,finalPath,{...signed,proof:{...signed.proof,keyId:'synthetic-unapproved-key'}},'POST',bearer(issuerKey))).status===403);
   const finalized=await r.request(owner,finalPath,signed,'POST',bearer(issuerKey));assert.equal(finalized.status,201,'HTTP finalization');
   const repeat=await r.request(owner,finalPath,signed,'POST',bearer(issuerKey));check('finalize retry is idempotent',repeat.status===200&&repeat.body.idempotent===true);
   const identifier=reservation.tecrid,publicPath='/api/v1/credentials/'+encodeURIComponent(identifier);
   const publicRecord=await r.request(owner,publicPath,undefined,'GET');check('public JSON issued',publicRecord.status===200);
   const page=await r.request(owner,'/records/'+encodeURIComponent(identifier),undefined,'GET');check('public verification page rendered',page.status===200&&page.text.includes('Northstar'));
   await owner.page.goto(origin+'/records/'+encodeURIComponent(identifier));await owner.page.screenshot({path:resolve(output,'public-390.png'),fullPage:true});
   const fp=await r.request(owner,'/api/verification/check',{documentSha256:hash(pdf)});check('PDF fingerprint resolves issued record',fp.status===201&&fp.body.result?.credentialIdentifier===identifier&&fp.body.result?.outcome==='verified_match', {outcome:fp.body?.result?.outcome});
   const altered=await r.request(owner,'/api/verification/check',{documentSha256:hash(Buffer.concat([pdf,Buffer.from('tamper')]))});check('altered PDF has no verified match',altered.body.result?.outcome!=='verified_match');
   const row=await DB.prepare('SELECT issuer_person_id,issuer_user_id,issuer_display_name,issuing_api_key_id FROM credentials WHERE identifier=?').bind(identifier).first();
   check('DB immutable named-person and API-key attribution present',row.issuer_person_id===personId&&row.issuer_user_id===owner.userId&&Boolean(row.issuer_display_name)&&Boolean(row.issuing_api_key_id),{personMatches:row.issuer_person_id===personId,userMatches:row.issuer_user_id===owner.userId,hasDisplayName:Boolean(row.issuer_display_name),hasApiKey:Boolean(row.issuing_api_key_id)});
   const issuedAudit=await DB.prepare("SELECT COUNT(*) n FROM audit_events WHERE entity_id=? AND event_type='credential.issued'").bind(identifier).first();check('issuance audit exists',issuedAudit.n===1);
   const readKey=await key(owner,['read']);assert.equal(readKey.status,201);
   check('read-only key cannot reserve',(await r.request(owner,'/api/v1/report-reservations',reportInput,'POST',bearer(readKey.body.key.plainTextKey))).status===403);
   check('read-only key cannot issue',(await r.request(owner,'/api/v1/credentials',signed,'POST',bearer(readKey.body.key.plainTextKey))).status===403);
   check('invalid or unapproved bearer cannot issue',(await r.request(owner,'/api/v1/credentials',signed,'POST',bearer('tec_live_syntheticinvalid'))).status===403);
   const rev={action:'revoke',reason:'SYNTHETIC rehearsal withdrawal'};
   const canonRev=await r.request(owner,publicPath+'/canonicalize',rev,'POST',bearer(issuerKey));assert.equal(canonRev.status,200);
   const revoked=await r.request(owner,publicPath+'/versions',{...rev,proof:{algorithm:'Ed25519',keyId:'synthetic-ed25519',signature:signature(kp.privateKey,canonRev.body.canonicalPayload)}},'POST',bearer(issuerKey));check('HTTP revocation works',revoked.status===201);
   const revRow=await DB.prepare('SELECT status,issuer_person_id FROM credentials WHERE identifier=?').bind(identifier).first();check('revocation preserves original attribution',revRow.status==='revoked'&&revRow.issuer_person_id===personId);
   const publicRev=await r.request(owner,publicPath,undefined,'GET');check('public record exposes revocation',publicRev.status===200&&JSON.stringify(publicRev.body).includes('revoked'));
   r.setPhase('controlled-onboarding');
  }
 }
 // Applicant is actually on the four-person ICS allowlist AND owns this lab.
 const applicant=admins[3],selfKey=keypair();await r.request(applicant,'/api/onboarding',{name:'SYNTHETIC applicant-owned lab',organizationType:'laboratory'});
 const selfForm=await form(applicant,selfKey,{laboratoryWebsite:'https://ics.test'});assert.equal(selfForm.status,201);
 const self=await r.request(applicant,'/api/admin/issuer-applications/'+selfForm.body.application.id+'/step-up',intent);
 check('applicant also on approver roster cannot self-approve',self.status===403);
 const brand=await r.person('synthetic-brand@brand.synthetic.test');await r.request(brand,'/api/onboarding',{name:'SYNTHETIC brand',organizationType:'brand'});
 check('non-laboratory cannot issue',(await r.request(brand,'/api/credentials',credentialInput)).status===403);
 check('non-laboratory cannot create write key',(await key(brand)).status===403);
 const sandbox=await r.request(brand,'/api/sandbox/session',undefined,'GET');assert.equal(sandbox.status,200);
 let sandboxState=sandbox.body.sandbox;
 for(const action of ['claim','confirm','issue']){const step=await r.request(brand,'/api/sandbox/session',{action,currentStage:sandboxState.stage});if(step.status===200)sandboxState=step.body.sandbox;}
 const sandboxPublicCount=await DB.prepare("SELECT COUNT(*) n FROM credentials WHERE created_by_user_id=? AND public_record=1").bind(brand.userId).first();
 check('issued sandbox session creates no public credential',sandboxState.stage==='issued'&&sandboxPublicCount.n===0);
 const draft=await r.request(brand,'/api/credentials',{...credentialInput,publish:false});assert.equal(draft.status,201);
 const draftIdentifier=draft.body.credential?.tecrid||draft.body.credential?.identifier;
 const hidden=await r.request(brand,'/api/v1/credentials/'+encodeURIComponent(draftIdentifier),undefined,'GET');
 check('private draft absent from public API',hidden.status===404);
 const hiddenPage=await r.request(brand,'/records/'+encodeURIComponent(draftIdentifier),undefined,'GET');
 check('private draft absent from public page',hiddenPage.status===404);
 // Test source-system selectors; these are NOT file parsers or vendor support.
 r.setPhase('synthetic-import-contracts');
 for(const [file,system]of [['LabWare.json','labware'],['LabVantage.json','labvantage'],['STARLIMS.json','starlims'],['Thermo-SampleManager.json','thermo_samplemanager']]){
  const response=await r.request(main,'/api/v1/report-reservations',{...reportInput,sourceSystem:system,idempotencyKey:'synthetic-format-'+system},'POST',bearer(issuerKey));
  fixtures.push({file,sourceSystemSelectorStatus:response.status,rawFileImporter:'NOT SUPPORTED: no laboratory CSV/JSON/PDF importer route in pinned source',vendorSupportClaim:false});
 }
 for(const file of ['LabWare.json','LabVantage.json','STARLIMS.json','Thermo-SampleManager.json']){
 const importResponse=await r.request(main,'/api/v1/credentials',JSON.parse(await readFile('tests/e2e/fixtures/'+file,'utf8')),'POST',bearer(issuerKey));
 fixtures.push({file:'raw '+file+' via credential endpoint',status:importResponse.status,parsed:importResponse.status===201,vendorSupportClaim:false});
 }
 for(const file of ['Agilent-MassHunter-ICP-MS.csv','SYNTHETIC-COA.pdf'])fixtures.push({file,rawFileImporter:'NOT SUPPORTED: no vendor import/OCR route',vendorSupportClaim:false});
 // Shared NAT probes preserve one IP. This intentionally follows onboarding.
 r.setPhase('shared-NAT-email-abuse');
 const natStatuses=[];for(let i=0;i<5;i++)natStatuses.push((await r.request(main,'/api/auth/sign-in/magic-link',{email:'synthetic-nat-'+i+'@nat.synthetic.test',callbackURL:'/account/passkeys'},'POST',{'cf-connecting-ip':'203.0.113.77'})).status);
 check('shared NAT email endpoint eventually rate limits',natStatuses.includes(429),{statuses:natStatuses});
 // Exact requested volume on available single-item HTTP paths, no batch API.
 if(full){
  r.setPhase('load-5000-single-issue');const ids=new Set();const started=performance.now();
  await pool(5000,4,async i=>{
   const input={...credentialInput,sampleName:'SYNTHETIC load specimen '+i,lotNumber:'SYNTHETIC-'+i};
   const signed=await signedInput(main,issuerKey,input,signing);
   const response=await r.request(main,'/api/v1/credentials',signed,'POST',bearer(issuerKey));
   load.statuses[response.status]=(load.statuses[response.status]||0)+1;
   if(response.status===201){load.issued++;const id=response.body.credential.tecrid;if(ids.has(id))load.duplicateIds++;ids.add(id);}
   if((i+1)%1000===0)console.log('Synthetic issuance attempts completed:',i+1);
  });load.issuanceDurationMs=+(performance.now()-started).toFixed(3);
  r.setPhase('load-1000-write-key-requests');const kt=performance.now();
  await pool(1000,4,async()=>{const response=await key(main);load.keyRequests++;if(response.status===201)load.keyCreated++;load.statuses['key-'+response.status]=(load.statuses['key-'+response.status]||0)+1;});load.keyDurationMs=+(performance.now()-kt).toFixed(3);
  check('5000 HTTP credentials issued without duplicate IDs',load.issued===5000&&load.duplicateIds===0);
  check('1000 actual HTTP key requests completed',load.keyRequests===1000);
 }
 r.setPhase('revocation-and-suspension');
 const revokedKey=await key(main);assert.equal(revokedKey.status,201);
 await r.request(main,'/api/keys',{id:revokedKey.body.key.id},'DELETE');
 check('revoked API key cannot reserve',(await r.request(main,'/api/v1/report-reservations',reportInput,'POST',bearer(revokedKey.body.key.plainTextKey))).status===403);
 const lab=(await DB.prepare('SELECT issuer_code,id FROM organizations WHERE owner_user_id=?').bind(main.userId).first());
 const suspend=await r.request(admins[0],'/api/lab-team',{lab:lab.issuer_code,action:'suspend_lab',reason:'SYNTHETIC rehearsal only'});check('HTTP ICS lab suspension',suspend.status===200);
 check('suspended lab key cannot issue',(await r.request(main,'/api/v1/credentials',credentialInput,'POST',bearer(issuerKey))).status===403);
 check('suspended lab cannot create replacement write key',(await key(main)).status===403);
 check('suspended lab cannot resubmit',(await form(main,signing)).status===403);
 const proof=await DB.prepare("SELECT (SELECT COUNT(*) FROM credentials WHERE public_record=1) publicRows,(SELECT COUNT(DISTINCT identifier) FROM credentials WHERE public_record=1) uniquePublicRows,(SELECT COUNT(*) FROM report_reservations) reservations,(SELECT COUNT(*) FROM api_keys) keyRows,(SELECT COUNT(*) FROM api_keys WHERE organization_id=? AND revoked_at IS NULL) activeLabKeys,(SELECT COUNT(*) FROM issuer_people WHERE identity_status='verified') syntheticVerifiedPeople,(SELECT COUNT(*) FROM credential_versions) versions,(SELECT COUNT(*) FROM audit_events WHERE event_type='credential.issued') issuedAudits").bind(lab.id).first();
 check('suspension revokes every laboratory key',proof.activeLabKeys===0);load.databaseProof=proof;
}catch(error){failures.push('Harness stopped: '+error.message);console.error('Rehearsal stopped:',error.message);}
finally{
 const summary={synthetic:true,base:'795557f193909f300cabb29dd7133828de20426a',identityProvider:'NOT CONNECTED; positive issuance uses exactly one explicitly seeded synthetic external attestation after real HTTP pending-identity refusal',businessActions:'actual loopback HTTP routes; DB mutations only schema/setup and one external attestation',physicalFaceIdSafariHomeScreen:'UNVERIFIED; Chromium virtual user-verifying authenticator only',checks,pairs,fixtures,load,failures};
 await writeFile(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
 const groups={};for(const row of r.rows){const label=row.phase+' | '+row.method+' '+row.path;const group=groups[label]||={count:0,statuses:{},latencies:[]};group.count++;group.statuses[row.status]=(group.statuses[row.status]||0)+1;group.latencies.push(row.ms);}
 for(const group of Object.values(groups)){group.latencies.sort((a,b)=>a-b);group.p50Ms=group.latencies[Math.ceil(group.latencies.length*.5)-1];group.p95Ms=group.latencies[Math.ceil(group.latencies.length*.95)-1];delete group.latencies;}
 await writeFile(resolve(output,'latency-summary.json'),JSON.stringify(groups,null,2)+'\n');
 await r.save({checks:checks.length,failedChecks:failures.length,volumeRequested:full});await r.close();
 console.log(JSON.stringify({checks:checks.length,failures,load},null,2));
}
if(failures.length)process.exitCode=1;

assert.equal(failures.length,0,failures.join("; "));
});
