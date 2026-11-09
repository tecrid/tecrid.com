import type { ChatGPTUser } from '../app/chatgpt-auth';

export type InboxItem = { id: string; source: 'tecrid'; kind: string; title: string; body: string; href: string; createdAt: string; read: boolean };
export const inboxHeaders = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization', 'X-Content-Type-Options': 'nosniff' };
export function safeInboxHref(value: unknown, _source: 'tecrid' = 'tecrid') {
  const origin = 'https://tecrid.com';
  try { const url = new URL(typeof value === 'string' ? value : '/notifications', origin); return url.origin === origin ? url.href : `${origin}/notifications`; } catch { return `${origin}/notifications`; }
}
// Callers must supply a validated session; never take identity from a browser.
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
