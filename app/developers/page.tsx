import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";

export const metadata: Metadata = {
  title: "TEC Network API",
  description: "Create and resolve Test Evidence Credentials through the TEC Network API.",
};

const createExample = `curl https://tec-registry.kmfp.chatgpt.site/api/v1/credentials \\
  -H "Authorization: Bearer $TEC_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sampleName": "Organic cacao powder",
    "lotNumber": "C-240518",
    "matrix": "Food · Powder",
    "method": "ICP-MS",
    "publish": false,
    "results": [
      { "analyte": "Lead", "symbol": "Pb", "resultText": "42", "unit": "µg/kg", "loqText": "10" }
    ]
  }'`;

export default function DevelopersPage() {
  return (
    <main className="product-page developers-page">
      <ProductNav compact />
      <section className="product-hero api-hero">
        <p className="section-kicker light">TEC Network API · v1</p>
        <h1>Evidence should be<br />machine-readable first.</h1>
        <p>Create structured laboratory records, retrieve your organization’s credentials, and resolve every public TEC through predictable JSON endpoints.</p>
        <div className="api-status"><i /> All v1 systems operational <a href="/api/v1/health">View health JSON ↗</a></div>
      </section>

      <section className="api-layout">
        <aside className="api-toc">
          <span>API reference</span>
          <a href="#authentication">Authentication</a>
          <a href="#create">Create credential</a>
          <a href="#list">List credentials</a>
          <a href="#resolve">Resolve credential</a>
          <a href="#errors">Errors</a>
          <a className="button-dark" href="/dashboard#api-keys">Create an API key →</a>
        </aside>
        <div className="api-docs">
          <section id="authentication">
            <p className="doc-index">01 / AUTHENTICATION</p>
            <h2>Bearer keys, scoped to one organization.</h2>
            <p>Create a key inside your authenticated dashboard, store it in a secret manager, and pass it in the Authorization header. TEC displays each secret once and stores only its SHA-256 hash.</p>
            <pre><code>Authorization: Bearer tec_live_••••••••••••</code></pre>
          </section>
          <section id="create">
            <p className="doc-index">02 / CREATE</p>
            <h2>POST /api/v1/credentials</h2>
            <p>Creates a structured credential owned by the authenticated organization. Unverified issuers may create drafts. Only an ICS-verified laboratory may set <code>publish</code> to true.</p>
            <pre><code>{createExample}</code></pre>
          </section>
          <section id="list">
            <p className="doc-index">03 / LIST</p>
            <h2>GET /api/v1/credentials</h2>
            <p>Returns up to 100 credentials for the organization associated with the bearer key, newest first.</p>
            <pre><code>curl https://tec-registry.kmfp.chatgpt.site/api/v1/credentials \
  -H &quot;Authorization: Bearer $TEC_API_KEY&quot;</code></pre>
          </section>
          <section id="resolve">
            <p className="doc-index">04 / RESOLVE</p>
            <h2>GET /api/v1/credentials/:identifier</h2>
            <p>Public, no API key required. Returns the issuer, sample context, results, current version, and fingerprint for any issued TEC.</p>
            <pre><code>curl https://tec-registry.kmfp.chatgpt.site/api/v1/credentials/TEC%C2%B7GLP-26-7F3A92</code></pre>
          </section>
          <section id="errors">
            <p className="doc-index">05 / ERRORS</p>
            <h2>Stable, inspectable responses.</h2>
            <div className="error-table"><div><code>400</code><span>invalid_request</span><p>Required fields or result structure are invalid.</p></div><div><code>403</code><span>not_authorized</span><p>The key is missing, revoked, or lacks issuer authority.</p></div><div><code>404</code><span>not_found</span><p>No public credential matches the identifier.</p></div></div>
          </section>
        </div>
      </section>
      <ProductFooter />
    </main>
  );
}
