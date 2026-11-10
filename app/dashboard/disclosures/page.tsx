import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { listDisclosureOperations } from "../../../lib/disclosures";
import { getOrganizationForUser } from "../../../lib/tec";
import { ProductFooter, ProductNav } from "../../site-nav";
import { DisclosureOperationsClient } from "./disclosure-operations-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Disclosure operations, TECRID",
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
      <header className="app-heading">
        <p className="section-kicker">Disclosures</p>
        <h1>Disclosures</h1>
        <p>One source file. Validate it before anything is published. Publication is not a safety decision.</p>
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
