import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";

export const metadata: Metadata = {
  title: "Laboratory Go-Time Pack — Test TECRID Today",
  description: "A same-day TECRID sandbox, API, issuance, evidence-lifecycle, and VLE handoff checklist for analytical laboratories.",
  alternates: { canonical: "https://tecrid.com/laboratory-go-time" },
};

const mintFlow = [
  ["Reserve", "Reserve the persistent identifier before the final report is rendered."],
  ["Render", "Print the TECRID and resolver URL on the laboratory-controlled report template."],
  ["Fingerprint", "Bind the exact final document to structured results, methods, dates, sample identifiers, lot or SKU context, and the source-document hash."],
  ["Sign", "Sign the exact canonical UTF-8 payload with the verified laboratory Ed25519 key."],
  ["Finalize", "Finalize the signed registry record so it can resolve, route, and later carry a correction or revocation without erasing history."],
];

const checklist = [
  ["Sandbox access", "Create or sign into a personal sandbox and create a revocable tec_sandbox_… key under API & integrations."],
  ["Issuer verification", "For production, submit legal identity, authority, competence or accreditation evidence, issuance scope, signing-key control, and conformance evidence. An account alone cannot issue live TECRIDs."],
  ["Configuration", "Use https://tecrid.com/api/sandbox/v1 for testing. Do not configure or guess a production endpoint or secret until TECRID supplies approved production credentials."],
  ["Report payload", "Prepare the currently supported report fields: sample name, product and matrix, lot or SKU, received/tested/released dates, methods, analytes, result text, units, qualifiers, detection limits, and the final document fingerprint. The VLE sampleCode remains part of the candidate handoff contract, not the live production issuance schema."],
  ["Dual ask with VLE", "Ask the customer both whether this result needs a TECRID and whether VLE independent sampling has already assigned a Sample code. Reuse the exact VLE Sample code; never imply that matching a code proves sampling or chain of custody."],
  ["Support", "Send the laboratory name, authorized contact, method family, proposed first customer workflow, and sandbox result to the Institute of Contaminant Standards."],
];

const sampleReportPayload = `{
  "sampleName": "Organic cacao powder",
  "productSku": "CACAO-12OZ",
  "lotNumber": "C-240518",
  "matrix": "Food · Powder",
  "method": "ICP-MS",
  "receivedAt": "2026-09-05",
  "testedAt": "2026-09-06",
  "releasedAt": "2026-09-07",
  "sourceDocument": {
    "sha256": "SHA256_OF_FINAL_TECRID_MARKED_PDF",
    "filename": "final-report.pdf",
    "reportNumber": "LAB-240518"
  },
  "results": [
    { "analyte": "Lead", "resultText": "42", "unit": "µg/kg", "loqText": "10" }
  ]
}`;

export default function LaboratoryGoTimePage() {
  return (
    <main className="product-page lab-gotime-page">
      <ProductNav compact />
      <section className="lab-gotime-hero">
        <div>
          <p className="section-kicker light">Lab go-time pack · sandbox first</p>
          <h1>If your laboratory says GO tomorrow, start here.</h1>
          <p>Run a sandbox issuance, authenticate a test API call, and exercise the candidate VLE sample-link contract today. Production authority remains locked until the laboratory passes every issuer-verification gate.</p>
          <div><a className="button-mint" href="/sandbox?role=laboratory&amp;section=integrations">Create a laboratory sandbox key →</a><a href="/join?role=laboratory">Create the real lab workspace →</a></div>
        </div>
        <aside><span>Same-day outcome</span><strong>One issued sandbox TECRID</strong><small>One authenticated scenario call · one sample-code match test · zero production claims</small></aside>
      </section>

      <section className="lab-gotime-definition">
        <div><p className="section-kicker">The object</p><h2>A TECRID is the record—not a label pasted onto a file.</h2></div>
        <div><p>A TECRID is a persistent identifier for a laboratory-issued, structured, signed, and versioned report record. It binds issuer identity, findings, sample context, document fingerprint, status, and lifecycle history to a resolvable registry entry.</p><div className="lab-gotime-warning"><strong>PDF/COA ≠ TECRID</strong><span>A PDF or Certificate of Analysis does not become a TECRID merely because an identifier or badge appears on it. The authenticated laboratory must finalize the canonical registry record.</span></div></div>
      </section>

      <section className="lab-gotime-flow">
        <div><p className="section-kicker light">Mint and authenticate</p><h2>From released result to maintained evidence.</h2><p>Correction and revocation do not erase an issued record. They append traceable status history. If replacement evidence receives a new TECRID, every downstream system must explicitly bind and evaluate the replacement.</p></div>
        <ol>{mintFlow.map(([title, copy], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><p>{copy}</p></div></li>)}</ol>
      </section>

      <section className="lab-gotime-sandbox">
        <div><p className="section-kicker">End-to-end sandbox</p><h2>Request. Issue. Call. Match.</h2><p>The test key is created inside your signed-in sandbox and shown once. Only its one-way hash is stored. It is limited to <code>/api/sandbox/v1/*</code> and cannot issue or read production records.</p></div>
        <ol>
          <li><span>01</span><div><strong>Request access and create a key</strong><p>Open the laboratory role directly at API &amp; integrations. Sign in, create a personal sandbox, and copy the <code>tec_sandbox_…</code> key when it is shown.</p><a href="/sandbox?role=laboratory&amp;section=integrations">Open laboratory API settings →</a></div></li>
          <li><span>02</span><div><strong>Issue the fictional sandbox record</strong><p>Use Evidence workflow to claim, confirm, and issue <code>SBX·NORTHSTAR-26-AVO8F2C1</code>. The fictional record has no production authority.</p><a href="/sandbox?role=laboratory&amp;section=evidence">Run the issuance flow →</a></div></li>
          <li><span>03</span><div><strong>Make an authenticated test call</strong><pre><code>{`curl "https://tecrid.com/api/sandbox/v1/scenario" \\\n  -H "Authorization: Bearer $TECRID_SANDBOX_KEY"`}</code></pre></div></li>
          <li><span>04</span><div><strong>Test the VLE sample-code match</strong><pre><code>{`curl --get "https://tecrid.com/api/sandbox/v1/vle-evidence" \\\n  -H "Authorization: Bearer $TECRID_SANDBOX_KEY" \\\n  --data-urlencode "tecridId=SBX·NORTHSTAR-26-AVO8F2C1" \\\n  --data-urlencode "expectedSampleCode=VLE-SAMPLE-AVO-260812-A"`}</code></pre><p>The endpoint returns the candidate evidence envelope only after sandbox issuance and only when the expected Sample code matches.</p></div></li>
        </ol>
      </section>

      <section className="lab-gotime-vle">
        <div><p className="section-kicker light">TECRID × VLE</p><h2>Link evidence to the sample. Keep the claims separate.</h2><p>VLE owns the PhysicalLot, SamplingOrder, Sample, qualification profile, decision, and listing. The candidate contract asks TECRID to authenticate the evidence envelope and its laboratory-declared <code>sampleCode</code>; VLE then compares that value with its existing Sample before evaluation. This contract is sandbox-only today. Production schema and adapter activation require joint approval.</p></div>
        <div className="lab-gotime-contract">
          <div><span>Request</span><code>{`{ tecridId, expectedSampleCode }`}</code></div>
          <div><span>TECRID response</span><code>{`{ tecridId, sampleCode, issuer, status, results, payloadHash, authentication }`}</code></div>
          <div><span>Boundary</span><strong>A matching code links two records. It does not prove representative sampling, custody, analytical correctness, certification, or qualification.</strong></div>
          <div><span>VLE decision</span><strong>VLE QUALIFIED is a separate deterministic outcome. It must never appear without authenticated TECRID-linked evidence and every applicable VLE requirement.</strong></div>
        </div>
        <div className="lab-gotime-vle-links"><a href="https://vle-navy.vercel.app/for-laboratories" target="_blank" rel="noreferrer">Open the current VLE laboratory page ↗</a><a href="https://vle.exchange/for-laboratories" target="_blank" rel="noreferrer">vle.exchange laboratory page · use after domain cutover ↗</a></div>
      </section>

      <section className="lab-gotime-checklist">
        <div><p className="section-kicker">Lab says GO tomorrow</p><h2>Six checks before the first live report.</h2></div>
        <ol>{checklist.map(([title, copy], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><p>{copy}</p>{title === "Report payload" ? <><pre><code>{sampleReportPayload}</code></pre><p><a href="/developers#report-mark">Open the implemented reserve and finalize reference →</a></p></> : null}{title === "Support" ? <p><a href="https://contaminantstandards.com/contact" target="_blank" rel="noreferrer">ICS contact page ↗</a> · <a href="mailto:karen@paleofoundation.com">karen@paleofoundation.com</a></p> : null}</div></li>)}</ol>
      </section>

      <section className="role-cta"><div><p className="section-kicker light">Test before production</p><h2>Prove the handoff with one fictional record.</h2><p>The sandbox proves integration behavior only. It does not verify a real laboratory, certify a report, grant production authority, or create VLE QUALIFIED status.</p></div><a href="/sandbox?role=laboratory&amp;section=integrations">Start the lab sandbox <span>↗</span></a></section>
      <ProductFooter />
    </main>
  );
}
