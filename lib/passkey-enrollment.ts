import { getRawDb } from "../db";
import { emailAuth, emailAuthOrigin } from "./email-auth";
const cookieName="tecrid.passkey_enrollment";
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");
// A session cookie alone cannot enroll a new approver passkey. A separate,
// short-lived, one-use proof is issued only by a successful email-link callback.
export async function addEmailEnrollmentProof(response:Response){
 if(response.status!==302)return response;
 const cookies=response.headers.getSetCookie();
 const sessionCookie=cookies.find(cookie=>cookie.startsWith("tecrid.session_token=")||cookie.startsWith("__Secure-tecrid.session_token="));
 if(!sessionCookie)return response;
 const identity=await emailAuth().api.getSession({headers:new Headers({cookie:sessionCookie.split(";")[0]})});
 if(!identity?.user.emailVerified)return response;
 const token=crypto.randomUUID()+crypto.randomUUID();
 await getRawDb().prepare("INSERT INTO passkey_enrollment_grants(id,user_id,session_id,token_hash,expires_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),identity.user.id,identity.session.id,await hash(token),new Date(Date.now()+300000).toISOString()).run();
 const headers=new Headers(response.headers);
 headers.append("set-cookie",`${cookieName}=${token}; Path=/api/auth/passkey; Max-Age=300; HttpOnly; SameSite=Strict${emailAuthOrigin().startsWith("https:")?"; Secure":""}`);
 headers.set("Cache-Control","private, no-store");
 return new Response(response.body,{status:response.status,headers});
}
export async function authorizePasskeyEnrollment(request:Request,consume=false){
 const identity=await emailAuth().api.getSession({headers:request.headers});
 if(!identity?.user.emailVerified)return false;
 const token=(request.headers.get("cookie")||"").split(";").map(value=>value.trim()).find(value=>value.startsWith(`${cookieName}=`))?.slice(cookieName.length+1);
 if(!token||token.length>100)return false;
 const db=getRawDb(),at=new Date().toISOString(),tokenHash=await hash(token);
 if(consume){const result=await db.prepare("UPDATE passkey_enrollment_grants SET used_at=? WHERE token_hash=? AND user_id=? AND session_id=? AND expires_at>? AND used_at IS NULL").bind(at,tokenHash,identity.user.id,identity.session.id,at).run();return result.meta.changes===1;}
 return !!await db.prepare("SELECT id FROM passkey_enrollment_grants WHERE token_hash=? AND user_id=? AND session_id=? AND expires_at>? AND used_at IS NULL").bind(tokenHash,identity.user.id,identity.session.id,at).first();
}
