import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getOrganizationForUser, isIcsAdmin } from "../../../lib/tec";
import { getDeliveryPolicy, organizationGate } from "../../../lib/organization-access";
import { OrganizationAccessControls } from "./access-client";
export const dynamic = "force-dynamic";
export const metadata = { title: "Recipient access status | TECRID", robots: { index: false, follow: false } };
export default async function OrganizationAccessPage() {
 const user = await requireChatGPTUser("/dashboard/organization-access"); const membership = await getOrganizationForUser(user.userId);
 if (!membership) redirect("/dashboard");
 const [gate, policy] = await Promise.all([organizationGate(membership.organization.id), getDeliveryPolicy()]);
 return <main className="product-page"><header className="dashboard-header"><div><p className="section-kicker light">Organization recipient status</p><h1>{gate.status}</h1><p>{membership.organization.name}</p></div><a href="/dashboard/organization-access">Refresh status</a></header><section className="dashboard-panel notification-settings"><h2>Delivery eligibility</h2>{gate.reasons.length ? <ul>{gate.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>Identity and an active controlling-brand grant are verified.</p>}<p>Terms requirement: {policy.termsRequired ? "on" : "off"}. Acceptance is versioned when terms are configured.</p><p>This status controls incoming recipient delivery. It does not grant access to every brand or SKU.</p></section><OrganizationAccessControls policy={policy} operator={isIcsAdmin(user)} /></main>;
}
