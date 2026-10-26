import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getDashboardData } from "../../../lib/tec";
import { IssuerApplicationPanel } from "../issuer-application";
import { ProductFooter } from "../../site-nav";
export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your laboratory", robots: { index: false, follow: false } };
export default async function LaboratorySetup() {
  const user = await requireChatGPTUser("/dashboard/laboratory");
  const data = await getDashboardData(user.userId);
  if (!data || data.organization.organizationType !== "laboratory") redirect("/dashboard");
  return <main className="product-page simple-dashboard"><header className="simple-dashboard-heading"><p className="section-kicker">Laboratory setup</p><h1>Verify your lab.</h1><p>Complete this verification form to finish lab signup. Until two independent ICS admins approve it, you can use sandbox and private drafts.</p><a href="/dashboard">Back to Home</a></header><IssuerApplicationPanel application={data.issuerApplication} issuerStatus={data.organization.issuerStatus} documents={data.issuerDocuments} checks={data.issuerChecks} confirmedEmail={user.userId.startsWith("email:") ? user.email : null} /><ProductFooter /></main>;
}
