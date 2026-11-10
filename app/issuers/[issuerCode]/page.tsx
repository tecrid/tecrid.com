import { PublicPage, PageHero } from "../../blue-atlas/public-page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getIssuer } from "../../../lib/tec";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ issuerCode: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { issuerCode } = await params;
  const issuer = await getIssuer(decodeURIComponent(issuerCode));
  if (!issuer) return { title: "Issuer not found, TECRID", openGraph: { images: [] }, twitter: { images: [] } };
  const title = `${issuer.name}, Verified issuers`;
  const description = `Public issuance status and reviewed scope for Test Evidence Credential issuer ${issuer.issuerCode}.`;
  return { title, description, alternates: { canonical: `https://tecrid.com/issuers/${encodeURIComponent(issuer.issuerCode)}` }, openGraph: { title, description, images: [] }, twitter: { title, description, images: [] } };
}

export default async function IssuerPage({ params }: PageProps) {
  const { issuerCode } = await params;
  const issuer = await getIssuer(decodeURIComponent(issuerCode));
  if (!issuer) notFound();
  const verified = issuer.issuerStatus === "verified";
  const authority = issuer.issuerStatus === "suspended"
    ? "Issuance is suspended. Existing TECRIDs remain public and show this status. This laboratory cannot mint."
    : issuer.issuerStatus === "revoked"
      ? "Issuance is revoked. Existing TECRIDs remain public and show this status. Revocation is permanent."
      : verified
        ? "Credentials still require a valid signature from the reviewed issuer key."
        : "Applications, drafts, and organization accounts do not confer public issuer status.";
  return (
    <PublicPage className="atlas-issuer-page">

      <PageHero className="atlas-record-page-hero atlas-issuer-record-hero">
        <div><p className="atlas-kicker">Verified issuers</p><h1>{issuer.name}</h1><p>Issuer code {issuer.issuerCode}</p></div>
        <span className={verified ? "atlas-public-verified" : "atlas-public-unverified"}><i /> {issuer.issuerStatus.replaceAll("_", " ")}</span>
      </PageHero>
      <section className="atlas-issuer-record-shell">
        <div className="atlas-issuer-status-statement">
          <span>Current issuance authority</span>
          <strong>{verified ? "Active within the scope recorded below" : issuer.issuerStatus === "suspended" ? "Suspended" : issuer.issuerStatus === "revoked" ? "Revoked" : "No public issuance authority"}</strong>
          <p>{authority}</p>
        </div>
        <dl className="atlas-issuer-facts">
          <div><dt>Legal identity</dt><dd>{issuer.legalName}</dd></div>
          <div><dt>Website</dt><dd>{issuer.website ? <a href={issuer.website} target="_blank" rel="noreferrer">{issuer.website} ↗</a> : "Not published"}</dd></div>
          <div><dt>Accreditation</dt><dd>{issuer.accreditation?.body ? `${issuer.accreditation.body}${issuer.accreditation.number ? ` · ${issuer.accreditation.number}` : ""}${issuer.accreditation.expiresOn ? ` · expires ${issuer.accreditation.expiresOn}` : ""}` : "No public accreditation claim recorded"}</dd></div>
          <div><dt>Signing key</dt><dd>{issuer.signingKey ? <><code>{issuer.signingKey.keyId}</code><small>{issuer.signingKey.algorithm} · reviewed {new Date(issuer.signingKey.verifiedAt).toLocaleDateString()}</small></> : "No reviewed signing key published"}</dd></div>
        </dl>
        <div className="atlas-issuer-scope-grid">
          <article><span>Reviewed scope</span><p>{issuer.verifiedScope?.summary ?? "No verified scope is public for this organization."}</p></article>
          <article><span>Method families</span><p>{issuer.verifiedScope?.methodFamilies ?? "No verified method families are public for this organization."}</p></article>
        </div>
      </section>
      <section className="atlas-record-boundary">
        <p className="atlas-kicker">Interpretation boundary</p><h2>Authority is not an analytical conclusion.</h2><p>This page records who may issue Test Evidence Credentials and under what reviewed scope. It does not independently validate any individual sample, method execution, or result.</p>
      </section>

    </PublicPage>
  );
}
