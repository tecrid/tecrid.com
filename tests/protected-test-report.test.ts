// @vitest-environment node
import {it,expect,vi,beforeEach} from 'vitest';
import {env} from './support/cloudflare-env';
const identity=vi.hoisted(()=>({user:null as any}));
vi.mock('../lib/email-auth',()=>({getEmailUser:async()=>identity.user}));
import {protectedTestReport} from '../lib/test-report-access';
import {sampleLabReports} from '../lib/sample-lab';
const report=sampleLabReports[0];
beforeEach(()=>{identity.user=null;env.TECRID_EMAIL_RELAY_SECRET='test-service-secret';});
it('denies anonymous, spoofed identities and sandbox keys without calling report service',async()=>{
 const transport=vi.fn();const r=await protectedTestReport(new Request('https://tecrid.com/api/test-reports/id/results',{headers:{'x-user-email':'buyer@company.test',authorization:'Bearer sandbox-key'}}),report.testIdentifier,'results',transport);expect(r.status).toBe(401);expect(transport).not.toHaveBeenCalled();expect(r.headers.get('cache-control')).toContain('no-store');
});
it('forwards only verified session identity and retains TEST fields privately',async()=>{
 identity.user={userId:'email:verified-id',email:'buyer@company.test'};
 const transport=vi.fn(async(_url:any,options:any)=>{const body=JSON.parse(options.body);expect(body.actor).toEqual({...identity.user,emailVerified:true});expect(body.reportNumber).toBe(report.reportNumber);return Response.json({reportNumber:report.reportNumber,sourceSha256:report.sourceSha256,sandbox:true,productionAuthority:false,reviewStatus:'UNAPPROVED_TRANSCRIPTION',results:[{analyte:'Synthetic',resultText:'ND'}]});});
 const r=await protectedTestReport(new Request('https://tecrid.com/api/test-reports/id/results'),report.testIdentifier,'results',transport);expect(r.status).toBe(200);expect((await r.json()).productionAuthority).toBe(false);expect(r.headers.get('vary')).toBe('Cookie');
});
it('denies recipients without grants, rejects mismatched source data and checks PDF fingerprint',async()=>{
 identity.user={userId:'email:id',email:'someone@gmail.com'};const req=new Request('https://tecrid.com/api/test-reports/id/results');
 expect((await protectedTestReport(req,report.testIdentifier,'results',async()=>new Response(null,{status:403}))).status).toBe(403);
 expect((await protectedTestReport(req,report.testIdentifier,'results',async()=>Response.json({reportNumber:'wrong',results:[]}))).status).toBe(502);
 expect((await protectedTestReport(req,report.testIdentifier,'pdf',async()=>new Response('%PDF- synthetic',{headers:{'content-type':'application/pdf','x-report-sha256':'wrong'}}))).status).toBe(502);
 const pdf=await protectedTestReport(req,report.testIdentifier,'pdf',async()=>new Response('%PDF- synthetic',{headers:{'content-type':'application/pdf','x-report-sha256':report.sourceSha256}}));expect(pdf.status).toBe(200);expect(pdf.headers.get('content-disposition')).toContain('inline');expect(pdf.headers.get('cache-control')).toContain('no-store');
});
