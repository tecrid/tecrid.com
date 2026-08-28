import type { Metadata } from "next";
import { demoLaboratory } from "../../../lib/demo-records";
import { ProductFooter, ProductNav } from "../../site-nav";

export const metadata: Metadata = {
  title: "Fictional demonstration laboratory — TEC Registry",
  description: "A non-registered fictional laboratory profile used only to demonstrate the TEC interface.",
  robots: { index: false, follow: true },
  openGraph: { title: "Fictional demonstration laboratory — TEC Registry", description: "Not a registered or verified TEC issuer.", images: [] },
  twitter: { title: "Fictional demonstration laboratory — TEC Registry", description: "Not a registered or verified TEC issuer.", images: [] },
};

export default function DemoLaboratoryPage() {
  return (
    <main className="product-page demo-lab-page">
      <ProductNav compact />
      <header className="record-page-hero issuer-record-hero">
        <div><p className="section-kicker light">Fictional laboratory demonstration</p><h1>{demoLaboratory.name}</h1><p>Demo code {demoLaboratory.code}</p></div>
        <span className="public-unverified"><i /> Not a registered issuer</span>
      </header>
      <section className="demo-lab-shell">
        <div className="demo-warning"><strong>No issuance authority</strong><p>This organization does not exist. It has no accreditation, reviewed scope, signing key, registry account, or ability to issue a public TEC.</p></div>
        <dl className="demo-fact-grid">
          <div><dt>Legal identity</dt><dd>{demoLaboratory.legalName}</dd></div>
          <div><dt>Location</dt><dd>{demoLaboratory.location}</dd></div>
          <div><dt>Registry status</dt><dd>{demoLaboratory.status}</dd></div>
          <div><dt>Signing key</dt><dd>{demoLaboratory.key}</dd></div>
          <div><dt>Illustrative scope</dt><dd>{demoLaboratory.scope}</dd></div>
          <div><dt>Public issuer page</dt><dd>None — demonstration pages are excluded</dd></div>
        </dl>
        <a className="evidence-link" href="/demo">Return to demonstration library <span>↗</span></a>
      </section>
      <ProductFooter />
    </main>
  );
}
