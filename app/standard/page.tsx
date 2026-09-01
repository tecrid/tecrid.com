import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";
import {
  ICS_ORGANIZATION_ID,
  KAREN_PERSON_ID,
  TECRID_SERVICE_ID,
  TECRID_SPECIFICATION_CONCEPT_DOI,
  TECRID_SPECIFICATION_CONCEPT_DOI_URL,
  TECRID_SPECIFICATION_DOI,
  TECRID_SPECIFICATION_DOI_URL,
  TECRID_SPECIFICATION_REPOSITORY_URL,
  TECRID_WEBSITE_ID,
} from "../../lib/entity-graph";

const canonicalUrl = "https://tecrid.com/standard";

export const metadata: Metadata = {
  title: "TEC Registry standard — Draft 1.0",
  description: "The public technical and governance contract for TEC credentials and TECRIDs.",
  alternates: { canonical: canonicalUrl },
};

const standardJsonLd = {
  "@context": "https://schema.org",
  "@type": ["CreativeWork", "TechArticle"],
  "@id": `${canonicalUrl}#standard`,
  name: "TEC Registry standard — Draft 1.0",
  headline: "A public contract for analytical evidence",
  description: "The public technical and governance contract for TEC credentials and TECRIDs.",
  url: canonicalUrl,
  identifier: [
    {
      "@type": "PropertyValue",
      propertyID: "DOI",
      value: TECRID_SPECIFICATION_DOI,
      url: TECRID_SPECIFICATION_DOI_URL,
    },
    {
      "@type": "PropertyValue",
      propertyID: "Zenodo concept DOI",
      value: TECRID_SPECIFICATION_CONCEPT_DOI,
      url: TECRID_SPECIFICATION_CONCEPT_DOI_URL,
    },
  ],
  sameAs: [
    TECRID_SPECIFICATION_DOI_URL,
    TECRID_SPECIFICATION_CONCEPT_DOI_URL,
    TECRID_SPECIFICATION_REPOSITORY_URL,
  ],
  citation: TECRID_SPECIFICATION_DOI_URL,
  version: "1.0-draft",
  inLanguage: "en",
  isAccessibleForFree: true,
  author: { "@id": KAREN_PERSON_ID },
  publisher: { "@id": ICS_ORGANIZATION_ID },
  isPartOf: { "@id": TECRID_WEBSITE_ID },
  about: { "@id": TECRID_SERVICE_ID },
  license: "https://spdx.org/licenses/MIT.html",
};

const requirements = [
  ["Permanent identity", "A TECRID is opaque, globally unique, never reassigned, and remains resolvable after correction or revocation."],
  ["Issuer attribution", "Every public record identifies an ICS-reviewed laboratory issuer and the scope under which it may issue."],
  ["Signed payload", "Publication requires an Ed25519 signature that verifies against the issuer key reviewed by ICS."],
  ["Append-only versions", "Corrections and revocations append a signed version; database triggers reject updates or deletion of prior version rows."],
  ["Structured evidence", "Results preserve analytes, reported values, units, limits, methods, sample context, and timestamps as issued."],
  ["Interpretation boundary", "A TEC proves attribution, integrity, and status—not representative sampling, regulatory compliance, or safety."],
];

export default function StandardPage() {
  return (
    <main className="product-page standard-page">
      <ProductNav compact />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(standardJsonLd).replaceAll("<", "\\u003c") }} />
      <header className="product-hero standard-hero">
        <p className="section-kicker light">TEC Protocol · Draft 1.0</p>
        <h1>A public contract<br />for analytical evidence.</h1>
        <p>The standard separates what the registry can verify from what remains an analytical, accreditation, sampling, or regulatory judgment.</p>
        <div className="draft-standard-badge"><i /> Public draft · implementations must not claim final conformance</div>
      </header>
      <section className="standard-requirements">
        <div><p className="section-kicker">Normative core</p><h2>Six non-negotiable properties.</h2><p>These properties define the minimum credible TEC. Extensions may add fields; they may not weaken provenance or erase history.</p></div>
        <ol>{requirements.map(([title, copy], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><p>{copy}</p></div></li>)}</ol>
      </section>
      <section className="trust-model">
        <div><p className="section-kicker light">Trust model</p><h2>Three different checks.<br />Never collapse them.</h2></div>
        <div className="trust-model-grid">
          <article><span>01</span><strong>Issuer authorization</strong><p>May this laboratory issue this type of evidence under its reviewed scope?</p></article>
          <article><span>02</span><strong>Cryptographic integrity</strong><p>Does the signature match the issuer key, and does the fingerprint match this exact version?</p></article>
          <article><span>03</span><strong>Scientific relevance</strong><p>Was the sampling, method, execution, and interpretation suitable for the decision being made?</p></article>
        </div>
      </section>
      <section className="standard-status">
        <div><p className="section-kicker">Implementation status</p><h2>What the registry enforces now.</h2></div>
        <dl>
          <div><dt>Implemented</dt><dd>Permanent TECRID generation, public resolution, structured JSON, organization-scoped API keys, issuer application intake, Ed25519 issuance enforcement, independently verifiable public proof bundles, live fingerprint/signature checks, and append-only version records.</dd></div>
          <div><dt>Requires ICS operation</dt><dd>Identity review, scope decisions, signing-key control verification, suspensions, appeals, and governance publication.</dd></div>
          <div><dt>Not yet claimed</dt><dd>W3C Verifiable Credential conformance, regulatory recognition, universal LIMS interoperability, supplier declarations, custody linking, automated authenticity comparisons, or fitness for any safety decision.</dd></div>
        </dl>
        <p><a href={TECRID_SPECIFICATION_REPOSITORY_URL} target="_blank" rel="noreferrer">Open the versioned specification, JSON Schemas, and example records ↗</a></p>
        <p><a href={TECRID_SPECIFICATION_DOI_URL} target="_blank" rel="noreferrer">Cite release v0.1.0 · doi:{TECRID_SPECIFICATION_DOI} ↗</a></p>
        <p><a href={TECRID_SPECIFICATION_CONCEPT_DOI_URL} target="_blank" rel="noreferrer">Reference all versions · concept doi:{TECRID_SPECIFICATION_CONCEPT_DOI} ↗</a></p>
      </section>
      <section className="why-cta"><div><p className="section-kicker light">Build against the draft</p><h2>Canonicalize. Sign. Issue. Resolve.</h2></div><a href="/developers">Read the API <span aria-hidden="true">↗</span></a></section>
      <ProductFooter />
    </main>
  );
}
