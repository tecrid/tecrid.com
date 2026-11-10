import { PublicPage, PageHero } from "../blue-atlas/public-page";
import type { Metadata } from "next";
import { listPublicParticipants } from "../../lib/sharing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  alternates: { canonical: "https://tecrid.com/participants" },
  title: "TECRID participants",
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
    <PublicPage className="atlas-participants-page">

      <PageHero className="atlas-participants-hero">
        <p className="atlas-kicker">Network profiles and test pilots</p>
        <h1>Participants,<br />with roles made explicit.</h1>
        <p>Participant listings are opt-in; operator-prepared test profiles are explicitly marked and await organization approval. An integration pilot is not a laboratory endorsement, and a participant profile does not grant access to private evidence.</p>
      </PageHero>
      <section className="atlas-participants-shell">
        <div className="atlas-participants-head"><div><p className="atlas-kicker">Public participants</p><h2>{participants.length} organization{participants.length === 1 ? "" : "s"}</h2></div><div className="atlas-participants-head-actions"><a href="/badge">Use the TECRID badge →</a><a className="atlas-button" href="/dashboard/sharing">Manage your listing →</a></div></div>
        <div className="atlas-participant-grid">
          {participants.map(({ profile, organization }) => <article key={profile.id}>
            <div><span>{TYPE_LABELS[organization.organizationType] ?? organization.organizationType.replaceAll("_", " ")}</span><code>{organization.issuerCode}</code></div>
            <h2>{profile.displayName}</h2>
            <p>{profile.summary}</p>
            <dl><div><dt>Network status</dt><dd>{profile.participationStatus.replaceAll("_", " ")}</dd></div><div><dt>TECRID identity</dt><dd>{profile.registryVerified ? "Operator verified" : profile.participationStatus === "test_pending_approval" ? "Unclaimed test profile" : "Account supplied"}</dd></div><div><dt>Evidence visibility</dt><dd>Private unless separately granted</dd></div></dl>
            <div className="atlas-participant-card-actions"><a href={`/participants/${encodeURIComponent(organization.issuerCode)}`}>View TECRID profile →</a>{profile.website ? <a href={profile.website} target="_blank" rel="noreferrer">Website ↗</a> : null}</div>
          </article>)}
        </div>
        <aside className="atlas-participants-note"><strong>What the directory proves</strong><p>It proves that the named organization has an identified role and a declared participation status in TECRID. It does not prove that every report, product, laboratory method, or certification decision associated with that organization has been verified.</p></aside>
      </section>

    </PublicPage>
  );
}
