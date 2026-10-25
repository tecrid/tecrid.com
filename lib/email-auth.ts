import { env } from 'cloudflare:workers';
import {getDb} from '../db';
import * as schema from '../db/schema';
import {createEmailAuth} from './email-auth-factory';
export function emailAuthReady(){const e=env as unknown as Record<string,string>;return !!(e.TECRID_AUTH_SECRET&&e.TECRID_MAIL_ISSUANCE_SECRET&&e.TECRID_EMAIL_RELAY_SECRET&&e.TECRID_EMAIL_RELAY_URL);}
export function emailAuth(){const e=env as unknown as Record<string,string>;return createEmailAuth(getDb(),schema,{secret:e.TECRID_AUTH_SECRET,baseURL:e.TECRID_AUTH_URL||'https://tecrid.com',relaySecret:e.TECRID_EMAIL_RELAY_SECRET,issuanceSecret:e.TECRID_MAIL_ISSUANCE_SECRET,relayURL:e.TECRID_EMAIL_RELAY_URL});}
export async function getEmailUser(headers:Headers){
 if(!emailAuthReady())return null;
 const origin=headers.get('origin');
 if(origin&&!['https://tecrid.com','https://www.tecrid.com','https://tec-registry.kmfp.chatgpt.site',(env as any).TECRID_AUTH_URL].filter(Boolean).includes(origin))return null;
 const result=await emailAuth().api.getSession({headers});
 if(!result?.user.emailVerified)return null;
 return {userId:`email:${result.user.id}`,email:result.user.email.toLowerCase(),displayName:result.user.name||result.user.email,fullName:result.user.name||null};
}
