import { env } from 'cloudflare:workers';
import { inboxHeaders, ownNotifications, serviceAuthorized } from '../../../../../lib/notifications';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:inboxHeaders});
 if(!await serviceAuthorized(request,env,'notifications-to-tecrid'))return json({error:'Unauthorized'},401);
 let input;try{const text=await request.text();if(text.length>1500)return json({error:'Too large'},413);input=JSON.parse(text);}catch{return json({error:'Invalid request'},400);}
 const actor=input?.actor;
 if(!actor||actor.emailVerified!==true||typeof actor.email!=='string'||actor.email.length>254||!/^\S+@\S+\.\S+$/.test(actor.email))return json({error:'Verified email required'},403);
 if(!['list','read'].includes(input.action)||(input.action==='read'&&(typeof input.id!=='string'||!input.id.startsWith('tecrid:'))))return json({error:'Unknown operation'},400);
 try{const items=await ownNotifications(env.DB,{userId:'',email:actor.email},input.action==='read'?input.id:undefined,true);return json({items});}catch{return json({error:'Notifications unavailable'},503);}
}
