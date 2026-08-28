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
        <p>Everything below is fictional, excluded from the live resolver and public API, and visibly marked as a demonstration.</p>
        <div className="draft-standard-badge"><i /> No verified issuer · no public TECRID · no real findings</div>
      </header>

      <section className="demo-hub">
        <div className="demo-warning"><strong>Demonstration boundary</strong><p>These examples cannot be resolved as TECRIDs, do not appear in the issuer register, and make no claim about any real product, supplier, laboratory, or brand.</p></div>
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
