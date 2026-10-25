import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getDashboardData } from "../../../lib/tec";
import { IssuerApplicationPanel } from "../issuer-application";
import { ProductFooter } from "../../site-nav";
export const dynamic = "force-dynamic";
export default async function LaboratorySetup() {
  const user = await requireChatGPTUser("/dashboard/laboratory");
  const data = await getDashboardData(user.userId);
  if (!data || data.organization.organizationType !== "laboratory") redirect("/dashboard");
  if (data.organization.slug.startsWith("setup--")) redirect("/dashboard/setup?return_to=/dashboard/laboratory");
  return <main className="product-page simple-dashboard"><header className="simple-dashboard-heading"><p className="section-kicker">Laboratory setup</p><h1>Verify your lab.</h1><p>You can explore while ICS reviews your details. Issuing stays locked until approval.</p><a href="/dashboard">Back to Home</a></header><IssuerApplicationPanel application={data.issuerApplication} issuerStatus={data.organization.issuerStatus} documents={data.issuerDocuments} checks={data.issuerChecks} /><ProductFooter /></main>;
}
