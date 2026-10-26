import { generateKeyPairSync, createHash, sign, randomUUID } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import { getRawDb } from "../../db";
import { prepareIssuerDecision, passkeyRelyingParty, type ReviewSession } from "../../lib/passkey-review";
import { reviewIssuerApplication } from "../../lib/tec";
import type { ChatGPTUser } from "../../app/chatgpt-auth";
const keys=new Map<string,ReturnType<typeof generateKeyPairSync>>();
let counter=0;
export async function syntheticReviewerSession(principal:ChatGPTUser):Promise<ReviewSession>{
 const db=getRawDb();const userId=principal.userId.slice(6),id=`synthetic-session-${userId}`;
 await db.prepare("INSERT OR IGNORE INTO auth_user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,0,0)").bind(userId,"Synthetic reviewer",principal.email.toLowerCase()).run();
 await db.prepare("INSERT OR IGNORE INTO auth_session(id,user_id,token,expires_at,created_at,updated_at) VALUES(?,?,?,?,0,0)").bind(id,userId,`synthetic-only-${randomUUID()}`,Date.now()+3600000).run();
 const keyId=`synthetic-passkey-${userId}`;
 if(!await db.prepare("SELECT id FROM auth_passkey WHERE id=?").bind(keyId).first()){
  const pair=generateKeyPairSync("ec",{namedCurve:"prime256v1"});keys.set(keyId,pair);
  const jwk=pair.publicKey.export({format:"jwk"});const cose=new Map([[1,2],[3,-7],[-1,1],[-2,new Uint8Array(Buffer.from(jwk.x!,"base64url"))],[-3,new Uint8Array(Buffer.from(jwk.y!,"base64url"))]] as [number,number|Uint8Array][]);
  const publicKey=Buffer.from(isoCBOR.encode(cose)).toString("base64");
  await db.prepare("INSERT INTO auth_passkey(id,user_id,public_key,credential_id,counter,device_type,backed_up,transports) VALUES(?,?,?,?,0,'singleDevice',0,'internal')").bind(keyId,userId,publicKey,Buffer.from(keyId).toString("base64url")).run();
 }
 return {id,userId};
}
export async function signedReviewerDecision(principal:ChatGPTUser,applicationId:string,value:Record<string,unknown>,overrides:{verified?:boolean;origin?:string;session?:ReviewSession}={}){
 const session=overrides.session||await syntheticReviewerSession(principal);
 const input={confirmations:{identity:true,accreditation:true,scope:true},registerUrl:"https://register.synthetic.test/FAKE",registerResult:"SYNTHETIC current identity, ISO/IEC 17025 certificate and scope match",registerCheckedAt:"2026-01-01",...value};
 const challenge=await prepareIssuerDecision(principal,session,applicationId,input);
 const {origin,rpID}=passkeyRelyingParty();const keyId=`synthetic-passkey-${session.userId}`,pair=keys.get(keyId)!;
 const clientData=Buffer.from(JSON.stringify({type:"webauthn.get",challenge:challenge.options.challenge,origin:overrides.origin||origin,crossOrigin:false}));
 const count=Buffer.alloc(4);count.writeUInt32BE(++counter);const authenticatorData=Buffer.concat([createHash("sha256").update(rpID).digest(),Buffer.from([overrides.verified===false?1:5]),count]);
 const signature=sign("sha256",Buffer.concat([authenticatorData,createHash("sha256").update(clientData).digest()]),pair.privateKey);
 const credentialId=Buffer.from(keyId).toString("base64url");
 return {session,input:{...input,stepUp:{id:challenge.id,response:{id:credentialId,rawId:credentialId,type:"public-key" as const,authenticatorAttachment:"platform" as const,response:{clientDataJSON:clientData.toString("base64url"),authenticatorData:authenticatorData.toString("base64url"),signature:signature.toString("base64url"),userHandle:Buffer.from(session.userId).toString("base64url")},clientExtensionResults:{}}}}};
}
export async function syntheticReview(principal:ChatGPTUser,applicationId:string,value:Record<string,unknown>){const prepared=await signedReviewerDecision(principal,applicationId,value);return reviewIssuerApplication(principal,applicationId,prepared.input,prepared.session);}
export async function approveWithTwo(first:ChatGPTUser,second:ChatGPTUser,applicationId:string,reviewNote="Synthetic independent review"){
 await syntheticReview(first,applicationId,{decision:"approve",reviewNote});return syntheticReview(second,applicationId,{decision:"approve",reviewNote});
}
