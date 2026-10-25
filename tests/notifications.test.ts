import {signedServiceInit} from '../lib/service-assertion.js';
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
 mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-22',d1Databases:['DB']});env.DB=await mf.getD1Database('DB');env.TECRID_EMAIL_RELAY_SECRET='synthetic-secret';env.TECRID_REPORT_READ_SECRET='synthetic-read-'.repeat(4);env.TECRID_REPORT_PERMISSION_SECRET='synthetic-permission-'.repeat(4);env.TECRID_NOTIFICATION_SERVICE_SECRET='synthetic-notification-'.repeat(4);
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
 const request=async(token:string,actor:unknown)=>{const url='https://tecrid.com/api/integrations/vle/notifications',body={action:'list',actor};return new Request(url,token==='synthetic-secret'?await signedServiceInit(url,body,env,'notifications-to-tecrid'):{method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify(body)});};
 expect(await serviceAuthorized(await request('wrong',{}),env,'notifications-to-tecrid')).toBe(false);
 expect((await bridge(await request('wrong',{email:bob.email,emailVerified:true}))).status).toBe(401);
 expect((await bridge(await request('synthetic-secret',{email:bob.email,emailVerified:false}))).status).toBe(403);
 const response=await bridge(await request('synthetic-secret',{email:bob.email,emailVerified:true}));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');expect((await response.json()).items).toHaveLength(1);
});
it('uses an authenticated server relay, fails on upstream errors, and rejects unsafe links',async()=>{
 const transport=async(url:unknown,options:any)=>{expect(url).toBe('https://vle.exchange/api/tecrid-report-permissions');expect(options.redirect).toBe('error');expect(options.headers.authorization).toMatch(/^TECRID-HMAC /);expect(JSON.parse(options.body).actor.email).toBe(bob.email);return Response.json({items:[{id:'vle:test',href:'https://evil.test/',source:'vle'}]});};
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
