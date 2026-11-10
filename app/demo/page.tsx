import { publicCopy } from "../blue-atlas/copy";
import { PublicPage, PageHero } from "../blue-atlas/public-page";
import type { Metadata } from "next";
import { demoLaboratory, demoRecords } from "../../lib/demo-records";

export const metadata: Metadata = {
  title: "Demonstration library, TECRID",
  description: "Fictional laboratory and record demonstrations that are isolated from live TECRID records.",
  robots: { index: false, follow: true },
  openGraph: { title: "Demonstration library, TECRID", description: "Invented interface examples, not public Test Evidence Credential records.", images: [] },
  twitter: { title: "Demonstration library, TECRID", description: "Invented interface examples, not public Test Evidence Credential records.", images: [] },
};

export default function DemoLibraryPage() {
  return (
    <PublicPage className="atlas-demo-page">

      <PageHero className="atlas-demo-hero">
        <p className="atlas-kicker">Isolated demonstration namespace</p>
        <h1>See the system.<br />Do not mistake it for evidence.</h1>
        <p>Everything below is fictional and visibly marked as a demonstration. The heavy-metals example uses TECRID’s reserved sample namespace so visitors can test the public resolver and JSON surface; it has no production authority.</p>
        <div className="atlas-draft-standard-badge"><i /> No verified issuer · no production TECRID · no real findings</div>
      </PageHero>

      <section className="atlas-demo-hub">
        <div className="atlas-demo-warning"><strong>Demonstration boundary</strong><p>The heavy-metals example resolves only inside TECRID’s reserved DEMO namespace. Neither example has production authority, appears as a verified issuer record, or makes a claim about any real product, supplier, laboratory, or brand.</p></div>
        <div className="atlas-demo-sandbox-callout"><div><p className="atlas-kicker">Want to operate the workflow?</p><h2>Switch roles inside the interactive sandbox.</h2><p>Move one fictional report from brand intake through laboratory confirmation and into a retailer evidence gate.</p></div><a className="atlas-button" href="/sandbox">Launch sandbox →</a></div>
        <div className="atlas-demo-sandbox-callout atlas-disclosure-demo-callout"><div><p className="atlas-kicker">For monthly disclosure operations</p><h2>Watch one source file become five reusable surfaces.</h2><p>A fictional regulated-brand workflow shows 12 production aggregates, 11 ready rows, one blocked exception, and the publication boundary between brand disclosure and TECRID.</p></div><a className="atlas-button" href="/demo/disclosure-operations">Open workflow demo →</a></div>
        <div className="atlas-section-title-row"><div><p className="atlas-kicker">Fictional issuer</p><h2>{demoLaboratory.name}</h2></div><a href="/demo/lab">Inspect lab profile ↗</a></div>
        <div className="atlas-demo-lab-strip"><span>{demoLaboratory.code}</span><strong>{demoLaboratory.status}</strong><small>{demoLaboratory.scope}</small></div>
        <div className="atlas-section-title-row atlas-demo-record-heading"><div><p className="atlas-kicker">Invented records</p><h2>Two complete examples</h2></div></div>
        <div className="atlas-demo-grid">{demoRecords.map((record) => (
          <a className="atlas-demo-card" href={`/demo/${record.slug}`} key={record.slug}>
            <span>Demonstration only</span><h3>{record.title}</h3><p>{publicCopy(record.sample)}</p><code>{record.demoId}</code><strong>Open example ↗</strong>
          </a>
        ))}</div>
      </section>

    </PublicPage>
  );
}
