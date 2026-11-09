// @vitest-environment node
import {it,expect,vi,beforeAll,afterAll,beforeEach} from 'vitest';
import type {Miniflare} from 'miniflare';
import {env} from './support/cloudflare-env';
import {isolatedStorage} from './support/d1-r2';
const identity=vi.hoisted(()=>({user:null as any}));
vi.mock('../lib/email-auth',()=>({getEmailUser:async()=>identity.user}));
const fetchSpy=vi.hoisted(()=>vi.fn());
vi.mock('../lib/private-fetch',()=>({privateFetch:fetchSpy}));
import {protectedTestReport} from '../lib/test-report-access';
import {sampleLabReports} from '../lib/sample-lab';
const report=sampleLabReports[0];
let mf:Miniflare;
const transcript={reportNumber:report.reportNumber,sourceSha256:report.sourceSha256,results:[{analyte:'Synthetic',resultText:'ND',unit:'',loqText:'',limitText:'',statusText:'',notes:''}]};
const grant=(email:string,expires:string|null=null)=>env.DB.prepare("INSERT OR REPLACE INTO kas_report_permissions (report_number,recipient_email,status,results_access,pdf_access,requested_results,requested_pdf,expires_at,revision,updated_at,updated_by) VALUES (?,?,'active',1,0,0,0,?,1,?,'controller@test')").bind(report.reportNumber,email,expires,new Date().toISOString()).run();
const req=()=>new Request('https://tecrid.com/api/test-reports/id/results');
beforeAll(async()=>{mf=await isolatedStorage();await env.DOCUMENTS.put(`kasandrinos/test-transcripts/${report.sourceSha256}.json`,JSON.stringify(transcript));},60000);
afterAll(async()=>{await mf?.dispose();});
beforeEach(()=>{identity.user=null;env.TECRID_KAS_TEST_CONTROLLER_EMAILS='';fetchSpy.mockReset();});
it('denies anonymous and spoofed identities without any outbound call',async()=>{
 const r=await protectedTestReport(new Request('https://tecrid.com/api/test-reports/id/results',{headers:{'x-user-email':'buyer@company.test',authorization:'Bearer sandbox-key'}}),report.testIdentifier,'results');
 expect(r.status).toBe(401);expect(r.headers.get('cache-control')).toContain('no-store');expect(fetchSpy).not.toHaveBeenCalled();
});
it('reads grants and transcripts from TECRID storage, never VLE',async()=>{
 identity.user={userId:'email:buyer',email:'buyer@company.test'};
 expect((await protectedTestReport(req(),report.testIdentifier,'card')).status).toBe(403);
 await grant('buyer@company.test');
 const r=await protectedTestReport(req(),report.testIdentifier,'card');expect(r.status).toBe(200);const data=await r.json();
 expect(data.productionAuthority).toBe(false);expect(data.card.identifier).toBe(report.testIdentifier);expect(data.card.sourceSha256).toBe(report.sourceSha256);expect(data.card.method).toBeTruthy();expect(r.headers.get('vary')).toBe('Cookie');
 expect((await protectedTestReport(req(),report.testIdentifier,'pdf')).status).toBe(403);
 const audit=await env.DB.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='test_report.viewed'").first<{n:number}>();expect(audit!.n).toBeGreaterThan(0);
 expect(fetchSpy).not.toHaveBeenCalled();
});
it('expires grants and rejects transcripts bound to another report',async()=>{
 identity.user={userId:'email:late',email:'late@company.test'};
 await grant('late@company.test',new Date(Date.now()-1000).toISOString());
 expect((await protectedTestReport(req(),report.testIdentifier,'card')).status).toBe(403);
 const other=sampleLabReports[1];identity.user={userId:'email:buyer',email:'buyer@company.test'};
 await env.DB.prepare("INSERT OR REPLACE INTO kas_report_permissions (report_number,recipient_email,status,results_access,pdf_access,requested_results,requested_pdf,expires_at,revision,updated_at,updated_by) VALUES (?,?,'active',1,0,0,0,NULL,1,?,'c')").bind(other.reportNumber,'buyer@company.test',new Date().toISOString()).run();
 expect((await protectedTestReport(req(),other.testIdentifier,'card')).status).toBe(503);
 await env.DOCUMENTS.put(`kasandrinos/test-transcripts/${other.sourceSha256}.json`,JSON.stringify(transcript));
 expect((await protectedTestReport(req(),other.testIdentifier,'card')).status).toBe(502);
});
it('lets only controllers read the PDF and checks its fingerprint',async()=>{
 identity.user={userId:'email:owner',email:'owner@kasandrinos.test'};env.TECRID_KAS_TEST_CONTROLLER_EMAILS='owner@kasandrinos.test';
 expect((await protectedTestReport(req(),report.testIdentifier,'pdf')).status).toBe(503);
 await env.DOCUMENTS.put(`kasandrinos/source-reports/${report.sourceSha256}.pdf`,'%PDF- synthetic altered bytes');
 expect((await protectedTestReport(req(),report.testIdentifier,'pdf')).status).toBe(502);
});
it('imports only fingerprint-bound sources into TECRID storage',async()=>{
 const {importTestReportSource}=await import('../lib/test-report-permissions');
 const other=sampleLabReports[2];
 expect((await importTestReportSource(env.DOCUMENTS,{reportNumber:'nope',pdf:null,transcript:''})).status).toBe(404);
 expect((await importTestReportSource(env.DOCUMENTS,{reportNumber:other.reportNumber,pdf:new Blob(['%PDF- not the source']),transcript:''})).status).toBe(400);
 expect((await importTestReportSource(env.DOCUMENTS,{reportNumber:other.reportNumber,pdf:null,transcript:JSON.stringify({...transcript})})).status).toBe(400);
 const ok=await importTestReportSource(env.DOCUMENTS,{reportNumber:other.reportNumber,pdf:null,transcript:JSON.stringify({...transcript,reportNumber:other.reportNumber,sourceSha256:other.sourceSha256})});
 expect(ok.status).toBe(200);expect(await env.DOCUMENTS.head(`kasandrinos/test-transcripts/${other.sourceSha256}.json`)).toBeTruthy();
});
