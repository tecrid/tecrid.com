import type { Metadata } from "next";
import { getChatGPTUser, chatGPTSignInPath } from "../chatgpt-auth";
import { getOrganizationForUser } from "../../lib/tec";
import { ProductFooter, ProductNav } from "../site-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join TECRID",
  description: "Create a free TECRID workspace. Optional Founding Organization support pays for white-glove implementation—not verification or credibility.",
};

type JoinRole = "laboratory" | "brand" | "certification_body";

const roleDoors: Array<{ id: JoinRole; label: string; title: string; copy: string; action: string }> = [
  {
    id: "laboratory",
    label: "Laboratory",
    title: "Authenticate issuance at the source.",
    copy: "Apply at no cost. Account access never substitutes for identity, scope, key-control, and conformance review.",
    action: "Start laboratory setup",
  },
  {
    id: "brand",
    label: "Brand or supplier",
    title: "Control a report portfolio.",
    copy: "Organize evidence by lot and SKU, request laboratory confirmation, and grant each recipient only what it needs.",
    action: "Start brand setup",
  },
  {
    id: "certification_body",
    label: "Certifier or retailer",
    title: "Request evidence, not folders.",
    copy: "Receive TECRIDs, frozen versions, CSV or API submissions, and scoped grants without repeated PDF intake.",
    action: "Start recipient setup",
  },
];

const roleHero: Record<JoinRole, { kicker: string; title: React.ReactNode; copy: string }> = {
  laboratory: {
    kicker: "Laboratories · free core",
    title: <>Register the laboratory.<br />Earn issuance authority.</>,
    copy: "Create the workspace and begin independent issuer review without paying. Production issuance remains locked until laboratory identity, competence evidence, approved scope, signing-key control, and conformance pass review.",
  },
  brand: {
    kicker: "Brands and suppliers · free core",
    title: <>Bring laboratory evidence<br />under control.</>,
    copy: "Create a private portfolio by SKU and lot, request laboratory confirmation, and decide which recipients can resolve each governed evidence package.",
  },
  certification_body: {
    kicker: "Certifiers and retailers · free core",
    title: <>Request evidence.<br />Skip the PDF chase.</>,
    copy: "Create a recipient workspace, request the TECRIDs your program needs, and preserve the exact version reviewed without re-keying laboratory PDFs.",
  },
};

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const selectedRole = roleDoors.some((door) => door.id === role) ? role as JoinRole : null;
  const laboratoryEntry = selectedRole === "laboratory";
  const selectedHero = selectedRole ? roleHero[selectedRole] : null;
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
      ? "Open implementation workspace"
      : "Add white-glove implementation — $2,500/year"
    : "Create free workspace first";
  const foundingHref = membership?.organization.plan === "founding" ? "/dashboard/founding" : checkoutHref;

  const freeOutcome = selectedRole === "laboratory"
    ? { title: "Begin independent issuer review.", copy: "Submit the laboratory evidence and signing challenge at no cost. Payment cannot unlock production issuance." }
    : selectedRole === "brand"
      ? { title: "Build the governed report portfolio.", copy: "Intake reports privately, invite the named laboratory to confirm them, and share only the issued evidence you authorize." }
      : selectedRole === "certification_body"
        ? { title: "Create a structured evidence channel.", copy: "Request and receive scoped TECRIDs while preserving the version and fingerprint used in each decision." }
        : { title: "Use the core registry without a subscription.", copy: "Create the right workspace, manage governed evidence, and resolve TECRIDs without paying for trust status." };

  return (
    <main className="product-page">
      <ProductNav compact />
      <section className="product-hero join-hero">
        <p className="section-kicker light">{selectedHero?.kicker ?? "Free forever · every organization type"}</p>
        <h1>{selectedHero?.title ?? <>The core registry<br />is free. Forever.</>}</h1>
        <p>{selectedHero?.copy ?? "Laboratories, brands, suppliers, certifiers, retailers, and government programs can use TECRID’s core registry without a subscription. Optional paid support implements a workflow; it never buys credibility, issuer approval, or a stronger record."}</p>
      </section>

      <section className="join-role-doors" aria-labelledby="join-role-heading">
        <header>
          <p className="section-kicker">Choose your door</p>
          <div><h2 id="join-role-heading">Start with the job you need to do.</h2><p>Every door opens the same free core. Organization type determines the setup path—not the credibility of its evidence.</p></div>
        </header>
        <div className="join-role-door-grid">
          {roleDoors.map((door) => (
            <a className={`join-role-door${selectedRole === door.id ? " active" : ""}`} href={`/join?role=${door.id}`} key={door.id} aria-current={selectedRole === door.id ? "page" : undefined}>
              <span>{door.label}</span><h3>{door.title}</h3><p>{door.copy}</p><strong>{door.action} →</strong>
            </a>
          ))}
        </div>
      </section>

      {laboratoryEntry ? <section className="lab-join-sequence"><article><span>01</span><strong>Create the free workspace</strong><p>Use an authorized laboratory contact and the laboratory’s legal website.</p></article><article><span>02</span><strong>Complete five verification gates</strong><p>Identity, competence evidence, scope, key control, and signing conformance are recorded separately.</p></article><article><span>03</span><strong>Issue only after approval</strong><p>Account creation and payment never unlock production TECRIDs.</p></article><a href="/laboratory-pilot">Read complete pilot requirements →</a><a href="https://vle.exchange/for-laboratories">Coordinate independent sampling with VLE →</a></section> : null}

      <section className="pricing-grid" aria-label="TECRID plans">
        <article className="price-card free-card">
          <span className="plan-label">Core registry · all roles</span>
          <h2>Free forever</h2>
          <p className="price"><strong>$0</strong><span>no trial · no paid trust tier</span></p>
          <p className="plan-outcome"><strong>{freeOutcome.title}</strong><span>{freeOutcome.copy}</span></p>
          <ul>
            <li>Organization workspace and optional public participant profile</li>
            <li>Public TECRID resolution and verification</li>
            <li>Free laboratory review and historical-report confirmation</li>
            <li>Private report intake organized by SKU and lot</li>
            <li>Scoped sharing, evidence requests, and recipient receipts</li>
            <li>Small public evidence portfolio</li>
            <li>Reasonable public, sandbox, and issuer API access</li>
            <li>Public correction, revocation, and version history</li>
          </ul>
          <a className="button-dark" href={freeHref}>{membership ? "Open dashboard" : user ? "Complete free setup" : selectedRole ? roleDoors.find((door) => door.id === selectedRole)?.action : "Create free workspace"} <span>→</span></a>
          <small>An account proves account access only. It does not verify a laboratory or certify product safety. A PDF or COA does not become a TECRID through upload or by printing an identifier on it. <a href="/privacy">Privacy &amp; data governance →</a></small>
        </article>

        <article className="price-card founding-card">
          <span className="plan-label">Optional · white-glove implementation</span>
          <h2>Founding Organization</h2>
          <p className="price"><strong>$2,500</strong><span>per year</span></p>
          <p className="plan-outcome"><strong>Buy implementation work—not credibility.</strong><span>A defined 30-day engagement helps one organization launch one real evidence workflow on top of the same free core.</span></p>
          <ul>
            <li>Everything in the free core</li>
            <li>Private kickoff and implementation brief with ICS</li>
            <li>Guided preparation of the first 10 historical reports</li>
            <li>Laboratory-claim and confirmation workflow setup</li>
            <li>QR/disclosure pack for TECRIDs that are actually issued</li>
            <li>One exports, API, LIMS, or procurement integration scope</li>
            <li>Closeout plan for continuing in the free workspace</li>
          </ul>
          <a className="button-mint" href={foundingHref}>{checkoutLabel} <span>{membership?.organization.plan === "founding" ? "→" : "↗"}</span></a>
          <small>Payment cannot approve a laboratory, turn a PDF into a TECRID, certify safety, alter a verification result, or create a VLE qualification. Membership does not guarantee laboratory confirmation. <a href="/privacy">How ICS handles data →</a></small>
        </article>
      </section>

      <section className="founding-boundaries">
        <div><p className="section-kicker light">The commercial firewall</p><h2>Workflow can be purchased. Trust cannot.</h2></div>
        <ul>
          <li>Free and paid organizations face the same evidence and disclosure rules</li>
          <li>Laboratory issuance authority is reviewed independently of payment</li>
          <li>TECRID authenticates provenance; it does not certify product safety</li>
          <li>Brands and suppliers remain in control of private disclosure grants</li>
        </ul>
        <div className="not-included"><strong>Never included</strong><p>Purchased verification, guaranteed laboratory participation, preferential record status, legal conclusions, automatic publication, or converting an uploaded PDF into a laboratory-issued TECRID.</p></div>
      </section>

      <section className="join-sandbox-callout">
        <div><p className="section-kicker light">Try it before creating an account</p><h2>Use the workflow before choosing a door.</h2><p>Enter the public sandbox as a brand, laboratory, supplier, certifier, or retailer. Complete a fictional report workflow without live registry authority.</p></div>
        <a className="button-mint" href="/sandbox">Open interactive sandbox →</a>
      </section>
      <ProductFooter />
    </main>
  );
}
