import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicDisclosurePortfolio } from "../../../lib/disclosures";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ organizationSlug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { organizationSlug } = await params;
  const portfolio = await getPublicDisclosurePortfolio(decodeURIComponent(organizationSlug));
  if (!portfolio) return { title: "Disclosure portfolio not found — TEC Registry" };
  return {
    title: `${portfolio.organization.name} disclosures — TEC Registry`,
    description: `Public production-aggregate analytical disclosures published by ${portfolio.organization.name}.`,
  };
}

export default async function DisclosurePortfolioPage({ params }: PageProps) {
  const { organizationSlug } = await params;
  const portfolio = await getPublicDisclosurePortfolio(decodeURIComponent(organizationSlug));
  if (!portfolio) notFound();
  return (
    <main className="product-page public-disclosure-page">
      <ProductNav compact />
      <header className="record-page-hero disclosure-portfolio-hero">
        <div><p className="section-kicker light">Public analytical disclosures</p><h1>{portfolio.organization.name}</h1><p>Production-aggregate records published by the brand and structured for people and procurement systems.</p></div>
        <span className="public-unverified"><i /> Brand disclosure portfolio</span>
      </header>
      <section className="disclosure-portfolio-shell">
        <div className="disclosure-public-boundary"><strong>Read the authority label on every record.</strong><p>A brand disclosure preserves what the brand reports from a laboratory document. It becomes laboratory-confirmed only when the laboratory verifies it; a TECRID exists only when a qualified issuer signs the credential.</p></div>
        <div className="disclosure-feed-actions"><span>Reuse this portfolio without re-entering it</span><a href={`/api/public/disclosures/${portfolio.organization.slug}`}>JSON feed ↗</a><a href={`/api/public/disclosures/${portfolio.organization.slug}?format=csv`}>Regulator-ready CSV ↓</a></div>
        <div className="disclosure-public-list">
          {portfolio.batches.length ? portfolio.batches.map(({ batch, product }) => (
            <a href={`/disclosures/${portfolio.organization.slug}/${batch.id}`} key={batch.id}>
              <span className="record-status record-published">published</span>
              <div><strong>{product.name}</strong><code>{product.sku} · {batch.batchCode}</code></div>
              <div><span>{batch.productionDate}</span><small>{batch.labConfirmed ? "Laboratory confirmed" : "Laboratory confirmation pending"}</small></div>
              <i>→</i>
            </a>
          )) : <div className="empty-state"><strong>No public disclosures.</strong><p>This portfolio contains no published production aggregates.</p></div>}
        </div>
      </section>
      <ProductFooter />
    </main>
  );
}
