import { and, desc, eq } from "drizzle-orm";
import { getDb, getRawDb, getApplicationSettings } from "../db";
import { issuerApplications, issuerReviewMail, issuerReviewReads, issuerReviewApprovals, organizations } from "../db/schema";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import type { InboxItem } from "./notifications";
import { isIcsAdmin, TecAuthorizationError } from "./tec";
import { requireIndependentLabReviewer } from "./lab-signup-policy";
import { privateFetch } from "./private-fetch";
export function configuredApproverMailboxes(){return [...new Set(String(getApplicationSettings().ICS_ADMIN_EMAILS||"").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean))];}
export function waitingReviewMailStatements(applicationId:string,at:string){return configuredApproverMailboxes().map(email=>getDb().insert(issuerReviewMail).values({id:`mail_${applicationId}_waiting_${crypto.randomUUID()}`,applicationId,recipientEmail:email,kind:"waiting",createdAt:at}));}
export async function approverInbox(user:ChatGPTUser,readId?:string):Promise<InboxItem[]>{
 if(!isIcsAdmin(user)){if(readId)throw new TecAuthorizationError("ICS approver access required.");return [];}
 const db=getDb();const rows=await db.select({application:issuerApplications,organization:organizations}).from(issuerApplications).innerJoin(organizations,eq(organizations.id,issuerApplications.organizationId)).where(eq(issuerApplications.status,"submitted")).orderBy(desc(issuerApplications.submittedAt)).limit(100);
 const reads=await db.select().from(issuerReviewReads).where(eq(issuerReviewReads.recipientEmail,user.email.toLowerCase()));
 const items:InboxItem[]=[];
 for(const row of rows){
  try{await requireIndependentLabReviewer(user,row.organization.id,row.application.contactEmail);}catch{continue;}
  const votes=await db.select().from(issuerReviewApprovals).where(and(eq(issuerReviewApprovals.applicationId,row.application.id),eq(issuerReviewApprovals.reviewVersion,row.application.reviewVersion)));
  if(votes.some(vote=>vote.reviewerUserId===user.userId||vote.reviewerEmail===user.email.toLowerCase()))continue;
  items.push({id:`tecrid:issuer-review:${row.application.id}`,source:"tecrid",kind:"issuer.awaiting_review",title:"A laboratory is waiting for review",body:"Review the identity, accreditation and scope. Each decision requires fresh device confirmation.",href:`https://tecrid.com/admin/issuers/${encodeURIComponent(row.application.id)}`,createdAt:row.application.submittedAt,read:reads.some(read=>read.applicationId===row.application.id)});
 }
 if(readId){const item=items.find(item=>item.id===readId);if(!item)throw new TecAuthorizationError("Notification not found.");await db.insert(issuerReviewReads).values({applicationId:readId.slice("tecrid:issuer-review:".length),recipientEmail:user.email.toLowerCase(),readAt:new Date().toISOString()}).onConflictDoNothing();item.read=true;}
 return items;
}
// Only the explicit opt-in worker path uses this adapter. It is off by default.
// The transport is injected in tests. No provider is provisioned by this code.
export async function deliverIssuerReviewMail(transport:typeof fetch=privateFetch){
 const configuration=getApplicationSettings();
 if(configuration.TECRID_REVIEW_MAIL_ENABLED!=="true"||!configuration.TECRID_REVIEW_MAIL_URL||!configuration.TECRID_REVIEW_MAIL_SECRET)return {sent:0,enabled:false};
 const target=new URL(String(configuration.TECRID_REVIEW_MAIL_URL));if(target.protocol!=="https:"||target.username||target.password)throw Error("Review mail adapter must use HTTPS.");
 const db=getRawDb();
 await db.prepare("UPDATE issuer_review_mail SET status='retry' WHERE status='sending' AND last_attempt_at<? AND attempts<5").bind(new Date(Date.now()-600000).toISOString()).run();
 const rows=(await db.prepare("SELECT * FROM issuer_review_mail WHERE status IN ('queued','retry') AND attempts<5 ORDER BY created_at LIMIT 20").all()).results;
 let sent=0;
 for(const row of rows){
  if(row.kind==="waiting") {
   const eligible=await db.prepare("SELECT a.id FROM issuer_applications a JOIN organizations o ON o.id=a.organization_id WHERE a.id=? AND a.status='submitted' AND lower(a.contact_email)<>? AND lower(o.owner_email)<>? AND NOT EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND lower(m.email)=?)").bind(row.application_id,row.recipient_email,row.recipient_email,row.recipient_email).first();
   if(!configuredApproverMailboxes().includes(String(row.recipient_email))||!eligible){await db.prepare("UPDATE issuer_review_mail SET status='cancelled' WHERE id=? AND status IN ('queued','retry')").bind(row.id).run();continue;}
  }
  const claimId=crypto.randomUUID(),at=new Date().toISOString();
  const claim=await db.prepare("UPDATE issuer_review_mail SET status='sending',claim_id=?,last_attempt_at=?,attempts=attempts+1 WHERE id=? AND status IN ('queued','retry')").bind(claimId,at,row.id).run();if(claim.meta.changes!==1)continue;
  const href=row.kind==="waiting"?`https://tecrid.com/admin/issuers/${encodeURIComponent(String(row.application_id))}`:"https://tecrid.com/dashboard/laboratory";
  try{
   const response=await transport(target.href,{method:"POST",redirect:"error",signal:AbortSignal.timeout(8000),headers:{"content-type":"application/json",authorization:`Bearer ${configuration.TECRID_REVIEW_MAIL_SECRET}`,"Idempotency-Key":String(row.id)},body:JSON.stringify({to:row.recipient_email,subject:row.kind==="waiting"?"A laboratory is waiting for ICS review":"Your laboratory application has an update",text:`Open TECRID to review the update: ${href}`,href})});
   if(!response.ok)throw Error("Review mail delivery unavailable.");
   await db.prepare("UPDATE issuer_review_mail SET status='sent' WHERE id=? AND claim_id=?").bind(row.id,claimId).run();sent++;
  }catch{await db.prepare("UPDATE issuer_review_mail SET status='retry' WHERE id=? AND claim_id=?").bind(row.id,claimId).run();}
 }
 return {sent,enabled:true};
}
