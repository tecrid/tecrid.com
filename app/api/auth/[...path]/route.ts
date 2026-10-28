import { laboratoryMailbox } from "../../../../lib/lab-signup-policy";
import {emailAuth,emailAuthReady} from '../../../../lib/email-auth';
export const dynamic='force-dynamic';
async function handler(request:Request){
 if(!emailAuthReady())return Response.json({error:'Work-email sign-in is temporarily unavailable. Please try again shortly.'},{status:503,headers:{'cache-control':'no-store'}});
 const path=new URL(request.url).pathname;
 if(!['/api/auth/sign-in/magic-link','/api/auth/magic-link/verify','/api/auth/get-session','/api/auth/sign-out'].includes(path))return new Response(null,{status:404});
 if(path==='/api/auth/sign-in/magic-link' && request.method==='POST'){
  const body=await request.clone().json().catch(()=>null);
  if(body?.role==='laboratory'){
   try{laboratoryMailbox(typeof body.email==='string'?body.email:'',typeof body.laboratoryWebsite==='string'?body.laboratoryWebsite:'');}
   catch(error){return Response.json({error:error instanceof Error?error.message:'Use your laboratory work email.'},{status:400,headers:{'cache-control':'no-store'}});}
  }
 }
 return emailAuth().handler(request);
}
export const GET=handler;
export const POST=handler;
