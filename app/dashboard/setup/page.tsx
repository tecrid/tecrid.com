import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getOrganizationForUser } from "../../../lib/tec";
import { safeReturnPath } from "../../../lib/auth-return-path";
import { WorkspaceDetailsForm } from "./details-form";
export const dynamic = "force-dynamic";
export default async function WorkspaceSetup({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  const requested = safeReturnPath((await searchParams).return_to);
  const returnTo = requested.startsWith("/dashboard/") && !requested.startsWith("/dashboard/setup") ? requested : "/dashboard";
  const user = await requireChatGPTUser(`/dashboard/setup?return_to=${encodeURIComponent(returnTo)}`);
  const membership = await getOrganizationForUser(user.userId); if (!membership) redirect("/welcome");
  if (!membership.organization.slug.startsWith("setup--")) redirect(returnTo);
  return <main className="product-page simple-dashboard"><header className="simple-dashboard-heading"><p className="section-kicker">One more detail for this step</p><h1>What is your organization called?</h1><p>We need this when you add or request a report. This does not verify your organization or publish your profile.</p></header><section className="dashboard-onboarding"><WorkspaceDetailsForm returnTo={returnTo} /></section></main>;
}
