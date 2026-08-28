import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getFoundingOnboardingForUser, getOrganizationForUser } from "../../../lib/tec";
import { ProductFooter, ProductNav } from "../../site-nav";
import { FoundingLaunchForm } from "./founding-launch-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Founding launch — TEC Registry",
  description: "Turn a TEC Registry Founding Organization membership into a defined evidence pilot.",
  robots: { index: false, follow: false },
};

export default async function FoundingLaunchPage() {
  const user = await requireChatGPTUser("/dashboard/founding");
  const membership = await getOrganizationForUser(user.userId);
  const existing = membership ? await getFoundingOnboardingForUser(user.userId) : null;

  return (
    <main className="product-page founding-launch-page">
      <ProductNav compact />
      <header className="form-page-header">
        <div><p className="section-kicker light">Founding Organization</p><h1>Your first 30 days.</h1><p>One defined pilot, an implementation queue, and a clear path to the first laboratory-confirmed TECRID.</p></div>
        <a href="/dashboard">← Dashboard</a>
      </header>
      {!membership ? (
        <section className="missing-workspace"><h2>Create your organization workspace first.</h2><a className="button-dark" href="/dashboard">Create workspace →</a></section>
      ) : membership.organization.plan !== "founding" ? (
        <section className="missing-workspace"><h2>Founding onboarding begins after membership activation.</h2><p>The free registry remains available without payment.</p><a className="button-dark" href="/join">Review Founding Organization →</a></section>
      ) : (
        <section className="founding-launch-shell">
          <div className="founding-delivery-strip" aria-label="Founding launch sequence">
            <article><span>01</span><strong>Define</strong><small>Submit this launch brief</small></article>
            <article><span>02</span><strong>Prepare</strong><small>Structure the first report set</small></article>
            <article><span>03</span><strong>Confirm</strong><small>Invite the issuing laboratories</small></article>
            <article><span>04</span><strong>Publish</strong><small>Resolve signed TECRIDs publicly</small></article>
          </div>
          <FoundingLaunchForm email={user.email} existing={existing} />
        </section>
      )}
      <ProductFooter />
    </main>
  );
}
