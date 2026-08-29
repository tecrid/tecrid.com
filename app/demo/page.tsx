import type { Metadata } from "next";
import { demoLaboratory, demoRecords } from "../../lib/demo-records";
import { ProductFooter, ProductNav } from "../site-nav";

export const metadata: Metadata = {
  title: "Demonstration library — TEC Registry",
  description: "Fictional laboratory and record demonstrations that are isolated from the live TEC Registry.",
  robots: { index: false, follow: true },
  openGraph: { title: "Demonstration library — TEC Registry", description: "Invented interface examples, not public TEC records.", images: [] },
  twitter: { title: "Demonstration library — TEC Registry", description: "Invented interface examples, not public TEC records.", images: [] },
};

export default function DemoLibraryPage() {
  return (
    <main className="product-page demo-page">
      <ProductNav compact />
      <header className="product-hero demo-hero">
        <p className="section-kicker light">Isolated demonstration namespace</p>
        <h1>See the system.<br />Do not mistake it for evidence.</h1>
        <p>Everything below is fictional and visibly marked as a demonstration. The heavy-metals example uses TECRID’s reserved sample namespace so visitors can test the public resolver and JSON surface; it has no production authority.</p>
        <div className="draft-standard-badge"><i /> No verified issuer · no production TECRID · no real findings</div>
      </header>

      <section className="demo-hub">
        <div className="demo-warning"><strong>Demonstration boundary</strong><p>These examples cannot be resolved as TECRIDs, do not appear in the issuer register, and make no claim about any real product, supplier, laboratory, or brand.</p></div>
        <div className="demo-sandbox-callout"><div><p className="section-kicker light">Want to operate the workflow?</p><h2>Switch roles inside the interactive sandbox.</h2><p>Move one fictional report from brand intake through laboratory confirmation and into a retailer evidence gate.</p></div><a className="button-mint" href="/sandbox">Launch sandbox →</a></div>
        <div className="demo-sandbox-callout disclosure-demo-callout"><div><p className="section-kicker light">For monthly disclosure operations</p><h2>Watch one source file become five reusable surfaces.</h2><p>A fictional regulated-brand workflow shows 12 production aggregates, 11 ready rows, one blocked exception, and the publication boundary between brand disclosure and TECRID.</p></div><a className="button-mint" href="/demo/disclosure-operations">Open workflow demo →</a></div>
        <div className="section-title-row"><div><p className="section-kicker">Fictional issuer</p><h2>{demoLaboratory.name}</h2></div><a href="/demo/lab">Inspect lab profile ↗</a></div>
        <div className="demo-lab-strip"><span>{demoLaboratory.code}</span><strong>{demoLaboratory.status}</strong><small>{demoLaboratory.scope}</small></div>
        <div className="section-title-row demo-record-heading"><div><p className="section-kicker">Invented records</p><h2>Two complete examples</h2></div></div>
        <div className="demo-grid">{demoRecords.map((record) => (
          <a className="demo-card" href={`/demo/${record.slug}`} key={record.slug}>
            <span>Demonstration only</span><h3>{record.title}</h3><p>{record.sample}</p><code>{record.demoId}</code><strong>Open example ↗</strong>
          </a>
        ))}</div>
      </section>
      <ProductFooter />
    </main>
  );
}
