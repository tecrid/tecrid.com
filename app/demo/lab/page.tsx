import { publicCopy } from "../../blue-atlas/copy";
import { PublicPage, PageHero } from "../../blue-atlas/public-page";
import type { Metadata } from "next";
import { demoLaboratory } from "../../../lib/demo-records";

export const metadata: Metadata = {
  title: "Fictional demonstration laboratory, TECRID",
  description: "A non-registered fictional laboratory profile used only to demonstrate the TECRID interface.",
  robots: { index: false, follow: true },
  openGraph: { title: "Fictional demonstration laboratory, TECRID", description: "Not a registered or verified Test Evidence Credential issuer.", images: [] },
  twitter: { title: "Fictional demonstration laboratory, TECRID", description: "Not a registered or verified Test Evidence Credential issuer.", images: [] },
};

export default function DemoLaboratoryPage() {
  return (
    <PublicPage className="atlas-demo-lab-page">

      <PageHero className="atlas-record-page-hero atlas-issuer-record-hero">
        <div><p className="atlas-kicker">Fictional laboratory demonstration</p><h1>{demoLaboratory.name}</h1><p>Demo code {demoLaboratory.code}</p></div>
        <span className="atlas-public-unverified"><i /> Not a verified laboratory</span>
      </PageHero>
      <section className="atlas-demo-lab-shell">
        <div className="atlas-demo-warning"><strong>No issuance authority</strong><p>This organization does not exist. It has no accreditation, reviewed scope, signing key, TECRID account, or ability to issue a public Test Evidence Credential.</p></div>
        <dl className="atlas-demo-fact-grid">
          <div><dt>Legal identity</dt><dd>{publicCopy(demoLaboratory.legalName)}</dd></div>
          <div><dt>Location</dt><dd>{demoLaboratory.location}</dd></div>
          <div><dt>TECRID status</dt><dd>{demoLaboratory.status}</dd></div>
          <div><dt>Signing key</dt><dd>{demoLaboratory.key}</dd></div>
          <div><dt>Illustrative scope</dt><dd>{demoLaboratory.scope}</dd></div>
          <div><dt>Public issuer page</dt><dd>None, demonstration pages are excluded</dd></div>
        </dl>
        <a className="atlas-evidence-link" href="/demo">Return to demonstration library <span>↗</span></a>
      </section>

    </PublicPage>
  );
}
