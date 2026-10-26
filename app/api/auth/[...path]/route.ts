import { addEmailEnrollmentProof, authorizePasskeyEnrollment } from "../../../../lib/passkey-enrollment";
import { laboratoryMailbox } from "../../../../lib/lab-signup-policy";
import {emailAuth,emailAuthReady} from '../../../../lib/email-auth';
export const dynamic='force-dynamic';
async function handler(request:Request){
 if(!emailAuthReady())return Response.json({error:'Work-email sign-in is temporarily unavailable. Please try again shortly.'},{status:503,headers:{'cache-control':'no-store'}});
 const path=new URL(request.url).pathname;
 if(!['/api/auth/sign-in/magic-link','/api/auth/magic-link/verify','/api/auth/get-session','/api/auth/sign-out','/api/auth/passkey/generate-register-options','/api/auth/passkey/verify-registration','/api/auth/passkey/generate-authenticate-options','/api/auth/passkey/verify-authentication','/api/auth/passkey/list-user-passkeys','/api/auth/passkey/delete-passkey'].includes(path))return new Response(null,{status:404});
 if(path==='/api/auth/sign-in/magic-link' && request.method==='POST'){
  const body=await request.clone().json().catch(()=>null);
  if(body?.role==='laboratory'){
   try{laboratoryMailbox(typeof body.email==='string'?body.email:'',typeof body.laboratoryWebsite==='string'?body.laboratoryWebsite:'');}
   catch(error){return Response.json({error:error instanceof Error?error.message:'Use your laboratory work email.'},{status:400,headers:{'cache-control':'no-store'}});}
  }
 }
 if(path.startsWith('/api/auth/passkey/') && !['/api/auth/passkey/generate-authenticate-options','/api/auth/passkey/verify-authentication'].includes(path)){
  if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Same-origin request required.'},{status:403});
  if(['/api/auth/passkey/generate-register-options','/api/auth/passkey/verify-registration'].includes(path) && !await authorizePasskeyEnrollment(request,path.endsWith('/verify-registration')))return Response.json({error:'Open a fresh email sign-in link in this browser before saving a passkey.'},{status:403,headers:{'cache-control':'private, no-store'}});
 }
 const response=await emailAuth().handler(request);
 if(path==='/api/auth/passkey/generate-authenticate-options'&&response.ok){const options=await response.json();return Response.json({...options,userVerification:'required'},{status:response.status,headers:response.headers});}
 return path==='/api/auth/magic-link/verify'?addEmailEnrollmentProof(response):response;
}
export const GET=handler;
export const POST=handler;
