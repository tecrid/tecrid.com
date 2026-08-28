"use client";

import { useState } from "react";

type EncryptedKeystore = {
  format: "tecrid-encrypted-keystore-v1";
  keyId: string;
  publicKeyJwk: JsonWebKey;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: { name: "AES-GCM"; iv: string; ciphertext: string };
};

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function decryptSigningKey(file: File, passphrase: string, expectedKeyId: string) {
  const keystore = JSON.parse(await file.text()) as EncryptedKeystore;
  if (
    keystore.format !== "tecrid-encrypted-keystore-v1" ||
    keystore.keyId !== expectedKeyId ||
    keystore.kdf?.name !== "PBKDF2" ||
    keystore.kdf.hash !== "SHA-256" ||
    keystore.cipher?.name !== "AES-GCM" ||
    keystore.kdf.iterations < 200_000
  ) {
    throw new Error("The encrypted key file does not match the reviewed issuer key.");
  }
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: decodeBase64Url(keystore.kdf.salt),
      iterations: keystore.kdf.iterations,
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(keystore.cipher.iv) },
    encryptionKey,
    decodeBase64Url(keystore.cipher.ciphertext),
  );
  const privateJwk = JSON.parse(new TextDecoder().decode(plaintext)) as JsonWebKey;
  if (
    privateJwk.kty !== "OKP" ||
    privateJwk.crv !== "Ed25519" ||
    !privateJwk.d ||
    !privateJwk.x ||
    privateJwk.x !== keystore.publicKeyJwk.x
  ) {
    throw new Error("The decrypted signing key is invalid.");
  }
  return crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "Ed25519" },
    false,
    ["sign"],
  );
}

export function LegacyConfirmationControls({
  token,
  reportId,
  status,
  isInvitedEmail,
  claimedByCurrentOrganization,
  organizationType,
  issuerStatus,
  issuedCredentialIdentifier,
}: {
  token: string;
  reportId: string;
  status: string;
  isInvitedEmail: boolean;
  claimedByCurrentOrganization: boolean;
  organizationType: string | null;
  issuerStatus: string | null;
  issuedCredentialIdentifier: string | null;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState("");

  async function action(actionName: "claim" | "discrepancy" | "decline", noteValue?: string) {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/legacy-reports/confirm/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: actionName, note: noteValue }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) return setMessage(body.error ?? "The action could not be completed.");
    setMessage("Decision recorded. Reloading the confirmation record…");
    window.location.reload();
  }

  async function signAndIssue() {
    if (!keyFile || !passphrase) return setMessage("Choose your encrypted issuer key file and enter its passphrase.");
    setPending(true);
    setMessage("Preparing the canonical payload…");
    try {
      const canonicalResponse = await fetch(
        `/api/legacy-reports/confirm/${encodeURIComponent(token)}/canonical`,
        { cache: "no-store" },
      );
      const canonical = await canonicalResponse.json();
      if (!canonicalResponse.ok) throw new Error(canonical.error ?? "Signing payload unavailable.");
      const privateKey = await decryptSigningKey(keyFile, passphrase, canonical.keyId);
      const signature = await crypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        new TextEncoder().encode(canonical.canonicalPayload),
      );
      setMessage("Signature created locally. Verifying and issuing…");
      const issueResponse = await fetch(`/api/legacy-reports/confirm/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "issue",
          proof: {
            keyId: canonical.keyId,
            algorithm: "Ed25519",
            signature: encodeBase64Url(signature),
          },
        }),
      });
      const body = await issueResponse.json();
      if (!issueResponse.ok) throw new Error(body.error ?? "Signed issuance failed.");
      window.location.href = `/records/${encodeURIComponent(body.result.tecrid)}`;
    } catch (error) {
      setPending(false);
      setMessage(error instanceof Error ? error.message : "Signed issuance failed.");
    }
  }

  if (issuedCredentialIdentifier || status === "issued") {
    return (
      <section className="confirmation-action-panel issued-confirmation-panel">
        <p className="section-kicker">Confirmation complete</p>
        <h2>Laboratory-signed TECRID issued.</h2>
        <a className="button-dark" href={`/records/${encodeURIComponent(issuedCredentialIdentifier || "")}`}>Resolve public record →</a>
      </section>
    );
  }

  if (!claimedByCurrentOrganization) {
    return (
      <section className="confirmation-action-panel">
        <p className="section-kicker">Gate 1 · organization claim</p>
        <h2>Claim only if your laboratory issued this report.</h2>
        {!isInvitedEmail ? <div className="review-boundary"><strong>Email mismatch.</strong><span>This request is restricted to the invited laboratory email.</span></div> : null}
        {organizationType !== "laboratory" ? <div className="review-boundary"><strong>Laboratory workspace required.</strong><span>Your current account is not registered as a laboratory organization. No claim or issuer authority has been granted.</span></div> : null}
        <div className="confirmation-button-row">
          <button className="button-dark" type="button" disabled={pending || !isInvitedEmail || organizationType !== "laboratory"} onClick={() => action("claim")}>Claim for laboratory review →</button>
          <button className="decline-button" type="button" disabled={pending || !isInvitedEmail || !note} onClick={() => action("decline", note)}>Decline request</button>
        </div>
        <label className="decision-note">Reason if declining<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></label>
        <p className="form-message" role="status">{message}</p>
      </section>
    );
  }

  if (status === "needs_submitter_correction") {
    return (
      <section className="confirmation-action-panel">
        <p className="section-kicker">Discrepancy open</p><h2>Issuance is locked.</h2>
        <p>The submitter must create a corrected intake or resolve the discrepancy before the laboratory can sign.</p>
      </section>
    );
  }

  if (issuerStatus !== "verified") {
    return (
      <section className="confirmation-action-panel">
        <p className="section-kicker">Gate 2 · issuer verification</p>
        <h2>The report is claimed, but issuance remains locked.</h2>
        <p>ICS must verify the laboratory identity, scope, accreditation evidence, responsible contact, and signing key. Payment cannot determine this decision.</p>
        <a className="button-dark" href="/dashboard">Open issuer application →</a>
      </section>
    );
  }

  return (
    <section className="confirmation-action-panel signing-panel">
      <p className="section-kicker">Gate 3 · laboratory decision and signature</p>
      <h2>Sign only after comparing the PDF and transcription.</h2>
      <div className="local-key-notice"><strong>Your private key never leaves this browser.</strong><span>TECRID receives only the Ed25519 signature. The encrypted key file and passphrase are used locally.</span></div>
      <div className="signing-inputs">
        <label>Encrypted TECRID issuer key<input type="file" accept="application/json,.json" onChange={(event) => setKeyFile(event.target.files?.[0] ?? null)} /></label>
        <label>Key passphrase<input type="password" autoComplete="current-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></label>
      </div>
      <button className="button-dark" type="button" disabled={pending || !keyFile || !passphrase} onClick={signAndIssue}>{pending ? "Working…" : "Confirm, sign, and issue TECRID →"}</button>
      <div className="discrepancy-control">
        <label className="decision-note">If anything differs, describe it<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="The tested date, unit, qualifier, sample identity, or another field differs from our canonical record." /></label>
        <button type="button" disabled={pending || !note} onClick={() => action("discrepancy", note)}>Flag discrepancy and lock issuance</button>
      </div>
      <p className="form-message" role="status">{message}</p>
      <small className="record-reference">Private intake {reportId}</small>
    </section>
  );
}
