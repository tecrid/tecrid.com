import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getIssuer } from "../../../lib/tec";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ issuerCode: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { issuerCode } = await params;
  const issuer = await getIssuer(decodeURIComponent(issuerCode));
  if (!issuer) return { title: "Issuer not found — TEC Registry", openGraph: { images: [] }, twitter: { images: [] } };
  const title = `${issuer.name} — TEC issuer register`;
  const description = `Public issuance status and reviewed scope for TEC issuer ${issuer.issuerCode}.`;
  return { title, description, openGraph: { title, description, images: [] }, twitter: { title, description, images: [] } };
}

export default async function IssuerPage({ params }: PageProps) {
  const { issuerCode } = await params;
  const issuer = await getIssuer(decodeURIComponent(issuerCode));
  if (!issuer) notFound();
  const verified = issuer.issuerStatus === "verified";
  return (
    <main className="product-page issuer-page">
      <ProductNav compact />
      <header className="record-page-hero issuer-record-hero">
        <div><p className="section-kicker light">TEC issuer register</p><h1>{issuer.name}</h1><p>Issuer code {issuer.issuerCode}</p></div>
        <span className={verified ? "public-verified" : "public-unverified"}><i /> {verified ? "ICS verified" : "Not authorized"}</span>
      </header>
      <section className="issuer-record-shell">
        <div className="issuer-status-statement">
          <span>Current issuance authority</span>
          <strong>{verified ? "Active within the scope recorded below" : "No public issuance authority"}</strong>
          <p>{verified ? "Credentials still require a valid signature from the reviewed issuer key." : "Applications, drafts, and organization accounts do not confer public issuer status."}</p>
        </div>
        <dl className="issuer-facts">
          <div><dt>Legal identity</dt><dd>{issuer.legalName}</dd></div>
          <div><dt>Website</dt><dd>{issuer.website ? <a href={issuer.website} target="_blank" rel="noreferrer">{issuer.website} ↗</a> : "Not published"}</dd></div>
          <div><dt>Accreditation</dt><dd>{issuer.accreditation?.body ? `${issuer.accreditation.body}${issuer.accreditation.number ? ` · ${issuer.accreditation.number}` : ""}` : "No public accreditation claim recorded"}</dd></div>
          <div><dt>Signing key</dt><dd>{issuer.signingKey ? <><code>{issuer.signingKey.keyId}</code><small>{issuer.signingKey.algorithm} · reviewed {new Date(issuer.signingKey.verifiedAt).toLocaleDateString()}</small></> : "No reviewed signing key published"}</dd></div>
        </dl>
        <div className="issuer-scope-grid">
          <article><span>Reviewed scope</span><p>{issuer.verifiedScope?.summary ?? "No verified scope is public for this organization."}</p></article>
          <article><span>Method families</span><p>{issuer.verifiedScope?.methodFamilies ?? "No verified method families are public for this organization."}</p></article>
        </div>
      </section>
      <section className="record-boundary">
        <p className="section-kicker">Interpretation boundary</p><h2>Authority is not an analytical conclusion.</h2><p>This page records who may issue TECs and under what reviewed scope. It does not independently validate any individual sample, method execution, or result.</p>
      </section>
      <ProductFooter />
    </main>
  );
}
