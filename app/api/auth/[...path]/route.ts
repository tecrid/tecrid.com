import {emailAuth,emailAuthReady} from '../../../../lib/email-auth';
export const dynamic='force-dynamic';
async function handler(request:Request){
 if(!emailAuthReady())return Response.json({error:'Work-email sign-in is temporarily unavailable. Please try again shortly.'},{status:503,headers:{'cache-control':'no-store'}});
 const path=new URL(request.url).pathname;
 if(!['/api/auth/sign-in/magic-link','/api/auth/magic-link/verify','/api/auth/get-session','/api/auth/sign-out'].includes(path))return new Response(null,{status:404});
 return emailAuth().handler(request);
}
export const GET=handler;
export const POST=handler;
