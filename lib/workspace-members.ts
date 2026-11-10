import { env } from 'cloudflare:workers';
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '../db/schema';
import type { ChatGPTUser } from '../app/chatgpt-auth';
import { emailAuth } from './email-auth';
import { getOrganizationForUser, TecAuthorizationError, TecInputError } from './tec';

export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type WorkspacePerson = { id: number; name: string; email: string; role: WorkspaceRole; joinedAt: string };
export type PendingInvite = { id: string; email: string; role: WorkspaceRole; createdAt: string };
const db = () => env.DB as D1Database;
const id = () => crypto.randomUUID();
const path = '/dashboard/settings/members';
export function outsideLaboratoryDomain(email: string, website: string | null) {
  if (!website) return false;
  try { return email.trim().toLowerCase().split('@')[1] !== new URL(website).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return false; }
}
function role(value: unknown): WorkspaceRole {
  if (!['owner', 'admin', 'member'].includes(String(value))) throw new TecInputError('Choose Owner, Admin, or Member.');
  return value as WorkspaceRole;
}
async function workspace(user: ChatGPTUser, manage = false) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError('Join a workspace first.');
  if (manage && !['owner', 'admin'].includes(membership.role)) throw new TecAuthorizationError('Only Owners and Admins can manage members.');
  return membership;
}
export async function listWorkspaceMembers(user: ChatGPTUser) {
  const membership = await workspace(user);
  const organizationId = membership.organization.id;
  const people = await db().prepare(`SELECT m.id, COALESCE(NULLIF(m.display_name,''), a.name, m.email) AS name, m.email, m.role, m.created_at AS joinedAt
    FROM organization_members m LEFT JOIN auth_user a ON m.user_id='email:'||a.id WHERE m.organization_id=? ORDER BY m.created_at,m.id`).bind(organizationId).all<WorkspacePerson>();
  const pending = await db().prepare('SELECT id,email,role,created_at AS createdAt FROM workspace_invites WHERE organization_id=? ORDER BY created_at').bind(organizationId).all<PendingInvite>();
  const incoming = await db().prepare('SELECT id FROM workspace_invites WHERE email=? AND organization_id<>?').bind(user.email.trim().toLowerCase(),organizationId).first();
  return { inviteError: incoming ? blockedInviteMessage : null, organization: membership.organization, canManage: ['owner','admin'].includes(membership.role), people: people.results, pending: pending.results };
}
// A mutation, its audit event, and its Owner inbox notification commit together.
async function recordMutation(user: ChatGPTUser, organizationId: string, event: string, entity: string, payload: object, mutation: D1PreparedStatement, requireChange = true) {
  const eventId = id();
  const createdAt = new Date().toISOString();
  const results = await db().batch([
    mutation,
    db().prepare(`INSERT INTO audit_events (id,organization_id,actor_user_id,event_type,entity_type,entity_id,payload,created_at)
      SELECT ?,?,?,?,'workspace_member',?,?,? WHERE changes()>0`).bind(eventId,organizationId,user.userId,event,entity,JSON.stringify(payload),createdAt),
    db().prepare(`INSERT INTO organization_notifications (id,organization_id,event_type,title,body,action_path,entity_type,entity_id,created_at)
      SELECT ?,?,?,'Workspace members updated',?,?,'workspace_member',?,? WHERE EXISTS (SELECT 1 FROM audit_events WHERE id=?)`).bind(id(),organizationId,event,`${user.displayName}: ${event.replace('workspace.', '').replaceAll('_', ' ')}. ${'email' in payload ? String(payload.email) : ''}`,path,entity,createdAt,eventId),
    db().prepare(`UPDATE organizations SET owner_user_id=(SELECT user_id FROM organization_members WHERE organization_id=? AND role='owner' ORDER BY id LIMIT 1),owner_email=(SELECT email FROM organization_members WHERE organization_id=? AND role='owner' ORDER BY id LIMIT 1)
      WHERE id=? AND EXISTS (SELECT 1 FROM audit_events WHERE id=?) AND NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=? AND user_id=organizations.owner_user_id AND role='owner')`).bind(organizationId,organizationId,organizationId,eventId,organizationId),
  ]);
  if (requireChange && !results[0].meta.changes) throw new TecInputError('The workspace changed. Refresh and try again.');
}
export async function sendWorkspaceSignIn(email: string) {
  await emailAuth().api.signInMagicLink({ headers: new Headers(), body: { email, callbackURL: path, newUserCallbackURL: path } });
}
// Derive the deny list from the schema, including controller, recipient, issuer,
// source and laboratory references. New organization-linked tables fail closed.
function allConditions(conditions: string[]): string {
  if (!conditions.length) return '1=1';
  if (conditions.length === 1) return conditions[0];
  // Balance the expression to stay within D1's expression-depth limit.
  const middle = Math.floor(conditions.length / 2);
  return `(${allConditions(conditions.slice(0,middle))} AND ${allConditions(conditions.slice(middle))})`;
}
const emptyWorkspaceDataGuard = allConditions(Object.values(schema).filter(table => is(table, SQLiteTable)).flatMap(table => {
  const { name, columns } = getTableConfig(table);
  if (name === 'organization_members') return [];
  return columns.filter(column => /(^|_)organization_id$/.test(column.name)).map(column => {
    const ownCreation = name === 'audit_events'
      ? " AND NOT COALESCE(event_type='organization.created' AND entity_type='organization' AND entity_id=o.id AND actor_user_id=o.owner_user_id,0)"
      : name === 'organization_notifications'
        ? " AND NOT (event_type='organization.created' AND entity_type='organization' AND entity_id=o.id)"
        : '';
    return `NOT EXISTS (SELECT 1 FROM "${name}" WHERE "${column.name}"=o.id${ownCreation})`;
  });
}));
// o is the source organization and m its sole owner. Reused inside the write,
// so eligibility cannot become stale between inspection and the atomic D1 batch.
const emptySoloWorkspace = `m.role='owner' AND m.user_id=o.owner_user_id
  AND lower(m.email)=lower(o.owner_email)
  AND (SELECT count(*) FROM organization_members WHERE organization_id=o.id)=1
  AND o.plan='free' AND o.stripe_customer_id IS NULL AND o.stripe_subscription_id IS NULL
  AND o.issuer_public_key_jwk IS NULL AND o.issuer_key_id IS NULL AND o.issuer_key_algorithm IS NULL AND o.issuer_key_verified_at IS NULL
  AND o.issuer_status IN ('pending','not_applicable') AND ${emptyWorkspaceDataGuard}`;
const blockedInviteMessage = 'Your invite could not be accepted because your current workspace has data or other members. Use a different email or contact TECRID for help.';
const occupiedWorkspaceMessage = 'This person already belongs to another workspace with data or other members. Only an empty workspace with a single Owner can be moved. Ask them to use a different email or contact TECRID for help.';

export async function inviteWorkspaceMember(user: ChatGPTUser, input: { email: string; role: unknown }, send = sendWorkspaceSignIn) {
  const { organization } = await workspace(user, true);
  const email = input.email.trim().toLowerCase();
  const invitedRole = role(input.role);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new TecInputError('Enter a valid email address.');
  const existing = await db().prepare('SELECT organization_id FROM organization_members WHERE lower(email)=?').bind(email).first<{organization_id:string}>();
  if (existing) {
    if (existing.organization_id === organization.id) throw new TecInputError('This person is already in your workspace.');
    const eligible = await db().prepare(`SELECT o.id FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE lower(m.email)=? AND ${emptySoloWorkspace}`).bind(email).first();
    if (!eligible) throw new TecInputError(occupiedWorkspaceMessage);
  }
  const pending = await db().prepare('SELECT organization_id FROM workspace_invites WHERE email=?').bind(email).first<{organization_id:string}>();
  if (pending && pending.organization_id !== organization.id) throw new TecInputError('This email has a pending invite to another workspace. A person can belong to only one workspace.');
  const inviteId = id();
  await recordMutation(user, organization.id, 'workspace.invited', email, { email, role: invitedRole }, db().prepare(`INSERT INTO workspace_invites (id,organization_id,email,role,invited_by,created_at)
    SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM organization_members WHERE organization_id=? AND user_id=? AND role IN ('owner','admin'))
    AND (NOT EXISTS (SELECT 1 FROM organization_members WHERE lower(email)=?)
      OR EXISTS (SELECT 1 FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE lower(m.email)=? AND o.id<>? AND ${emptySoloWorkspace}))
    ON CONFLICT(email) DO UPDATE SET role=excluded.role,invited_by=excluded.invited_by WHERE workspace_invites.organization_id=excluded.organization_id`).bind(inviteId,organization.id,email,invitedRole,user.userId,new Date().toISOString(),organization.id,user.userId,email,email,organization.id));
  try { await send(email); }
  catch { throw new TecInputError('The invite is saved, but the sign-in email could not be sent. Invite this email again to retry. They can also sign in at tecrid.com.'); }
  return { email, outsideDomain: organization.organizationType === 'laboratory' && outsideLaboratoryDomain(email, organization.website) };
}
export async function claimWorkspaceInvite(user: ChatGPTUser) {
  if (user.displayName !== user.email) await db().prepare('UPDATE organization_members SET display_name=? WHERE user_id=? AND display_name<>?').bind(user.displayName,user.userId,user.displayName).run();
  const invite = await db().prepare('SELECT id,organization_id,role FROM workspace_invites WHERE email=?').bind(user.email.trim().toLowerCase()).first<{id:string;organization_id:string;role:WorkspaceRole}>();
  if (!invite) return;
  const membership = await getOrganizationForUser(user.userId);
  if (membership) {
    if (membership.organization.id !== invite.organization_id) {
      return moveEmptyWorkspace(user, membership.organization.id, invite);
    }
    await db().prepare('DELETE FROM workspace_invites WHERE id=?').bind(invite.id).run();
    return;
  }
  await recordMutation(user,invite.organization_id,'workspace.joined',user.userId,{email:user.email,role:invite.role},db().prepare(`INSERT OR IGNORE INTO organization_members (organization_id,user_id,email,role,display_name,created_at)
    SELECT organization_id,?,?,role,?,? FROM workspace_invites WHERE id=? AND email=?
    AND NOT EXISTS (SELECT 1 FROM organization_members WHERE lower(email)=?)`).bind(user.userId,user.email.toLowerCase(),user.displayName,new Date().toISOString(),invite.id,user.email.toLowerCase(),user.email.toLowerCase()), false);
  await db().prepare('DELETE FROM workspace_invites WHERE id=? AND EXISTS (SELECT 1 FROM organization_members WHERE user_id=? AND organization_id=?)').bind(invite.id,user.userId,invite.organization_id).run();
}
async function moveEmptyWorkspace(user: ChatGPTUser, sourceId: string, invite: { id: string; organization_id: string; role: WorkspaceRole }) {
  const eventId = id();
  const timestamp = new Date().toISOString();
  const email = user.email.trim().toLowerCase();
  const happened = 'EXISTS (SELECT 1 FROM audit_events WHERE id=?)';
  const results = await db().batch([
    // Keep Owner during relocation so the last-Owner role guard remains intact.
    db().prepare(`UPDATE organization_members SET organization_id=?,display_name=?,created_at=?
      WHERE user_id=? AND lower(email)=? AND organization_id=?
      AND EXISTS (SELECT 1 FROM workspace_invites WHERE id=? AND email=? AND organization_id=?)
      AND EXISTS (SELECT 1 FROM organizations o JOIN organization_members m ON m.organization_id=o.id
        WHERE o.id=? AND m.user_id=? AND ${emptySoloWorkspace})`)
      .bind(invite.organization_id,user.displayName,timestamp,user.userId,email,sourceId,invite.id,email,invite.organization_id,sourceId,user.userId),
    db().prepare(`INSERT INTO audit_events (id,organization_id,actor_user_id,event_type,entity_type,entity_id,payload,created_at)
      SELECT ?,?,?,'workspace.joined','workspace_member',?,json_set(?,'$.role',(SELECT role FROM workspace_invites WHERE id=?)),? WHERE changes()>0`)
      .bind(eventId,invite.organization_id,user.userId,user.userId,JSON.stringify({email,role:invite.role,previousWorkspaceId:sourceId}),invite.id,timestamp),
    db().prepare(`UPDATE organization_members SET role=(SELECT role FROM workspace_invites WHERE id=?) WHERE user_id=? AND organization_id=? AND ${happened}`)
      .bind(invite.id,user.userId,invite.organization_id,eventId),
    // Creation audit rows have no FK. All other source data was excluded above.
    db().prepare(`DELETE FROM audit_events WHERE organization_id=? AND ${happened}`).bind(sourceId,eventId),
    db().prepare(`DELETE FROM organizations WHERE id=? AND NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=?) AND ${happened}`).bind(sourceId,sourceId,eventId),
    db().prepare(`INSERT INTO organization_notifications (id,organization_id,event_type,title,body,action_path,entity_type,entity_id,created_at)
      SELECT ?,?,'workspace.joined','Workspace members updated',?,?,'workspace_member',?,? WHERE ${happened}`)
      .bind(id(),invite.organization_id,`${user.displayName} joined this workspace.`,path,user.userId,timestamp,eventId),
    db().prepare(`DELETE FROM workspace_invites WHERE id=? AND ${happened}`).bind(invite.id,eventId),
  ]);
  if (!results[0].meta.changes) {
    // Concurrent sign-in may already have completed this same invite.
    const current = await getOrganizationForUser(user.userId);
    if (current?.organization.id !== invite.organization_id) return { error: blockedInviteMessage };
  }
}
export async function changeWorkspaceMember(user: ChatGPTUser, memberId: number, action: 'role' | 'remove', value?: unknown) {
  const { organization } = await workspace(user, true);
  const target = await db().prepare('SELECT email,role,user_id FROM organization_members WHERE id=? AND organization_id=?').bind(memberId,organization.id).first<{email:string;role:string;user_id:string}>();
  if (!target) throw new TecInputError('This member was not found in your workspace.');
  const nextRole = action === 'role' ? role(value) : null;
  if (target.role === 'owner' && nextRole !== 'owner') {
    const count = await db().prepare("SELECT count(*) AS total FROM organization_members WHERE organization_id=? AND role='owner'").bind(organization.id).first<{total:number}>();
    if (count!.total <= 1) throw new TecInputError('The last Owner cannot be removed or demoted. Assign another Owner first.');
  }
  const guard = "EXISTS (SELECT 1 FROM organization_members actor WHERE actor.organization_id=? AND actor.user_id=? AND actor.role IN ('owner','admin'))";
  const mutation = action === 'remove'
    ? db().prepare(`DELETE FROM organization_members WHERE id=? AND organization_id=? AND ${guard}`).bind(memberId,organization.id,organization.id,user.userId)
    : db().prepare(`UPDATE organization_members SET role=? WHERE id=? AND organization_id=? AND ${guard}`).bind(nextRole,memberId,organization.id,organization.id,user.userId);
  try { await recordMutation(user,organization.id,action === 'remove' ? 'workspace.removed' : 'workspace.role_changed',String(memberId),{email:target.email,previousRole:target.role,role:nextRole},mutation); }
  catch (error) {
    if (String(error).includes('last Owner')) throw new TecInputError('The last Owner cannot be removed or demoted. Assign another Owner first.');
    throw error;
  }
}
