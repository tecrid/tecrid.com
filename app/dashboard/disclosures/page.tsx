import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { listDisclosureOperations } from "../../../lib/disclosures";
import { getOrganizationForUser } from "../../../lib/tec";
import { ProductFooter, ProductNav } from "../../site-nav";
import { DisclosureOperationsClient } from "./disclosure-operations-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Disclosure operations — TEC Registry",
  description: "Validate production-aggregate laboratory data and publish reusable brand disclosures.",
};

export default async function DisclosureOperationsPage() {
  const user = await requireChatGPTUser("/dashboard/disclosures");
  const membership = await getOrganizationForUser(user.userId);
  const supported = membership && ["brand", "laboratory"].includes(membership.organization.organizationType);
  const data = supported ? await listDisclosureOperations(user) : null;

  return (
    <main className="product-page disclosure-ops-page">
      <ProductNav compact />
      <header className="dashboard-header disclosure-ops-hero">
        <div>
          <p className="section-kicker light">Disclosure operations</p>
          <h1>One source file.<br />Every required surface.</h1>
          <p>Validate production aggregates before they become brand pages, QR destinations, retained evidence, or machine-readable data.</p>
        </div>
        <span className="workspace-code">Signed in as <strong>{user.displayName}</strong></span>
      </header>
      {!membership ? (
        <section className="disclosure-access-state">
          <p className="section-kicker">Organization required</p>
          <h2>Create a workspace before importing regulated disclosure data.</h2>
          <p>Your organization owns the portfolio, import history, exceptions, and public endpoints.</p>
          <Link className="button-dark" href="/dashboard">Create organization →</Link>
        </section>
      ) : !supported ? (
        <section className="disclosure-access-state">
          <p className="section-kicker">Limited pilot</p>
          <h2>This workflow currently accepts brand and laboratory workspaces.</h2>
          <p>Retailer monitoring and procurement endpoints are the receiving side of this system and will follow the disclosure pilot.</p>
          <Link className="button-dark" href="/dashboard">Return to dashboard →</Link>
        </section>
      ) : data ? (
        <DisclosureOperationsClient
          organization={data.membership.organization}
          imports={data.imports}
          batches={data.batches}
          exceptions={data.exceptions}
        />
      ) : null}
      <ProductFooter />
    </main>
  );
}
