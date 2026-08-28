import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "../../chatgpt-auth";
import { getOrganizationForUser } from "../../../lib/tec";
import { ProductFooter, ProductNav } from "../../site-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome to TEC Registry",
  description: "Continue Founding Organization onboarding with TEC Registry.",
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
        ? "Create your TEC workspace"
        : "Sign in with the checkout email";
  return (
    <main className="product-page success-page">
      <ProductNav compact />
      <section className="success-hero">
        <span className="success-seal">✓</span>
        <p className="section-kicker light">Stripe checkout complete</p>
        <h1>{active ? "Your founding launch is active." : "Now attach the work to your organization."}</h1>
        <p>{active ? "The membership is attached to your TEC workspace. Define the first product, report set, laboratories, and target outcome now." : "Use the same identity and organization email used at checkout. A signed Stripe event activates the workspace; this return page alone never grants paid access."}</p>
        <a className="button-mint" href={nextHref}>{nextLabel} <span>→</span></a>
        <small>Issuer verification remains a separate ICS standards review and is never purchased through membership.</small>
      </section>
      <section className="post-checkout-sequence">
        <article className={user ? "complete" : ""}><span>01</span><div><strong>Identity</strong><p>{user ? `Signed in as ${user.email}` : "Sign in with the email used at Stripe checkout."}</p></div></article>
        <article className={membership ? "complete" : ""}><span>02</span><div><strong>Organization</strong><p>{membership ? membership.organization.name : "Create the workspace that owns the subscription."}</p></div></article>
        <article className={active ? "complete" : ""}><span>03</span><div><strong>Activation</strong><p>{active ? "Founding Organization is active." : "Stripe’s signed event is matched to the workspace."}</p></div></article>
        <article><span>04</span><div><strong>First pilot</strong><p>Submit the launch brief, then upload the first private historical report.</p></div></article>
      </section>
      <ProductFooter />
    </main>
  );
}
