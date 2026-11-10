// @vitest-environment node
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import { readdirSync, readFileSync } from 'node:fs';
import { env } from './support/cloudflare-env';
import { inviteWorkspaceMember, claimWorkspaceInvite, changeWorkspaceMember, listWorkspaceMembers, outsideLaboratoryDomain } from '../lib/workspace-members';
import { createApiKey, createCredentialForUser, submitIssuerApplication } from '../lib/tec';
import { recordIssuerPublicKey } from '../lib/lab-invite';
import { onboardOrganization, getOrganizationForUser } from '../lib/tec';
import JoinPage from '../app/join/page';
import Welcome from '../app/welcome/page';
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock('next/headers', () => ({ headers: async () => request.headers }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
const mail = vi.hoisted(() => ({ messages: [] as Array<{subject:string;to:string[];text:string}> }));
vi.mock('../lib/private-fetch', () => ({ privateFetch: async (_url: string, init: RequestInit) => { mail.messages.push(JSON.parse(String(init.body)));return Response.json({id:'fixture-mail'}); } }));
const owner = { userId:'email:owner',email:'owner@atlas.test',displayName:'Atlas Owner',fullName:null };
const member = { userId:'email:member',email:'member@outside.test',displayName:'Taylor Member',fullName:null };
const admin = { userId:'email:admin',email:'admin@atlas.test',displayName:'Atlas Admin',fullName:null };
let mf:Miniflare;
const send = vi.fn(async (_email:string)=>{});
beforeAll(async()=>{
  mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-22',d1Databases:['DB']});
  env.DB=await mf.getD1Database('DB');
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) for(const sql of readFileSync(`drizzle/${file}`,'utf8').split('--> statement-breakpoint')) if(sql.trim()) await env.DB.prepare(sql).run();
  await env.DB.prepare("INSERT INTO organizations (id,name,slug,organization_type,website,owner_user_id,owner_email,issuer_code) VALUES ('atlas','Atlas Laboratory','atlas','laboratory','https://atlas.test',?,?,'ATL'),('other','Other Workspace','other','brand',NULL,'other','other@other.test','OTHER')").bind(owner.userId,owner.email).run();
  await env.DB.prepare("INSERT INTO organization_members (organization_id,user_id,email,role) VALUES ('atlas',?,?,'owner'),('atlas',?,?,'admin'),('other','other','other@other.test','owner')").bind(owner.userId,owner.email,admin.userId,admin.email).run();
  await env.DB.prepare("INSERT INTO organization_notifications (id,organization_id,event_type,title,body,entity_type,entity_id) VALUES ('other-data','other','evidence.received','Evidence received','Keep this workspace','evidence','report')").run();
},60000);
afterAll(async()=>{await mf?.dispose();});
it('saves a pending invite, sends the sign-in email, audits and notifies',async()=>{
  const result=await inviteWorkspaceMember(owner,{email:' MEMBER@outside.test ',role:'member'},send);
  expect(result.outsideDomain).toBe(true);expect(send).toHaveBeenCalledWith(member.email);
  expect((await listWorkspaceMembers(owner)).pending).toHaveLength(1);
  expect(await env.DB.prepare("SELECT id FROM audit_events WHERE event_type='workspace.invited'").first()).toBeTruthy();
  expect(await env.DB.prepare("SELECT id FROM organization_notifications WHERE event_type='workspace.invited' AND organization_id='atlas'").first()).toBeTruthy();
});
it('joins with the signed-in email, records the name and is idempotent',async()=>{
  await Promise.all([claimWorkspaceInvite(member),claimWorkspaceInvite(member)]);
  const data=await listWorkspaceMembers(member);expect(data.canManage).toBe(false);expect(data.pending).toHaveLength(0);
  expect(data.people.find(p=>p.email===member.email)).toMatchObject({name:'Taylor Member',role:'member'});
  expect((await env.DB.prepare("SELECT count(*) AS total FROM audit_events WHERE event_type='workspace.joined'").first())?.total).toBe(1);
});
it('blocks members from inviting, changing roles and removing people',async()=>{
  const target=(await listWorkspaceMembers(owner)).people.find(p=>p.email===admin.email)!;
  await expect(inviteWorkspaceMember(member,{email:'another@atlas.test',role:'member'},send)).rejects.toThrow(/Owners and Admins/);
  await expect(changeWorkspaceMember(member,target.id,'role','owner')).rejects.toThrow(/Owners and Admins/);
  await expect(changeWorkspaceMember(member,target.id,'remove')).rejects.toThrow(/Owners and Admins/);
});
it('keeps laboratory issuing, keys and verification restricted to managers',async()=>{
  await expect(createCredentialForUser(member,{})).rejects.toThrow(/owner or admin/);
  await expect(createApiKey(member,'Test key')).rejects.toThrow(/owner or admin/);
  await expect(submitIssuerApplication(member,{})).rejects.toThrow(/owner or admin/);
  await expect(recordIssuerPublicKey(member,{})).rejects.toThrow(/owner or admin/);
});
it('lets an Admin change a role with an audit event and notification',async()=>{
  const target=(await listWorkspaceMembers(owner)).people.find(p=>p.email===member.email)!;
  await changeWorkspaceMember(admin,target.id,'role','admin');
  expect((await listWorkspaceMembers(member)).canManage).toBe(true);
  expect(await env.DB.prepare("SELECT id FROM audit_events WHERE event_type='workspace.role_changed'").first()).toBeTruthy();
  expect(await env.DB.prepare("SELECT id FROM organization_notifications WHERE event_type='workspace.role_changed'").first()).toBeTruthy();
});
it('blocks removing or demoting the last Owner in the service and database',async()=>{
  const target=(await listWorkspaceMembers(owner)).people.find(p=>p.role==='owner')!;
  await expect(changeWorkspaceMember(admin,target.id,'remove')).rejects.toThrow(/last Owner/);
  await expect(changeWorkspaceMember(admin,target.id,'role','member')).rejects.toThrow(/last Owner/);
  await expect(env.DB.prepare('DELETE FROM organization_members WHERE id=?').bind(target.id).run()).rejects.toThrow(/last Owner/);
  await expect(env.DB.prepare("UPDATE organization_members SET role='member' WHERE id=?").bind(target.id).run()).rejects.toThrow(/last Owner/);
});
it('blocks cross-workspace emails and pending invites',async()=>{
  await expect(inviteWorkspaceMember(owner,{email:'OTHER@other.test',role:'member'},send)).rejects.toThrow(/another workspace/);
  await inviteWorkspaceMember(owner,{email:'pending@atlas.test',role:'member'},send);
  const other={...owner,userId:'other',email:'other@other.test'};
  await expect(inviteWorkspaceMember(other,{email:'pending@atlas.test',role:'member'},send)).rejects.toThrow(/pending invite to another workspace/);
  expect(await claimWorkspaceInvite({...other,email:'pending@atlas.test'})).toMatchObject({error:expect.stringContaining('could not be accepted')});
  expect((await listWorkspaceMembers(other)).organization.id).toBe('other');
});
it('keeps the pending row when delivery fails and allows retry',async()=>{
  await expect(inviteWorkspaceMember(owner,{email:'retry@atlas.test',role:'member'},async()=>{throw Error('offline')})).rejects.toThrow(/invite is saved/);
  expect((await listWorkspaceMembers(owner)).pending.some(p=>p.email==='retry@atlas.test')).toBe(true);
  await inviteWorkspaceMember(owner,{email:'retry@atlas.test',role:'member'},send);
});
it('rejects invalid roles, emails and members in another workspace',async()=>{
  await expect(inviteWorkspaceMember(owner,{email:'bad',role:'member'},send)).rejects.toThrow(/valid email/);
  await expect(inviteWorkspaceMember(owner,{email:'test@atlas.test',role:'superuser'},send)).rejects.toThrow(/Choose/);
  const other=await env.DB.prepare("SELECT id FROM organization_members WHERE user_id='other'").first<{id:number}>();
  await expect(changeWorkspaceMember(owner,other!.id,'remove')).rejects.toThrow(/not found/);
});
it('allows Owner handoff and removal while retaining an Owner and updating the owner pointer',async()=>{
  let data=await listWorkspaceMembers(owner);
  await changeWorkspaceMember(owner,data.people.find(p=>p.email===admin.email)!.id,'role','owner');
  await changeWorkspaceMember(admin,data.people.find(p=>p.email===owner.email)!.id,'remove');
  data=await listWorkspaceMembers(admin);expect(data.people.some(p=>p.email===owner.email)).toBe(false);
  expect(data.organization.ownerUserId).toBe(admin.userId);
  expect(await env.DB.prepare("SELECT id FROM audit_events WHERE event_type='workspace.removed'").first()).toBeTruthy();
  expect(await env.DB.prepare("SELECT id FROM organization_notifications WHERE event_type='workspace.removed'").first()).toBeTruthy();
});
it('compares the lab website domain without blocking outside mailboxes',()=>{
  expect(outsideLaboratoryDomain('person@atlas.test','https://www.atlas.test/about')).toBe(false);
  expect(outsideLaboratoryDomain('person@gmail.com','https://atlas.test')).toBe(true);
});

it('uses the existing Resend sign-in sender for a real pending invitation',async()=>{
  env.TECRID_AUTH_SECRET='fixture-only-secret-with-at-least-32-characters';
  env.TECRID_AUTH_URL='https://tecrid.test';env.RESEND_API_KEY='fixture-unused-key';env.TECRID_EMAIL_FROM='TECRID <signin@atlas.test>';
  await inviteWorkspaceMember(admin,{email:'resend@atlas.test',role:'member'});
  expect(mail.messages).toHaveLength(1);expect(mail.messages[0].subject).toBe('Sign in to TECRID');
  expect(mail.messages[0].to).toEqual(['resend@atlas.test']);expect(mail.messages[0].text).toContain('/sign-in/confirm?');
});

async function solo(label: string) {
  const user = {userId:`email:${label}`,email:`${label}@atlas.test`,displayName:label,fullName:null};
  const membership = await onboardOrganization(user,{role:'certification_body'});
  return {user,organizationId:membership!.organization.id};
}
it('invites a solo Owner without moving them until sign-in, then atomically moves and audits once',async()=>{
  const {user,organizationId} = await solo('empty-owner');
  await env.DB.prepare("INSERT INTO organization_notifications (id,organization_id,event_type,title,body,entity_type,entity_id) VALUES ('creation-notice',?,'organization.created','Created','Welcome','organization',?)").bind(organizationId,organizationId).run();
  await inviteWorkspaceMember(admin,{email:user.email,role:'member'},send);
  expect((await getOrganizationForUser(user.userId))!.organization.id).toBe(organizationId);
  await Promise.all([claimWorkspaceInvite(user),claimWorkspaceInvite(user)]);
  expect(await getOrganizationForUser(user.userId)).toMatchObject({role:'member',organization:{id:'atlas'}});
  expect(await env.DB.prepare('SELECT id FROM organizations WHERE id=?').bind(organizationId).first()).toBeNull();
  expect(await env.DB.prepare('SELECT id FROM audit_events WHERE organization_id=?').bind(organizationId).first()).toBeNull();
  expect(await env.DB.prepare("SELECT id FROM organization_notifications WHERE id='creation-notice'").first()).toBeNull();
  expect(await env.DB.prepare('SELECT id FROM workspace_invites WHERE email=?').bind(user.email).first()).toBeNull();
  const events = (await env.DB.prepare("SELECT payload FROM audit_events WHERE actor_user_id=? AND event_type='workspace.joined' AND organization_id='atlas'").bind(user.userId).all()).results as Array<{payload:string}>;
  expect(events).toHaveLength(1);
  expect(JSON.parse(events[0].payload)).toMatchObject({previousWorkspaceId:organizationId,role:'member'});
});
it('refuses a workspace containing credentials and preserves all of its data',async()=>{
  const {user,organizationId} = await solo('data-owner');
  await env.DB.prepare("INSERT INTO credentials (identifier,organization_id,sample_name,status) VALUES ('TECRID:KEEP',?,'Keep this report','issued')").bind(organizationId).run();
  await expect(inviteWorkspaceMember(admin,{email:user.email,role:'admin'},send)).rejects.toThrow(/another workspace with data or other members/);
  expect(await env.DB.prepare("SELECT identifier FROM credentials WHERE identifier='TECRID:KEEP'").first()).toBeTruthy();
  expect((await getOrganizationForUser(user.userId))!.organization.id).toBe(organizationId);
});
it('rechecks eligibility on claim when data or members arrive after the invitation',async()=>{
  for (const kind of ['notification','member','audit','unattributed-creation','api-key','profile','share-code']) {
    const {user,organizationId} = await solo(`changed-${kind}`);
    await inviteWorkspaceMember(admin,{email:user.email,role:'admin'},send);
    if (kind==='member') await env.DB.prepare("INSERT INTO organization_members (organization_id,user_id,email,role) VALUES (?,? ,?,'member')").bind(organizationId,`extra-${kind}`,`extra-${kind}@atlas.test`).run();
    if (kind==='notification') await env.DB.prepare("INSERT INTO organization_notifications (id,organization_id,event_type,title,body,entity_type,entity_id) VALUES ('keep-notice',?,'evidence.received','Keep','Keep','evidence','report')").bind(organizationId).run();
    if (kind==='audit') await env.DB.prepare("INSERT INTO audit_events (id,organization_id,actor_user_id,event_type,entity_type,entity_id,payload) VALUES ('keep-audit',?,?,'organization.updated','organization',?,'{}')").bind(organizationId,user.userId,organizationId).run();
    if (kind==='unattributed-creation') await env.DB.prepare("INSERT INTO audit_events (id,organization_id,event_type,entity_type,entity_id) VALUES ('unattributed',?,'organization.created','organization',?)").bind(organizationId,organizationId).run();
    if (kind==='api-key') await env.DB.prepare("INSERT INTO api_keys (id,organization_id,label,key_prefix,key_hash,last_four,created_by_user_id) VALUES ('keep-key',?,'Keep','test','keep-hash','1234',?)").bind(organizationId,user.userId).run();
    if (kind==='profile') await env.DB.prepare("INSERT INTO participant_profiles (id,organization_id,public_slug,display_name,summary) VALUES ('keep-profile',?,'keep-profile','Keep','Keep')").bind(organizationId).run();
    if (kind==='share-code') await env.DB.prepare("INSERT INTO evidence_share_codes (id,controller_organization_id,recipient_organization_id,label,purpose,scope_mode,scope_json,access_level,token_hash,token_prefix,token_last_four,created_by_user_id,created_at,expires_at) VALUES ('keep-share',?,'atlas','Keep','Keep','all','{}','selected_analytes','share-hash','share','1234',?,datetime('now'),datetime('now','+1 day'))").bind(organizationId,user.userId).run();
    expect(await claimWorkspaceInvite(user)).toMatchObject({error:expect.stringContaining('data or other members')});
    expect((await listWorkspaceMembers(user)).inviteError).toContain('could not be accepted');
    await expect(inviteWorkspaceMember(admin,{email:user.email,role:'admin'},send)).rejects.toThrow(/data or other members/);
    expect((await getOrganizationForUser(user.userId))!.organization.id).toBe(organizationId);
    expect(await env.DB.prepare('SELECT id FROM workspace_invites WHERE email=?').bind(user.email).first()).toBeTruthy();
  }
});
it('rolls back the whole move if a later batch statement fails',async()=>{
  const {user,organizationId} = await solo('rollback-owner');
  await inviteWorkspaceMember(admin,{email:user.email,role:'member'},send);
  await env.DB.prepare("CREATE TRIGGER fail_move_notice BEFORE INSERT ON organization_notifications WHEN NEW.event_type='workspace.joined' BEGIN SELECT RAISE(ABORT,'test rollback'); END").run();
  try { await expect(claimWorkspaceInvite(user)).rejects.toThrow(/test rollback/); }
  finally { await env.DB.prepare('DROP TRIGGER fail_move_notice').run(); }
  expect((await getOrganizationForUser(user.userId))!.organization.id).toBe(organizationId);
  expect(await env.DB.prepare('SELECT id FROM workspace_invites WHERE email=?').bind(user.email).first()).toBeTruthy();
  expect(await env.DB.prepare("SELECT id FROM audit_events WHERE actor_user_id=? AND event_type='workspace.joined'").bind(user.userId).first()).toBeNull();
});
it('claims pending invites before the join and welcome role pickers for new and existing accounts',async()=>{
  env.TECRID_PLATFORM_IDENTITY_SECRET='local-test-platform-secret';
  for (const existing of [false,true]) {
    for (const page of ['join','welcome']) {
      const label=`signin-${existing}-${page}`;
      const user=existing ? (await solo(label)).user : {userId:`email:${label}`,email:`${label}@atlas.test`,displayName:label,fullName:null};
      await inviteWorkspaceMember(admin,{email:user.email,role:'admin'},send);
      request.headers=new Headers({'x-tecrid-platform-identity':env.TECRID_PLATFORM_IDENTITY_SECRET,'oai-authenticated-user-id':user.userId,'oai-authenticated-user-email':user.email});
      await expect(page==='join' ? JoinPage({searchParams:Promise.resolve({})}) : Welcome({searchParams:Promise.resolve({})})).rejects.toThrow('redirect:/dashboard');
      expect(await getOrganizationForUser(user.userId)).toMatchObject({role:'admin',organization:{id:'atlas'}});
    }
  }
});
