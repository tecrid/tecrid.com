import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getEmailUser } from '../../../lib/email-auth';
import { inboxHeaders, ownNotifications, vleNotifications } from '../../../lib/notifications';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status=200) => Response.json(body, {status, headers: inboxHeaders});
async function handle(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return json({error:'Sign in to view your notifications.'},401);
  let readId: string | undefined;
  if (request.method === 'POST') {
    if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Same-origin request required.'},403);
    try { const text=await request.text(); if(text.length>1000)return json({error:'Request too large.'},413); const body=JSON.parse(text); if(body.action!=='read'||typeof body.id!=='string'||body.id.length>240)throw Error(); readId=body.id; } catch { return json({error:'Choose a notification to mark read.'},400); }
  }
  const emailUser = await getEmailUser(request.headers);
  if (readId?.startsWith('vle:') && !emailUser) return json({error:'Work-email sign-in is required for VLE notifications.'},403);
  if (readId && !/^(tecrid|vle):/.test(readId)) return json({error:'Unknown notification.'},404);
  const results = await Promise.allSettled([
    ownNotifications(env.DB, user, readId?.startsWith('tecrid:') ? readId : undefined),
    emailUser ? vleNotifications(emailUser, readId?.startsWith('vle:') ? readId : undefined) : Promise.resolve([]),
  ]);
  if(readId && results[readId.startsWith('vle:')?1:0].status==='rejected') return json({error:'The notification could not be marked read. Refresh and retry.'},503);
  const items=results.flatMap(result=>result.status==='fulfilled'?result.value:[]).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const unavailable=results.flatMap((result,index)=>result.status==='rejected'?[index===0?'TECRID':'VLE']:[]);
  return json({items, unreadCount:items.filter(item=>!item.read).length, unavailable, vleConnected:!!emailUser});
}
export async function GET(request:Request){try{return await handle(request);}catch{return json({error:'Notifications are temporarily unavailable.'},503);}}
export async function POST(request:Request){try{return await handle(request);}catch{return json({error:'Notifications are temporarily unavailable.'},503);}}
