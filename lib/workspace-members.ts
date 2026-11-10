import { env } from 'cloudflare:workers';
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
  return { organization: membership.organization, canManage: ['owner','admin'].includes(membership.role), people: people.results, pending: pending.results };
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
export async function inviteWorkspaceMember(user: ChatGPTUser, input: { email: string; role: unknown }, send = sendWorkspaceSignIn) {
  const { organization } = await workspace(user, true);
  const email = input.email.trim().toLowerCase();
  const invitedRole = role(input.role);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new TecInputError('Enter a valid email address.');
  const existing = await db().prepare('SELECT organization_id FROM organization_members WHERE lower(email)=?').bind(email).first<{organization_id:string}>();
  if (existing) throw new TecInputError(existing.organization_id === organization.id ? 'This person is already in your workspace.' : 'This person already belongs to another workspace. A person can belong to only one workspace.');
  const pending = await db().prepare('SELECT organization_id FROM workspace_invites WHERE email=?').bind(email).first<{organization_id:string}>();
  if (pending && pending.organization_id !== organization.id) throw new TecInputError('This email has a pending invite to another workspace. A person can belong to only one workspace.');
  const inviteId = id();
  await recordMutation(user, organization.id, 'workspace.invited', email, { email, role: invitedRole }, db().prepare(`INSERT INTO workspace_invites (id,organization_id,email,role,invited_by,created_at)
    SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM organization_members WHERE organization_id=? AND user_id=? AND role IN ('owner','admin'))
    AND NOT EXISTS (SELECT 1 FROM organization_members WHERE lower(email)=?)
    ON CONFLICT(email) DO UPDATE SET role=excluded.role,invited_by=excluded.invited_by WHERE workspace_invites.organization_id=excluded.organization_id`).bind(inviteId,organization.id,email,invitedRole,user.userId,new Date().toISOString(),organization.id,user.userId,email));
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
    if (membership.organization.id !== invite.organization_id) return; // Never move an existing account.
    await db().prepare('DELETE FROM workspace_invites WHERE id=?').bind(invite.id).run();
    return;
  }
  await recordMutation(user,invite.organization_id,'workspace.joined',user.userId,{email:user.email,role:invite.role},db().prepare(`INSERT OR IGNORE INTO organization_members (organization_id,user_id,email,role,display_name,created_at)
    SELECT organization_id,?,?,role,?,? FROM workspace_invites WHERE id=? AND email=?
    AND NOT EXISTS (SELECT 1 FROM organization_members WHERE lower(email)=?)`).bind(user.userId,user.email.toLowerCase(),user.displayName,new Date().toISOString(),invite.id,user.email.toLowerCase(),user.email.toLowerCase()), false);
  await db().prepare('DELETE FROM workspace_invites WHERE id=? AND EXISTS (SELECT 1 FROM organization_members WHERE user_id=? AND organization_id=?)').bind(invite.id,user.userId,invite.organization_id).run();
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
