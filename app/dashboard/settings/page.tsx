import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser, chatGPTSignOutPath } from "../../chatgpt-auth";
import { ProductFooter, ProductNav } from "../../site-nav";
import { getDashboardData } from "../../../lib/tec";
import { listSharingForUser } from "../../../lib/sharing";
import { ApiKeyPanel } from "../dashboard-client";
import { ProfileSettingsForm } from "./profile-settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile and settings — TEC Registry", robots: { index: false, follow: false } };

const roleNames: Record<string, string> = {
  laboratory: "Testing laboratory", brand: "Brand or manufacturer", supplier: "Ingredient supplier",
  retailer: "Retailer or marketplace", certification_body: "Third-party certification body",
  government: "Government or regulator", consultant: "Consultant or auditor",
  research: "Research organization", other: "Other organization",
};

export default async function DashboardSettingsPage() {
  const user = await requireChatGPTUser("/dashboard/settings");
  const [data, sharing] = await Promise.all([getDashboardData(user.userId), listSharingForUser(user)]);
  if (!data) redirect("/dashboard");
  const profile = sharing.profile ? {
    displayName: sharing.profile.displayName,
    website: sharing.profile.website,
    summary: sharing.profile.summary,
    isPublic: sharing.profile.isPublic,
  } : null;

  return (
    <main className="product-page dashboard-settings-page">
      <ProductNav compact />
      <header className="dashboard-header settings-hero"><div><p className="section-kicker light">Organization settings</p><h1>Identity, visibility,<br />and integration.</h1><p>Manage the organization’s public profile, inspect its immutable workspace identity, and control API access from one place.</p></div><span className="workspace-code">Organization <strong>{data.organization.issuerCode}</strong></span></header>
      <div className="settings-shell">
        <section className="settings-identity-card">
          <div className="settings-section-heading"><div><p className="section-kicker">Workspace identity</p><h2>{data.organization.name}</h2></div><span>{data.organization.issuerStatus.replaceAll("_", " ")}</span></div>
          <dl><div><dt>Organization type</dt><dd>{roleNames[data.organization.organizationType] ?? data.organization.organizationType}</dd></div><div><dt>Workspace code</dt><dd><code>{data.organization.issuerCode}</code></dd></div><div><dt>Plan</dt><dd>{data.organization.plan === "free" ? "Open network" : data.organization.plan}</dd></div><div><dt>Signed in as</dt><dd>{user.email}</dd></div></dl>
          <p>Legal identity and organization type are not silently editable. Contact ICS when a verified laboratory changes its legal name, ownership, or issuance scope.</p>
          <a href={chatGPTSignOutPath("/")}>Sign out of this account →</a>
        </section>

        <ProfileSettingsForm organization={{ name: data.organization.name, code: data.organization.issuerCode, website: data.organization.website }} profile={profile} />

        <ApiKeyPanel keys={data.keys} />

        <section className="settings-integration-card">
          <div><p className="section-kicker light">Agent-guided integration</p><h2>Open the repository. Type <code>integrate</code>.</h2><p>Connect a laboratory, brand, supplier, retailer, or certification system without placing secrets in source control.</p></div>
          <div><a className="button-mint" href="/integrate">Review the four-step setup →</a><a href="https://github.com/tecrid/tecrid-connect" target="_blank" rel="noreferrer">Open TECRID Connect on GitHub ↗</a><a href="/developers">Read the API documentation →</a></div>
        </section>
      </div>
      <ProductFooter />
    </main>
  );
}
