import type { Metadata } from "next";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import { getOrganizationForUser } from "../../lib/tec";
import { ProductFooter, ProductNav } from "../site-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join TEC Registry",
  description: "Create a free TEC Registry organization account or become a Founding Organization.",
};

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const laboratoryEntry = role === "laboratory";
  const user = await getChatGPTUser();
  const membership = user ? await getOrganizationForUser(user.userId) : null;
  const freeHref = membership ? "/dashboard" : user ? "/dashboard" : chatGPTSignInPath("/dashboard");
  const checkoutHref = user && membership
    ? `https://buy.stripe.com/14AfZi02HabV0HKfxZ3ZK00?locked_prefilled_email=${encodeURIComponent(user.email)}&client_reference_id=${encodeURIComponent(membership.organization.id)}`
    : user
      ? "/dashboard"
      : chatGPTSignInPath("/dashboard");
  const checkoutLabel = membership
    ? membership.organization.plan === "founding"
      ? "Open founding launch"
      : "Start founding membership — $2,500/year"
    : user
      ? "Create workspace before checkout"
      : "Sign in and create workspace";
  const foundingHref = membership?.organization.plan === "founding" ? "/dashboard/founding" : checkoutHref;

  return (
    <main className="product-page">
      <ProductNav compact />
      <section className="product-hero join-hero">
        <p className="section-kicker light">{laboratoryEntry ? "Free founding laboratory pilot" : "Join the evidence registry"}</p>
        <h1>{laboratoryEntry ? <>Apply as a laboratory.<br />Verification is free.</> : <>Know what happens<br />before you pay.</>}</h1>
        <p>
          {laboratoryEntry ? "Create the laboratory workspace, submit identity and scope evidence, prove signing-key control, and pass conformance. Public issuance remains locked until every verification gate passes." : "The open registry is a self-serve trust utility. Founding Organization is a one-year implementation membership with a defined 30-day launch—not a fee for laboratory approval."}
        </p>
      </section>

      {laboratoryEntry ? <section className="lab-join-sequence"><article><span>01</span><strong>Create the free workspace</strong><p>Use an authorized laboratory contact and the laboratory’s legal website.</p></article><article><span>02</span><strong>Complete five verification gates</strong><p>Identity, competence evidence, scope, key control, and signing conformance are recorded separately.</p></article><article><span>03</span><strong>Issue only after approval</strong><p>Account creation and payment never unlock production TECRIDs.</p></article><a href="/laboratory-pilot">Read complete pilot requirements →</a></section> : null}

      <section className="pricing-grid" aria-label="TEC plans">
        <article className="price-card free-card">
          <span className="plan-label">Open network</span>
          <h2>Free</h2>
          <p className="price"><strong>$0</strong><span>forever</span></p>
          <p className="plan-outcome"><strong>{laboratoryEntry ? "Apply for laboratory issuance authority." : "Use the registry yourself."}</strong><span>{laboratoryEntry ? "Create the workspace, submit the issuer application and evidence, and complete the signing challenge without paying." : "Create a workspace, submit private reports, invite laboratories, and publish only after valid confirmation."}</span></p>
          <ul>
            <li>Public TEC resolution and verification</li>
            <li>Free laboratory verification and report confirmation</li>
            <li>Private brand report intake</li>
            <li>Small public evidence portfolio</li>
            <li>Draft-protocol credential tooling</li>
            <li>Reasonable public and issuer API access</li>
            <li>Public correction and version history</li>
            <li>Scoped share codes and participant-directory opt-in</li>
          </ul>
          <a className="button-dark" href={freeHref}>{membership ? "Open dashboard" : user ? "Complete setup" : laboratoryEntry ? "Create laboratory workspace" : "Create free account"} <span>→</span></a>
          <small>Sign-in uses your ChatGPT identity. Public issuance requires a separate ICS scope and signing-key review. <a href="/privacy">Privacy &amp; data governance →</a></small>
        </article>

        <article className="price-card founding-card">
          <span className="plan-label">Launch cohort · limited</span>
          <h2>Founding Organization</h2>
          <p className="price"><strong>$2,500</strong><span>per year</span></p>
          <p className="plan-outcome"><strong>Launch one real evidence program.</strong><span>Your first 30 days convert an existing report set into a defined laboratory-confirmation pilot.</span></p>
          <ul>
            <li>Everything in the open network, with founding limits</li>
            <li>A private implementation brief in the ICS queue</li>
            <li>Guided preparation of the first 10 historical reports</li>
            <li>Laboratory-claim and confirmation workflow setup</li>
            <li>QR/disclosure pack for TECRIDs that are actually issued</li>
            <li>One exports, API, LIMS, or procurement integration scope</li>
            <li>Founding cohort recognition, with consent</li>
          </ul>
          <a className="button-mint" href={foundingHref}>{checkoutLabel} <span>{membership?.organization.plan === "founding" ? "→" : "↗"}</span></a>
          <small>Annual subscription. Checkout uses the workspace owner email so activation can attach to the correct organization. Membership does not guarantee any laboratory will confirm a report. <a href="/privacy">How ICS handles data →</a></small>
        </article>
      </section>

      <section className="join-sandbox-callout">
        <div><p className="section-kicker light">Try it before creating an account</p><h2>See exactly what every participant gets.</h2><p>Use the public sandbox as a brand, laboratory, supplier, and retailer. Complete a fictional report workflow without a login or live registry access.</p></div>
        <a className="button-mint" href="/sandbox">Open interactive sandbox →</a>
      </section>

      <section className="independence-callout">
        <p className="section-kicker">Network formation</p>
        <h2>Core enrollment is free for every role.</h2>
        <p>Laboratories, brands, ingredient suppliers, retailers, certification bodies, and government programs can create an organization workspace without a subscription. Free participation includes identity setup, laboratory-verification intake, public resolution, governed evidence sharing, and an optional public participant profile. Paid plans fund implementation and scale, not trust status.</p>
      </section>

      <section className="purchase-clarity">
        <div className="purchase-clarity-intro">
          <p className="section-kicker">What happens next</p>
          <h2>A purchase should start work immediately.</h2>
        </div>
        <div className="purchase-steps">
          <article><span>01 · Before Stripe</span><h3>Create the organization workspace.</h3><p>This establishes which brand, laboratory, retailer, or advisor owns the membership and prevents an orphaned payment.</p></article>
          <article><span>02 · Checkout</span><h3>Pay $2,500 for one year.</h3><p>Stripe uses the locked workspace email. The receipt, customer, subscription, and TEC organization can be reconciled automatically.</p></article>
          <article><span>03 · Immediately after</span><h3>Open the founding launch brief.</h3><p>Choose the first product, report set, laboratories, target date, and desired commercial outcome. ICS receives it in a restricted queue.</p></article>
          <article><span>04 · First 30 days</span><h3>Move one pilot toward issuance.</h3><p>Prepare up to 10 historical reports, request laboratory confirmation, resolve discrepancies, and publish only legitimately signed TECRIDs.</p></article>
        </div>
      </section>

      <section className="founding-boundaries">
        <div><p className="section-kicker light">A good fit</p><h2>Organizations with real reports and a real trust problem.</h2></div>
        <ul>
          <li>Brands trying to prove what their suppliers or laboratories actually reported</li>
          <li>Laboratories that want customer reports to resolve as authenticated records</li>
          <li>Retailers building evidence requirements into procurement</li>
          <li>Organizations ready to name a first product, report set, and laboratory</li>
        </ul>
        <div className="not-included"><strong>Not included</strong><p>Purchased verification, guaranteed laboratory participation, a compliance certification, legal conclusions, or automatic publication of an uploaded PDF.</p></div>
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
