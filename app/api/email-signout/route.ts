import {emailAuth,emailAuthReady} from '../../../lib/email-auth';
import {rejectCrossOriginWrite} from '../../../lib/request-security';
export async function POST(request:Request){
 const denial=rejectCrossOriginWrite(request);if(denial)return denial;
 const url=new URL(request.url);const response=Response.redirect(new URL(request.headers.get('oai-authenticated-user-id')?'/signout-with-chatgpt?return_to=%2F':'/sign-in',url.origin),303);
 const headers=new Headers(response.headers);
 if(emailAuthReady()){
  const signedOut=await emailAuth().handler(new Request(new URL('/api/auth/sign-out',url.origin),{method:'POST',headers:new Headers({'content-type':'application/json',origin:url.origin,cookie:request.headers.get('cookie')||''}),body:'{}'}));
  if(!signedOut.ok)return Response.json({error:'Could not sign out. Please try again.'},{status:500});
  for(const cookie of signedOut.headers.getSetCookie())headers.append('set-cookie',cookie);
 }
 headers.set('cache-control','no-store');return new Response(null,{status:303,headers});
}
