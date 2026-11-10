import {signedServiceInit} from "./service-assertion.js";
import {privateFetch} from './private-fetch';
import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';

// The factory also allows isolated tests to substitute email transport, never a
// production route or environment flag that can bypass mailbox verification.
export function createEmailAuth(db:any, schema:any, config:{secret:string;baseURL:string;resendAPIKey?:string;emailFrom?:string;relaySecret?:string;relayURL?:string;issuanceSecret?:string}, transport:typeof fetch=privateFetch){
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
  plugins:[magicLink({expiresIn:1200,storeToken:'hashed',rateLimit:{window:60,max:3},
   async sendMagicLink({email,url}){
    const confirmation=new URL(url);confirmation.pathname='/sign-in/confirm';
    if(config.resendAPIKey){
     if(!config.emailFrom)throw Error('Email delivery is not configured.');
     const response=await transport('https://api.resend.com/emails',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{authorization:`Bearer ${config.resendAPIKey}`,'content-type':'application/json'},
      body:JSON.stringify({from:config.emailFrom,to:[email],subject:'Sign in to TECRID',text:`Sign in to TECRID\n\nOpen this link, then click the sign-in button to open your workspace:\n${confirmation.href}\n\nThis link expires in 20 minutes and can only be used once. If you did not request it, you can ignore this email.`})
     });
     if(!response.ok)throw Error('Email delivery failed. Please try again shortly.');
     return;
    }
    if(config.issuanceSecret===config.secret)throw Error('Mail issuance requires a distinct credential.');
    if(!config.issuanceSecret||!config.relaySecret||!config.relayURL)throw Error('Email delivery is not configured.');
    const assertion=await signedServiceInit(config.relayURL,{email,url:confirmation.href},{TECRID_MAIL_ISSUANCE_SECRET:config.issuanceSecret,TECRID_EMAIL_RELAY_SECRET:config.relaySecret},'mail-issuance');
    const response=await transport(config.relayURL,{
     ...assertion,redirect:'error',signal:AbortSignal.timeout(15000),headers:{...assertion.headers,authorization:`Bearer ${config.relaySecret}`,'x-tecrid-mail-issuance':assertion.headers.authorization}
    });
    // Never log provider responses or the link: both can contain credentials.
    if(!response.ok)throw Error('Email delivery failed. Please try again shortly.');
   }
  })],
 });
}
