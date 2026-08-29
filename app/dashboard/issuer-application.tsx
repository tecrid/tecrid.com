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
  const [keyId, setKeyId] = useState("");
  const [publicKeyJwk, setPublicKeyJwk] = useState("");
  const [keyPassphrase, setKeyPassphrase] = useState("");

  function encodeBase64Url(value: ArrayBuffer) {
    const bytes = new Uint8Array(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }

  async function generateEncryptedIssuerKey() {
    if (keyPassphrase.length < 12) {
      return setMessage("Use a key-file passphrase of at least 12 characters.");
    }
    setPending(true);
    setMessage("Generating the issuer key in this browser…");
    try {
      const pair = await crypto.subtle.generateKey(
        { name: "Ed25519" },
        true,
        ["sign", "verify"],
      ) as CryptoKeyPair;
      const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
      const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
      const generatedKeyId = `tecrid/issuer/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID().slice(0, 8)}`;
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const passwordKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(keyPassphrase),
        "PBKDF2",
        false,
        ["deriveKey"],
      );
      const encryptionKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations: 250_000 },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"],
      );
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        encryptionKey,
        new TextEncoder().encode(JSON.stringify(privateJwk)),
      );
      const keystore = {
        format: "tecrid-encrypted-keystore-v1",
        keyId: generatedKeyId,
        publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: publicJwk.x, use: "sig" },
        kdf: {
          name: "PBKDF2",
          hash: "SHA-256",
          iterations: 250_000,
          salt: encodeBase64Url(salt.buffer as ArrayBuffer),
        },
        cipher: {
          name: "AES-GCM",
          iv: encodeBase64Url(iv.buffer as ArrayBuffer),
          ciphertext: encodeBase64Url(ciphertext),
        },
      };
      const blobUrl = URL.createObjectURL(
        new Blob([JSON.stringify(keystore, null, 2)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `tecrid-issuer-key-${generatedKeyId.split("/").at(-1)}.json`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
      setKeyId(generatedKeyId);
      setPublicKeyJwk(JSON.stringify(keystore.publicKeyJwk));
      setKeyPassphrase("");
      setMessage("Encrypted issuer key downloaded. Keep the file and passphrase separately; submit the populated public key below.");
    } catch {
      setMessage("This browser could not generate the Ed25519 issuer key. Use your laboratory key-management system and enter its public JWK instead.");
    } finally {
      setPending(false);
    }
  }

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
          <div className="browser-key-generator">
            <strong>Generate an encrypted browser signing key</strong>
            <p>The private key is encrypted locally and downloaded. TECRID receives only the public key.</p>
            <label>New key-file passphrase<input type="password" value={keyPassphrase} onChange={(event) => setKeyPassphrase(event.target.value)} minLength={12} autoComplete="new-password" /></label>
            <button type="button" onClick={generateEncryptedIssuerKey} disabled={pending || keyPassphrase.length < 12}>Generate and download encrypted key</button>
          </div>
          <label>Key ID<input name="keyId" value={keyId} onChange={(event) => setKeyId(event.target.value)} placeholder="lab.example/key/2026-01" /></label>
          <label>Public JWK<textarea name="publicKeyJwk" value={publicKeyJwk} onChange={(event) => setPublicKeyJwk(event.target.value)} rows={5} placeholder={'{"kty":"OKP","crv":"Ed25519","x":"…"}'} /></label>
        </details>
        <label className="attestation-check"><input name="attested" type="checkbox" required /><span>I attest that this application is accurate and that payment has no bearing on the review outcome.</span></label>
        <p className="collection-notice">Application materials are restricted to issuer verification, registry integrity, support, and legal obligations; submitting them does not create a public laboratory profile. Review <a href="/privacy" target="_blank">Privacy &amp; Data Governance ↗</a>.</p>
        <button className="button-dark" type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit for ICS review →"}</button>
        <p className="form-message" role="status">{message}</p>
      </form>
    </section>
  );
}
