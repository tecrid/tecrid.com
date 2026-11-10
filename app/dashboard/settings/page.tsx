import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser, chatGPTSignOutPath } from "../../chatgpt-auth";
import { ProductFooter } from "../../site-nav";
import { getDashboardData } from "../../../lib/tec";
import { listSharingForUser } from "../../../lib/sharing";
import { organizationRole } from "../../../lib/roles";
import { ApiKeyPanel } from "../dashboard-client";
import { ProfileSettingsForm } from "./profile-settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings | TEC Registry", robots: { index: false, follow: false } };

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
  if (data.organization.slug.startsWith("setup--")) {
    if (data.organization.organizationType === "other") return <main className="product-page simple-dashboard"><header className="simple-dashboard-heading"><h1>Your account</h1><p>{user.email}</p><a href={chatGPTSignOutPath("/")}>Sign out</a></header><ProductFooter /></main>;
    redirect("/dashboard/setup?return_to=/dashboard/settings");
  }
  const role = organizationRole(data.organization.organizationType);
  const showProfile = role !== "public";
  const showKeys = role === "laboratory" || role === "brand" || role === "supplier" || role === "certification_body";
  const profile = sharing.profile ? {
    displayName: sharing.profile.displayName,
    website: sharing.profile.website,
    summary: sharing.profile.summary,
    isPublic: sharing.profile.isPublic,
  } : null;

  return (
    <main className="product-page app-page">
      <header className="app-heading">
        <p className="section-kicker">Settings</p>
        <h1>{data.organization.name}</h1>
        <nav className="app-tabs" aria-label="Settings sections">
          <a href="#account">Account</a>
          {showProfile ? <a href="#profile">Profile</a> : null}
          {showKeys ? <a href="#api-keys">API keys</a> : null}
        </nav>
      </header>
      <div className="settings-sections">
        <section className="settings-section" id="account">
          <h2>Account</h2>
          <dl>
            <div><dt>Organization type</dt><dd>{roleNames[data.organization.organizationType] ?? data.organization.organizationType}</dd></div>
            <div><dt>Workspace code</dt><dd><code>{data.organization.issuerCode}</code></dd></div>
            <div><dt>Plan</dt><dd>{data.organization.plan === "free" ? "Open network" : data.organization.plan}</dd></div>
            <div><dt>Signed in as</dt><dd>{user.email}</dd></div>
            {role === "laboratory" ? <div><dt>Issuer status</dt><dd>{data.organization.issuerStatus.replaceAll("_", " ")}</dd></div> : null}
          </dl>
          <p>{role === "laboratory" ? "Legal name and organization type stay fixed after setup. A verified laboratory asks ICS before a legal name or scope change." : "Legal name and organization type stay fixed after setup."}</p>
          <a href={chatGPTSignOutPath("/")}>Sign out</a>
        </section>
        {showProfile ? <section className="settings-section" id="profile"><ProfileSettingsForm organization={{ name: data.organization.name, code: data.organization.issuerCode, website: data.organization.website }} profile={profile} /></section> : null}
        {showKeys ? <section className="settings-section"><ApiKeyPanel keys={data.keys} /></section> : null}
      </div>
      <ProductFooter />
    </main>
  );
}
