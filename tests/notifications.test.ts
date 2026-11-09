// @vitest-environment node
import {beforeAll,afterAll,it,expect} from 'vitest';
import {Miniflare} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import {env} from './support/cloudflare-env';
import {getDb} from '../db';
import {organizations,organizationMembers,organizationNotifications} from '../db/schema';
import {createEvidenceRequest,respondToEvidenceRequest} from '../lib/evidence-routing';
import {ownNotifications,safeInboxHref} from '../lib/notifications';
let mf:Miniflare;
const alice={userId:'alice',email:'alice@example.test'},bob={userId:'bob',email:'bob@example.test'};
beforeAll(async()=>{
 mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-22',d1Databases:['DB']});env.DB=await mf.getD1Database('DB');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(`drizzle/${f}`,'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await env.DB.prepare(sql).run();
 await getDb().insert(organizations).values({id:'test',name:'Test',slug:'test',organizationType:'brand',ownerUserId:'alice',ownerEmail:alice.email,issuerCode:'TEST'});
 for(const user of [alice,bob])await getDb().insert(organizationMembers).values({organizationId:'test',...user,role:'owner'});
 await getDb().insert(organizationNotifications).values({id:'notice',organizationId:'test',eventType:'credential.issued',title:'New TECRID issued',body:'Synthetic',actionPath:'/records/example',entityType:'credential',entityId:'example'});
},60000);
afterAll(async()=>{await mf?.dispose()});
it('scopes notifications to membership and keeps read markers personal',async()=>{
 expect(await ownNotifications(env.DB,{userId:'stranger',email:alice.email})).toEqual([]);
 expect(await ownNotifications(env.DB,alice)).toMatchObject([{id:'tecrid:notice',read:false}]);
 await ownNotifications(env.DB,{userId:'',email:alice.email.toUpperCase()},'tecrid:notice',true);
 expect(await ownNotifications(env.DB,alice)).toMatchObject([{read:true}]);
 expect(await ownNotifications(env.DB,bob)).toMatchObject([{read:false}]);
 await expect(ownNotifications(env.DB,{userId:'stranger',email:alice.email},'tecrid:notice')).rejects.toThrow();
 await env.DB.prepare('DELETE FROM organization_members WHERE user_id=?').bind('alice').run();
 expect(await ownNotifications(env.DB,alice,undefined,true)).toEqual([]);
});
it('keeps inbox links on tecrid.com',()=>{
 expect(safeInboxHref('javascript:alert(1)','tecrid')).toBe('https://tecrid.com/notifications');
 expect(safeInboxHref('https://vle.exchange/notifications','tecrid')).toBe('https://tecrid.com/notifications');
 expect(safeInboxHref('/records/x','tecrid')).toBe('https://tecrid.com/records/x');
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
