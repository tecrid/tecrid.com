'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { PendingInvite, WorkspacePerson, WorkspaceRole } from '../../../../lib/workspace-members';
// Domain advice is informational. Invitation authorization is enforced by the server.
function outsideDomain(email: string, website: string | null) {
  try { return !!email.includes('@') && !!website && email.toLowerCase().split('@')[1] !== new URL(website).hostname.replace(/^www\./,''); } catch { return false; }
}
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const date = (value: string) => new Date(value.includes('T') ? value : value.replace(' ','T')+'Z').toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', timeZone:'UTC' });
function Roles({value, onChange, name, id}: {value:string;onChange:(value:WorkspaceRole)=>void;name:string;id?:string}) {
  return <select id={id} aria-label={name} value={value} onChange={e=>onChange(e.target.value as WorkspaceRole)}><option value="member">Member</option><option value="admin">Admin</option><option value="owner">Owner</option></select>;
}
export function MembersPanel({people,pending,canManage,laboratory,website}: {people:WorkspacePerson[];pending:PendingInvite[];canManage:boolean;laboratory:boolean;website:string|null}) {
  const router = useRouter();
  const [email,setEmail] = useState('');
  const [role,setRole] = useState<WorkspaceRole>('member');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [confirmation,setConfirmation] = useState<{person:WorkspacePerson;action:'role'|'remove';role?:WorkspaceRole}|null>(null);
  async function save(body: object) {
    setBusy(true);setMessage('');
    try {
      const response = await fetch('/api/workspace/members',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The change could not be saved.');
      setMessage('Changes saved.');setConfirmation(null);router.refresh();return true;
    } catch(error) {setMessage(error instanceof Error ? error.message : 'Try again shortly.');return false;}
    finally {setBusy(false);}
  }
  async function invite(event:FormEvent) {event.preventDefault();if(await save({action:'invite',email,role})){setEmail('');setMessage('Invite saved. A TECRID sign-in email is on its way.');}}
  const owners = people.filter(person=>person.role==='owner').length;
  return <>
    <section className="workspace-summary" aria-label="Membership summary"><article><strong>{people.length}</strong><span>Members</span></article><article><strong>{pending.length}</strong><span>Pending invites</span></article><article><strong>{owners}</strong><span>{owners===1?'Owner':'Owners'}</span></article></section>
    {canManage ? <section className="settings-section"><h2>Invite someone</h2><p>They join this workspace when they sign in with the invited email.</p><form className="member-invite-form" onSubmit={invite}><label>Email<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" /></label><label htmlFor="invite-role">Role<Roles id="invite-role" name="Invite role" value={role} onChange={setRole}/></label><button disabled={busy}>Send invite</button></form>{laboratory && outsideDomain(email,website) ? <p role="note">This email is outside the laboratory website domain. You can still invite this person.</p> : null}</section> : <p>Only Owners and Admins can invite people, change roles, or remove members.</p>}
    {message ? <p role="status">{message}</p> : null}
    {confirmation ? <section className="member-confirmation" aria-label="Confirm member change"><h2>{confirmation.action==='remove'?'Remove member?':'Change role?'}</h2><p>{confirmation.action==='remove' ? `Remove ${confirmation.person.email} from this workspace? They will lose workspace access.` : `Change ${confirmation.person.email} to ${label(confirmation.role!)}?`}</p><button disabled={busy} onClick={()=>save({action:confirmation.action,memberId:confirmation.person.id,role:confirmation.role,confirm:true})}>Confirm {confirmation.action==='remove'?'removal':'role change'}</button><button disabled={busy} onClick={()=>setConfirmation(null)}>Cancel</button></section> : null}
    <section className="work-queue"><h2>Workspace members</h2><div className="workspace-table-scroll"><table className="work-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th>{canManage ? <th>Manage</th>:null}</tr></thead><tbody>{people.map(person=><tr key={person.id}><td>{person.name}</td><td>{person.email}</td><td>{label(person.role)}</td><td>{date(person.joinedAt)}</td>{canManage ? <td><div className="member-actions">{person.role==='owner' && owners===1 ? <span>Last Owner</span> : <><Roles name={`Role for ${person.email}`} value={person.role} onChange={value=>setConfirmation({person,action:'role',role:value})}/><button disabled={busy} onClick={()=>setConfirmation({person,action:'remove'})}>Remove</button></>}</div></td>:null}</tr>)}</tbody></table></div></section>
    <section className="work-queue"><h2>Pending invites</h2>{pending.length ? <table className="work-table"><thead><tr><th>Email</th><th>Role</th><th>Invited</th></tr></thead><tbody>{pending.map(invite=><tr key={invite.id}><td>{invite.email}</td><td>{label(invite.role)}</td><td>{date(invite.createdAt)}</td></tr>)}</tbody></table> : <div className="queue-empty"><strong>No pending invites.</strong><p>{canManage?'Enter an email above to invite someone to this workspace.':'An Owner or Admin can invite someone to this workspace.'}</p></div>}</section>
  </>;
}
