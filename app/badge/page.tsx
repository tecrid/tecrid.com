import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";
import { BadgeBuilder } from "./badge-builder";

export const metadata: Metadata = {
  title: "TECRID badge — link to an organization registry profile",
  description: "Add the official blue TECRID identifier badge to an email signature or website and link it to an opt-in organization registry profile.",
  alternates: { canonical: "https://tecrid.com/badge" },
};

type PageProps = { searchParams: Promise<{ code?: string }> };

export default async function BadgePage({ searchParams }: PageProps) {
  const search = await searchParams;
  const code = (search.code ?? "YOUR-CODE").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24) || "YOUR-CODE";
  return (
    <main className="product-page badge-page">
      <ProductNav compact />
      <header className="badge-hero">
        <div><p className="section-kicker light">A portable registry identity</p><h1>Put your TECRID profile where trust begins.</h1><p>The blue TECRID badge turns an email signature, proposal, supplier packet, or website footer into a direct path to the organization&apos;s opt-in TECRID profile.</p></div>
        <div className="badge-hero-art"><img src="/brand/tecrid-id.svg" width="170" height="170" alt="Blue TECRID mark" /><strong>TECRID</strong><span>Registry profile</span></div>
      </header>
      <BadgeBuilder initialCode={code} />
      <section className="badge-boundary" aria-labelledby="badge-boundary-title">
        <div><p className="section-kicker light">Trust boundary</p><h2 id="badge-boundary-title">The badge is a link—not a blanket endorsement.</h2></div>
        <div><p>It means the organization has chosen to make its TECRID participation discoverable. The linked profile states the organization&apos;s role, registry identity status, and participation status.</p><p>It does not certify every product, validate every laboratory result, disclose private evidence, or grant laboratory issuance authority. Those claims remain attached to their own records and status labels.</p></div>
      </section>
      <ProductFooter />
    </main>
  );
}
