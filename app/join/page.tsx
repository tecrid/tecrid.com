import type { Metadata } from "next";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import { getOrganizationForUser } from "../../lib/tec";
import { ProductFooter, ProductNav } from "../site-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join TEC Network",
  description: "Create a free TEC Network organization account or become a Founding Organization.",
};

export default async function JoinPage() {
  const user = await getChatGPTUser();
  const membership = user ? await getOrganizationForUser(user.userId) : null;
  const freeHref = membership ? "/dashboard" : user ? "/dashboard" : chatGPTSignInPath("/dashboard");

  return (
    <main className="product-page">
      <ProductNav compact />
      <section className="product-hero join-hero">
        <p className="section-kicker light">Join the evidence network</p>
        <h1>Verification is free.<br />Infrastructure is a business.</h1>
        <p>
          Every organization can resolve TEC records and use the open standard. Laboratories can create an account, request issuer verification, and start building draft integrations without a contract.
        </p>
      </section>

      <section className="pricing-grid" aria-label="TEC plans">
        <article className="price-card free-card">
          <span className="plan-label">Open network</span>
          <h2>Free</h2>
          <p className="price"><strong>$0</strong><span>forever</span></p>
          <ul>
            <li>Public TEC resolution and verification</li>
            <li>Organization account and issuer application</li>
            <li>Standards-compliant draft credentials</li>
            <li>Reasonable public and issuer API access</li>
            <li>Public correction and version history</li>
          </ul>
          <a className="button-dark" href={freeHref}>{membership ? "Open dashboard" : user ? "Complete setup" : "Create free account"} <span>→</span></a>
          <small>Sign-in uses your ChatGPT identity. Issuer verification is a separate standards review.</small>
        </article>

        <article className="price-card founding-card">
          <span className="plan-label">Launch cohort · limited</span>
          <h2>Founding Organization</h2>
          <p className="price"><strong>$2,500</strong><span>per year</span></p>
          <ul>
            <li>Everything in the open network</li>
            <li>Structured implementation onboarding</li>
            <li>Priority LIMS and workflow integration support</li>
            <li>Extended API capacity and monitoring</li>
            <li>Early access to policy and procurement tools</li>
            <li>Founding cohort recognition</li>
          </ul>
          <a className="button-mint" href="https://buy.stripe.com/14AfZi02HabV0HKfxZ3ZK00">Become a founding organization <span>↗</span></a>
          <small>Membership never purchases, accelerates, or guarantees laboratory verification.</small>
        </article>
      </section>

      <section className="independence-callout">
        <p className="section-kicker">The commercial firewall</p>
        <h2>Pay for workflow. Never pay for credibility.</h2>
        <p>TEC can charge for integrations, support, monitoring, procurement controls, and enterprise operations. The issuer-review decision remains method-based and independent of payment.</p>
      </section>
      <ProductFooter />
    </main>
  );
}
