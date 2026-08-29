"use client";

import { useRef, useState } from "react";

type VerificationResult = {
  receiptId: string;
  receiptFingerprint: string;
  checkedAt: string;
  outcome: string;
  credentialIdentifier: string | null;
  productionAuthority: boolean;
  record: { links?: { human?: string }; issuer?: { name?: string }; subject?: { sampleName?: string } } | null;
};

const OUTCOME_COPY: Record<string, [string, string]> = {
  verified_match: ["Verified registry match", "The current record, issuer authority, fingerprint, signature, and version checks passed."],
  sample_only: ["Resolver sample only", "This fictional sample demonstrates the workflow and has no production authority."],
  revoked: ["Record revoked", "The TECRID resolves, but the current record is revoked."],
  not_currently_issued: ["Not currently issued", "The record exists but is not an issued public credential."],
  issuer_not_verified: ["Issuer not verified", "The record exists, but its issuing laboratory does not currently hold verified status."],
  proof_incomplete: ["Integrity proof incomplete", "The record exists, but one or more signature, fingerprint, or version checks did not pass."],
  not_found: ["No registry match", "No public TECRID or source-document fingerprint matched this lookup."],
};

async function fileSha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function VerificationClient({ sampleTecrid, sampleFingerprint }: { sampleTecrid: string; sampleFingerprint: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [identifier, setIdentifier] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [filename, setFilename] = useState("");
  const [message, setMessage] = useState("Enter one TECRID, or choose one PDF to compare by fingerprint.");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function chooseFile(file?: File) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") return setMessage("Choose a PDF file.");
    setBusy(true);
    setResult(null);
    setIdentifier("");
    setFilename(file.name);
    setMessage("Computing SHA-256 locally in your browser…");
    try {
      const digest = await fileSha256(file);
      setFingerprint(digest);
      setMessage("Fingerprint ready. The PDF has not been sent to TECRID.");
    } catch {
      setMessage("This browser could not fingerprint the file.");
    } finally {
      setBusy(false);
    }
  }

  async function check(payload: { identifier?: string; documentSha256?: string }) {
    setBusy(true);
    setResult(null);
    setMessage("Checking the current public registry…");
    try {
      const response = await fetch("/api/verification/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { result?: VerificationResult; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error || "Verification failed.");
      setResult(body.result);
      setMessage("A fingerprinted registry verification receipt has been created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  function loadSample() {
    setIdentifier(sampleTecrid);
    setFingerprint("");
    setFilename("");
    setResult(null);
    setMessage("Fictional resolver sample loaded. It will be identified as sample-only.");
  }

  const outcome = result ? (OUTCOME_COPY[result.outcome] ?? [result.outcome, "Review the receipt for details."]) : null;
  return (
    <section className="verification-shell">
      <div className="verification-workbench">
        <div className="verification-input-panel">
          <p className="section-kicker">Option 01</p><h2>Check a TECRID</h2>
          <label htmlFor="verify-tecrid">TECRID</label>
          <input id="verify-tecrid" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setFingerprint(""); setFilename(""); }} placeholder="TECRID·LAB-26-000001" />
          <div className="verification-actions"><button className="button-dark" type="button" disabled={busy || !identifier.trim()} onClick={() => void check({ identifier })}>{busy ? "Checking…" : "Verify TECRID"}</button><button className="button-outline" type="button" onClick={loadSample}>Load sample</button></div>
        </div>
        <div className="verification-input-panel file-panel">
          <p className="section-kicker">Option 02</p><h2>Check a PDF</h2>
          <input ref={fileRef} className="sr-only" type="file" accept="application/pdf,.pdf" onChange={(event) => void chooseFile(event.target.files?.[0])} />
          <button className="verification-file-button" type="button" onClick={() => fileRef.current?.click()}><span>{filename || "Choose a local PDF"}</span><small>SHA-256 is computed in this browser</small></button>
          {fingerprint ? <code className="verification-digest">{fingerprint}</code> : null}
          <div className="verification-actions"><button className="button-dark" type="button" disabled={busy || !fingerprint} onClick={() => void check({ documentSha256: fingerprint })}>{busy ? "Checking…" : "Compare fingerprint"}</button><button className="button-outline" type="button" onClick={() => { setIdentifier(""); setFingerprint(sampleFingerprint); setFilename("fictional-sample-report.pdf"); setResult(null); setMessage("Fictional sample fingerprint loaded. No PDF was uploaded."); }}>Load sample digest</button></div>
        </div>
      </div>
      <p className="verification-message" aria-live="polite">{message}</p>
      {result && outcome ? (
        <article className={`verification-result result-${result.outcome}`}>
          <div><span>{result.outcome.replaceAll("_", " ")}</span><h2>{outcome[0]}</h2><p>{outcome[1]}</p></div>
          <dl>
            <div><dt>TECRID</dt><dd>{result.credentialIdentifier || "No match"}</dd></div>
            <div><dt>Issuer</dt><dd>{result.record?.issuer?.name || "—"}</dd></div>
            <div><dt>Sample</dt><dd>{result.record?.subject?.sampleName || "—"}</dd></div>
            <div><dt>Production authority</dt><dd>{result.productionAuthority ? "Yes" : "No"}</dd></div>
          </dl>
          <div className="verification-result-actions"><a href={`/verification/receipts/${encodeURIComponent(result.receiptId)}`}>Open verification receipt →</a>{result.record?.links?.human ? <a href={result.record.links.human}>Open public record ↗</a> : null}</div>
        </article>
      ) : null}
    </section>
  );
}
