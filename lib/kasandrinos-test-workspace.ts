import {env} from 'cloudflare:workers';
import {getEmailUser} from './email-auth';
import {privateReportHeaders} from './test-report-access';
const failure=(error:string,status:number)=>Response.json({error},{status,headers:privateReportHeaders});
export async function kasandrinosTestWorkspace(request:Request,transport:typeof fetch=fetch){
 if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return failure('Same-origin request required.',403);
 let user;try{user=await getEmailUser(request.headers);}catch{return failure('Please sign in again.',401);}
 if(!user)return failure('Sign in with your work email.',401);
 let input:any={action:'workspace'};
 if(request.method==='POST'){
  try{const text=await request.text();if(text.length>10000)return failure('Request too large.',413);input=JSON.parse(text);}catch{return failure('Invalid request.',400);}
  if(!['grant','revoke','decline','request','status'].includes(input.action))return failure('Unknown permission action.',400);
 }
 const secret=(env as any).TECRID_EMAIL_RELAY_SECRET;if(!secret)return failure('Permissions temporarily unavailable.',503);
 try{
  const response=await transport('https://vle.exchange/api/tecrid-report-permissions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify({...input,actor:{userId:user.userId,email:user.email,emailVerified:true}})});
  const data=await response.json();return Response.json(data,{status:[200,400,401,403,404,409].includes(response.status)?response.status:503,headers:privateReportHeaders});
 }catch{return failure('Permissions temporarily unavailable. Please retry.',503);}
}
