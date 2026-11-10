import { PublicPage, PageHero } from "../../blue-atlas/public-page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicDisclosurePortfolio } from "../../../lib/disclosures";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ organizationSlug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { organizationSlug } = await params;
  const portfolio = await getPublicDisclosurePortfolio(decodeURIComponent(organizationSlug));
  if (!portfolio) return { title: "Disclosure portfolio not found, TECRID" };
  return {
    title: `${portfolio.organization.name} disclosures, TECRID`,
    description: `Public production-aggregate analytical disclosures published by ${portfolio.organization.name}.`,
    alternates: { canonical: `https://tecrid.com/disclosures/${encodeURIComponent(decodeURIComponent(organizationSlug))}` },
  };
}

export default async function DisclosurePortfolioPage({ params }: PageProps) {
  const { organizationSlug } = await params;
  const portfolio = await getPublicDisclosurePortfolio(decodeURIComponent(organizationSlug));
  if (!portfolio) notFound();
  return (
    <PublicPage className="atlas-public-disclosure-page">

      <PageHero className="atlas-record-page-hero atlas-disclosure-portfolio-hero">
        <div><p className="atlas-kicker">Public analytical disclosures</p><h1>{portfolio.organization.name}</h1><p>Production-aggregate records published by the brand and structured for people and procurement systems.</p></div>
        <span className="atlas-public-unverified"><i /> Brand disclosure portfolio</span>
      </PageHero>
      <section className="atlas-disclosure-portfolio-shell">
        <div className="atlas-disclosure-public-boundary"><strong>Read the authority label on every record.</strong><p>A brand disclosure preserves what the brand reports from a laboratory document. It becomes laboratory-confirmed only when the laboratory verifies it; a TECRID exists only when a qualified issuer signs the credential.</p></div>
        <div className="atlas-disclosure-feed-actions"><span>Reuse this portfolio without re-entering it</span><a href={`/api/public/disclosures/${portfolio.organization.slug}`}>JSON feed ↗</a><a href={`/api/public/disclosures/${portfolio.organization.slug}?format=csv`}>Regulator-ready CSV ↓</a></div>
        <div className="atlas-disclosure-public-list">
          {portfolio.batches.length ? portfolio.batches.map(({ batch, product }) => (
            <a href={`/disclosures/${portfolio.organization.slug}/${batch.id}`} key={batch.id}>
              <span className="atlas-record-status atlas-record-published">published</span>
              <div><strong>{product.name}</strong><code>{product.sku} · {batch.batchCode}</code></div>
              <div><span>{batch.productionDate}</span><small>{batch.labConfirmed ? "Laboratory confirmed" : "Laboratory confirmation pending"}</small></div>
              <i>→</i>
            </a>
          )) : <div className="atlas-empty-state"><strong>No public disclosures.</strong><p>This portfolio contains no published production aggregates.</p></div>}
        </div>
      </section>

    </PublicPage>
  );
}
