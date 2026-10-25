import { env } from 'cloudflare:workers';
import type { ChatGPTUser } from '../app/chatgpt-auth';
import { privateFetch } from './private-fetch';

export type InboxItem = { id: string; source: 'tecrid' | 'vle'; kind: string; title: string; body: string; href: string; createdAt: string; read: boolean };
export const inboxHeaders = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' };
export function safeInboxHref(value: unknown, source: 'tecrid' | 'vle') {
  const origin = source === 'tecrid' ? 'https://tecrid.com' : 'https://vle.exchange';
  try { const url = new URL(typeof value === 'string' ? value : '/notifications', origin); return ['https://tecrid.com', 'https://vle.exchange'].includes(url.origin) ? url.href : `${origin}/notifications`; } catch { return `${origin}/notifications`; }
}
// Local callers must supply a validated session. The bridge supplies an exact
// verified email only after service authentication; never take it from a browser.
export async function ownNotifications(db: D1Database, user: Pick<ChatGPTUser, 'userId' | 'email'>, readId?: string, bridge = false) {
  const email = user.email.trim().toLowerCase();
  const membership = bridge ? 'lower(m.email)=?' : 'm.user_id=?';
  const identity = bridge ? email : user.userId;
  if (readId) {
    if (!readId.startsWith('tecrid:') || readId.length > 180) throw new Error('Unknown notification');
    const id = readId.slice(7);
    const accessible = await db.prepare(`SELECT n.id FROM organization_notifications n JOIN organization_members m ON m.organization_id=n.organization_id WHERE n.id=? AND ${membership} LIMIT 1`).bind(id, identity).first();
    if (!accessible) throw new Error('Unknown notification');
    await db.prepare('INSERT OR IGNORE INTO notification_reads (notification_id,recipient_email,read_at) VALUES (?,?,?)').bind(id, email, new Date().toISOString()).run();
  }
  const rows = (await db.prepare(`SELECT DISTINCT n.id,n.event_type,n.title,n.body,n.action_path,n.created_at,r.read_at FROM organization_notifications n JOIN organization_members m ON m.organization_id=n.organization_id LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.recipient_email=? WHERE ${membership} ORDER BY n.created_at DESC,n.id DESC LIMIT 100`).bind(email, identity).all<any>()).results;
  return rows.map(row => ({ id: `tecrid:${row.id}`, source: 'tecrid' as const, kind: row.event_type, title: row.title, body: row.body, href: safeInboxHref(row.action_path, 'tecrid'), createdAt: row.created_at, read: !!row.read_at }));
}
export async function vleNotifications(user: Pick<ChatGPTUser, 'userId' | 'email'>, readId?: string, transport: typeof fetch = privateFetch): Promise<InboxItem[]> {
  const secret = (env as any).TECRID_EMAIL_RELAY_SECRET;
  if (!secret) throw new Error('VLE connection unavailable');
  const response = await transport('https://vle.exchange/api/tecrid-report-permissions', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action: readId ? 'notification-read' : 'notifications', id: readId, actor: { userId: user.userId, email: user.email, emailVerified: true } }),
  });
  if (!response.ok) throw new Error('VLE connection unavailable');
  const body = await response.json() as { items?: InboxItem[] };
  if (!Array.isArray(body.items)) throw new Error('VLE connection unavailable');
  return body.items.map(item => ({ ...item, source: 'vle', href: safeInboxHref(item.href, 'vle') }));
}
export async function serviceAuthorized(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const hash = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a,b] = await Promise.all([hash(request.headers.get('authorization') || ''), hash(`Bearer ${secret}`)]);
  let difference = 0; for (let i=0;i<a.length;i++) difference |= a[i]^b[i]; return difference === 0;
}
