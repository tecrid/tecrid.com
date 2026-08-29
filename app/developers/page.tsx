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
    "productSku": "CACAO-12OZ",
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

const controlledRoutingExample = `curl https://tecrid.com/api/v1/credentials \\
  -H "Authorization: Bearer $LAB_TEC_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sampleName": "Organic cacao powder",
    "productSku": "CACAO-12OZ",
    "lotNumber": "C-240518",
    "visibility": "controlled",
    "publish": true,
    "routingToken": "tec_route_••••••••••••",
    "proof": {
      "keyId": "lab.example/key/2026-01",
      "algorithm": "Ed25519",
      "signature": "BASE64URL_SIGNATURE"
    },
    "results": [
      { "analyte": "Lead", "resultText": "42", "unit": "µg/kg" }
    ]
  }'`;

const reserveReportExample = `curl https://tecrid.com/api/v1/report-reservations \\
  -H "Authorization: Bearer $LAB_TEC_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "productName": "Organic cacao powder",
    "productSku": "CACAO-12OZ",
    "laboratoryReportNumber": "LAB-240518",
    "sourceSystem": "labware",
    "routingToken": "tec_route_••••••••••••"
  }'`;

const finalizeReportExample = `curl https://tecrid.com/api/v1/report-reservations/$RESERVATION_ID/finalize \\
  -H "Authorization: Bearer $LAB_TEC_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sampleName": "Organic cacao powder",
    "productSku": "CACAO-12OZ",
    "visibility": "controlled",
    "publish": true,
    "sourceDocument": {
      "sha256": "SHA256_OF_FINAL_TECRID_MARKED_PDF",
      "filename": "final-report.pdf",
      "reportNumber": "LAB-240518"
    },
    "proof": {
      "keyId": "lab.example/key/2026-01",
      "algorithm": "Ed25519",
      "signature": "BASE64URL_SIGNATURE"
    },
    "results": [
      { "analyte": "Lead", "resultText": "42", "unit": "µg/kg" }
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
          <a href="#issuer-onboarding">Issuer onboarding</a>
          <a href="#canonicalize">Canonicalize</a>
          <a href="#report-mark">Print TECRID on report</a>
          <a href="#create">Issue credential</a>
          <a href="#list">List credentials</a>
          <a href="#resolve">Resolve credential</a>
          <a href="#versions">Correct or revoke</a>
          <a href="#controlled-routing">Controlled routing</a>
          <a href="#share-codes">Share-code redemption</a>
          <a href="#certification-intake">Certification intake</a>
          <a href="#legacy-api">Legacy reports</a>
          <a href="#insights">Portfolio insights</a>
          <a href="#connectors">LIMS connector profiles</a>
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
          <section id="issuer-onboarding">
            <p className="doc-index">01A / ISSUER ONBOARDING</p>
            <h2>Five gates before production issuance.</h2>
            <p>A laboratory account begins unverified. ICS records legal identity and authority, accreditation or comparable competence evidence, the approved method and matrix scope, private-key control, and TECRID signing conformance as separate checks. The final approval endpoint remains locked until all five pass.</p>
            <p>Key control and conformance use a single-use, 15-minute canonical challenge. The laboratory signs the exact UTF-8 payload with the Ed25519 private key corresponding to its submitted public JWK. Private keys never go to TECRID.</p>
            <pre><code>{`POST /api/issuer-application/key-challenge

POST /api/issuer-application/key-challenge/verify
Content-Type: application/json

{
  "challengeId": "issuer_challenge_…",
  "signature": "BASE64URL_ED25519_SIGNATURE"
}`}</code></pre>
            <p>Successful challenge verification proves the key relationship and the required signing format. It does not approve laboratory identity, competence, or analytical scope; those remain independent ICS review decisions.</p>
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
          <section id="report-mark">
            <p className="doc-index">03A / REPORT MARK</p>
            <h2>Reserve. Render. Fingerprint. Sign. Finalize.</h2>
            <p>A laboratory cannot add an identifier after hashing the final PDF. Reserve the TECRID first, place the returned human-readable identifier and resolver URL or QR data into the report template, then hash and sign that finished PDF during finalization.</p>
            <h3>POST /api/v1/report-reservations</h3>
            <pre><code>{reserveReportExample}</code></pre>
            <p>The response includes <code>reportMark.templateFields.tecrid_identifier</code>, <code>tecrid_resolver_url</code>, and <code>qrData</code>. Before finalization, the resolver shows an explicit reserved—not issued—state.</p>
            <h3>POST /api/v1/report-reservations/:id/finalize</h3>
            <pre><code>{finalizeReportExample}</code></pre>
            <p>Successful finalization issues the preprinted TECRID, preserves the final PDF fingerprint in the signed payload, creates the brand or supplier&apos;s full controller receipt, and fans out narrower packages to any active certifier, retailer, or government grants.</p>
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
            <p>Public, no API key required. A public credential returns its results and complete proof bundle. A controlled credential returns only its resolver envelope—issuer, status, fingerprint, and version metadata—while results, canonical payloads, and signed payload remain withheld.</p>
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
          <section id="controlled-routing">
            <p className="doc-index">07 / CONTROLLED ROUTING</p>
            <h2>Issue once. Deliver only to active grants.</h2>
            <p>A certifier, retailer, or government workspace requests a SKU and result scope. The brand or ingredient supplier may approve a narrower grant, then creates a show-once <code>tec_route_…</code> token for one verified laboratory. TECRID stores only its SHA-256 hash.</p>
            <p>The laboratory can attach the token to controlled issuance. The registry verifies the laboratory signature, finds the active recipient grants for that SKU, and freezes a separate fingerprinted view for each recipient.</p>
            <pre><code>{controlledRoutingExample}</code></pre>
            <h3>POST /api/v1/routing/deliveries · retry without reissuing</h3>
            <pre><code>{`curl https://tecrid.com/api/v1/routing/deliveries \\
  -H "Authorization: Bearer $BRAND_ROUTING_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "tecrid": "TECRID·LAB-26-000001" }'`}</code></pre>
            <h3>GET /api/v1/routing/deliveries · receive routed evidence</h3>
            <pre><code>{`curl https://tecrid.com/api/v1/routing/deliveries \\
  -H "Authorization: Bearer $RECIPIENT_TEC_API_KEY"`}</code></pre>
            <p>The recipient response contains only deliveries in which its organization is a party. Revocation blocks future delivery; it does not erase a package already received and relied upon.</p>
          </section>
          <section id="certification-intake">
            <p className="doc-index">08 / CERTIFICATION INTAKE</p>
            <h2>POST /api/v1/certification/submissions</h2>
            <p>A certification organization creates a program-scoped intake secret in its dashboard and gives it to an applicant&apos;s system. The endpoint resolves every TECRID, blocks samples and incomplete authority, freezes each accepted public record version, and returns one package fingerprint.</p>
            <pre><code>{`curl https://tecrid.com/api/v1/certification/submissions \\
  -H "Authorization: Bearer $TECRID_INTAKE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "applicantOrganization": "Example Brand",
    "applicantName": "Quality Lead",
    "applicantEmail": "quality@example.com",
    "submissionReference": "CERT-2026-41",
    "tecrids": ["TECRID·LAB-26-000001"]
  }'`}</code></pre>
            <p>The token begins <code>tec_intake_</code>, is displayed once, and is stored by TECRID only as a SHA-256 hash. Passing the intake gate does not award certification.</p>
          </section>
          <section id="share-codes">
            <p className="doc-index">08A / SHARE-CODE REDEMPTION</p>
            <h2>POST /api/v1/share-codes/redeem</h2>
            <p>A brand or supplier creates a one-time code addressed to one named certification body, retailer, or government workspace. The recipient redeems the code with its public organization code. The response is a frozen structured package plus a package fingerprint. A retry by the same named recipient returns the existing receipt rather than creating a second delivery.</p>
            <pre><code>{`curl https://tecrid.com/api/v1/share-codes/redeem \
  -H "Content-Type: application/json" \
  -d '{
    "code": "tec_share_••••••••••••",
    "recipientOrganizationCode": "HMTC"
  }'`}</code></pre>
            <p>Codes are high-entropy bearer credentials, recipient-bound, expiring, revocable before use, and consumed after the first successful redemption. Raw report files and onward sharing are excluded from the package.</p>
          </section>
          <section id="legacy-api">
            <p className="doc-index">09 / LEGACY REPORTS</p>
            <h2>POST /api/v1/legacy-reports</h2>
            <p>Upload an existing private PDF with multipart form data, its transcribed results JSON, the named laboratory, and the laboratory confirmation contact. The API returns a private intake id, source fingerprint, and confirmation path. Uploading never creates a TECRID by itself.</p>
            <pre><code>{`curl https://tecrid.com/api/v1/legacy-reports \\
  -H "Authorization: Bearer $BRAND_TEC_API_KEY" \\
  -F "document=@report.pdf;type=application/pdf" \\
  -F "laboratoryName=Example Analytical" \\
  -F "confirmationEmail=quality@example-lab.com" \\
  -F "sampleName=Organic cacao powder" \\
  -F 'results=[{"analyte":"Lead","resultText":"42","unit":"µg/kg"}]' \\
  -F "attested=on"`}</code></pre>
          </section>
          <section id="insights">
            <p className="doc-index">10 / INSIGHTS</p>
            <h2>GET /api/v1/insights</h2>
            <p>Returns deterministic summaries across TECRIDs the organization issued or was authorized to receive: distinct records, result rows, SKU coverage, analyte counts, missing requested analytes, and the exact source TECRID behind every latest value. It does not infer safety, compliance, or comparability across units or methods.</p>
          </section>
          <section id="connectors">
            <p className="doc-index">11 / CONNECTOR PROFILES</p>
            <h2>Start with a report-release hook, not a LIMS replacement.</h2>
            <p>The TECRID Connect starter includes configuration profiles for LabWare, LabVantage, and STARLIMS plus generic JSON and CSV. These profiles map each system&apos;s release event and report-template fields to the same reserve/finalize protocol. They are implementation starters, not vendor-certified integrations.</p>
            <p><a className="button-dark" href="https://github.com/tecrid/tecrid-connect">Open the public TECRID Connect repository ↗</a></p>
            <p>The repository is the canonical starting point for labs, brands, suppliers, retailers, and certification programs. It includes role-specific setup, report reservation and finalization examples, connector profiles, signing utilities, and deployment-safe environment guidance. A versioned ZIP remains available for offline review.</p>
            <p><a href="/downloads/tecrid-connect.zip">Download the current ZIP snapshot →</a></p>
            <p>Outbound email is not yet a production claim. In-product notifications and controller receipts are live; email delivery still requires a configured sending provider and deliverability controls.</p>
          </section>
          <section id="errors">
            <p className="doc-index">12 / ERRORS</p>
            <h2>Stable, inspectable responses.</h2>
            <div className="error-table"><div><code>400</code><span>invalid_request</span><p>Required fields, result structure, revision reason, or proof shape is invalid.</p></div><div><code>403</code><span>not_authorized</span><p>The API key, issuer authority, reviewed signing key, or signature verification failed.</p></div><div><code>404</code><span>not_found</span><p>No public TECRID matches the identifier.</p></div></div>
          </section>
        </div>
      </section>
      <ProductFooter />
    </main>
  );
}
