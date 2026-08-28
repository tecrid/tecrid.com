import type { Metadata } from "next";
import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { getDashboardData } from "../../lib/tec";
import { ProductFooter, ProductNav } from "../site-nav";
import { ApiKeyPanel, OrganizationOnboarding } from "./dashboard-client";
import { IssuerApplicationPanel } from "./issuer-application";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TEC Registry Dashboard",
  description: "Manage your TEC organization, credentials, and API access.",
};

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const data = await getDashboardData(user.userId);

  return (
    <main className="product-page dashboard-page">
      <ProductNav compact />
      <header className="dashboard-header">
        <div>
          <p className="section-kicker light">Authenticated workspace</p>
          <h1>{data ? data.organization.name : "Welcome to TEC Registry"}</h1>
          <p>{user.displayName} · <a href={chatGPTSignOutPath("/")}>Sign out</a></p>
        </div>
        {data ? <span className="workspace-code">Issuer code <strong>{data.organization.issuerCode}</strong></span> : null}
      </header>

      {!data ? (
        <section className="dashboard-onboarding"><OrganizationOnboarding email={user.email} /></section>
      ) : (
        <div className="dashboard-shell">
          <section className="dashboard-summary" aria-label="Workspace summary">
            <article><span>Plan</span><strong>{data.organization.plan === "free" ? "Open network" : data.organization.plan}</strong><small>Verification remains free</small></article>
            <article><span>Issuer status</span><strong className={`status-${data.organization.issuerStatus}`}>{data.organization.issuerStatus.replaceAll("_", " ")}</strong><small>{data.organization.organizationType === "laboratory" ? "ICS review required for public issuance" : "Public issuance belongs to laboratories"}</small></article>
            <article><span>Credentials</span><strong>{data.records.length}</strong><small>{data.records.filter((record) => record.publicRecord).length} public</small></article>
            <article><span>API</span><strong>v1</strong><small>Bearer access available</small></article>
          </section>

          <section className="dashboard-panel credential-panel">
            <div className="panel-heading">
              <div><p className="section-kicker">Evidence records</p><h2>Credentials</h2></div>
              <a className="button-dark" href="/dashboard/credentials/new">New credential <span>→</span></a>
            </div>
            {data.organization.organizationType === "laboratory" && data.organization.issuerStatus !== "verified" ? (
              <div className="verification-banner"><strong>No public issuance authority yet.</strong><span>You may create private drafts and test canonicalization. Publication remains locked until ICS verifies the laboratory scope and signing key.</span></div>
            ) : null}
            <div className="credential-list">
              {data.records.length ? data.records.map((record) => (
                <article key={record.identifier}>
                  <span className={`record-status record-${record.status}`}>{record.status}</span>
                  <div><strong>{record.sampleName}</strong><code>{record.identifier}</code></div>
                  <div><span>{record.lotNumber || "No lot"}</span><small>{new Date(record.createdAt).toLocaleDateString()}</small></div>
                  {record.publicRecord ? <a href={`/records/${encodeURIComponent(record.identifier)}`}>Resolve ↗</a> : <span className="draft-lock">Not public</span>}
                </article>
              )) : <div className="empty-state"><strong>No credentials yet.</strong><p>Create a structured draft here or send one through the API.</p></div>}
            </div>
          </section>

          {data.organization.organizationType === "laboratory" ? (
            <IssuerApplicationPanel
              application={data.issuerApplication}
              issuerStatus={data.organization.issuerStatus}
            />
          ) : null}

          <ApiKeyPanel keys={data.keys} />

          <section className="dashboard-panel billing-panel">
            <div><p className="section-kicker light">Founding organization</p><h2>Need implementation support?</h2><p>Add structured onboarding, priority draft-protocol support, and integration scoping without changing your issuer-review outcome.</p></div>
            <a className="button-mint" href="/join">View founding membership ↗</a>
          </section>
        </div>
      )}
      <ProductFooter />
    </main>
  );
}
