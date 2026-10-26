import { emailAuthOrigin } from "./email-auth";
import { and, desc, eq } from "drizzle-orm";
import { generateAuthenticationOptions, verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { getDb, getRawDb } from "../db";
import { issuerApplications, issuerApplicationDocuments, issuerVerificationChecks, organizations, passkey, issuerReviewApprovals, issuerDecisionChallenges, session, user as authUser } from "../db/schema";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { isIcsAdmin, TecAuthorizationError, TecInputError } from "./tec";
import { requireIndependentLabReviewer } from "./lab-signup-policy";

export type ReviewSession = { id: string; userId: string };
export type ReviewIntent = { decision: "approve" | "needs_information" | "reject"; reviewNote: string; confirmations: { identity: boolean; accreditation: boolean; scope: boolean }; registerUrl: string; registerResult: string; registerCheckedAt: string };
export function passkeyRelyingParty() {
 const origin = emailAuthOrigin();
 const url = new URL(origin);
 if (url.origin !== origin || (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost"))) throw new TecAuthorizationError("Passkey origin is not configured safely.");
 return { origin, rpID: url.hostname };
}
export function parseReviewIntent(value: Record<string,unknown>): ReviewIntent {
 const decision = value.decision;
 if (!["approve","needs_information","reject"].includes(String(decision))) throw new TecInputError("Choose approve, request changes, or reject.");
 const clean=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):"";
 const reviewNote=clean(value.reviewNote,1200);
 if (!reviewNote) throw new TecInputError("A decision reason is required.");
 const checks=value.confirmations as Record<string,unknown>|undefined;
 const confirmations={identity:checks?.identity===true,accreditation:checks?.accreditation===true,scope:checks?.scope===true};
 const registerUrl=clean(value.registerUrl,300),registerResult=clean(value.registerResult,600),registerCheckedAt=clean(value.registerCheckedAt,10);
 if(decision==="approve") {
  if(!Object.values(confirmations).every(Boolean))throw new TecInputError("Review and confirm identity, accreditation and scope.");
  let valid=false;try{const url=new URL(registerUrl);valid=url.protocol==="https:"&&!url.username&&!url.password;}catch{valid=false;}
  const date=Date.parse(registerCheckedAt);
  if(!valid||!registerResult||!/^\d{4}-\d{2}-\d{2}$/.test(registerCheckedAt)||!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==registerCheckedAt||date>Date.now())throw new TecInputError("Record the public register lookup URL, result and date.");
 }
 return {decision:decision as ReviewIntent["decision"],reviewNote,confirmations,registerUrl,registerResult,registerCheckedAt};
}
async function intentHash(intent:ReviewIntent){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(intent)))),b=>b.toString(16).padStart(2,"0")).join("");}
async function context(principal:ChatGPTUser,reviewSession:ReviewSession|undefined,applicationId:string,intent:ReviewIntent){
 if(!isIcsAdmin(principal)||!principal.userId.startsWith("email:")||!reviewSession||reviewSession.userId!==principal.userId.slice(6))throw new TecAuthorizationError("ICS approver session required.");
 const db=getDb();
 const [currentSession]=await db.select({session,user:authUser}).from(session).innerJoin(authUser,eq(authUser.id,session.userId)).where(and(eq(session.id,reviewSession.id),eq(session.userId,reviewSession.userId))).limit(1);
 if(!currentSession||currentSession.session.expiresAt.getTime()<=Date.now()||!currentSession.user.emailVerified||currentSession.user.email.toLowerCase()!==principal.email.toLowerCase())throw new TecAuthorizationError("Sign in again before reviewing.");
 const [record]=await db.select({application:issuerApplications,organization:organizations}).from(issuerApplications).innerJoin(organizations,eq(organizations.id,issuerApplications.organizationId)).where(eq(issuerApplications.id,applicationId)).limit(1);
 if(!record)throw new TecInputError("Application not found.");
 await requireIndependentLabReviewer(principal,record.organization.id,record.application.contactEmail);
 if(record.application.status!=="submitted"||record.organization.issuerStatus!=="application_submitted")throw new TecInputError("Only the current submitted application can be reviewed.");
 const [latest]=await db.select().from(issuerApplications).where(eq(issuerApplications.organizationId,record.organization.id)).orderBy(desc(issuerApplications.submittedAt)).limit(1);
 if(latest?.id!==applicationId)throw new TecInputError("This application was replaced. Review the current application.");
 const approvals=await db.select().from(issuerReviewApprovals).where(and(eq(issuerReviewApprovals.applicationId,applicationId),eq(issuerReviewApprovals.reviewVersion,record.application.reviewVersion)));
 for(const approval of approvals){
  const voter={...principal,userId:approval.reviewerUserId,email:approval.reviewerEmail};
  if(!isIcsAdmin(voter))throw new TecAuthorizationError("A previous reviewer is no longer an ICS approver. Request a new application review.");
  await requireIndependentLabReviewer(voter,record.organization.id,record.application.contactEmail);
 }
 if(intent.decision==="approve"){
  if(record.organization.slug.startsWith("setup--")||record.organization.issuerCode.startsWith("SETUP_"))throw new TecInputError("Save the real organization name before approval.");
  if(approvals.some(a=>a.reviewerUserId===principal.userId||a.reviewerEmail===principal.email.toLowerCase()))throw new TecAuthorizationError("The same person cannot approve twice. A different independent approver is required.");
  const submission=await getRawDb().prepare("SELECT payload FROM audit_events WHERE entity_id=? AND event_type='issuer.application_submitted' LIMIT 1").bind(applicationId).first() as {payload:string}|null;
  if(!submission||JSON.parse(submission.payload||"{}").signupVerificationVersion!==1)throw new TecInputError("Complete the current laboratory signup verification before approval.");
  const checks=await db.select().from(issuerVerificationChecks).where(eq(issuerVerificationChecks.applicationId,applicationId));
  if(!["key_control","conformance"].every(type=>checks.some(check=>check.checkType===type&&check.status==="passed")))throw new TecInputError("The laboratory signing-key challenge must pass first.");
  const docs=await db.select().from(issuerApplicationDocuments).where(eq(issuerApplicationDocuments.applicationId,applicationId));
  if(!docs.some(doc=>doc.documentType==="accreditation_scope"))throw new TecInputError("A scope PDF is required.");
 }
 return {record,approvals};
}
export async function prepareIssuerDecision(principal:ChatGPTUser,reviewSession:ReviewSession,applicationId:string,value:Record<string,unknown>){
 const intent=parseReviewIntent(value);const {record}=await context(principal,reviewSession,applicationId,intent);
 const keys=await getDb().select().from(passkey).where(eq(passkey.userId,reviewSession.userId));
 if(!keys.length)throw new TecAuthorizationError("Save a passkey after signing in with your email link, then approve with device verification.");
 const {rpID}=passkeyRelyingParty();
 const options=await generateAuthenticationOptions({rpID,userVerification:"required",allowCredentials:keys.map(key=>({id:key.credentialID})),timeout:120000});
 const id=crypto.randomUUID();const expiresAt=new Date(Date.now()+120000).toISOString();
 await getDb().insert(issuerDecisionChallenges).values({id,applicationId,userId:principal.userId,sessionId:reviewSession.id,challenge:options.challenge,intentHash:await intentHash(intent),reviewVersion:record.application.reviewVersion,expiresAt});
 return {id,options,expiresAt};
}
export async function commitIssuerDecision(principal:ChatGPTUser,applicationId:string,value:Record<string,unknown>,reviewSession?:ReviewSession){
 const intent=parseReviewIntent(value);const {record,approvals}=await context(principal,reviewSession,applicationId,intent);
 const stepUp=value.stepUp as {id?:unknown;response?:AuthenticationResponseJSON}|undefined;
 if(typeof stepUp?.id!=="string"||!stepUp.response||typeof stepUp.response.id!=="string")throw new TecAuthorizationError("Fresh passkey confirmation is required for every decision.");
 const [challenge]=await getDb().select().from(issuerDecisionChallenges).where(eq(issuerDecisionChallenges.id,stepUp.id)).limit(1);
 if(!challenge||challenge.userId!==principal.userId||challenge.sessionId!==reviewSession!.id||challenge.applicationId!==applicationId||challenge.intentHash!==await intentHash(intent)||challenge.reviewVersion!==record.application.reviewVersion||challenge.expiresAt<=new Date().toISOString())throw new TecAuthorizationError("This decision confirmation expired or changed. Confirm again with your passkey.");
 const [key]=await getDb().select().from(passkey).where(and(eq(passkey.userId,reviewSession!.userId),eq(passkey.credentialID,stepUp.response.id))).limit(1);
 if(!key)throw new TecAuthorizationError("This passkey does not belong to the approver.");
 const {origin,rpID}=passkeyRelyingParty();
 let verification;
 try{verification=await verifyAuthenticationResponse({response:stepUp.response,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpID,credential:{id:key.credentialID,publicKey:Uint8Array.from(atob(key.publicKey),c=>c.charCodeAt(0)),counter:key.counter},requireUserVerification:true});}catch{throw new TecAuthorizationError("Fresh device verification failed.");}
 if(!verification.verified||!verification.authenticationInfo.userVerified)throw new TecAuthorizationError("Fresh device verification failed.");
 const at=new Date().toISOString(),receiptId=crypto.randomUUID(),isApproval=intent.decision==="approve";
 const status=isApproval?"approved":intent.decision==="reject"?"rejected":"needs_information";
 const issuerStatus=status==="approved"?"verified":status;
 const db=getRawDb();const safe=(sql:string,...args:unknown[])=>db.prepare(sql).bind(...args);
 const receiptExists="EXISTS(SELECT 1 FROM issuer_decision_receipts WHERE id=?)";
 // A single transaction claims the exact ceremony and commits its decision.
 // Session, credential counter, evidence version, applicant association and votes
 // are rechecked while SQLite holds the write lock; pre-verification is not authority.
 const statements=[safe(`INSERT INTO issuer_decision_receipts(id,challenge_id,application_id,user_id,session_id,credential_id,verified_at,decision)
 SELECT ?,id,application_id,user_id,session_id,?,?,? FROM issuer_decision_challenges c WHERE c.id=? AND c.user_id=? AND c.session_id=? AND c.expires_at>? AND c.intent_hash=? AND c.review_version=?
 AND NOT EXISTS(SELECT 1 FROM issuer_decision_receipts r WHERE r.challenge_id=c.id)
 AND EXISTS(SELECT 1 FROM auth_session s JOIN auth_user u ON u.id=s.user_id WHERE s.id=? AND s.user_id=? AND s.expires_at>? AND u.email_verified=1 AND lower(u.email)=?)
 AND EXISTS(SELECT 1 FROM auth_passkey p WHERE p.id=? AND p.user_id=? AND p.counter=? AND p.public_key=?)
 AND EXISTS(SELECT 1 FROM issuer_applications a JOIN organizations o ON o.id=a.organization_id WHERE a.id=c.application_id AND a.status='submitted' AND a.review_version=c.review_version AND o.issuer_status='application_submitted')
 AND NOT EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=? AND (m.user_id=? OR lower(m.email)=?))
 AND NOT EXISTS(SELECT 1 FROM organization_members m JOIN issuer_review_approvals a ON a.application_id=c.application_id AND a.review_version=c.review_version WHERE m.organization_id=? AND (m.user_id=a.reviewer_user_id OR lower(m.email)=a.reviewer_email))`,receiptId,key.credentialID,at,intent.decision,challenge.id,principal.userId,reviewSession!.id,at,challenge.intentHash,record.application.reviewVersion,reviewSession!.id,reviewSession!.userId,Date.now(),principal.email.toLowerCase(),key.id,reviewSession!.userId,key.counter,key.publicKey,record.organization.id,principal.userId,principal.email.toLowerCase(),record.organization.id),
 safe(`UPDATE auth_passkey SET counter=? WHERE id=? AND ${receiptExists}`,verification.authenticationInfo.newCounter,key.id,receiptId)];
 if(isApproval)statements.push(safe(`INSERT INTO issuer_review_approvals(id,application_id,review_version,reviewer_user_id,reviewer_email,credential_id,verified_at,review_note,register_evidence) SELECT ?,?,?,?,?,?,?,?,? WHERE ${receiptExists}`,crypto.randomUUID(),applicationId,record.application.reviewVersion,principal.userId,principal.email.toLowerCase(),key.credentialID,at,intent.reviewNote,JSON.stringify({registerUrl:intent.registerUrl,registerResult:intent.registerResult,registerCheckedAt:intent.registerCheckedAt}),receiptId));
 const approvalCountSql="(SELECT COUNT(*) FROM issuer_review_approvals WHERE application_id=? AND review_version=?)";
 const finalized=isApproval?`${approvalCountSql}>=2`:"1=1";
 const finalArgs=isApproval?[applicationId,record.application.reviewVersion]:[];
 const event=`issuer.application_${status}`;
 statements.push(safe(`INSERT INTO audit_events(id,organization_id,actor_user_id,event_type,entity_type,entity_id,payload,created_at) SELECT ?,?,?,CASE WHEN ${finalized} THEN ? ELSE 'issuer.application_approval_recorded' END,'issuer_application',?,json_set(?, '$.approvalCount', ${approvalCountSql}),? WHERE ${receiptExists}`,`evt_${receiptId}`,record.organization.id,principal.userId,...finalArgs,event,applicationId,JSON.stringify({decision:intent.decision,reviewNote:intent.reviewNote,confirmations:intent.confirmations,registerUrl:intent.registerUrl,registerResult:intent.registerResult,registerCheckedAt:intent.registerCheckedAt,credentialId:key.credentialID,passkeyVerifiedAt:at,passkeyUserVerified:true,reviewVersion:record.application.reviewVersion,approvalCount:isApproval?approvals.length+1:approvals.length}),applicationId,record.application.reviewVersion,at,receiptId));
 statements.push(safe(`INSERT OR IGNORE INTO issuer_review_reads(application_id,recipient_email,read_at) SELECT ?,?,? WHERE ${receiptExists}`,applicationId,principal.email.toLowerCase(),at,receiptId));
 {
  statements.push(safe(`UPDATE issuer_applications SET status=?,review_note=?,reviewed_at=? WHERE id=? AND ${receiptExists} AND ${finalized}`,status,intent.reviewNote,at,applicationId,receiptId,...finalArgs));
  statements.push(safe(`UPDATE organizations SET issuer_status=?,issuer_public_key_jwk=?,issuer_key_id=?,issuer_key_algorithm=?,issuer_key_verified_at=?,updated_at=? WHERE id=? AND ${receiptExists} AND ${finalized}`,issuerStatus,status==="approved"?record.application.publicKeyJwk:record.organization.issuerPublicKeyJwk,status==="approved"?record.application.keyId:record.organization.issuerKeyId,status==="approved"?"Ed25519":record.organization.issuerKeyAlgorithm,status==="approved"?at:record.organization.issuerKeyVerifiedAt,at,record.organization.id,receiptId,...finalArgs));
  statements.push(safe(`INSERT INTO organization_notifications(id,organization_id,event_type,title,body,action_path,entity_type,entity_id,created_at) SELECT ?,?,?,?,?,?,'issuer_application',?,? WHERE ${receiptExists} AND ${finalized}`,`notice_${applicationId}_${status}`,record.organization.id,event,status==="approved"?"Lab application approved":status==="rejected"?"Lab application rejected":"More information needed",status==="approved"?"Two independent ICS approvers confirmed with passkeys. Issuing still requires the registered laboratory signing key.":"Open your laboratory application to read the decision and next steps.","/dashboard/laboratory",applicationId,at,receiptId,...finalArgs));
  statements.push(safe(`INSERT INTO issuer_review_mail(id,application_id,recipient_email,kind,created_at) SELECT ?,?,?,?,? WHERE ${receiptExists} AND ${finalized}`,`mail_${applicationId}_${status}`,applicationId,record.application.contactEmail.toLowerCase(),status,at,receiptId,...finalArgs));
 }
 const results=await db.batch(statements);
 if(results[0].meta.changes!==1)throw new TecAuthorizationError("This confirmation was used, revoked or changed. Confirm again with your passkey.");
 const [saved]=await getDb().select({status:issuerApplications.status}).from(issuerApplications).where(eq(issuerApplications.id,applicationId)).limit(1);
 const count=await getRawDb().prepare("SELECT COUNT(*) AS total FROM issuer_review_approvals WHERE application_id=? AND review_version=?").bind(applicationId,record.application.reviewVersion).first();
 return {id:applicationId,status:saved.status,issuerStatus:saved.status==="approved"?"verified":saved.status==="submitted"?"application_submitted":saved.status,approvalCount:Number(count?.total||0),reviewedAt:at};
}
