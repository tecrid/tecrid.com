import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { isIcsAdmin, listFoundingOnboardingForAdmin } from "../../../lib/tec";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ICS founding implementation queue — TEC Registry",
  robots: { index: false, follow: false },
};

export default async function FoundingAdminPage() {
  const user = await requireChatGPTUser("/admin/founding");
  if (!isIcsAdmin(user)) notFound();
  const launches = await listFoundingOnboardingForAdmin(user);

  return (
    <main className="product-page admin-page">
      <ProductNav compact />
      <header className="dashboard-header"><div><p className="section-kicker light">ICS restricted operation</p><h1>Founding implementation queue</h1><p>Paid operational work kept separate from issuer-verification decisions</p></div><span className="workspace-code">Launches <strong>{launches.length}</strong></span></header>
      <section className="admin-application-list">
        <div className="admin-switcher"><a href="/admin/issuers">Issuer applications</a><a href="/admin/reports">Report intake audit</a><strong>Founding launches</strong></div>
        {launches.length ? launches.map(({ onboarding, organization }) => (
          <article key={onboarding.id}>
            <header><div><span>{organization.issuerCode}</span><h2>{organization.name}</h2><p>{organization.organizationType.replaceAll("_", " ")} · {onboarding.contactName} · {onboarding.contactEmail}</p></div><span className={`record-status record-${onboarding.status}`}>{onboarding.status.replaceAll("_", " ")}</span></header>
            <dl>
              <div><dt>First pilot</dt><dd>{onboarding.pilotProduct}<small>{onboarding.primaryGoal.replaceAll("_", " ")}</small></dd></div>
              <div><dt>Report set</dt><dd>{onboarding.estimatedReportCount} estimated reports</dd></div>
              <div><dt>Laboratories</dt><dd>{onboarding.primaryLaboratories || "Not named yet"}</dd></div>
              <div><dt>Target</dt><dd>{onboarding.targetLaunchDate || "No date supplied"}</dd></div>
              <div><dt>Operational notes</dt><dd>{onboarding.notes || "None supplied"}</dd></div>
              <div><dt>Updated</dt><dd>{new Date(onboarding.updatedAt).toLocaleString()}</dd></div>
            </dl>
          </article>
        )) : <div className="empty-registry"><strong>No founding launch briefs.</strong><p>Activated customers will appear here after defining their first pilot.</p></div>}
      </section>
      <ProductFooter />
    </main>
  );
}
