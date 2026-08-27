import type { Metadata } from "next";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { getOrganizationForUser } from "../../../../lib/tec";
import { ProductFooter, ProductNav } from "../../../site-nav";
import { CredentialForm } from "./credential-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create a TEC",
  description: "Create a structured Test Evidence Credential.",
};

export default async function NewCredentialPage() {
  const user = await requireChatGPTUser("/dashboard/credentials/new");
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) {
    return (
      <main className="product-page"><ProductNav compact /><section className="missing-workspace"><h1>Create your organization first.</h1><a href="/dashboard">Continue to setup →</a></section><ProductFooter /></main>
    );
  }
  const canPublish = membership.organization.organizationType === "laboratory" && membership.organization.issuerStatus === "verified";

  return (
    <main className="product-page credential-create-page">
      <ProductNav compact />
      <header className="form-page-header">
        <div><p className="section-kicker light">Structured analytical evidence</p><h1>Create a credential.</h1><p>{membership.organization.name} · {membership.organization.issuerCode}</p></div>
        <a href="/dashboard">← Dashboard</a>
      </header>
      <CredentialForm canPublish={canPublish} />
      <ProductFooter />
    </main>
  );
}
