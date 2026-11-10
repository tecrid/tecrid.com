// @vitest-environment node
import {it,expect,vi} from 'vitest';
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({userId:'test',email:'test@example.test'})}));
vi.mock('../lib/email-auth',()=>({getEmailUser:async()=>null}));
vi.mock('../lib/notifications',()=>({inboxHeaders:{},ownNotifications:async()=>[],vleNotifications:async()=>[]}));
vi.mock('../lib/legacy-reports',()=>({createLegacyReport:vi.fn(),updateLegacyReportTranscription:vi.fn(),claimLegacyReport:vi.fn(),declineLegacyReport:vi.fn(),flagLegacyReportDiscrepancy:vi.fn(),issueLegacyReport:vi.fn(),LegacyReportConflictError:class extends Error{},LegacyReportRateLimitError:class extends Error{}}));
import {POST as notifications} from '../app/api/notifications/route';
import {POST as reports} from '../app/api/legacy-reports/route';
import {POST as confirm} from '../app/api/legacy-reports/confirm/[token]/route';
import {PATCH as correction} from '../app/api/legacy-reports/[reportId]/route';
const routes=[
 ['notifications', (r:Request)=>notifications(r)],
 ['reports', (r:Request)=>reports(r)],
 ['confirmation', (r:Request)=>confirm(r,{params:Promise.resolve({token:'test'})})],
 ['correction', (r:Request)=>correction(r,{params:Promise.resolve({reportId:'test'})})],
] as const;
it.each(routes)('%s accepts public proxy origins and keeps hostile-origin 403',async(_name,handler)=>{
 for(const origin of ['https://tecrid.com','https://www.tecrid.com','https://preview.example','https://host.example']){
  const request=new Request('http://internal.local/api/test',{method:'POST',headers:{origin,'x-forwarded-host':'preview.example',host:'host.example','content-type':'application/json'},body:JSON.stringify({action:'read',id:'tecrid:test'})});
  expect((await handler(request)).status).not.toBe(403);
 }
 expect((await handler(new Request('http://internal.local/api/test',{method:'POST',headers:{origin:'https://evil.example'}}))).status).toBe(403);
});
it('requires an explicit origin to mark notifications read',async()=>{
 expect((await notifications(new Request('http://internal.local/api/notifications',{method:'POST'}))).status).toBe(403);
});
