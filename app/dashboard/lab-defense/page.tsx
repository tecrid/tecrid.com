import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { listLabDefenseForUser } from "../../../lib/lab-defense";
import { ProductFooter, ProductNav } from "../../site-nav";
import { LabDefenseClient } from "./lab-defense-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Laboratory verification desk — TEC Registry" };

export default async function LabDefensePage() {
  const user = await requireChatGPTUser("/dashboard/lab-defense");
  const data = await listLabDefenseForUser(user);
  const verified = data.checks.filter((check) => check.outcome === "verified_match").length;
  return (
    <main className="product-page lab-defense-page">
      <ProductNav compact />
      <header className="dashboard-header lab-defense-hero"><div><p className="section-kicker light">Laboratory verification desk</p><h1>Answer the report question<br />with a durable receipt.</h1><p>See authenticity checks against your issued records and assemble two-record evidence cases without pretending software can choose the scientifically correct result.</p></div><span className="workspace-code">Workspace <strong>{data.membership.organization.name}</strong></span></header>
      <div className="lab-defense-shell">
        <section className="dashboard-summary">
          <article><span>Verification checks</span><strong>{data.checks.length}</strong><small>Latest 100 against this issuer</small></article>
          <article><span>Verified matches</span><strong>{verified}</strong><small>Current registry checks passed</small></article>
          <article><span>Exceptions</span><strong>{data.checks.length - verified}</strong><small>Revoked, incomplete, or unmatched</small></article>
          <article><span>Evidence cases</span><strong>{data.cases.length}</strong><small>Fingerprinted comparison manifests</small></article>
        </section>
        <LabDefenseClient />
        <section className="lab-defense-grid">
          <div className="dashboard-panel verification-log-panel"><div className="panel-heading"><div><p className="section-kicker">Public verification log</p><h2>Checks against your reports</h2></div><a className="button-outline" href="/verify">Open public verifier ↗</a></div><p className="panel-copy">The registry stores the lookup, outcome, record fingerprint, and a receipt fingerprint. It does not store the PDF used for a local fingerprint check.</p><div className="lab-defense-list">{data.checks.length ? data.checks.map((check) => <a key={check.id} href={`/verification/receipts/${check.id}`}><span className={`record-status record-${check.outcome}`}>{check.outcome.replaceAll("_", " ")}</span><div><strong>{check.credentialIdentifier || "No match"}</strong><small>{check.lookupType.replaceAll("_", " ")} · {new Date(check.createdAt).toLocaleString()}</small></div><i>→</i></a>) : <div className="empty-state"><strong>No public checks against this issuer yet.</strong><p>Checks appear after a TECRID or matching PDF fingerprint is verified.</p></div>}</div></div>
          <aside className="dashboard-panel dispute-case-panel"><div className="panel-heading"><div><p className="section-kicker light">Evidence cases</p><h2>Structured dispute handoffs</h2></div></div><div className="lab-defense-list dark-list">{data.cases.length ? data.cases.map((record) => <Link key={record.id} href={`/dashboard/lab-defense/${record.id}`}><span>{record.comparisonStatus.replaceAll("_", " ")}</span><div><strong>{record.title}</strong><small>{record.leftCredentialIdentifier} ↔ {record.rightCredentialIdentifier}</small></div><i>→</i></Link>) : <div className="empty-state dark"><strong>No evidence cases yet.</strong><p>Create one above, or open the fictional demo to inspect the output first.</p><a href="/demo/lab-defense">View fictional demonstration →</a></div>}</div></aside>
        </section>
      </div>
      <ProductFooter />
    </main>
  );
}
