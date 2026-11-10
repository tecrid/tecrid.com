import { PublicPage, PageHero } from "../../blue-atlas/public-page";
import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "../../chatgpt-auth";
import { getOrganizationForUser } from "../../../lib/tec";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome to TECRID",
  description: "Continue Founding Organization onboarding with TECRID.",
};

export default async function JoinSuccessPage() {
  const user = await getChatGPTUser();
  const membership = user ? await getOrganizationForUser(user.userId) : null;
  const active = membership?.organization.plan === "founding";
  const nextHref = active
    ? "/dashboard/founding"
    : user
      ? "/dashboard"
      : chatGPTSignInPath("/join/success");
  const nextLabel = active
    ? "Start the founding launch brief"
    : membership
      ? "Open workspace and check activation"
      : user
        ? "Create your TECRID workspace"
        : "Sign in with the checkout email";
  return (
    <PublicPage className="atlas-success-page">

      <PageHero className="atlas-success-hero">
        <span className="atlas-success-seal">✓</span>
        <p className="atlas-kicker">Stripe checkout complete</p>
        <h1>{active ? "Your founding launch is active." : "Now attach the work to your organization."}</h1>
        <p>{active ? "The membership is attached to your TECRID workspace. Define the first product, report set, laboratories, and target outcome now." : "Use the same identity and organization email used at checkout. A signed Stripe event activates the workspace; this return page alone never grants paid access."}</p>
        <a className="atlas-button" href={nextHref}>{nextLabel} <span>→</span></a>
        <small>Issuer verification remains a separate ICS standards review and is never purchased through membership.</small>
      </PageHero>
      <section className="atlas-post-checkout-sequence">
        <article className={user ? "atlas-complete" : ""}><span>01</span><div><strong>Identity</strong><p>{user ? `Signed in as ${user.email}` : "Sign in with the email used at Stripe checkout."}</p></div></article>
        <article className={membership ? "atlas-complete" : ""}><span>02</span><div><strong>Organization</strong><p>{membership ? membership.organization.name : "Create the workspace that owns the subscription."}</p></div></article>
        <article className={active ? "atlas-complete" : ""}><span>03</span><div><strong>Activation</strong><p>{active ? "Founding Organization is active." : "Stripe’s signed event is matched to the workspace."}</p></div></article>
        <article><span>04</span><div><strong>First pilot</strong><p>Submit the launch brief, then upload the first private historical report.</p></div></article>
      </section>

    </PublicPage>
  );
}
