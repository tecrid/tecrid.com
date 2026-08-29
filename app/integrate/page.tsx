import type { Metadata } from "next";
import { ProductFooter, ProductNav } from "../site-nav";

export const metadata: Metadata = {
  title: "Integrate TECRID with Codex or Claude Code — One-Word Setup",
  description: "Open the TECRID Connect repository in an advanced coding agent, type integrate, and follow a role-aware setup for laboratories, brands, suppliers, retailers, certifiers, or government programs.",
  alternates: { canonical: "https://tecrid.com/integrate" },
  keywords: ["TECRID integration", "laboratory API integration", "LIMS integration", "Codex repository instructions", "Claude Code TECRID"],
};

const roles = [
  ["Laboratory", "Maps the controlled LIMS release event, report template, final-PDF fingerprint, canonical signature, finalization, audit trail, and failure tests."],
  ["Brand or supplier", "Connects the evidence portfolio, SKU-specific laboratory routing, recipient permissions, historical-report intake, and optional public profile."],
  ["Retailer or certifier", "Connects scoped requests, intake, authority validation, frozen version receipts, exception handling, and portfolio monitoring."],
  ["Government program", "Uses the same recipient boundary while preserving program-specific reliance rules, access limits, and append-only submission evidence."],
];

export default function IntegratePage() {
  return (
    <main className="integration-page">
      <ProductNav compact />
      <section className="integration-hero">
        <div><p className="section-kicker light">Agent-guided onboarding</p><h1>Open the repo.<br />Type <code>integrate</code>.</h1><p>The public TECRID Connect repository contains instructions for Codex and Claude Code, a machine-readable role manifest, a read-only preflight, the API client, MCP tools, LIMS starter profiles, and a required completion report.</p><div className="integration-hero-actions"><a className="button-mint" href="https://github.com/tecrid/tecrid-connect" target="_blank" rel="noreferrer">Open the GitHub repository ↗</a><a href="/downloads/tecrid-connect.zip" download>Download ZIP ↓</a></div></div>
        <aside><span>Type this in the coding agent</span><pre><code>integrate</code></pre><small>One word starts discovery. Human approval still controls identity, secrets, deployment, and production writes.</small></aside>
      </section>

      <section className="integration-steps">
        <div><p className="section-kicker">Four steps</p><h2>The shortest safe path from repository to working connection.</h2></div>
        <ol><li><span>01</span><strong>Open both codebases</strong><p>Give the coding agent access to TECRID Connect and the portal, LIMS connector, or service that will receive the integration.</p></li><li><span>02</span><strong>Select maximum capability</strong><p>In Codex, use GPT-5.6 Sol with max reasoning when available. In Claude Code, choose the highest-capability coding mode exposed to your account.</p></li><li><span>03</span><strong>Type “integrate”</strong><p>The agent reads <code>AGENTS.md</code> or <code>CLAUDE.md</code>, inspects the stack, and asks once for any role, target, or LIMS fact it cannot discover.</p></li><li><span>04</span><strong>Review the receipt</strong><p>The agent implements and tests the connection, then creates <code>TECRID-INTEGRATION-REPORT.md</code> with verified work, open human gates, and rollback steps.</p></li></ol>
      </section>

      <section className="integration-agent-contract">
        <div><p className="section-kicker light">What the agent does</p><h2>Discovery, implementation, validation, and a durable handoff.</h2><p>The checked-in instructions make “integrate” a defined workflow rather than a vague prompt.</p></div>
        <div><article><span>Discover</span><p>Framework, package manager, deployment boundary, environment conventions, CI, audit patterns, existing TECRID code, organization role, and source system.</p></article><article><span>Connect</span><p>Secret placeholders, typed client, role-specific APIs, native audit storage, structured errors, retries, and integration tests.</p></article><article><span>Verify</span><p>Public API health, local checks, target tests, authorization behavior, failure handling, and the exact boundary between completed work and human approval.</p></article><article><span>Report</span><p>Files changed, events and endpoints connected, checks actually run, human gates, deployment approval, rollback, and a no-secrets-in-source attestation.</p></article></div>
      </section>

      <section className="integration-roles"><div><p className="section-kicker">Role-aware setup</p><h2>One trigger. Four bounded outcomes.</h2></div><div>{roles.map(([title, copy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

      <section className="integration-human-gates">
        <div><p className="section-kicker light">Deliberately not automated</p><h2>The agent handles implementation. People retain authority.</h2></div>
        <ul><li><strong>Identity</strong><span>A person signs in, creates or selects the organization, and completes any issuer or program verification.</span></li><li><strong>Secrets</strong><span>A person places the TECRID API key and any laboratory signing key into approved custody. Keys are never requested in chat.</span></li><li><strong>Release authority</strong><span>A laboratory owner approves the mapped release event; a brand approves disclosures; a recipient approves its reliance rules.</span></li><li><strong>Production</strong><span>Deployment and the first production write require explicit approval after the integration report is reviewed.</span></li></ul>
      </section>

      <section className="integration-start"><div><p className="section-kicker">Start free</p><h2>Create the workspace first—or let the agent build until it reaches the credential gate.</h2><p>TECRID account creation, public resolution, laboratory verification, and the founding pilot are free.</p></div><div><a href="/join">Create a workspace <span>↗</span></a><a href="https://github.com/tecrid/tecrid-connect" target="_blank" rel="noreferrer">Open TECRID Connect <span>↗</span></a></div></section>
      <ProductFooter />
    </main>
  );
}
