// @vitest-environment node
import { beforeAll, afterAll, it, expect } from 'vitest';
import { Miniflare } from 'miniflare';
import { readdirSync, readFileSync } from 'node:fs';
import { env } from './support/cloudflare-env';
import { getDb } from '../db';
import { organizations, organizationMembers, evidenceRequests, evidenceAccessGrants, evidenceShareCodes, routingAuthorizations } from '../db/schema';
import { listWorkspaceAccess, revokeWorkspaceAccess } from '../lib/workspace-access';
import { revokeEvidenceGrant } from '../lib/evidence-routing';
import { revokeEvidenceShareCode } from '../lib/sharing';
const owner={userId:'owner',email:'owner@brand.test',displayName:'Owner',fullName:null};
const member={userId:'member',email:'member@brand.test',displayName:'Member',fullName:null};
const admin={userId:'admin',email:'admin@brand.test',displayName:'Admin',fullName:null};
const otherOwner={userId:'other-owner',email:'other@brand.test',displayName:'Other',fullName:null};
const createdAt='2026-01-01T12:00:00Z';
const expiresAt='2099-01-01T12:00:00Z';
let mf:Miniflare;
beforeAll(async()=>{
  mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-22',d1Databases:['DB']});env.DB=await mf.getD1Database('DB');
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) for(const sql of readFileSync(`drizzle/${file}`,'utf8').split('--> statement-breakpoint')) if(sql.trim()) await env.DB.prepare(sql).run();
  const db=getDb();
  for(const [id,type] of [['brand','brand'],['recipient','retailer'],['lab','laboratory'],['other','supplier'],['unused','retailer']]) {
    await db.insert(organizations).values({id,name:`${id} organization`,slug:id,organizationType:type,ownerUserId:id==='brand'?owner.userId:otherOwner.userId,ownerEmail:`${id}@example.test`,issuerCode:id.toUpperCase(),createdAt,updatedAt:createdAt});
  }
  for(const [user,role,organizationId] of [[owner,'owner','brand'],[admin,'admin','brand'],[member,'member','brand'],[otherOwner,'owner','other']] as const) {
    await db.insert(organizationMembers).values({organizationId,userId:user.userId,email:user.email,role,createdAt});
  }
  async function grant(id:string,controller='brand',recipient='recipient',status='active') {
    await db.insert(evidenceRequests).values({id:`request-${id}`,requesterOrganizationId:recipient,controllerOrganizationId:controller,programName:'Review',purpose:'Test',productName:'Olive oil',productSku:'OIL-1',accessLevel:'selected_analytes',analyteScopeJson:'["Lead"]',deliveryMode:'future_sku',status:'accepted',requestedByUserId:'recipient-user'});
    await db.insert(evidenceAccessGrants).values({id,requestId:`request-${id}`,controllerOrganizationId:controller,recipientOrganizationId:recipient,productName:'Olive oil',productSku:'OIL-1',accessLevel:'selected_analytes',analyteScopeJson:'["Lead"]',deliveryMode:'future_sku',status,createdByUserId:owner.userId,createdAt});
  }
  await grant('grant');await grant('foreign','other');await grant('fulfilled','brand','unused','fulfilled');await grant('single','brand','unused');
  for(const [id,status,controller,recipient] of [['share','active','brand','recipient'],['redeemed','redeemed','brand','recipient'],['revoked-code','revoked','brand','unused'],['foreign-code','active','other','recipient']]) {
    await db.insert(evidenceShareCodes).values({id,controllerOrganizationId:controller,recipientOrganizationId:recipient,label:'Package',purpose:'Review',scopeMode:'tecrid_set',scopeJson:'["TECRID:TEST-1"]',accessLevel:'full_record',tokenHash:id,tokenPrefix:'test',tokenLastFour:'test',status,createdByUserId:owner.userId,createdAt,expiresAt,redeemedAt:status==='redeemed'?'2026-02-01T12:00:00Z':null});
  }
  // Legacy organizations can hold several permission types. Group by ID, never by name or type.
  for(const [id,controller,recipient] of [['route','brand','recipient'],['lab-route','brand','lab'],['foreign-route','other','recipient']]) {
    await db.insert(routingAuthorizations).values({id,controllerOrganizationId:controller,laboratoryOrganizationId:recipient,productName:'Olive oil',productSku:'OIL-1',tokenHash:id,tokenPrefix:'test',tokenLastFour:'test',createdByUserId:owner.userId,createdAt,expiresAt,lastUsedAt:'2026-03-01T12:00:00Z'});
  }

  await env.DB.prepare("INSERT INTO credentials (identifier,organization_id,sample_name,status) VALUES ('TECRID:TEST-1','lab','Olive oil','issued')").run();
  await env.DB.prepare("INSERT INTO evidence_deliveries (id,grant_id,routing_authorization_id,controller_organization_id,recipient_organization_id,credential_identifier,credential_version,access_level,snapshot_json,snapshot_fingerprint,delivered_at) VALUES ('delivery','grant','route','brand','recipient','TECRID:TEST-1',1,'selected_analytes','{}','fixture-fingerprint','2026-04-01T12:00:00Z')").run();
  await env.DB.prepare("INSERT INTO evidence_share_redemptions (id,share_code_id,controller_organization_id,recipient_organization_id,package_json,package_fingerprint,record_count,redeemed_at) VALUES ('redemption','redeemed','brand','recipient','{}','fixture-fingerprint',1,'2026-02-01T12:00:00Z')").run();
},60000);
afterAll(async()=>{await mf?.dispose();});
it('combines the three item types into one row per receiving organization with scopes, dates, and recorded use',async()=>{
  const data=await listWorkspaceAccess(member);expect(data.canRevoke).toBe(false);
  const recipient=data.organizations.find(row=>row.id==='recipient')!;
  expect(recipient.items.map(item=>item.id)).toEqual(expect.arrayContaining(['grant','share','redeemed','route']));expect(recipient.items).toHaveLength(4);
  expect(recipient.items.find(item=>item.id==='grant')).toMatchObject({products:['OIL-1'],accessLevel:'selected_analytes',analytes:['Lead'],expiresAt:null,lastUsedAt:'2026-04-01T12:00:00Z',grantedAt:createdAt});
  expect(recipient.items.find(item=>item.id==='redeemed')).toMatchObject({products:['TECRID:TEST-1'],lastUsedAt:'2026-02-01T12:00:00Z',expiresAt});
  expect(recipient.items.find(item=>item.id==='route')).toMatchObject({accessLevel:null,lastUsedAt:'2026-03-01T12:00:00Z'});
  expect(data.organizations.filter(row=>row.id==='recipient')).toHaveLength(1);
  const all=data.organizations.flatMap(row=>row.items.map(item=>item.id));expect(all).not.toContain('foreign');expect(all).not.toContain('fulfilled');expect(all).not.toContain('revoked-code');expect(all).not.toContain('foreign-code');expect(all).not.toContain('foreign-route');
});
it('prevents Members from revoking all or individual items, including the existing grant API path',async()=>{
  await expect(revokeWorkspaceAccess(member,'recipient')).rejects.toThrow(/owner or admin/);
  await expect(revokeWorkspaceAccess(member,'recipient',{id:'share',kind:'share'})).rejects.toThrow(/owner or admin/);
  await expect(revokeEvidenceGrant(member,'grant')).rejects.toThrow(/owner or admin/);
  await expect(revokeEvidenceShareCode(member,'share')).rejects.toThrow(/owner or admin/);
  expect((await listWorkspaceAccess(owner)).organizations.find(row=>row.id==='recipient')!.items).toHaveLength(4);
});
it('revokes one expanded item without changing another recipient or item',async()=>{
  await expect(revokeWorkspaceAccess(owner,'unused',{id:'share',kind:'share'})).rejects.toThrow(/No current permissions/);
  expect(await revokeWorkspaceAccess(owner,'unused',{id:'single',kind:'grant'})).toEqual({revoked:1});
  expect((await listWorkspaceAccess(owner)).organizations.find(row=>row.id==='recipient')!.items).toHaveLength(4);
});
it('revokes all three types through existing functions, notifies the recipient, and retains audit history',async()=>{
  expect(await revokeWorkspaceAccess(admin,'recipient')).toEqual({revoked:4});
  for(const [table,id] of [['evidence_access_grants','grant'],['evidence_share_codes','share'],['evidence_share_codes','redeemed'],['routing_authorizations','route']]) {
    expect((await env.DB.prepare(`SELECT status FROM ${table} WHERE id=?`).bind(id).first())?.status).toBe('revoked');
  }
  const notices=await env.DB.prepare("SELECT event_type FROM organization_notifications WHERE organization_id='recipient'").all();
  expect(notices.results.map((notice:{event_type:string})=>notice.event_type)).toEqual(expect.arrayContaining(['evidence_access.revoked','evidence_share.revoked','evidence_routing.revoked']));
  expect((await env.DB.prepare("SELECT count(*) AS total FROM evidence_deliveries WHERE id='delivery'").first())?.total).toBe(1);
  expect((await env.DB.prepare("SELECT count(*) AS total FROM evidence_share_redemptions WHERE id='redemption'").first())?.total).toBe(1);
  const data=await listWorkspaceAccess(member);expect(data.organizations.some(row=>row.id==='recipient')).toBe(false);
  expect(data.history.filter(event=>event.recipientId==='recipient')).toHaveLength(4);expect(data.history.find(event=>event.itemId==='grant')).toMatchObject({kind:'grant',products:['OIL-1']});
  expect((await env.DB.prepare("SELECT status FROM routing_authorizations WHERE id='lab-route'").first())?.status).toBe('active');
  expect((await env.DB.prepare("SELECT status FROM evidence_access_grants WHERE id='foreign'").first())?.status).toBe('active');
});
it('keeps controllers isolated and supports supplier workspaces',async()=>{
  const data=await listWorkspaceAccess(otherOwner);expect(data.canRevoke).toBe(true);expect(data.organizations.flatMap(row=>row.items)).toHaveLength(3);expect(data.history).toHaveLength(0);
  await expect(revokeWorkspaceAccess(otherOwner,'unused',{id:'single',kind:'grant'})).rejects.toThrow(/No current permissions/);
  await expect(listWorkspaceAccess({...owner,userId:'not-a-member'})).rejects.toThrow(/brand and supplier/);
});
