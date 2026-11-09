import {env} from 'cloudflare:workers';
import {getEmailUser} from './email-auth';
import {privateReportHeaders} from './test-report-access';
import {reportPermissionRequest} from './test-report-permissions';
import {privateFetch} from './private-fetch';
const failure=(error:string,status:number)=>Response.json({error},{status,headers:privateReportHeaders});
// Permissions live in TECRID. The mail transport is only used for controller notices.
export async function kasandrinosTestWorkspace(request:Request,db:D1Database|undefined=(env as any).DB,transport:typeof fetch=privateFetch){
 if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return failure('Same-origin request required.',403);
 let user;try{user=await getEmailUser(request.headers);}catch{return failure('Please sign in again.',401);}
 if(!user)return failure('Sign in with your work email.',401);
 let input:any={action:'workspace'};
 const requestId=new URL(request.url).searchParams.get('request');
 if(requestId&&/^[a-f0-9-]{36}$/.test(requestId))input.requestId=requestId;
 if(request.method==='POST'){
  try{const text=await request.text();if(text.length>10000)return failure('Request too large.',413);input=JSON.parse(text);}catch{return failure('Invalid request.',400);}
  if(!['grant','revoke','decline','request','status'].includes(input.action))return failure('Unknown permission action.',400);
 }
 if(!db)return failure('Permissions temporarily unavailable.',503);
 // Identity always comes from the verified session, never from the request body.
 delete input.actor;
 return reportPermissionRequest(db,{userId:user.userId,email:user.email},input,transport);
}
