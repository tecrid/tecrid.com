import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { getDashboardData } from "../../lib/tec";
import { listLegacyReportsForUser } from "../../lib/legacy-reports";
import { ProductFooter, ProductNav } from "../site-nav";
import { ApiKeyPanel, OrganizationOnboarding } from "./dashboard-client";
import { IssuerApplicationPanel } from "./issuer-application";
import { getVerificationProgress } from "./laboratory-progress";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TEC Registry Dashboard",
  description: "Manage your TEC organization, credentials, and API access.",
};

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const data = await getDashboardData(user.userId);
  const legacyReports = data ? await listLegacyReportsForUser(user) : [];
  const activeApiKey = data?.keys.some((key) => !key.revokedAt) ?? false;
  const verificationProgress = getVerificationProgress(
    data?.organization.issuerStatus ?? "pending",
    data?.issuerApplication?.status,
  );
  const laboratoryMilestones = data?.organization.organizationType === "laboratory" ? [
    { label: "Workspace", detail: "Organization created", complete: true, href: "/dashboard" },
    { label: "Verification", detail: verificationProgress.detail, complete: data.organization.issuerStatus === "verified", href: "/dashboard#laboratory-verification" },
    { label: "Integration", detail: activeApiKey ? "API access ready" : "Create API access", complete: activeApiKey, href: "/dashboard/settings#api-keys" },
    { label: "First TECRID", detail: data.records.length ? `${data.records.length} credential${data.records.length === 1 ? "" : "s"} created` : "Create the first credential", complete: data.records.length > 0, href: "/dashboard/credentials/new" },
  ] : [];
  const nextLaboratoryMilestone = laboratoryMilestones.find((step) => !step.complete) ?? { label: "Monitor", detail: "Review report activity", complete: false, href: "/dashboard/insights" };

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
          {laboratoryMilestones.length ? <section className="dashboard-launch-path" aria-label="Laboratory onboarding path">
            <div><p className="section-kicker light">Recommended next action</p><h2>{nextLaboratoryMilestone.detail}</h2><p>Complete the laboratory path in order, while keeping verification, API setup, and issuance as separate gates.</p><Link className="button-mint" href={nextLaboratoryMilestone.href}>Continue {nextLaboratoryMilestone.label.toLowerCase()} →</Link></div>
            <ol>{laboratoryMilestones.map((step, index) => <li className={step.complete ? "complete" : step === nextLaboratoryMilestone ? "next" : ""} key={step.label}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div><Link href={step.href}>{step.complete ? "Review" : "Open"} →</Link></li>)}</ol>
          </section> : null}

          <section className="dashboard-summary" aria-label="Workspace summary">
            <article><span>Plan</span><strong>{data.organization.plan === "free" ? "Open network" : data.organization.plan}</strong><small>Verification remains free</small></article>
            <article><span>Issuer status</span><strong className={`status-${data.organization.issuerStatus}`}>{data.organization.issuerStatus.replaceAll("_", " ")}</strong><small>{data.organization.organizationType === "laboratory" ? "ICS review required for public issuance" : "Public issuance belongs to laboratories"}</small></article>
            <article><span>Credentials</span><strong>{data.records.length}</strong><small>{data.records.filter((record) => record.publicRecord).length} public</small></article>
            <article><span>Private intake</span><strong>{legacyReports.length}</strong><small>{legacyReports.filter((report) => report.status === "issued").length} issued</small></article>
          </section>

          <section className="dashboard-panel disclosure-dashboard-entry">
            <div>
              <p className="section-kicker light">Disclosure operations</p>
              <h2>Turn one laboratory file into every disclosure surface.</h2>
              <p>Stage production aggregates, stop incomplete rows, publish brand disclosures, expose retailer-ready JSON, and preserve the path to laboratory confirmation.</p>
            </div>
            <Link className="button-mint" href="/dashboard/disclosures">Open disclosure operations →</Link>
          </section>

          <section className="dashboard-workflow-grid">
            <Link className="dashboard-workflow-card sharing-card" href="/dashboard/sharing">
              <p className="section-kicker light">Scoped share codes</p>
              <h2>Replace document uploads with consented evidence packages.</h2>
              <p>Create recipient-bound codes for selected TECRIDs, selected SKUs, or a time-limited portfolio. Every redemption produces a fingerprinted receipt.</p>
              <span>Open evidence sharing →</span>
            </Link>
            <Link className="dashboard-workflow-card routing-card" href="/dashboard/evidence-routing">
              <p className="section-kicker light">Controlled evidence routing</p>
              <h2>Request, grant, and deliver by SKU.</h2>
              <p>Let certifiers, retailers, and government programs request TECRIDs while the brand or supplier controls each recipient, result scope, and laboratory route.</p>
              <span>Open evidence routing →</span>
            </Link>
            <Link className="dashboard-workflow-card verification-card" href="/dashboard/lab-defense">
              <p className="section-kicker">Laboratory verification desk</p>
              <h2>Answer report questions with durable receipts.</h2>
              <p>See checks against issued records, compare two public TECRIDs, and download one fingerprinted evidence manifest for technical review.</p>
              <span>Open laboratory desk →</span>
            </Link>
            <Link className="dashboard-workflow-card certification-card" href="/dashboard/certification">
              <p className="section-kicker light">Certification intake</p>
              <h2>Receive evidence by ID, CSV, or API.</h2>
              <p>Create applicant submission links and scoped API tokens. Every TECRID is authority-checked and frozen at the version reviewed.</p>
              <span>Open certification intake →</span>
            </Link>
            <Link className="dashboard-workflow-card insights-card" href="/dashboard/insights">
              <p className="section-kicker">Evidence insights</p>
              <h2>Review the portfolio without flattening the evidence.</h2>
              <p>See result coverage, SKU volume, missing requested analytes, and the exact TECRID behind every summary.</p>
              <span>Open evidence insights →</span>
            </Link>
          </section>

          <section className="dashboard-panel legacy-report-panel">
            <div className="panel-heading">
              <div><p className="section-kicker">Legacy report intake</p><h2>Existing laboratory reports</h2></div>
              <Link className="button-dark" href="/dashboard/reports/new">Submit private report <span>→</span></Link>
            </div>
            <p className="panel-copy">A submitted PDF is private evidence—not a TECRID. The named laboratory must claim, confirm, and sign it before public issuance.</p>
            <div className="legacy-report-list">
              {legacyReports.length ? legacyReports.map((report) => (
                <a href={`/dashboard/reports/${encodeURIComponent(report.id)}`} key={report.id}>
                  <span className={`record-status record-${report.status}`}>{report.status.replaceAll("_", " ")}</span>
                  <div><strong>{report.sampleName}</strong><small>{report.laboratoryName} · {report.reportNumber || "No report number"}</small></div>
                  <code>{report.sourceSha256.slice(0, 12)}…{report.sourceSha256.slice(-8)}</code>
                  <i aria-hidden="true">→</i>
                </a>
              )) : <div className="empty-state"><strong>No existing reports in private intake.</strong><p>Upload the original PDF, preserve its fingerprint, and invite the laboratory to confirm it.</p></div>}
            </div>
          </section>

          <section className="dashboard-panel credential-panel" id="credentials">
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
              documents={data.issuerDocuments}
              checks={data.issuerChecks}
            />
          ) : null}

          <ApiKeyPanel keys={data.keys} />

          <section className="dashboard-panel billing-panel">
            {data.organization.plan === "founding" ? (
              <>
                <div><p className="section-kicker light">Founding organization · active</p><h2>{data.foundingLaunch ? "Your pilot is in the implementation queue." : "Turn membership into a first outcome."}</h2><p>{data.foundingLaunch ? `${data.foundingLaunch.pilotProduct} · ${data.foundingLaunch.estimatedReportCount} planned reports · ${data.foundingLaunch.status.replaceAll("_", " ")}` : "Define the first product, report set, laboratories, and target date. The brief becomes the operational handoff to ICS."}</p></div>
                <a className="button-mint" href="/dashboard/founding">{data.foundingLaunch ? "Review launch brief" : "Start launch brief"} →</a>
              </>
            ) : (
              <>
                <div><p className="section-kicker light">Founding organization</p><h2>Need a defined implementation pilot?</h2><p>Founding membership adds a 30-day launch brief, guided preparation of the first 10 reports, laboratory-confirmation setup, and one integration scope.</p></div>
                <a className="button-mint" href="/join">See exactly what is included →</a>
              </>
            )}
          </section>
        </div>
      )}
      <ProductFooter />
    </main>
  );
}
