import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getEmailUser } from "../../../lib/email-auth";
import { isIcsAdmin } from "../../../lib/tec";
import { approverInbox } from "../../../lib/issuer-review-notices";
import { getDb } from "../../../db";
import { issuerApplications } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { NotificationBell } from "../../notification-center";
export const dynamic="force-dynamic";
export const metadata={title:"Labs waiting for approval",robots:{index:false,follow:false}};
export default async function IssuerReviewPage(){
 const user=await getEmailUser(new Headers(await headers()));if(!user)redirect("/sign-in?return_to=/admin/issuers");if(!isIcsAdmin(user))notFound();
 const waiting=await approverInbox(user);
 return <main className="product-page phone-review-page"><header className="phone-review-header"><a href="/dashboard">Home</a><NotificationBell/></header><h1>Labs waiting for approval</h1><p>Each lab needs two different independent approvers. Every decision requires fresh device confirmation.</p><div className="phone-review-list">{waiting.length?await Promise.all(waiting.map(async item=>{const id=item.id.slice("tecrid:issuer-review:".length);const [application]=await getDb().select({legalName:issuerApplications.legalName}).from(issuerApplications).where(eq(issuerApplications.id,id)).limit(1);return <a key={id} href={`/admin/issuers/${encodeURIComponent(id)}`}><strong>{application?.legalName||"Laboratory application"}</strong><span>{item.read?"Awaiting your review":"New application"}</span><span aria-hidden="true">→</span></a>;})):<p className="notification-empty">No laboratories are waiting for your approval.</p>}</div></main>;
}
