"use client";

import { useState } from "react";

type ApplicationSummary = {
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
} | null;

export function IssuerApplicationPanel({
  application,
  issuerStatus,
}: {
  application: ApplicationSummary;
  issuerStatus: string;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/issuer-application", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        legalName: form.get("legalName"),
        laboratoryAddress: form.get("laboratoryAddress"),
        accreditationBody: form.get("accreditationBody"),
        accreditationNumber: form.get("accreditationNumber"),
        accreditationUrl: form.get("accreditationUrl"),
        scopeSummary: form.get("scopeSummary"),
        methodFamilies: form.get("methodFamilies"),
        contactName: form.get("contactName"),
        contactEmail: form.get("contactEmail"),
        keyId: form.get("keyId"),
        publicKeyJwk: form.get("publicKeyJwk"),
        attested: form.get("attested") === "on",
      }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "Application failed.");
    setMessage("Application recorded. Reloading your workspace…");
    window.location.reload();
  }

  if (issuerStatus === "verified") {
    return (
      <section className="dashboard-panel issuer-application-panel verified-issuer-panel">
        <div className="panel-heading">
          <div><p className="section-kicker">Issuance authority</p><h2>ICS verified issuer</h2></div>
          <span className="verified-pill"><i /> Active</span>
        </div>
        <p className="panel-copy">Public issuance remains limited to the reviewed laboratory scope and requires a valid signature from the registered issuer key.</p>
      </section>
    );
  }

  const canResubmit = application && ["needs_information", "rejected"].includes(application.status);

  if (application && !canResubmit) {
    return (
      <section className="dashboard-panel issuer-application-panel">
        <div className="panel-heading">
          <div><p className="section-kicker">Issuer application</p><h2>Review status</h2></div>
          <span className="record-status record-draft">{application.status}</span>
        </div>
        <p className="panel-copy">Submitted {new Date(application.submittedAt).toLocaleDateString()}. Payment cannot accelerate or determine this review.</p>
        <div className="review-boundary"><strong>Not yet authorized to publish.</strong><span>Drafts and canonicalization tools remain available while ICS reviews identity, scope, accreditation evidence, and signing-key control.</span></div>
        {application.reviewNote ? <p className="form-message">ICS note: {application.reviewNote}</p> : null}
      </section>
    );
  }

  return (
    <section className="dashboard-panel issuer-application-panel">
      <div className="panel-heading">
        <div><p className="section-kicker">Issuer application</p><h2>{canResubmit ? "Submit a replacement application" : "Request laboratory issuance authority"}</h2></div>
        <span className="record-status record-draft">{canResubmit ? application.status.replaceAll("_", " ") : "Not submitted"}</span>
      </div>
      {canResubmit ? <div className="review-boundary"><strong>ICS requested a new application.</strong><span>{application.reviewNote || "Correct the application and submit the complete replacement record below."}</span></div> : null}
      <p className="panel-copy">ICS reviews the laboratory’s legal identity, analytical scope, accreditation evidence, responsible contact, and signing-key control. Approval applies only to the recorded scope.</p>
      <form className="issuer-application-form" onSubmit={submit}>
        <label>Laboratory legal name<input name="legalName" required /></label>
        <label>Physical laboratory address<textarea name="laboratoryAddress" required rows={3} /></label>
        <div className="form-pair">
          <label>Accreditation body<input name="accreditationBody" placeholder="Optional if not accredited" /></label>
          <label>Accreditation number<input name="accreditationNumber" /></label>
        </div>
        <label>Public accreditation record URL<input name="accreditationUrl" type="url" placeholder="https://…" /></label>
        <label>Requested issuance scope<textarea name="scopeSummary" required rows={4} placeholder="Matrices, analyte families, authenticity claims, exclusions…" /></label>
        <label>Method families<textarea name="methodFamilies" required rows={3} placeholder="ICP-MS, GC-FID sterol profile, LC-MS/MS…" /></label>
        <div className="form-pair">
          <label>Responsible contact<input name="contactName" required /></label>
          <label>Contact email<input name="contactEmail" type="email" required /></label>
        </div>
        <details className="signing-key-details">
          <summary>Issuer signing key <span>required before approval</span></summary>
          <p>Submit only an Ed25519 public JWK. Never paste a private key. The registry verifies key control separately.</p>
          <label>Key ID<input name="keyId" placeholder="lab.example/key/2026-01" /></label>
          <label>Public JWK<textarea name="publicKeyJwk" rows={5} placeholder={'{"kty":"OKP","crv":"Ed25519","x":"…"}'} /></label>
        </details>
        <label className="attestation-check"><input name="attested" type="checkbox" required /><span>I attest that this application is accurate and that payment has no bearing on the review outcome.</span></label>
        <button className="button-dark" type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit for ICS review →"}</button>
        <p className="form-message" role="status">{message}</p>
      </form>
    </section>
  );
}
