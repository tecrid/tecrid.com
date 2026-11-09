// @vitest-environment node
import {it,expect,vi,beforeAll,afterAll,beforeEach} from 'vitest';
import type {Miniflare} from 'miniflare';
import {env} from './support/cloudflare-env';
import {isolatedStorage} from './support/d1-r2';
const identity=vi.hoisted(()=>({user:null as any}));vi.mock('../lib/email-auth',()=>({getEmailUser:async()=>identity.user}));
import {kasandrinosTestWorkspace} from '../lib/kasandrinos-test-workspace';
import {accessNotifications} from '../lib/test-report-permissions';
import {sampleLabReports} from '../lib/sample-lab';
const owner={userId:'email:owner',email:'owner@kasandrinos.test'},viewer={userId:'email:viewer',email:'viewer@company.test'};
const report=sampleLabReports[0];
let mf:Miniflare;let sent:any[]=[];
const transport=vi.fn(async(url:any,o:any)=>{expect(String(url)).toBe('https://api.resend.com/emails');sent.push(JSON.parse(o.body));return Response.json({id:'synthetic'});});
const call=(body?:unknown,query='')=>kasandrinosTestWorkspace(new Request('https://tecrid.com/api/kasandrinos-test'+query,body?{method:'POST',headers:{origin:'https://tecrid.com'},body:JSON.stringify(body)}:{}),env.DB,transport as unknown as typeof fetch);
beforeAll(async()=>{
 mf=await isolatedStorage();
 await env.DB.prepare("INSERT INTO organization_members (organization_id,user_id,email,role) VALUES ('org_test_kasandrinos',?,?,'owner')").bind(owner.userId,owner.email).run();
},60000);
afterAll(async()=>{await mf?.dispose();});
beforeEach(()=>{identity.user=null;sent=[];transport.mockClear();env.RESEND_API_KEY='synthetic-resend-key';env.TECRID_EMAIL_FROM='TECRID <no-reply@tecrid.com>';env.TECRID_KAS_TEST_CONTROLLER_EMAILS='';});
it('blocks anonymous use and cross-origin writes',async()=>{
 expect((await call()).status).toBe(401);
 identity.user=owner;for(const origin of [null,'https://evil.test']){const r=await kasandrinosTestWorkspace(new Request('https://tecrid.com/api/kasandrinos-test',{method:'POST',headers:origin?{origin}:{},body:JSON.stringify({action:'revoke'})}),env.DB,transport as unknown as typeof fetch);expect(r.status).toBe(403);}
 expect(transport).not.toHaveBeenCalled();
});
it('ignores client actor claims; only TECRID owners manage',async()=>{
 identity.user=viewer;
 const r=await call({action:'grant',email:'x@company.test',reports:[{reportNumber:report.reportNumber,revision:0}],card:true,actor:{...owner,emailVerified:true}});
 expect(r.status).toBe(403);expect(r.headers.get('cache-control')).toContain('no-store');expect(r.headers.get('vary')).toBe('Cookie');
 const w=await (await call()).json();expect(w.canManage).toBe(false);expect(w.reports).toHaveLength(8);
});
it('runs request, notify, approve and revoke entirely inside TECRID',async()=>{
 identity.user=viewer;
 const requested=await (await call({action:'request',reportNumber:report.reportNumber,card:true})).json();
 expect(requested.status).toBe('pending');
 expect(sent).toHaveLength(1);expect(sent[0].from).toBe('TECRID <no-reply@tecrid.com>');expect(sent[0].to).toEqual([owner.email]);expect(sent[0].text).not.toContain(viewer.email);expect(sent[0].text).toContain('https://tecrid.com/dashboard/kasandrinos?request=');
 identity.user=owner;
 const w=await (await call(undefined,'?request='+requested.notificationId)).json();
 expect(w.canManage).toBe(true);expect(w.targetRequest.requester_email).toBe(viewer.email);expect(w.notificationEmail).toBe(owner.email);
 expect((await accessNotifications(env.DB,owner)).some(n=>n.kind==='evidence_access.requested')).toBe(true);
 expect((await call({action:'grant',email:viewer.email,reports:[{reportNumber:report.reportNumber,revision:0}],card:true})).status).toBe(409);
 expect((await call({action:'grant',email:viewer.email,reports:[{reportNumber:report.reportNumber,revision:1}],card:true})).status).toBe(200);
 identity.user=viewer;
 expect((await (await call({action:'status',reportNumber:report.reportNumber})).json()).canReadCard).toBe(true);
 const inbox=await accessNotifications(env.DB,viewer);expect(inbox.map(n=>n.kind)).toContain('evidence_access.granted');expect(inbox.every(n=>n.href.startsWith('https://tecrid.com/'))).toBe(true);
 await accessNotifications(env.DB,viewer,inbox[0].id);expect((await accessNotifications(env.DB,viewer))[0].read).toBe(true);
 identity.user=owner;
 expect((await call({action:'revoke',email:viewer.email,reports:[{reportNumber:report.reportNumber,revision:2}]})).status).toBe(200);
 identity.user=viewer;
 expect((await (await call({action:'status',reportNumber:report.reportNumber})).json()).canReadCard).toBe(false);
});
it('keeps requests pending without email when the sender is not configured',async()=>{
 env.RESEND_API_KEY='';identity.user={userId:'email:other',email:'other@company.test'};
 expect((await call({action:'request',reportNumber:report.reportNumber,card:true})).status).toBe(200);expect(transport).not.toHaveBeenCalled();
 const row=await env.DB.prepare("SELECT status FROM kas_access_notifications WHERE requester_email='other@company.test'").first<{status:string}>();expect(row!.status).toBe('pending');
});
