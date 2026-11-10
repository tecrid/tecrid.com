import { env } from 'cloudflare:workers';
import type { ChatGPTUser } from '../app/chatgpt-auth';
import { assertOrganizationManager, getOrganizationForUser, TecAuthorizationError, TecInputError } from './tec';
import { revokeEvidenceGrant, revokeRoutingAuthorization } from './evidence-routing';
import { revokeEvidenceShareCode } from './sharing';

export type AccessKind = 'grant' | 'share' | 'routing';
export type AccessItem = {
  id: string; kind: AccessKind; recipientId: string; name: string; type: string;
  accessLevel: string | null; products: string[]; analytes: string[];
  grantedAt: string; expiresAt: string | null; lastUsedAt: string | null;
};
export type AccessOrganization = { id: string; name: string; type: string; items: AccessItem[] };
export type AccessHistory = { id: string; recipientId: string; name: string; type: string; itemId: string; kind: AccessKind; revokedAt: string; products: string[] };
type RawItem = Omit<AccessItem, 'products' | 'analytes'> & { scope: string; analytes: string | null };
const database = () => env.DB as D1Database;
function values(json: string | null) {
  try { const result: unknown = JSON.parse(json || '[]'); return Array.isArray(result) ? result.filter((item): item is string => typeof item === 'string') : []; }
  catch { return []; }
}
async function controller(user: ChatGPTUser, manage = false) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership || !['brand','supplier'].includes(membership.organization.organizationType)) {
    throw new TecAuthorizationError('This access list is for brand and supplier workspaces.');
  }
  if (manage) assertOrganizationManager(membership.role, 'revoke workspace access');
  return membership;
}
// Project only display fields. Codes, token hashes, snapshots, and findings never reach the client.
async function itemsForController(organizationId: string): Promise<AccessItem[]> {
  const result = await database().prepare(`
    SELECT g.id AS id,'grant' AS kind,g.recipient_organization_id AS recipientId,o.name,o.organization_type AS type,
      g.access_level AS accessLevel,json_array(g.product_sku) AS scope,g.analyte_scope_json AS analytes,
      g.created_at AS grantedAt,NULL AS expiresAt,
      (SELECT max(d.delivered_at) FROM evidence_deliveries d WHERE d.grant_id=g.id) AS lastUsedAt
    FROM evidence_access_grants g JOIN organizations o ON o.id=g.recipient_organization_id
    WHERE g.controller_organization_id=? AND g.status='active'
    UNION ALL
    SELECT s.id,'share',s.recipient_organization_id,o.name,o.organization_type,s.access_level,
      CASE WHEN s.scope_mode='portfolio' THEN '["Current portfolio"]' ELSE s.scope_json END,s.analyte_scope_json,
      s.created_at,s.expires_at,s.redeemed_at
    FROM evidence_share_codes s JOIN organizations o ON o.id=s.recipient_organization_id
    WHERE s.controller_organization_id=? AND s.status IN ('active','redeemed')
    UNION ALL
    SELECT r.id,'routing',r.laboratory_organization_id,o.name,o.organization_type,NULL,json_array(r.product_sku),NULL,
      r.created_at,r.expires_at,r.last_used_at
    FROM routing_authorizations r JOIN organizations o ON o.id=r.laboratory_organization_id
    WHERE r.controller_organization_id=? AND r.status='active'
    ORDER BY grantedAt,id`).bind(organizationId,organizationId,organizationId).all<RawItem>();
  return result.results.map(({scope,analytes,...item}) => ({...item,products:values(scope),analytes:values(analytes)}));
}
export async function listWorkspaceAccess(user: ChatGPTUser) {
  const membership = await controller(user);
  const items = await itemsForController(membership.organization.id);
  const grouped = new Map<string,AccessOrganization>();
  for (const item of items) {
    const row = grouped.get(item.recipientId) || {id:item.recipientId,name:item.name,type:item.type,items:[]};
    row.items.push(item);grouped.set(row.id,row);
  }
  const revoked = await database().prepare(`SELECT a.id,a.entity_id AS itemId,a.created_at AS revokedAt,
      CASE a.event_type WHEN 'evidence_access.revoked' THEN 'grant' WHEN 'evidence_share.revoked' THEN 'share' ELSE 'routing' END AS kind,
      o.id AS recipientId,o.name,o.organization_type AS type,
      CASE WHEN s.scope_mode='portfolio' THEN '["Current portfolio"]' ELSE coalesce(s.scope_json,json_array(coalesce(g.product_sku,r.product_sku,json_extract(a.payload,'$.productSku')))) END AS scope
    FROM audit_events a
    LEFT JOIN evidence_access_grants g ON a.event_type='evidence_access.revoked' AND g.id=a.entity_id
    LEFT JOIN evidence_share_codes s ON a.event_type='evidence_share.revoked' AND s.id=a.entity_id
    LEFT JOIN routing_authorizations r ON a.event_type='evidence_routing.revoked' AND r.id=a.entity_id
    JOIN organizations o ON o.id=coalesce(g.recipient_organization_id,s.recipient_organization_id,r.laboratory_organization_id,json_extract(a.payload,'$.recipientOrganizationId'),json_extract(a.payload,'$.laboratoryOrganizationId'))
    WHERE a.organization_id=? AND a.event_type IN ('evidence_access.revoked','evidence_share.revoked','evidence_routing.revoked')
    ORDER BY a.created_at DESC,a.id DESC`).bind(membership.organization.id).all<Omit<AccessHistory,'products'> & {scope:string}>();
  return {
    organizationName:membership.organization.name,
    canRevoke:['owner','admin'].includes(membership.role),
    organizations:[...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name)),
    history:revoked.results.map(({scope,...event})=>({...event,products:values(scope)})),
  };
}
export async function revokeWorkspaceAccess(user: ChatGPTUser, recipientId: string, selected?: {id:string;kind:AccessKind}) {
  const membership = await controller(user, true);
  const items = (await itemsForController(membership.organization.id)).filter(item => item.recipientId === recipientId);
  const targets = selected ? items.filter(item => item.id === selected.id && item.kind === selected.kind) : items;
  if (!targets.length) throw new TecInputError('No current permissions were found for this organization. Refresh the access list.');
  // The existing functions preserve each permission's audit trail and authorization rules.
  // Process independently so a stale item cannot leave unrelated access silently untouched.
  const failed: string[] = [];
  for (const item of targets) {
    try {
      if (item.kind === 'grant') await revokeEvidenceGrant(user,item.id);
      else if (item.kind === 'share') await revokeEvidenceShareCode(user,item.id);
      else await revokeRoutingAuthorization(user,item.id);
    } catch { failed.push(item.id); }
  }
  if (failed.length) throw new TecInputError('Some permissions could not be revoked. Refresh the list and revoke the remaining items.');
  return { revoked:targets.length };
}
