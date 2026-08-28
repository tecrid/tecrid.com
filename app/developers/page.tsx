import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";

export const metadata: Metadata = {
  title: "TEC Registry API",
  description: "Canonicalize, sign, issue, revise, and resolve TEC records through the implemented v1 API.",
};

const credentialBody = `{
  "sampleName": "Organic cacao powder",
  "lotNumber": "C-240518",
  "matrix": "Food · Powder",
  "method": "ICP-MS",
  "submittingParty": "Example Brand",
  "releasedAt": "2026-08-28",
  "sourceDocument": {
    "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "filename": "laboratory-report.pdf",
    "reportNumber": "LAB-240518"
  },
  "publish": true,
  "results": [
    { "analyte": "Lead", "symbol": "Pb", "resultText": "42", "unit": "µg/kg", "loqText": "10" }
  ]
}`;

const canonicalizeExample = `curl https://tecrid.com/api/v1/credentials/canonicalize \\
  -H "Authorization: Bearer $TEC_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${credentialBody}'`;

const createExample = `curl https://tecrid.com/api/v1/credentials \\
  -H "Authorization: Bearer $TEC_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sampleName": "Organic cacao powder",
    "lotNumber": "C-240518",
    "matrix": "Food · Powder",
    "method": "ICP-MS",
    "submittingParty": "Example Brand",
    "releasedAt": "2026-08-28",
    "sourceDocument": {
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "filename": "laboratory-report.pdf",
      "reportNumber": "LAB-240518"
    },
    "publish": true,
    "proof": {
      "keyId": "lab.example/key/2026-01",
      "algorithm": "Ed25519",
      "signature": "BASE64URL_SIGNATURE"
    },
    "results": [
      { "analyte": "Lead", "symbol": "Pb", "resultText": "42", "unit": "µg/kg", "loqText": "10" }
    ]
  }'`;

export default function DevelopersPage() {
  return (
    <main className="product-page developers-page">
      <ProductNav compact />
      <section className="product-hero api-hero">
        <p className="section-kicker light">TEC Registry API · v1</p>
        <h1>Canonicalize. Sign.<br />Issue. Resolve.</h1>
        <p>The documented routes below are implemented. Public issuance is rejected unless the payload verifies against the ICS-reviewed Ed25519 key for that laboratory.</p>
        <div className="api-status"><i /> Live service check <a href="/api/v1/health">Open health JSON ↗</a></div>
      </section>

      <section className="api-layout">
        <aside className="api-toc">
          <span>API reference</span>
          <a href="#authentication">Authentication</a>
          <a href="#canonicalize">Canonicalize</a>
          <a href="#create">Issue credential</a>
          <a href="#list">List credentials</a>
          <a href="#resolve">Resolve credential</a>
          <a href="#versions">Correct or revoke</a>
          <a href="#errors">Errors</a>
          <a className="button-dark" href="/dashboard#api-keys">Create an API key →</a>
        </aside>
        <div className="api-docs">
          <section id="authentication">
            <p className="doc-index">01 / AUTHENTICATION</p>
            <h2>Bearer keys, scoped to one organization.</h2>
            <p>Create a key inside your authenticated dashboard, store it in a secret manager, and pass it in the Authorization header. The registry displays each secret once and stores only its SHA-256 hash.</p>
            <pre><code>Authorization: Bearer tec_live_••••••••••••</code></pre>
          </section>
          <section id="canonicalize">
            <p className="doc-index">02 / CANONICALIZE</p>
            <h2>POST /api/v1/credentials/canonicalize</h2>
            <p>Normalizes the submitted evidence and returns the exact UTF-8 JSON string the laboratory must sign. Do not reserialize or reformat that string before signing.</p>
            <pre><code>{canonicalizeExample}</code></pre>
          </section>
          <section id="create">
            <p className="doc-index">03 / ISSUE</p>
            <h2>POST /api/v1/credentials</h2>
            <p>Creates a private draft when <code>publish</code> is false. Public issuance additionally requires verified laboratory status, a reviewed key, and a valid Ed25519 signature over the canonical payload. Successful issuance returns a permanent TECRID.</p>
            <p>For a historical PDF, include <code>sourceDocument</code>. Its SHA-256 fingerprint, report reference, submitting party, and release date become part of the signed payload; the private PDF itself is not exposed by the public API.</p>
            <pre><code>{createExample}</code></pre>
          </section>
          <section id="list">
            <p className="doc-index">04 / LIST</p>
            <h2>GET /api/v1/credentials</h2>
            <p>Returns up to 100 credentials for the organization associated with the bearer key, newest first.</p>
            <pre><code>curl https://tecrid.com/api/v1/credentials \
  -H &quot;Authorization: Bearer $TEC_API_KEY&quot;</code></pre>
          </section>
          <section id="resolve">
            <p className="doc-index">05 / RESOLVE</p>
            <h2>GET /api/v1/credentials/:identifier</h2>
            <p>Public, no API key required. Returns issuer status, sample context, results, current status, every recorded version, and an independently verifiable proof bundle: exact signed payload, Ed25519 signature, reviewed public key, key-review timestamp, and live fingerprint/signature checks.</p>
            <pre><code>curl https://tecrid.com/api/v1/credentials/TECRID%C2%B7YOUR-LAB-26-XXXXXXXX</code></pre>
          </section>
          <section id="versions">
            <p className="doc-index">06 / CORRECT OR REVOKE</p>
            <h2>POST /api/v1/credentials/:tecrid/versions</h2>
            <p>Corrections and revocations append a new signed version. They never erase the prior fingerprint. First post the proposed revision to <code>/:tecrid/canonicalize</code>, sign the returned payload, then submit the same revision with its proof.</p>
            <pre><code>{`{
  "action": "revoke",
  "reason": "Sample identity could not be sustained after chain-of-custody review.",
  "proof": {
    "keyId": "lab.example/key/2026-01",
    "algorithm": "Ed25519",
    "signature": "BASE64URL_SIGNATURE"
  }
}`}</code></pre>
          </section>
          <section id="errors">
            <p className="doc-index">07 / ERRORS</p>
            <h2>Stable, inspectable responses.</h2>
            <div className="error-table"><div><code>400</code><span>invalid_request</span><p>Required fields, result structure, revision reason, or proof shape is invalid.</p></div><div><code>403</code><span>not_authorized</span><p>The API key, issuer authority, reviewed signing key, or signature verification failed.</p></div><div><code>404</code><span>not_found</span><p>No public TECRID matches the identifier.</p></div></div>
          </section>
        </div>
      </section>
      <ProductFooter />
    </main>
  );
}
