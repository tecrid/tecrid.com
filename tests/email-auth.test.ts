// @vitest-environment node
import {it} from "vitest";
import {env} from "./support/cloudflare-env";
import {getEmailUser} from "../lib/email-auth";
import {onboardOrganization,submitIssuerApplication} from "../lib/tec";
import {upsertParticipantProfile} from "../lib/sharing";
import {reserveReportTecrid} from "../lib/report-issuance";
import {kasandrinosTestWorkspace} from "../lib/kasandrinos-test-workspace";
import {protectedTestReport} from "../lib/test-report-access";
import {sampleLabReports} from "../lib/sample-lab";
import {safeReturnPath} from "../lib/auth-return-path";
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {drizzle} from 'drizzle-orm/d1';
import * as schema from '../db/schema.ts';
import {createEmailAuth} from '../lib/email-auth-factory.ts';
it('email login, mailbox isolation, onboarding, profile, security and production gate',async()=>{
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',d1Databases:['DB'],r2Buckets:['DOCUMENTS'],compatibilityDate:'2026-05-22'});
try{
const db=await mf.getD1Database('DB');
env.DB=db;env.DOCUMENTS=await mf.getR2Bucket('DOCUMENTS');env.TECRID_AUTH_SECRET='local-test-only-'.repeat(4);env.TECRID_AUTH_URL='https://tecrid.test';env.RESEND_API_KEY='synthetic-resend-key';env.TECRID_EMAIL_FROM='TECRID <no-reply@tecrid.com>';
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
let mail=[],ip=1;
const mailConfig={apiKey:'synthetic-resend-key',from:'TECRID <no-reply@tecrid.com>'};
const auth=createEmailAuth(drizzle(db,{schema}),schema,{secret:'local-test-only-'.repeat(4),baseURL:'https://tecrid.test',email:mailConfig},async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers.authorization,'Bearer synthetic-resend-key');assert(options.headers['idempotency-key'].startsWith('tecrid-signin-'));const body=JSON.parse(options.body);assert.equal(body.from,'TECRID <no-reply@tecrid.com>');assert.equal(body.to.length,1);assert(!/vle/i.test(body.text));mail.push({email:body.to[0],url:body.text.match(/https:\/\/\S+/)[0]});return Response.json({id:'test-message'});});
const call=(path,body,cookie='',origin='https://tecrid.test')=>auth.handler(new Request('https://tecrid.test/api/auth/'+path,{method:body?'POST':'GET',headers:{origin,'Content-Type':'application/json','cf-connecting-ip':`192.0.2.${ip++}`,cookie},...(body?{body:JSON.stringify(body)}:{})}));
const send=async(email)=>{let r=await call('sign-in/magic-link',{email,callbackURL:'/email-sign-in'});assert.equal(r.status,200);return mail.at(-1).url;};
const link=await send('buyer@company.test');assert.equal(mail[0].email,'buyer@company.test');
const pending=await db.prepare('SELECT identifier FROM auth_verification').first();assert(!pending.identifier.includes(new URL(link).searchParams.get('token')));
let r=await auth.handler(new Request(link));assert.equal(r.status,302);let cookie=r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');assert(cookie.includes('tecrid.session_token'));assert(r.headers.get('set-cookie').includes('HttpOnly'));assert(r.headers.get('set-cookie').includes('Secure'));
let s=await auth.api.getSession({headers:new Headers({cookie})});assert.equal(s.user.email,'buyer@company.test');assert.equal(s.user.emailVerified,true);
r=await auth.handler(new Request(link));assert(new URL(r.headers.get('location')).searchParams.has('error'));assert(!r.headers.get('set-cookie')?.includes('session_token='));
// No recipient allowlist: an unrelated supplier email creates a separate verified identity.
const supplierLink=await send('supplier@independent-ingredients.test');assert.equal(mail.at(-1).email,'supplier@independent-ingredients.test');
r=await auth.handler(new Request(supplierLink,{headers:{'cf-connecting-ip':'192.0.2.210'}}));assert.equal(r.status,302);const supplierCookie=r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');const supplierSession=await auth.api.getSession({headers:new Headers({cookie:supplierCookie})});assert.equal(supplierSession.user.email,'supplier@independent-ingredients.test');assert.equal(supplierSession.user.emailVerified,true);assert.notEqual(supplierSession.user.id,s.user.id);assert.equal((await auth.api.getSession({headers:new Headers({cookie})})).user.email,'buyer@company.test');
const report=sampleLabReports[0];
await env.DOCUMENTS.put(`kasandrinos/test-transcripts/${report.sourceSha256}.json`,JSON.stringify({reportNumber:report.reportNumber,sourceSha256:report.sourceSha256,results:[{analyte:'Synthetic',resultText:'ND',unit:'',loqText:'',limitText:'',statusText:'',notes:''}]}));
assert.equal((await protectedTestReport(new Request('https://tecrid.test/api/test-reports/id/results',{headers:{cookie}}),report.testIdentifier,'card')).status,403);
await db.prepare("INSERT INTO kas_report_permissions (report_number,recipient_email,status,results_access,pdf_access,requested_results,requested_pdf,expires_at,revision,updated_at,updated_by) VALUES (?,?,'active',1,0,0,0,NULL,1,?,'controller@test')").bind(report.reportNumber,'buyer@company.test',new Date().toISOString()).run();
r=await protectedTestReport(new Request('https://tecrid.test/api/test-reports/id/results',{headers:{cookie}}),report.testIdentifier,'card');assert.equal(r.status,200);assert.equal((await r.json()).card.identifier,report.testIdentifier);
assert.equal((await protectedTestReport(new Request('https://tecrid.test/api/test-reports/id/document',{headers:{cookie}}),report.testIdentifier,'pdf')).status,403);
assert.equal((await protectedTestReport(new Request('https://tecrid.test/api/test-reports/id/results',{headers:{cookie:'tecrid.session_token=forged'}}),report.testIdentifier,'card')).status,401);
r=await kasandrinosTestWorkspace(new Request('https://tecrid.test/api/kasandrinos-test',{headers:{cookie}}));assert.equal(r.status,200);{const w=await r.json();assert.equal(w.canManage,false);assert.equal(w.email,'buyer@company.test');assert.equal(w.reports.length,8);}
const principal=await getEmailUser(new Headers({cookie}));assert(principal);assert(principal.userId.startsWith('email:'));
const membership=await onboardOrganization(principal,{name:'Synthetic email lab',organizationType:'laboratory',website:'https://example.test'});assert.equal(membership.organization.issuerStatus,'pending');
await assert.rejects(upsertParticipantProfile(principal,{displayName:'Synthetic email lab',website:'https://company.test',summary:'Isolated test profile',isPublic:true}));
await upsertParticipantProfile(principal,{displayName:'Synthetic email lab',website:'https://company.test',summary:'Isolated test profile',isPublic:false});
const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
const application=await submitIssuerApplication(principal,{legalName:'Synthetic email lab',laboratoryAddress:'Test only',laboratoryWebsite:'https://company.test',authorityRole:'Test owner',accreditationStatus:'accredited',accreditationBody:'SYNTHETIC body',accreditationNumber:'FAKE-17025',accreditationExpiresOn:'2027-12-31',accreditationUrl:'https://register.example.test/FAKE',scopeSummary:'Synthetic only',methodFamilies:'Test',contactName:'Fixture',contactEmail:principal.email,keyId:'test-email-key',publicKeyJwk:JSON.stringify(await crypto.subtle.exportKey('jwk',pair.publicKey)),attested:true},new File(['%PDF-1.7 synthetic scope'],'scope.pdf'));assert(application.id);
await assert.rejects(reserveReportTecrid(membership.organization,{productName:'X',productSku:'X'}));
assert.equal(await getEmailUser(new Headers({cookie,origin:'https://evil.test'})),null);
assert.equal(safeReturnPath('//evil.test'),'/dashboard');assert.equal(safeReturnPath('/dashboard#laboratory-verification'),'/dashboard#laboratory-verification');
const expired=await send('expired@company.test');await db.prepare('UPDATE auth_verification SET expires_at=0').run();r=await auth.handler(new Request(expired));assert(new URL(r.headers.get('location')).searchParams.has('error'));
r=await call('sign-out',{},cookie,'https://evil.test');assert.equal(r.status,403);assert(await auth.api.getSession({headers:new Headers({cookie})}));
r=await call('sign-out',{},cookie);assert.equal(r.status,200);assert.equal(await auth.api.getSession({headers:new Headers({cookie})}),null);
assert.equal((await protectedTestReport(new Request('https://tecrid.test/api/test-reports/id/results',{headers:{cookie}}),report.testIdentifier,'card')).status,401);
assert.equal((await kasandrinosTestWorkspace(new Request('https://tecrid.test/api/kasandrinos-test',{headers:{cookie}}))).status,401);
r=await call('sign-in/magic-link',{email:'redirect@company.test',callbackURL:'https://evil.test'});assert.equal(r.status,403);
// Use one IP for these requests to check the persisted limiter.
for(let i=0;i<4;i++){ip=100;r=await call('sign-in/magic-link',{email:'limited@company.test',callbackURL:'/'});}assert.equal(r.status,429);
const failing=createEmailAuth(drizzle(db,{schema}),schema,{secret:'local-test-only-'.repeat(4),baseURL:'https://tecrid.test',email:mailConfig},async()=>new Response('',{status:503}));
r=await failing.handler(new Request('https://tecrid.test/api/auth/sign-in/magic-link',{method:'POST',headers:{origin:'https://tecrid.test','content-type':'application/json','cf-connecting-ip':'192.0.2.200'},body:JSON.stringify({email:'failure@company.test'})}));assert(r.status>=400);
const unconfigured=createEmailAuth(drizzle(db,{schema}),schema,{secret:'local-test-only-'.repeat(4),baseURL:'https://tecrid.test',email:{apiKey:'',from:''}},async()=>{throw Error('must not send');});
r=await unconfigured.handler(new Request('https://tecrid.test/api/auth/sign-in/magic-link',{method:'POST',headers:{origin:'https://tecrid.test','content-type':'application/json','cf-connecting-ip':'192.0.2.201'},body:JSON.stringify({email:'unconfigured@company.test'})}));assert(r.status>=400);
console.log('PASS: D1 email auth, verified identity, hashed one-use token, expiry, secure cookie, CSRF, sign-out revocation, redirect validation, persisted rate limit, delivery failure.');
}finally{await mf.dispose();}

},60000);
