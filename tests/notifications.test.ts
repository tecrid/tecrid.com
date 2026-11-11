// @vitest-environment node
import {beforeAll,afterAll,it,expect} from 'vitest';
import {Miniflare} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import {env} from './support/cloudflare-env';
import {getDb} from '../db';
import {organizations,organizationMembers,organizationNotifications} from '../db/schema';
import {createEvidenceRequest,respondToEvidenceRequest} from '../lib/evidence-routing';
import {ownNotifications,serviceAuthorized,safeInboxHref,vleNotifications} from '../lib/notifications';
import {POST as bridge} from '../app/api/integrations/vle/notifications/route';
let mf:Miniflare;
const alice={userId:'alice',email:'alice@example.test'},bob={userId:'bob',email:'bob@example.test'};
beforeAll(async()=>{
 mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-22',d1Databases:['DB']});env.DB=await mf.getD1Database('DB');env.TECRID_EMAIL_RELAY_SECRET='synthetic-secret';env.TECRID_NOTIFICATION_SERVICE_SECRET='synthetic-notification-service-secret';
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(`drizzle/${f}`,'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await env.DB.prepare(sql).run();
 await getDb().insert(organizations).values({id:'test',name:'Test',slug:'test',organizationType:'brand',ownerUserId:'alice',ownerEmail:alice.email,issuerCode:'TEST'});
 for(const user of [alice,bob])await getDb().insert(organizationMembers).values({organizationId:'test',...user,role:'owner'});
 await getDb().insert(organizationNotifications).values({id:'notice',organizationId:'test',eventType:'credential.issued',title:'New TECRID issued',body:'Synthetic',actionPath:'/records/example',entityType:'credential',entityId:'example'});
},60000);
afterAll(async()=>{await mf?.dispose()});
it('scopes notifications to membership and keeps read markers personal across both apps',async()=>{
 expect(await ownNotifications(env.DB,{userId:'stranger',email:alice.email})).toEqual([]);
 expect(await ownNotifications(env.DB,alice)).toMatchObject([{id:'tecrid:notice',read:false}]);
 await ownNotifications(env.DB,{userId:'',email:alice.email.toUpperCase()},'tecrid:notice',true);
 expect(await ownNotifications(env.DB,alice)).toMatchObject([{read:true}]);
 expect(await ownNotifications(env.DB,bob)).toMatchObject([{read:false}]);
 await expect(ownNotifications(env.DB,{userId:'stranger',email:alice.email},'tecrid:notice')).rejects.toThrow();
 await env.DB.prepare('DELETE FROM organization_members WHERE user_id=?').bind('alice').run();
 expect(await ownNotifications(env.DB,alice,undefined,true)).toEqual([]);
});
it('authenticates bridge calls and requires a verified identity',async()=>{
 const request=(token:string,actor:unknown)=>new Request('https://tecrid.com/api/integrations/vle/notifications',{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({action:'list',actor})});
 expect(await serviceAuthorized(request('wrong',{}),'synthetic-secret')).toBe(false);
 expect((await bridge(request('wrong',{email:bob.email,emailVerified:true}))).status).toBe(401);
 expect((await bridge(request('synthetic-secret',{email:bob.email,emailVerified:false}))).status).toBe(403);
 const response=await bridge(request('synthetic-secret',{email:bob.email,emailVerified:true}));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');expect((await response.json()).items).toHaveLength(1);
});
it('uses an authenticated server relay, fails on upstream errors, and rejects unsafe links',async()=>{
 const transport=async(url:unknown,options:any)=>{expect(url).toBe('https://vle.exchange/api/tecrid-report-permissions');expect(options.redirect).toBe('error');expect(options.headers.authorization).toMatch(/^TECRID-HMAC t=\d{10},n=[a-f0-9-]{36},v1=[a-f0-9]{64}$/);expect(JSON.parse(options.body).actor.email).toBe(bob.email);expect(JSON.parse(options.body).action).toBe('notifications');return Response.json({items:[{id:'vle:test',href:'https://evil.test/',source:'vle'}]});};
 expect((await vleNotifications({...bob,userId:'email:bob'},undefined,transport as typeof fetch))[0].href).toBe('https://vle.exchange/notifications');
 await expect(vleNotifications(bob,undefined,(async()=>new Response(null,{status:503})) as typeof fetch)).rejects.toThrow();
 expect(safeInboxHref('javascript:alert(1)','tecrid')).toBe('https://tecrid.com/notifications');
});

it('notifies the controller and recipient for native TECRID request decisions',async()=>{
 const recipient={userId:'recipient',email:'recipient@example.test',displayName:'Recipient',fullName:'Recipient'};
 const controller={...bob,displayName:'Controller',fullName:'Controller'};
 await getDb().insert(organizations).values({id:'recipient-org',name:'Recipient',slug:'recipient-org',organizationType:'retailer',ownerUserId:recipient.userId,ownerEmail:recipient.email,issuerCode:'RECIPIENT'});
 await getDb().insert(organizationMembers).values({organizationId:'recipient-org',userId:recipient.userId,email:recipient.email,role:'owner'});
 const request=await createEvidenceRequest(recipient,{controllerOrganizationCode:'TEST',programName:'Synthetic',purpose:'Fixture',productName:'Example',productSku:'SKU',accessLevel:'status_only',deliveryMode:'one_time'});
 expect((await ownNotifications(env.DB,controller)).some(n=>n.kind==='evidence_access.requested'&&n.href.endsWith('request-'+request.id))).toBe(true);
 await expect(respondToEvidenceRequest(controller,request.id,{decision:'accept',accessLevel:'full_record'})).rejects.toThrow(/broader/);
 await respondToEvidenceRequest(controller,request.id,{decision:'accept'});
 expect((await ownNotifications(env.DB,recipient)).map(n=>n.kind)).toEqual(['evidence_access.granted']);
 await expect(respondToEvidenceRequest(controller,request.id,{decision:'accept'})).rejects.toThrow(/answered/);
 const second=await createEvidenceRequest(recipient,{controllerOrganizationCode:'TEST',programName:'Synthetic',purpose:'Fixture',productName:'Example',productSku:'SKU2',accessLevel:'status_only',deliveryMode:'one_time'});
 await respondToEvidenceRequest(controller,second.id,{decision:'decline'});
 expect((await ownNotifications(env.DB,recipient)).map(n=>n.kind)).toContain('evidence_access.declined');
});

it('builds record, application, and request destinations with existing page routes',async()=>{
 const {existsSync}=await import('node:fs');
 for(const [path,page] of [
  ['/records/TECRID%C2%B7DEMO-26-HM0001','app/records/[identifier]/page.tsx'],
  ['/dashboard/laboratory','app/dashboard/laboratory/page.tsx'],
  ['/dashboard/evidence-routing#request-example','app/dashboard/evidence-routing/page.tsx'],
 ]){
  expect(existsSync(page)).toBe(true);
  expect(new URL(safeInboxHref(path,'tecrid')).pathname+new URL(safeInboxHref(path,'tecrid')).hash).toBe(path);
 }
});

it('marks all owned TECRID notifications beyond the feed cap without affecting other recipients or organizations',async()=>{
 await getDb().insert(organizations).values({id:'other',name:'Other',slug:'other',organizationType:'brand',ownerUserId:'other',ownerEmail:'other@example.test',issuerCode:'OTHER'});
 await getDb().insert(organizationNotifications).values({id:'private-notice',organizationId:'other',eventType:'credential.issued',title:'Private',body:'Private',actionPath:'/notifications',entityType:'credential',entityId:'private'});
 for(let index=0;index<101;index++)await getDb().insert(organizationNotifications).values({id:`bulk-${index}`,organizationId:'test',eventType:'credential.issued',title:'Bulk',body:'Synthetic',actionPath:'/notifications',entityType:'credential',entityId:`bulk-${index}`});
 const items=await ownNotifications(env.DB,bob,undefined,false,true);expect(items).toHaveLength(100);expect(items.every(item=>item.read)).toBe(true);
 const count=await env.DB.prepare("SELECT count(*) AS count FROM notification_reads WHERE recipient_email=? AND notification_id LIKE 'bulk-%'").bind(bob.email).first<{count:number}>();expect(count?.count).toBe(101);
 expect(await env.DB.prepare("SELECT * FROM notification_reads WHERE notification_id='private-notice'").first()).toBeNull();
 expect(await env.DB.prepare("SELECT * FROM notification_reads WHERE recipient_email=? AND notification_id LIKE 'bulk-%'").bind(alice.email).first()).toBeNull();
});
it('marks VLE unread items through the existing authenticated ownership-checked relay',async()=>{
 const calls:unknown[]=[];
 const transport=async(_url:unknown,options:any)=>{const body=JSON.parse(options.body);calls.push(body);return Response.json({items:[{id:'vle:unread',read:body.action==='notification-read',href:'/notifications'},{id:'vle:read',read:true,href:'/notifications'}]});};
 const items=await vleNotifications(bob,undefined,transport as typeof fetch,true);
 expect(calls).toEqual([{action:'notifications',actor:{...bob,emailVerified:true}},{action:'notification-read',id:'vle:unread',actor:{...bob,emailVerified:true}}]);expect(items.every(item=>item.read)).toBe(true);
 await expect(vleNotifications(bob,undefined,(async()=>new Response(null,{status:503})) as typeof fetch,true)).rejects.toThrow();
});
