import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicParticipant } from "../../../lib/sharing";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ issuerCode: string }> };

const TYPE_LABELS: Record<string, string> = {
  laboratory: "Laboratory", brand: "Brand", supplier: "Ingredient supplier", retailer: "Retailer",
  certification_body: "Third-party certification", government: "Government", research: "Research organization",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { issuerCode } = await params;
  const participant = await getPublicParticipant(decodeURIComponent(issuerCode));
  if (!participant) return { title: "Participant not found — TECRID", openGraph: { images: [] }, twitter: { images: [] } };
  const title = `${participant.profile.displayName} — TECRID participant profile`;
  const description = `${TYPE_LABELS[participant.organization.organizationType] ?? "Organization"} participating in TECRID under registry code ${participant.organization.issuerCode}.`;
  return { title, description, alternates: { canonical: `https://tecrid.com/participants/${participant.organization.issuerCode}` }, openGraph: { title, description, images: [] }, twitter: { title, description, images: [] } };
}

export default async function ParticipantProfilePage({ params }: PageProps) {
  const { issuerCode } = await params;
  const participant = await getPublicParticipant(decodeURIComponent(issuerCode));
  if (!participant) notFound();
  const { profile, organization } = participant;
  const role = TYPE_LABELS[organization.organizationType] ?? organization.organizationType.replaceAll("_", " ");
  const profileUrl = `https://tecrid.com/participants/${organization.issuerCode}`;
  const structuredData = {
    "@context": "https://schema.org", "@type": "Organization", name: profile.displayName, url: profileUrl,
    identifier: { "@type": "PropertyValue", propertyID: "TECRID organization code", value: organization.issuerCode },
    description: profile.summary, sameAs: profile.website ? [profile.website] : [],
  };
  return (
    <main className="product-page participant-profile-page">
      <ProductNav compact />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
      <header className="record-page-hero participant-profile-hero">
        <div className="participant-profile-title"><img src="/brand/tecrid-logo.png" width="74" height="74" alt="" /><div><p className="section-kicker light">Public TECRID participant</p><h1>{profile.displayName}</h1><p>{role} · Organization code {organization.issuerCode}</p></div></div>
        <span className={profile.registryVerified ? "public-verified" : "public-unverified"}><i /> {profile.registryVerified ? "Operator verified identity" : "Account-supplied identity"}</span>
      </header>
      <section className="participant-profile-shell">
        <div className="participant-profile-summary"><p>{profile.summary}</p>{profile.website ? <a href={profile.website} target="_blank" rel="noreferrer">Visit organization website ↗</a> : null}</div>
        <dl className="participant-profile-facts"><div><dt>TECRID role</dt><dd>{role}</dd></div><div><dt>Participation</dt><dd>{profile.participationStatus.replaceAll("_", " ")}</dd></div><div><dt>Profile first published</dt><dd>{profile.publishedAt ? new Date(profile.publishedAt).toLocaleDateString() : "Not recorded"}</dd></div><div><dt>Evidence visibility</dt><dd>Private unless separately authorized</dd></div></dl>
        <div className="participant-profile-badge"><div><span>Portable profile link</span><h2>Use the TECRID badge.</h2><p>This organization may link the official badge to this exact page in email signatures, proposals, and websites.</p><a href={`/badge?code=${encodeURIComponent(organization.issuerCode)}`}>Get the linked badge →</a></div><a href={profileUrl}><img src="/brand/tecrid-profile-badge.svg" width="224" height="52" alt={`View ${profile.displayName} TECRID profile`} /></a></div>
        <aside className="participant-profile-boundary"><strong>What this profile proves</strong><p>It records an opt-in TECRID network identity, organization role, public code, and declared participation status. It does not certify products, disclose private findings, or establish laboratory issuance authority. Individual TECRIDs and issuer-register pages carry their own proof and status.</p>{organization.organizationType === "laboratory" ? <a href={`/issuers/${encodeURIComponent(organization.issuerCode)}`}>Check laboratory issuer authority →</a> : null}</aside>
      </section>
      <ProductFooter />
    </main>
  );
}
