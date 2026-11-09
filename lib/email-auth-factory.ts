import {privateFetch} from './private-fetch';
import {sendEmail,sha256Hex,type EmailConfig} from './email-sender';
import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';

// The factory also allows isolated tests to substitute email transport, never a
// production route or environment flag that can bypass mailbox verification.
export function createEmailAuth(db:any, schema:any, config:{secret:string;baseURL:string;email:EmailConfig}, transport:typeof fetch=privateFetch){
 if(!config.secret || config.secret.length<32)throw Error('Email authentication is not configured.');
  return betterAuth({
  logger:{disabled:true},
  appName:'TECRID',baseURL:config.baseURL,basePath:'/api/auth',secret:config.secret,
  database:drizzleAdapter(db,{provider:'sqlite',schema,transaction:false}),
  trustedOrigins:[config.baseURL,...(config.baseURL==='https://tecrid.com'?['https://www.tecrid.com','https://tec-registry.kmfp.chatgpt.site']:[])],
  emailAndPassword:{enabled:false},
  session:{expiresIn:60*60*24*7,updateAge:60*60*24,cookieCache:{enabled:false}},
  advanced:{disableOriginCheck:false,disableCSRFCheck:false,cookiePrefix:'tecrid',useSecureCookies:config.baseURL.startsWith('https:'),ipAddress:{ipAddressHeaders:['cf-connecting-ip']},defaultCookieAttributes:{httpOnly:true,sameSite:'lax',path:'/'}},
  rateLimit:{enabled:true,storage:'database',window:60,max:60},
  plugins:[magicLink({expiresIn:600,storeToken:'hashed',rateLimit:{window:60,max:3},
   async sendMagicLink({email,url}){
    // Only a verification link for this site is ever mailed, with fixed content.
    const link=new URL(url);
    if(link.origin!==new URL(config.baseURL).origin||link.pathname!=='/api/auth/magic-link/verify'||!link.searchParams.get('token'))throw Error('Invalid sign-in link.');
    await sendEmail(config.email,{
     to:[email],
     subject:'Your TECRID sign-in link',
     text:`Sign in to TECRID\n\n${link.href}\n\nThis link expires in 10 minutes and works once. If you did not request it, ignore this email.`,
     idempotencyKey:'tecrid-signin-'+await sha256Hex(email.toLowerCase()+'\n'+link.href),
    },transport);
   }
  })],
 });
}
