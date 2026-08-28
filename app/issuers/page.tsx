import type { Metadata } from "next";
import { listVerifiedIssuers } from "../../lib/tec";
import { ProductFooter, ProductNav } from "../site-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verified laboratory issuers — TEC Registry",
  description: "Inspect the laboratories authorized by ICS to issue signed public TEC records.",
  openGraph: { title: "Verified laboratory issuers — TEC Registry", description: "The public TEC issuer register.", images: [] },
  twitter: { title: "Verified laboratory issuers — TEC Registry", description: "The public TEC issuer register.", images: [] },
};

export default async function IssuersPage() {
  const issuers = await listVerifiedIssuers();
  return (
    <main className="product-page issuers-page">
      <ProductNav compact />
      <header className="product-hero issuer-hero">
        <p className="section-kicker light">Public trust register</p>
        <h1>Issuer authority has<br />a visible boundary.</h1>
        <p>ICS verification applies to the laboratory identity, recorded scope, and signing key shown here. It is not a blanket endorsement of every method or result.</p>
      </header>
      <section className="issuer-directory">
        <div className="section-title-row">
          <div><p className="section-kicker">Verified laboratories</p><h2>Authorized public issuers</h2></div>
          <span className="verified-pill"><i /> {issuers.length} active</span>
        </div>
        {issuers.length ? (
          <div className="issuer-list">{issuers.map((issuer) => (
            <a key={issuer.issuerCode} href={`/issuers/${encodeURIComponent(issuer.issuerCode)}`}>
              <span>{issuer.issuerCode}</span><strong>{issuer.name}</strong><small>{issuer.issuerKeyVerifiedAt ? `${issuer.issuerKeyAlgorithm} signing key reviewed` : "Issuance key pending"}</small><i aria-hidden="true">↗</i>
            </a>
          ))}</div>
        ) : (
          <div className="empty-registry"><strong>No laboratory has completed public issuer review yet.</strong><p>The registry does not populate this list with demonstrations or applicants. An issuer appears only after ICS completes its review.</p></div>
        )}
      </section>
      <section className="record-boundary">
        <p className="section-kicker">Trust is scoped</p>
        <h2>Verified issuer does not mean infallible result.</h2>
        <p>Issuer verification confirms organizational identity, reviewed scope, and signing-key control. Representative sampling, method validity, quality controls, and interpretation remain independently material.</p>
      </section>
      <ProductFooter />
    </main>
  );
}
