import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";
import {
  ICS_ORGANIZATION_ID,
  TECRID_SERVICE_ID,
  TECRID_WEBSITE_ID,
} from "../../lib/entity-graph";

export const metadata: Metadata = {
  title: "TECRID API and Integration",
  description: "Integrate TECRID with a LIMS, brand portal, retailer system, or certification program through the implemented v1 API and agent-guided connector.",
  alternates: { canonical: "https://tecrid.com/developers" },
};

const developersJsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "@id": "https://tecrid.com/developers#documentation",
  name: "TECRID API and Integration",
  headline: "TECRID API and Integration",
  description: "Implemented v1 API documentation for issuing, resolving, correcting, revoking, and routing TECRID laboratory evidence records.",
  url: "https://tecrid.com/developers",
  inLanguage: "en",
  isAccessibleForFree: true,
  publisher: { "@id": ICS_ORGANIZATION_ID },
  isPartOf: { "@id": TECRID_WEBSITE_ID },
  about: { "@id": TECRID_SERVICE_ID },
  dependencies: "TECRID Connect",
  codeRepository: "https://github.com/tecrid/tecrid-connect",
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
  -H "Authorization: Bearer $TECRID_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${credentialBody}'`;

const createExample = `curl https://tecrid.com/api/v1/credentials \\
  -H "Authorization: Bearer $TECRID_API_KEY" \\
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
  -H "Authorization: Bearer $LAB_TECRID_API_KEY" \\
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
  -H "Authorization: Bearer $LAB_TECRID_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "productName": "Organic cacao powder",
    "productSku": "CACAO-12OZ",
    "laboratoryReportNumber": "LAB-240518",
    "sourceSystem": "labware",
    "routingToken": "tec_route_••••••••••••"
  }'`;

const finalizeReportExample = `curl https://tecrid.com/api/v1/report-reservations/$RESERVATION_ID/finalize \\
  -H "Authorization: Bearer $LAB_TECRID_API_KEY" \\
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(developersJsonLd).replaceAll("<", "\\u003c") }} />
      <section className="product-hero api-hero">
        <p className="section-kicker light">TECRID API · v1</p>
        <h1>Canonicalize. Sign.<br />Issue. Resolve.</h1>
        <p>The documented routes below are implemented. Public issuance is rejected unless the payload verifies against the ICS-reviewed Ed25519 key for that laboratory.</p>
        <div className="api-status"><i /> Live service check <a href="/api/v1/health">Open health JSON ↗</a></div>
      </section>

      <section className="api-agent-onboarding" id="agent-setup">
        <div><p className="section-kicker">Fastest implementation path</p><h2>Open the repository. Type <code>integrate</code>.</h2><p>The checked-in Codex and Claude Code instructions inspect the target stack, create a secret-free setup outline, implement the smallest compatible connection, run tests, and leave a durable integration report. People retain control of identity, credentials, disclosure, deployment, and production writes.</p></div>
        <div><a className="button-dark" href="/integrate">Read the four-step setup →</a><a href="https://github.com/tecrid/tecrid-connect" target="_blank" rel="noreferrer">Open TECRID Connect on GitHub ↗</a><a href="/downloads/tecrid-connect.zip" download>Download the current ZIP ↓</a></div>
      </section>

      <section className="api-layout">
        <aside className="api-toc">
          <span>API reference</span>
          <a href="#agent-setup">Agent-guided setup</a>
          <a href="#authentication">Authentication</a>
          <a href="#issuer-onboarding">Issuer onboarding</a>
          <a href="#canonicalize">Canonicalize</a>
          <a href="#report-mark">Print TECRID on report</a>
          <a href="#create">Issue credential</a>
          <a href="#batch">Batch issuance</a>
          <a href="#list">List credentials</a>
          <a href="#resolve">Resolve credential</a>
          <a href="#versions">Correct or revoke</a>
          <a href="#controlled-routing">Controlled routing</a>
          <a href="#share-codes">Share-code redemption</a>
          <a href="#certification-intake">Certification intake</a>
          <a href="#legacy-api">Legacy reports</a>
          <a href="#backfill">Backfill past reports</a>
          <a href="#insights">Portfolio insights</a>
          <a href="#connectors">LIMS connector profiles</a>
          <a href="#errors">Errors</a>
          <a className="button-dark" href="/dashboard#api-keys">Create an API key →</a>
        </aside>
        <div className="api-docs">
          <section id="authentication">
            <p className="doc-index">01 / AUTHENTICATION</p>
            <h2>Bearer keys, scoped to one organization.</h2>
            <p>Create a key inside your authenticated dashboard, store it in a secret manager, and pass it in the Authorization header. TECRID displays each secret once and stores only its SHA-256 hash.</p>
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
          <section id="batch">
            <p className="doc-index">03B / BATCH</p>
            <h2>POST /api/v1/credentials/batch</h2>
            <p>Send up to 500 credential payloads in one call. Each item uses the same validation and Ed25519 signature check as a single issuance. The call can succeed for some items and fail for others. A repeated <code>reportId</code> or <code>sampleId</code> returns the existing TECRID and does not create a duplicate.</p>
            <p>Limit: 500 credentials per call, 10 calls per minute for each laboratory, and a 2 MB JSON body. For 10,000 or more, split the work into chunks of 500. Retries are safe because the laboratory report or sample ID is the idempotency key. Set <code>async</code> to true when you want a job id you can read again. Each job is still one chunk of 500.</p>
            <p><code>laboratorySite</code> is compared with the sites on the certificate. A report from a site that is not covered is not labeled accredited. An analyte that is outside the accredited scope is still issued and marked <code>Not on the accredited scope.</code> TECRID does not decide whether a result is acceptable.</p>
            <pre><code>{`curl https://tecrid.com/api/v1/credentials/batch \\
  -H "Authorization: Bearer $TECRID_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "credentials": [
      {
        "reportId": "LL-240518",
        "sampleId": "S-240518",
        "laboratorySite": "Ann Arbor, MI",
        "sampleName": "Olive oil",
        "lotNumber": "LOT-240518",
        "matrix": "Olive oil",
        "method": "ICP-MS",
        "releasedAt": "2026-08-28",
        "publish": true,
        "sourceDocument": {
          "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          "filename": "LL-240518.pdf",
          "reportNumber": "LL-240518"
        },
        "proof": {
          "keyId": "lab.example/key/2026-01",
          "algorithm": "Ed25519",
          "signature": "BASE64URL_SIGNATURE"
        },
        "results": [
          { "analyte": "Lead", "resultText": "0.02", "unit": "mg/kg" }
        ]
      }
    ]
  }'`}</code></pre>
            <p>Each result is <code>created</code>, <code>existing</code>, or <code>error</code> with a reason. Read a stored chunk with <code>GET /api/v1/credentials/batch/jobs/:jobId</code>.</p>
            <pre><code>{`# 10,000 credentials: 20 files of 500. Pause after each 10 calls.
i=0
for f in chunks/chunk-*.json; do
  curl -sS https://tecrid.com/api/v1/credentials/batch \\
    -H "Authorization: Bearer $TECRID_API_KEY" \\
    -H "Content-Type: application/json" \\
    --data-binary @"$f"
  i=$((i+1))
  if [ $((i % 10)) -eq 0 ]; then sleep 60; fi
done`}</code></pre>
            <p>Add <code>&quot;async&quot;: true</code> next to the credentials array when you want HTTP 202 and a job id. Poll <code>GET /api/v1/credentials/batch/jobs/:jobId</code> with the same bearer key. The job still holds at most 500 credentials.</p>
          </section>
          <section id="report-mark">
            <p className="doc-index">03A / REPORT MARK</p>
            <h2>Reserve. Render. Fingerprint. Sign. Finalize.</h2>
            <p>A laboratory cannot add an identifier after hashing the final PDF. Reserve the TECRID first, place the returned human-readable identifier and resolver URL or QR data into the report template, then hash and sign that finished PDF during finalization.</p>
            <h3>POST /api/v1/report-reservations</h3>
            <pre><code>{reserveReportExample}</code></pre>
            <p>The response includes <code>reportMark.templateFields.tecrid_identifier</code>, <code>tecrid_resolver_url</code>, and <code>qrData</code>. Before finalization, the resolver shows an explicit reserved state that has not been issued.</p>
            <h3>POST /api/v1/report-reservations/:id/finalize</h3>
            <pre><code>{finalizeReportExample}</code></pre>
            <p>Successful finalization issues the preprinted TECRID, preserves the final PDF fingerprint in the signed payload, creates the brand or supplier&apos;s full controller receipt, and fans out narrower packages to any active certifier, retailer, or government grants.</p>
          </section>
          <section id="list">
            <p className="doc-index">04 / LIST</p>
            <h2>GET /api/v1/credentials</h2>
            <p>Returns up to 100 credentials for the organization associated with the bearer key, newest first.</p>
            <pre><code>curl https://tecrid.com/api/v1/credentials \
  -H &quot;Authorization: Bearer $TECRID_API_KEY&quot;</code></pre>
          </section>
          <section id="resolve">
            <p className="doc-index">05 / RESOLVE</p>
            <h2>GET /api/v1/credentials/:identifier</h2>
            <p>Public, no API key required. A public credential returns its results and complete proof bundle. A controlled credential returns only its resolver envelope, including issuer, status, fingerprint, and version metadata, while results, canonical payloads, and signed payload remain withheld.</p>
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
            <p>The laboratory can attach the token to controlled issuance. TECRID verifies the laboratory signature, finds the active recipient grants for that SKU, and freezes a separate fingerprinted view for each recipient.</p>
            <pre><code>{controlledRoutingExample}</code></pre>
            <h3>POST /api/v1/routing/deliveries · retry without reissuing</h3>
            <pre><code>{`curl https://tecrid.com/api/v1/routing/deliveries \\
  -H "Authorization: Bearer $BRAND_ROUTING_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "tecrid": "TECRID·LAB-26-000001" }'`}</code></pre>
            <h3>GET /api/v1/routing/deliveries · receive routed evidence</h3>
            <pre><code>{`curl https://tecrid.com/api/v1/routing/deliveries \\
  -H "Authorization: Bearer $RECIPIENT_TECRID_API_KEY"`}</code></pre>
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
  -H "Authorization: Bearer $BRAND_TECRID_API_KEY" \\
  -F "document=@report.pdf;type=application/pdf" \\
  -F "laboratoryName=Example Analytical" \\
  -F "confirmationEmail=quality@example-lab.com" \\
  -F "sampleName=Organic cacao powder" \\
  -F 'results=[{"analyte":"Lead","resultText":"42","unit":"µg/kg"}]' \\
  -F "attested=on"`}</code></pre>
          </section>
          <section id="backfill">
            <p className="doc-index">09A / BACKFILL</p>
            <h2>POST /api/v1/legacy-reports/batch</h2>
            <p>A verified laboratory can import past reports as a JSON manifest, a CSV manifest, or PDF URLs plus SHA-256. The original report date is kept, and the record is marked backfilled. The same PDF SHA-256 returns the existing record. The response includes the exact canonical payload to sign. Add that signature on a retry, or post the returned credential to the batch issuance endpoint.</p>
            <p>Limit: 25 reports per call, 20 MB per PDF, and 10 calls per minute for each laboratory. For a larger history, send the next chunk. PDF URLs must be public https addresses.</p>
            <pre><code>{`curl https://tecrid.com/api/v1/legacy-reports/batch \\
  -H "Authorization: Bearer $TECRID_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      {
        "reportId": "LL-2024-100",
        "sampleId": "S-100",
        "sampleName": "Olive oil",
        "originalReportDate": "2024-03-15",
        "laboratorySite": "Ann Arbor, MI",
        "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "filename": "LL-2024-100.pdf",
        "pdfUrl": "https://reports.example/LL-2024-100.pdf",
        "results": [
          { "analyte": "Lead", "resultText": "0.01", "unit": "mg/kg" }
        ]
      }
    ]
  }'`}</code></pre>
            <pre><code>{`curl https://tecrid.com/api/v1/legacy-reports/batch \\
  -H "Authorization: Bearer $TECRID_API_KEY" \\
  -F "manifest=@manifest.json;type=application/json" \\
  -F "document=@LL-2024-100.pdf;type=application/pdf"`}</code></pre>
            <p>A CSV manifest uses one row per analyte and groups rows that share a <code>sha256</code>. Columns: <code>reportId,sampleId,sampleName,originalReportDate,laboratorySite,sha256,filename,pdfUrl,lotNumber,matrix,method,analyte,resultText,unit</code>.</p>
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
            <p><a href="https://github.com/tecrid/tecrid-specification" target="_blank" rel="noreferrer">Read the versioned TECRID specification and JSON Schemas ↗</a></p>
            <p><a href="https://doi.org/10.5281/zenodo.22232196" target="_blank" rel="noreferrer">Cite the TECRID Specification v0.1.0 on Zenodo ↗</a></p>
            <p><a href="https://doi.org/10.5281/zenodo.22232195" target="_blank" rel="noreferrer">Reference the TECRID Specification across all versions ↗</a></p>
            <p>The repository is the canonical starting point for labs, brands, suppliers, retailers, and certification programs. It includes role-specific setup, report reservation and finalization examples, connector profiles, signing utilities, and deployment-safe environment guidance. A versioned ZIP remains available for offline review.</p>
            <p><a href="/downloads/tecrid-connect.zip">Download the current ZIP snapshot →</a></p>
            <p>Outbound email is not yet a production claim. In-product notifications and controller receipts are live; email delivery still requires a configured sending provider and deliverability controls.</p>
          </section>
          <section id="errors">
            <p className="doc-index">12 / ERRORS</p>
            <h2>Stable, inspectable responses.</h2>
            <div className="error-table"><div><code>400</code><span>invalid_request</span><p>Required fields, result structure, revision reason, or proof shape is invalid. A batch above 500 credentials or a backfill above 25 reports is rejected before any item is written.</p></div><div><code>403</code><span>not_authorized</span><p>The API key, issuer authority, reviewed signing key, or signature verification failed.</p></div><div><code>404</code><span>not_found</span><p>No public TECRID matches the identifier.</p></div><div><code>429</code><span>rate_limited</span><p>The laboratory sent more batch or backfill calls than the limit. Wait and retry. Repeated report IDs, sample IDs, and PDF fingerprints return the existing record.</p></div></div>
          </section>
        </div>
      </section>
      <ProductFooter />
    </main>
  );
}
