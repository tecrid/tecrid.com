import { PublicPage, PageHero } from "../blue-atlas/public-page";
import type { Metadata } from "next";
import { listVerifiedIssuers } from "../../lib/tec";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "https://tecrid.com/issuers" },
  title: "Verified laboratory issuers, TECRID",
  description: "Inspect the laboratories authorized by ICS to issue signed public Test Evidence Credential records.",
  openGraph: { title: "Verified laboratory issuers, TECRID", description: "Laboratories with reviewed public issuance authority.", images: [] },
  twitter: { title: "Verified laboratory issuers, TECRID", description: "Laboratories with reviewed public issuance authority.", images: [] },
};

export default async function IssuersPage() {
  const issuers = await listVerifiedIssuers();
  return (
    <PublicPage className="atlas-issuers-page">

      <PageHero className="atlas-issuer-hero">
        <p className="atlas-kicker">Verified issuers</p>
        <h1>Issuer authority has<br />a visible boundary.</h1>
        <p>ICS verification applies to the laboratory identity, recorded scope, and signing key shown here. It is not a blanket endorsement of every method or result.</p>
      </PageHero>
      <section className="atlas-issuer-directory">
        <div className="atlas-section-title-row">
          <div><p className="atlas-kicker">Verified laboratories</p><h2>Authorized public issuers</h2></div>
          <span className="atlas-verified-pill"><i /> {issuers.length} active</span>
        </div>
        {issuers.length ? (
          <div className="atlas-issuer-list">{issuers.map((issuer) => (
            <a key={issuer.issuerCode} href={`/issuers/${encodeURIComponent(issuer.issuerCode)}`}>
              <span>{issuer.issuerCode}</span><strong>{issuer.name}</strong><small>{issuer.issuerKeyVerifiedAt ? `${issuer.issuerKeyAlgorithm} signing key reviewed` : "Issuance key pending"}</small><i aria-hidden="true">↗</i>
            </a>
          ))}</div>
        ) : (
          <div className="atlas-empty-state"><strong>No laboratory has completed public issuer review yet.</strong><p>TECRID does not populate this list with demonstrations or applicants. An issuer appears only after ICS completes its review.</p></div>
        )}
      </section>
      <section className="atlas-record-boundary">
        <p className="atlas-kicker">Trust is scoped</p>
        <h2>Verified issuer does not mean infallible result.</h2>
        <p>Issuer verification confirms organizational identity, reviewed scope, and signing-key control. Representative sampling, method validity, quality controls, and interpretation remain independently material.</p>
      </section>

    </PublicPage>
  );
}
