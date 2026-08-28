import type { Metadata } from "next";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import { getOrganizationForUser } from "../../lib/tec";
import { ProductFooter, ProductNav } from "../site-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join TEC Registry",
  description: "Create a free TEC Registry organization account or become a Founding Organization.",
};

export default async function JoinPage() {
  const user = await getChatGPTUser();
  const membership = user ? await getOrganizationForUser(user.userId) : null;
  const freeHref = membership ? "/dashboard" : user ? "/dashboard" : chatGPTSignInPath("/dashboard");

  return (
    <main className="product-page">
      <ProductNav compact />
      <section className="product-hero join-hero">
        <p className="section-kicker light">Join the evidence registry</p>
        <h1>Trust stays free.<br />Workflow pays for the network.</h1>
        <p>
          Laboratories never pay for issuer review or historical-report confirmation. Brands can begin with private intake and a small public evidence portfolio. Paid work starts where implementation, monitoring, integrations, and scale begin.
        </p>
      </section>

      <section className="pricing-grid" aria-label="TEC plans">
        <article className="price-card free-card">
          <span className="plan-label">Open network</span>
          <h2>Free</h2>
          <p className="price"><strong>$0</strong><span>forever</span></p>
          <ul>
            <li>Public TEC resolution and verification</li>
            <li>Free laboratory verification and report confirmation</li>
            <li>Private brand report intake</li>
            <li>Small public evidence portfolio</li>
            <li>Draft-protocol credential tooling</li>
            <li>Reasonable public and issuer API access</li>
            <li>Public correction and version history</li>
          </ul>
          <a className="button-dark" href={freeHref}>{membership ? "Open dashboard" : user ? "Complete setup" : "Create free account"} <span>→</span></a>
          <small>Sign-in uses your ChatGPT identity. Public issuance requires a separate ICS scope and signing-key review.</small>
        </article>

        <article className="price-card founding-card">
          <span className="plan-label">Launch cohort · limited</span>
          <h2>Founding Organization</h2>
          <p className="price"><strong>$2,500</strong><span>per year</span></p>
          <ul>
            <li>Everything in the open network</li>
            <li>Managed evidence-portfolio onboarding</li>
            <li>QR-label and disclosure implementation pack</li>
            <li>Supplier confirmation workflow setup</li>
            <li>Exports, API, and LIMS integration scoping</li>
            <li>Monitoring and procurement pilot participation</li>
            <li>Founding cohort recognition, with consent</li>
          </ul>
          <a className="button-mint" href="https://buy.stripe.com/14AfZi02HabV0HKfxZ3ZK00">Become a founding organization <span>↗</span></a>
          <small>Membership purchases workflow and implementation—not laboratory credibility, a passing decision, or preferred review.</small>
        </article>
      </section>

      <section className="independence-callout">
        <p className="section-kicker">The commercial firewall</p>
        <h2>Pay for workflow. Never pay for credibility.</h2>
        <p>TEC can charge for implementation support, integrations, monitoring, procurement controls, and enterprise operations as those services become available. The issuer-review decision remains method-based and independent of payment.</p>
      </section>
      <ProductFooter />
    </main>
  );
}
