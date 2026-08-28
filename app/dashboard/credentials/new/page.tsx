import type { Metadata } from "next";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { getDashboardData } from "../../../../lib/tec";
import { ProductFooter, ProductNav } from "../../../site-nav";
import { CredentialDraftForm } from "./credential-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New credential draft — TEC Registry",
  description: "Create a private structured TEC draft in your laboratory workspace.",
};

export default async function NewCredentialPage() {
  const user = await requireChatGPTUser("/dashboard/credentials/new");
  const data = await getDashboardData(user.userId);
  if (!data) return null;

  return (
    <main className="product-page credential-new-page">
      <ProductNav compact />
      <header className="dashboard-header">
        <div><p className="section-kicker light">TEC Registry workspace</p><h1>New credential draft</h1><p>{data.organization.name} · issuer code {data.organization.issuerCode}</p></div>
        <a className="button-mint" href="/dashboard">Return to dashboard</a>
      </header>
      <section className="credential-form-shell"><CredentialDraftForm /></section>
      <ProductFooter />
    </main>
  );
}
