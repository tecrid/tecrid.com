import type { Metadata } from "next";
import { listPublicParticipants } from "../../lib/sharing";
import { ProductFooter, ProductNav } from "../site-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "TECRID participants — TEC Registry",
  description: "Organizations that have chosen to make their TECRID participation discoverable.",
};

const TYPE_LABELS: Record<string, string> = {
  laboratory: "Laboratory",
  brand: "Brand",
  supplier: "Ingredient supplier",
  retailer: "Retailer",
  certification_body: "Third-party certification",
  government: "Government",
  research: "Research organization",
};

export default async function ParticipantsPage() {
  const participants = await listPublicParticipants();
  return (
    <main className="product-page participants-page">
      <ProductNav />
      <header className="participants-hero">
        <p className="section-kicker light">Opt-in network directory</p>
        <h1>Participants,<br />with roles made explicit.</h1>
        <p>Organizations appear here only when they choose to be discoverable. An integration pilot is not a laboratory endorsement, and a participant profile does not grant access to private evidence.</p>
      </header>
      <section className="participants-shell">
        <div className="participants-head"><div><p className="section-kicker">Public participants</p><h2>{participants.length} organization{participants.length === 1 ? "" : "s"}</h2></div><a className="button-dark" href="/dashboard/sharing">Manage your listing →</a></div>
        <div className="participant-grid">
          {participants.map(({ profile, organization }) => <article key={profile.id}>
            <div><span>{TYPE_LABELS[organization.organizationType] ?? organization.organizationType.replaceAll("_", " ")}</span><code>{organization.issuerCode}</code></div>
            <h2>{profile.displayName}</h2>
            <p>{profile.summary}</p>
            <dl><div><dt>Network status</dt><dd>{profile.participationStatus.replaceAll("_", " ")}</dd></div><div><dt>Registry identity</dt><dd>{profile.registryVerified ? "Operator verified" : "Account supplied"}</dd></div><div><dt>Evidence visibility</dt><dd>Private unless separately granted</dd></div></dl>
            {profile.website ? <a href={profile.website} target="_blank" rel="noreferrer">Visit organization ↗</a> : null}
          </article>)}
        </div>
        <aside className="participants-note"><strong>What the directory proves</strong><p>It proves that the named organization has an identified role and a declared participation status in TECRID. It does not prove that every report, product, laboratory method, or certification decision associated with that organization has been verified.</p></aside>
      </section>
      <ProductFooter />
    </main>
  );
}
