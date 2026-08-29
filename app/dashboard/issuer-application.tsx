"use client";

import { useState } from "react";

type ApplicationSummary = {
  id: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  keyId: string | null;
  publicKeyJwk: string | null;
} | null;

type EvidenceSummary = {
  id: string;
  documentType: string;
  filename: string;
  sha256: string;
  createdAt: string;
};

type CheckSummary = {
  checkType: string;
  status: string;
  evidenceNote: string | null;
  reviewedAt: string | null;
};

type SigningChallenge = {
  id: string;
  canonicalPayload: string;
  expiresAt: string;
};

export function IssuerApplicationPanel({
  application,
  issuerStatus,
  documents,
  checks,
}: {
  application: ApplicationSummary;
  issuerStatus: string;
  documents: EvidenceSummary[];
  checks: CheckSummary[];
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [keyId, setKeyId] = useState("");
  const [publicKeyJwk, setPublicKeyJwk] = useState("");
  const [keyPassphrase, setKeyPassphrase] = useState("");
  const [evidenceMessage, setEvidenceMessage] = useState("");
  const [challengeMessage, setChallengeMessage] = useState("");
  const [challenge, setChallenge] = useState<SigningChallenge | null>(null);
  const [externalSignature, setExternalSignature] = useState("");
  const [keystoreFile, setKeystoreFile] = useState<File | null>(null);

  function encodeBase64Url(value: ArrayBuffer) {
    const bytes = new Uint8Array(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }

  function decodeBase64Url(value: string) {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  async function uploadEvidence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setEvidenceMessage("");
    const response = await fetch("/api/issuer-application/evidence", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setEvidenceMessage(body.error ?? "Evidence upload failed.");
    setEvidenceMessage("Evidence fingerprinted and stored privately. Reloading…");
    window.location.reload();
  }

  async function createChallenge() {
    setPending(true);
    setChallengeMessage("");
    const response = await fetch("/api/issuer-application/key-challenge", { method: "POST" });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setChallengeMessage(body.error ?? "Challenge creation failed.");
    setChallenge(body.challenge);
    setChallengeMessage("Sign the exact payload below before the 15-minute challenge expires.");
  }

  async function verifyChallenge(signature: string) {
    if (!challenge) return setChallengeMessage("Create a signing challenge first.");
    setPending(true);
    const response = await fetch("/api/issuer-application/key-challenge/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId: challenge.id, signature }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setChallengeMessage(body.error ?? "Signature verification failed.");
    setChallengeMessage("Key control and signing conformance verified. Reloading…");
    window.location.reload();
  }

  async function signWithDownloadedKey() {
    if (!challenge) return setChallengeMessage("Create a signing challenge first.");
    if (!keystoreFile) return setChallengeMessage("Choose the encrypted TECRID key file.");
    if (!keyPassphrase) return setChallengeMessage("Enter the key-file passphrase.");
    setPending(true);
    setChallengeMessage("Decrypting locally and signing the challenge…");
    try {
      const keystore = JSON.parse(await keystoreFile.text()) as {
        format: string;
        kdf: { hash: string; iterations: number; salt: string };
        cipher: { iv: string; ciphertext: string };
      };
      if (keystore.format !== "tecrid-encrypted-keystore-v1") throw new Error();
      const passwordKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(keyPassphrase),
        "PBKDF2",
        false,
        ["deriveKey"],
      );
      const encryptionKey = await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          hash: keystore.kdf.hash,
          salt: decodeBase64Url(keystore.kdf.salt),
          iterations: keystore.kdf.iterations,
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );
      const privateBytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: decodeBase64Url(keystore.cipher.iv) },
        encryptionKey,
        decodeBase64Url(keystore.cipher.ciphertext),
      );
      const privateJwk = JSON.parse(new TextDecoder().decode(privateBytes)) as JsonWebKey;
      const privateKey = await crypto.subtle.importKey(
        "jwk",
        privateJwk,
        { name: "Ed25519" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        new TextEncoder().encode(challenge.canonicalPayload),
      );
      setKeyPassphrase("");
      await verifyChallenge(encodeBase64Url(signature));
    } catch {
      setPending(false);
      setChallengeMessage("The key file could not be decrypted or did not contain a usable Ed25519 private key.");
    }
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
        laboratoryWebsite: form.get("laboratoryWebsite"),
        authorityRole: form.get("authorityRole"),
        accreditationStatus: form.get("accreditationStatus"),
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
    const checkByType = new Map(checks.map((check) => [check.checkType, check]));
    const checklist = [
      ["identity", "Legal identity and authority"],
      ["accreditation", "Accreditation or competence evidence"],
      ["scope", "Methods, matrices and analyte scope"],
      ["key_control", "Issuer signing-key control"],
      ["conformance", "TECRID signing conformance"],
    ];
    const keyComplete = checkByType.get("key_control")?.status === "passed" && checkByType.get("conformance")?.status === "passed";
    return (
      <section className="dashboard-panel issuer-application-panel">
        <div className="panel-heading">
          <div><p className="section-kicker">Issuer application</p><h2>Review status</h2></div>
          <span className="record-status record-draft">{application.status}</span>
        </div>
        <p className="panel-copy">Submitted {new Date(application.submittedAt).toLocaleDateString()}. Payment cannot accelerate or determine this review.</p>
        <div className="review-boundary"><strong>Not yet authorized to publish.</strong><span>All five gates below must pass. An application or payment never creates issuance authority.</span></div>
        <div className="issuer-gate-list" aria-label="Issuer verification gates">
          {checklist.map(([checkType, label], index) => {
            const check = checkByType.get(checkType);
            const status = check?.status ?? "pending";
            return <article key={checkType}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{label}</strong><small>{check?.evidenceNote || (checkType === "key_control" || checkType === "conformance" ? "Complete the cryptographic challenge below." : "Awaiting ICS evidence review.")}</small></div><i className={`gate-status gate-${status}`}>{status}</i></article>;
          })}
        </div>

        <div className="issuer-verification-tools">
          <form className="issuer-evidence-form" onSubmit={uploadEvidence}>
            <div><p className="section-kicker">Private evidence</p><h3>Upload review documents</h3><p>PDFs remain restricted to your laboratory and ICS reviewers. Each file is fingerprinted when received.</p></div>
            <label>Evidence type<select name="documentType" defaultValue="accreditation_scope"><option value="accreditation_scope">Accreditation scope</option><option value="accreditation_certificate">Accreditation certificate</option><option value="legal_identity">Legal identity or authority</option></select></label>
            <label>PDF evidence<input name="document" type="file" accept="application/pdf,.pdf" required /></label>
            <button className="button-dark" type="submit" disabled={pending}>{pending ? "Working…" : "Upload private evidence →"}</button>
            <p className="form-message" role="status">{evidenceMessage}</p>
            {documents.length ? <div className="issuer-evidence-list">{documents.map((document) => <a key={document.id} href={`/api/issuer-application/evidence/${encodeURIComponent(document.id)}`} target="_blank" rel="noreferrer"><strong>{document.documentType.replaceAll("_", " ")}</strong><span>{document.filename}</span><code>{document.sha256.slice(0, 12)}…{document.sha256.slice(-8)}</code></a>)}</div> : <p className="empty-state">No private verification documents uploaded yet.</p>}
          </form>

          <div className="issuer-key-conformance">
            <div><p className="section-kicker">Cryptographic gate</p><h3>{keyComplete ? "Key control verified" : "Prove control of the issuer key"}</h3><p>{keyComplete ? "The submitted public key verified a canonical TECRID challenge and signing-format test." : "TECRID issues a single-use canonical payload. The laboratory must sign its exact UTF-8 bytes with the private key corresponding to the submitted public key."}</p></div>
            {keyComplete ? <div className="key-conformance-complete"><strong>Passed</strong><span>Key control and signing conformance are recorded separately from ICS identity and scope review.</span></div> : <>
              <button className="button-dark" type="button" onClick={createChallenge} disabled={pending}>{challenge ? "Replace challenge" : "Create 15-minute challenge"} →</button>
              {challenge ? <>
                <label>Canonical challenge payload<textarea readOnly rows={7} value={challenge.canonicalPayload} /></label>
                <small>Expires {new Date(challenge.expiresAt).toLocaleString()} · Sign the payload exactly as shown.</small>
                <div className="keystore-conformance">
                  <strong>Use the encrypted browser key generated above</strong>
                  <label>TECRID key file<input type="file" accept="application/json,.json" onChange={(event) => setKeystoreFile(event.target.files?.[0] ?? null)} /></label>
                  <label>Key-file passphrase<input type="password" value={keyPassphrase} onChange={(event) => setKeyPassphrase(event.target.value)} autoComplete="current-password" /></label>
                  <button type="button" onClick={signWithDownloadedKey} disabled={pending}>Sign locally and verify →</button>
                </div>
                <details className="external-signature-details"><summary>Using an HSM or external key manager?</summary><label>Base64url signature<textarea rows={4} value={externalSignature} onChange={(event) => setExternalSignature(event.target.value)} placeholder="Paste the Ed25519 signature without padding" /></label><button type="button" onClick={() => verifyChallenge(externalSignature)} disabled={pending || !externalSignature}>Verify external signature →</button></details>
              </> : null}
              <p className="form-message" role="status">{challengeMessage}</p>
            </>}
          </div>
        </div>
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
          <label>Laboratory website<input name="laboratoryWebsite" type="url" required placeholder="https://laboratory.example" /></label>
          <label>Your authority role<input name="authorityRole" required placeholder="Quality director, laboratory manager…" /></label>
        </div>
        <label>Accreditation status<select name="accreditationStatus" defaultValue="accredited" required><option value="accredited">Accredited for at least part of the requested scope</option><option value="in_process">Accreditation in process</option><option value="not_accredited">Not accredited — submit comparable competence evidence</option></select></label>
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
          <label>Key ID<input name="keyId" value={keyId} onChange={(event) => setKeyId(event.target.value)} placeholder="lab.example/key/2026-01" required /></label>
          <label>Public JWK<textarea name="publicKeyJwk" value={publicKeyJwk} onChange={(event) => setPublicKeyJwk(event.target.value)} rows={5} placeholder={'{"kty":"OKP","crv":"Ed25519","x":"…"}'} required /></label>
        </details>
        <label className="attestation-check"><input name="attested" type="checkbox" required /><span>I attest that this application is accurate and that payment has no bearing on the review outcome.</span></label>
        <p className="collection-notice">Application materials are restricted to issuer verification, registry integrity, support, and legal obligations; submitting them does not create a public laboratory profile. Review <a href="/privacy" target="_blank">Privacy &amp; Data Governance ↗</a>.</p>
        <button className="button-dark" type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit for ICS review →"}</button>
        <p className="form-message" role="status">{message}</p>
      </form>
    </section>
  );
}
