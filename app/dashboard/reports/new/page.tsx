import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { getOrganizationForUser } from "../../../../lib/tec";
import { ProductFooter, ProductNav } from "../../../site-nav";
import { LegacyReportIntakeForm } from "./report-intake-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private report intake — TEC Registry",
  robots: { index: false, follow: false },
};

export default async function NewLegacyReportPage() {
  const user = await requireChatGPTUser("/dashboard/reports/new");
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) redirect("/dashboard");
  return (
    <main className="product-page">
      <ProductNav compact />
      <header className="form-page-header intake-form-header">
        <div><p className="section-kicker light">Private legacy-report intake</p><h1>Submit the evidence you actually received.</h1><p>The source document stays private. Nothing becomes a TECRID until the named laboratory claims, confirms, and signs it.</p></div>
        <span className="workspace-code">Workspace <strong>{membership.organization.name}</strong></span>
      </header>
      <section className="legacy-intake-shell">
        <LegacyReportIntakeForm />
      </section>
      <ProductFooter />
    </main>
  );
}
