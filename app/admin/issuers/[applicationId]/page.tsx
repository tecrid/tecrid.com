import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getEmailUser } from "../../../../lib/email-auth";
import { isIcsAdmin } from "../../../../lib/tec";
import { requireIndependentLabReviewer, laboratoryMailbox } from "../../../../lib/lab-signup-policy";
import { getDb } from "../../../../db";
import { organizations,issuerApplications,issuerApplicationDocuments,issuerVerificationChecks,issuerReviewApprovals, user as authUser } from "../../../../db/schema";
import { PhoneReview } from "./phone-review";
export const dynamic="force-dynamic";
export const metadata={title:"Review laboratory application",robots:{index:false,follow:false}};
export default async function ReviewLaboratory({params}:{params:Promise<{applicationId:string}>}){
 const user=await getEmailUser(new Headers(await headers()));if(!user||!isIcsAdmin(user))notFound();
 const {applicationId}=await params;const db=getDb();const [application]=await db.select().from(issuerApplications).where(eq(issuerApplications.id,applicationId)).limit(1);if(!application)notFound();
 try{await requireIndependentLabReviewer(user,application.organizationId,application.contactEmail);}catch{notFound();}
 const [organization]=await db.select().from(organizations).where(eq(organizations.id,application.organizationId)).limit(1);
 const [documents,checks,approvals]=await Promise.all([db.select().from(issuerApplicationDocuments).where(eq(issuerApplicationDocuments.applicationId,applicationId)),db.select().from(issuerVerificationChecks).where(eq(issuerVerificationChecks.applicationId,applicationId)),db.select().from(issuerReviewApprovals).where(and(eq(issuerReviewApprovals.applicationId,applicationId),eq(issuerReviewApprovals.reviewVersion,application.reviewVersion)))]);
 let domainMatched=false;try{laboratoryMailbox(application.contactEmail,application.laboratoryWebsite||"");domainMatched=true;}catch{domainMatched=false;}
 const existingLookup=checks.find(check=>check.checkType==="accreditation")?.evidenceNote;
 let lookup={registerUrl:application.accreditationUrl||"",registerResult:"",registerCheckedAt:""};try{const parsed=JSON.parse(approvals[0]?.registerEvidence||existingLookup||"{}");lookup={...lookup,...parsed};}catch{/* Older evidence notes may be plain text. */}
 const keyComplete=["key_control","conformance"].every(type=>checks.some(check=>check.checkType===type&&check.status==="passed"));
 const approverNames=await Promise.all(approvals.map(async approval=>{const [person]=await db.select({name:authUser.name}).from(authUser).where(eq(authUser.id,approval.reviewerUserId.slice(6))).limit(1);return person?.name||"Independent ICS approver";}));
 const alreadyApproved=approvals.some(approval=>approval.reviewerUserId===user.userId||approval.reviewerEmail===user.email.toLowerCase());
 return <main className="product-page phone-review-page"><Link href="/admin/issuers">← Labs waiting for approval</Link><h1>{application.legalName}</h1><p><a href={`/dashboard/team?lab=${encodeURIComponent(organization.issuerCode)}`}>View named laboratory issuers</a></p><p>{application.status.replaceAll("_"," ")} · {approvals.length} of 2 approvals</p><dl className="phone-review-facts"><div><dt>Legal identity</dt><dd>{application.laboratoryAddress}<br/>{application.authorityRole}</dd></div><div><dt>Work-email domain</dt><dd>{domainMatched?"Domain match recorded at signup":"Domain match needs review"}<br/>{application.laboratoryWebsite}</dd></div><div><dt>ISO/IEC 17025 accreditation</dt><dd>{application.accreditationBody}<br/>{application.accreditationNumber}<br/><a href={application.accreditationUrl||"#"} target="_blank" rel="noreferrer">Open accreditation register</a></dd></div><div><dt>Requested scope</dt><dd>{application.scopeSummary}<br/>{application.methodFamilies}</dd></div><div><dt>Signing-key challenge</dt><dd>{keyComplete?"Key control and conformance passed":"Not complete; approval stays locked"}</dd></div></dl><section><h2>Private evidence PDFs</h2><div className="phone-review-documents">{documents.map(document=><a key={document.id} href={`/api/issuer-application/evidence/${encodeURIComponent(document.id)}`} target="_blank" rel="noreferrer">{document.documentType.replaceAll("_"," ")} · {document.filename}</a>)}</div></section><section><h2>Already approved</h2>{approvals.length?<ul>{approvals.map((approval,index)=><li key={approval.id}>{approverNames[index]} · {new Date(approval.verifiedAt).toLocaleString()} · device verified</li>)}</ul>:<p>No approval has been recorded yet.</p>}</section>{alreadyApproved?<p role="status">Your approval is recorded. A different independent approver must complete the second review.</p>:application.status==="submitted"?<PhoneReview applicationId={application.id} keyComplete={keyComplete} initialLookup={lookup}/>:<p>This application is no longer waiting for a decision.</p>}<p><a href="/account/passkeys">Set up or recover your passkey</a></p></main>;
}
