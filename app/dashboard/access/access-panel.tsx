'use client';
import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AccessHistory, AccessItem, AccessOrganization } from '../../../lib/workspace-access';

export const revocationNotice = 'Revoking stops all future access. Copies already delivered stay with the recipient.';
const kinds = {grant:'Evidence grant',share:'Share code',routing:'Laboratory routing'};
const accessLabels: Record<string,string> = {status_only:'Status only',selected_analytes:'Selected analytes',full_record:'Full record'};
const typeLabels: Record<string,string> = {brand:'Brand',supplier:'Supplier',laboratory:'Laboratory',retailer:'Retailer',certification_body:'Certification body',government:'Government'};
function date(value: string | null, fallback: string) {
  if (!value) return fallback;
  const normalized = value.includes('T') ? value : value.replace(' ','T')+'Z';
  return new Date(normalized).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
}
function permission(item: AccessItem) {
  return item.accessLevel ? accessLabels[item.accessLevel] || item.accessLevel.replaceAll('_',' ') : 'Routing only';
}
function unique(values: string[]) { return [...new Set(values)]; }
function used(items: AccessItem[]) {
  const dates = items.map(item=>item.lastUsedAt).filter((value):value is string=>!!value).sort();
  return date(dates.at(-1) || null,'No recorded use');
}
export function AccessPanel({organizations,history,canRevoke}: {
  organizations: AccessOrganization[]; history: AccessHistory[]; canRevoke: boolean;
}) {
  const router = useRouter();
  const [tab,setTab] = useState<'current'|'revoked'>('current');
  const [expanded,setExpanded] = useState<string[]>([]);
  const [confirmation,setConfirmation] = useState<{organization:AccessOrganization;item?:AccessItem}|null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  function toggle(id:string) {setExpanded(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);}
  async function revoke() {
    if (!confirmation) return;
    setBusy(true);setMessage('');
    try {
      const {organization,item} = confirmation;
      const response = await fetch('/api/workspace/access',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({recipientId:organization.id,confirm:true,...(item?{item:{id:item.id,kind:item.kind}}:{})}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Access could not be revoked.');
      setMessage(`Revoked ${body.revoked} ${body.revoked===1?'permission':'permissions'} for ${organization.name}.`);
    } catch(error) {setMessage(error instanceof Error?error.message:'Access could not be revoked. Try again.');}
    finally {setBusy(false);setConfirmation(null);router.refresh();}
  }
  return <div className="access-panel">
    <div className="work-filters" role="group" aria-label="Access views">
      <button type="button" aria-pressed={tab==='current'} onClick={()=>setTab('current')}>Current ({organizations.length})</button>
      <button type="button" aria-pressed={tab==='revoked'} onClick={()=>setTab('revoked')}>Revoked ({history.length})</button>
    </div>
    <p>Last used shows the latest recorded delivery, code redemption, or routing use. Individual views are not tracked. Expired permissions keep their original expiry dates here.</p>
    {!canRevoke ? <p>Members can view this list. Only Owners and Admins can revoke access.</p>:null}
    {message ? <p role="status">{message}</p>:null}
    {confirmation ? <section className="member-confirmation" aria-label="Confirm access revocation">
      <h2>{confirmation.item?'Revoke this permission?':'Revoke all access?'}</h2>
      <p>{confirmation.organization.name}{confirmation.item?`: ${kinds[confirmation.item.kind]} for ${confirmation.item.products.join(', ')}.`:' will lose every current permission from this workspace.'}</p>
      <p>{revocationNotice}</p>
      <button type="button" disabled={busy} onClick={()=>void revoke()}>Confirm revocation</button>
      <button type="button" disabled={busy} onClick={()=>setConfirmation(null)}>Cancel</button>
    </section>:null}
    {tab==='current' ? <section className="work-queue" aria-label="Current access">
      {organizations.length ? <table className="work-table access-table"><thead><tr>
        <th>Organization</th><th>What it can see</th><th>Products or TECRIDs</th><th>Granted</th><th>Expires</th><th>Last used</th>{canRevoke?<th>Manage</th>:null}
      </tr></thead><tbody>{organizations.map(organization=><Fragment key={organization.id}>
        <tr>
          <td><strong>{organization.name}</strong><br/><small>{typeLabels[organization.type]||organization.type.replaceAll('_',' ')}</small><br/>
            <button className="access-details-button" type="button" aria-expanded={expanded.includes(organization.id)} aria-controls={`access-${organization.id}`} onClick={()=>toggle(organization.id)}>{expanded.includes(organization.id)?'Hide items':'Show items'} ({organization.items.length})</button>
          </td>
          <td>{unique(organization.items.map(permission)).join(', ')}</td>
          <td>{unique(organization.items.flatMap(item=>item.products)).join(', ')}</td>
          <td>{date(organization.items.map(item=>item.grantedAt).sort()[0],'Not recorded')}</td>
          <td>{unique(organization.items.map(item=>date(item.expiresAt,'No expiry'))).join(', ')}</td>
          <td>{used(organization.items)}</td>
          {canRevoke?<td><button type="button" disabled={busy} aria-label={`Revoke all access for ${organization.name}`} onClick={()=>setConfirmation({organization})}>Revoke</button><small className="access-revoke-note">{revocationNotice}</small></td>:null}
        </tr>
        {expanded.includes(organization.id)?<tr id={`access-${organization.id}`}><td colSpan={canRevoke?7:6}>
          <ul className="access-items">{organization.items.map(item=><li key={`${item.kind}:${item.id}`}>
            <div><strong>{kinds[item.kind]}</strong><p>{permission(item)}{item.analytes.length?`: ${item.analytes.join(', ')}`:''}</p><p>{item.products.join(', ')}</p>
              {item.kind==='routing'?<p>Permits laboratory delivery. It does not grant access to view your results.</p>:null}
              <p>Granted {date(item.grantedAt,'Not recorded')} · Expires {date(item.expiresAt,'No expiry')} · Last used {date(item.lastUsedAt,'No recorded use')}</p>
            </div>
            {canRevoke?<div><button type="button" disabled={busy} aria-label={`Revoke ${kinds[item.kind]} ${item.id}`} onClick={()=>setConfirmation({organization,item})}>Revoke item</button><small className="access-revoke-note">{revocationNotice}</small></div>:null}
          </li>)}</ul>
        </td></tr>:null}
      </Fragment>)}</tbody></table>:<div className="queue-empty"><strong>No organizations have current permissions.</strong><p>Approve a request or share selected evidence to give an organization access.</p><a href="/dashboard/evidence-routing">Review requests</a></div>}
    </section>:<section className="work-queue" aria-label="Revoked access history">
      {history.length?<table className="work-table"><thead><tr><th>Organization</th><th>Permission</th><th>Products or TECRIDs</th><th>Revoked</th></tr></thead><tbody>{history.map(event=><tr key={event.id}><td><strong>{event.name}</strong><br/><small>{typeLabels[event.type]||event.type.replaceAll('_',' ')}</small></td><td>{kinds[event.kind]}</td><td>{event.products.join(', ')}</td><td>{date(event.revokedAt,'Not recorded')}</td></tr>)}</tbody></table>:<div className="queue-empty"><strong>No revoked access yet.</strong><p>Revoked permissions will appear here with their audit history.</p></div>}
    </section>}
  </div>;
}
