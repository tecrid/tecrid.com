import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {database} from './support/onboarding-db.mjs';
import {queuePage,admit} from '../lib/onboarding-common.js';
const db=database(),objects=new Map(),env={DB:db,DOCUMENTS:{async put(k,b){objects.set(k,b);},async delete(k){objects.delete(k);}}};
globalThis.__scaleLab={env,gatePass:false,reviewCalls:0};
const bundled=await build({stdin:{contents:"export * from './lib/public-lab-applications.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node',packages:'external',plugins:[{name:'platform-and-review-boundary',setup(b){
 b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));
 b.onResolve({filter:/^\.\/tec$/},()=>({path:'review',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='env'?'export const env=globalThis.__scaleLab.env;':`export class TecInputError extends Error {} export class TecAuthorizationError extends Error {} export function isIcsAdmin(user){return user.email==='admin@ics.test';} export async function reviewIssuerApplication(user,id,input){globalThis.__scaleLab.reviewCalls++;if(!globalThis.__scaleLab.gatePass)throw Error('Existing issuer verification gates incomplete');return {id,status:'approved'};}`}));
}}]});
const temporary=resolve('tests/.scale-lab-'+crypto.randomUUID()+'.mjs');
writeFileSync(temporary,bundled.outputFiles[0].text);
let lab;try{lab=await import(pathToFileURL(temporary).href);}finally{unlinkSync(temporary);}
const admin={userId:'admin',email:'admin@ics.test'};
function form(n){const f=new FormData();for(const [k,v] of Object.entries({labName:'Laboratory '+n,accreditationBody:'Accreditor',accreditationNumber:'ISO-'+n,scopeMetals:'Lead, cadmium',contactEmail:'lab'+n+'@laboratory.test'}))f.set(k,v);f.set('certificate',new File(['%PDF-1.7\nAccreditation certificate\n%%EOF'],'certificate.pdf',{type:'application/pdf'}));return f;}
test.after(()=>db.close());
test('all migrations apply; public lab creates PENDING without any issuer authority',async()=>{
 const before=(await db.prepare('SELECT count(*) AS n FROM organizations').first()).n;
 const result=await lab.submitPublicLabApplication(form(1),'ip1');assert.equal(result.status,'PENDING');assert.equal(result.productionAuthority,false);assert.equal(objects.size,1);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM organizations').first()).n,before);
 const row=await db.prepare('SELECT * FROM lab_applications WHERE id=?').bind(result.id).first();assert.equal(row.status,'PENDING');assert.match(row.certificate_sha256,/^[a-f0-9]{64}$/);
 const page=await lab.labQueue(admin,new URLSearchParams());assert.equal(page.applications.length,1);assert(!('certificate_key' in page.applications[0]));
 await assert.rejects(()=>lab.labQueue({email:'visitor@lab.test'},new URLSearchParams()),{status:403});
});
test('duplicate name/email and invalid certificates are rejected; racing duplicates clean up their uploaded object',async()=>{
 const duplicate=form(2);duplicate.set('labName',' Laboratory 1. ');await assert.rejects(()=>lab.submitPublicLabApplication(duplicate,'ip2'),{status:409});
 const bad=form(3);bad.set('certificate',new File(['plain text'],'certificate.pdf'));await assert.rejects(()=>lab.submitPublicLabApplication(bad,'ip3'),{status:400});
 const results=await Promise.allSettled([lab.submitPublicLabApplication(form(4),'ip4'),lab.submitPublicLabApplication(form(4),'ip5')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(objects.size,2);
});
test('non-admin approval fails; admin approval cannot bypass existing verified issuer gates',async()=>{
 const row=await db.prepare('SELECT id FROM lab_applications WHERE contact_email=?').bind('lab1@laboratory.test').first();
 await assert.rejects(()=>lab.reviewPublicLab({email:'applicant@lab.test'},row.id,'approve','Checked'),{status:403});
 await assert.rejects(()=>lab.reviewPublicLab(admin,row.id,'approve','Checked'),{status:409});
 assert.equal(globalThis.__scaleLab.reviewCalls,0);
 const at=new Date().toISOString();
 await db.prepare("INSERT INTO organizations(id,name,slug,organization_type,owner_user_id,owner_email,issuer_code,created_at,updated_at) VALUES ('org','Laboratory 1','lab-1','laboratory','owner','lab1@laboratory.test','LAB1',?,?)").bind(at,at).run();
 await db.prepare("INSERT INTO issuer_applications(id,organization_id,legal_name,laboratory_address,accreditation_body,accreditation_number,scope_summary,method_families,contact_name,contact_email,status) VALUES ('issuer-app','org','Laboratory 1','Cyprus','Accreditor','ISO-1','Lead','ICP-MS','Lab contact','lab1@laboratory.test','submitted')").run();
 await assert.rejects(()=>lab.reviewPublicLab(admin,row.id,'approve','Reviewed certificate'),/Existing issuer verification gates incomplete/);
 assert.equal((await db.prepare('SELECT status FROM lab_applications WHERE id=?').bind(row.id).first()).status,'PENDING');
 globalThis.__scaleLab.gatePass=true;
 const approved=await lab.reviewPublicLab(admin,row.id,'approve','Reviewed certificate and independently verified issuer');assert.equal(approved.status,'APPROVED');assert.equal(approved.productionAuthority,true);assert.equal(approved.organizationId,'org');
 assert.equal(globalThis.__scaleLab.reviewCalls,2);
 const realReview=readFileSync('lib/tec.ts','utf8');assert(realReview.includes('Two different independent ICS admins'));assert(realReview.includes('requireIndependentLabReviewer'));
 const route=readFileSync('app/api/admin/lab-applications/[applicationId]/route.ts','utf8');assert(route.includes('requireAdminFactor(user,request)'));
});
test('1001 pending applications paginate without gaps and use the queue index',async()=>{
 for(let n=0;n<1001;n++)await db.prepare("INSERT INTO lab_applications(id,lab_name,normalized_name,contact_email,accreditation_body,accreditation_number,scope_metals,certificate_key,certificate_filename,certificate_sha256,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind('lab_'+crypto.randomUUID(),'Queue '+n,'queue'+n,'q'+n+'@lab.test','Body','n'+n,'Pb','private/'+n,'cert.pdf','a'.repeat(64),'2026-11-06T00:00:00.000Z').run();
 let cursor=null,seen=[];do{const page=await queuePage(db,'lab_applications',new URLSearchParams({status:'PENDING',...(cursor?{before:cursor}:{})}));assert(page.applications.length<=25);seen.push(...page.applications.map(r=>r.id));cursor=page.nextCursor;}while(cursor);
 assert.equal(seen.length,1002);assert.equal(new Set(seen).size,1002);
 const plan=await db.prepare("EXPLAIN QUERY PLAN SELECT * FROM lab_applications WHERE status='PENDING' ORDER BY created_at DESC,id DESC LIMIT 26").all();assert(plan.results.some(r=>r.detail.includes('lab_applications_queue')));
});
test('durable rate counter rejects excess concurrent requests; synthetic intake and its certificate can be deleted',async()=>{
 const results=await Promise.allSettled(Array.from({length:10},()=>admit(db,'scale-test','same-ip',3)));assert.equal(results.filter(r=>r.status==='fulfilled').length,3);
 const row=await db.prepare('SELECT id,certificate_key FROM lab_applications WHERE contact_email=?').bind('lab4@laboratory.test').first();await db.prepare("DELETE FROM lab_applications WHERE id=? AND status='PENDING'").bind(row.id).run();await env.DOCUMENTS.delete(row.certificate_key);assert.equal(await db.prepare('SELECT id FROM lab_applications WHERE id=?').bind(row.id).first(),null);assert(!objects.has(row.certificate_key));
});
