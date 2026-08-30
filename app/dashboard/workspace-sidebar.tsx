/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Organization = { name: string; code: string; type: string; issuerStatus: string; plan: string };
type Progress = { hasApplication: boolean; hasApiKey: boolean; hasCredential: boolean };

const roleNames: Record<string, string> = {
  laboratory: "Testing laboratory",
  brand: "Brand or manufacturer",
  supplier: "Ingredient supplier",
  retailer: "Retailer or marketplace",
  certification_body: "Certification body",
  government: "Government or regulator",
  consultant: "Consultant or auditor",
  research: "Research organization",
  other: "Organization",
};

function isCurrent(pathname: string, href: string) {
  const path = href.split("#")[0];
  return path === "/dashboard" ? pathname === path : pathname.startsWith(path);
}

function NavigationLink({ href, label, index, pathname }: { href: string; label: string; index: string; pathname: string }) {
  const active = isCurrent(pathname, href);
  return <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={href}><span>{index}</span>{label}</Link>;
}

export function WorkspaceSidebar({ organization, progress, user, signOutHref }: {
  organization: Organization;
  progress: Progress;
  user: { displayName: string; email: string };
  signOutHref: string;
}) {
  const pathname = usePathname();
  const laboratory = organization.type === "laboratory";
  const controller = ["brand", "supplier"].includes(organization.type);
  const recipient = ["retailer", "certification_body", "government"].includes(organization.type);
  const verificationComplete = organization.issuerStatus === "verified";
  const completed = [true, verificationComplete, progress.hasApiKey, progress.hasCredential].filter(Boolean).length;

  const primary = laboratory ? [
    ["/dashboard", "Overview"],
    ["/dashboard/credentials/new", "Issue a credential"],
    ["/dashboard/lab-defense", "Verification desk"],
    ["/dashboard/insights", "Evidence insights"],
  ] : controller ? [
    ["/dashboard", "Overview"],
    ["/dashboard/reports/new", "Submit an existing report"],
    ["/dashboard/sharing", "Evidence sharing"],
    ["/dashboard/evidence-routing", "Evidence routing"],
    ["/dashboard/insights", "Evidence insights"],
  ] : recipient ? [
    ["/dashboard", "Overview"],
    ["/dashboard/sharing", "Receive share codes"],
    ["/dashboard/evidence-routing", "Evidence requests"],
    ["/dashboard/certification", "Certification intake"],
    ["/dashboard/insights", "Evidence insights"],
  ] : [
    ["/dashboard", "Overview"],
    ["/dashboard/insights", "Evidence insights"],
  ];

  const secondary = [
    ...(laboratory || controller ? [["/dashboard/disclosures", "Disclosure operations"]] : []),
    ...(organization.plan === "founding" ? [["/dashboard/founding", "Founding launch"]] : []),
    ["/dashboard/settings", "Profile & settings"],
  ];

  const menu = (
    <>
      <nav className="workspace-sidebar-nav" aria-label="Workspace navigation">
        <span>Workspace</span>
        {primary.map(([href, label], index) => <NavigationLink key={href} href={href} label={label} index={String(index + 1).padStart(2, "0")} pathname={pathname} />)}
        <span>Organization</span>
        {secondary.map(([href, label], index) => <NavigationLink key={href} href={href} label={label} index={String(index + 1).padStart(2, "0")} pathname={pathname} />)}
      </nav>
      {laboratory ? <section className="workspace-lab-progress" aria-label="Laboratory onboarding progress">
        <div><span>Laboratory launch</span><strong>{completed}/4</strong></div>
        <ol>
          <li className="complete"><i>1</i><span>Workspace created</span></li>
          <li className={verificationComplete ? "complete" : "next"}><i>2</i><Link href="/dashboard#laboratory-verification">{verificationComplete ? "Issuer verified" : progress.hasApplication ? "Verification in review" : "Start verification"}</Link></li>
          <li className={progress.hasApiKey ? "complete" : "next"}><i>3</i><Link href="/dashboard/settings#api-keys">{progress.hasApiKey ? "API access ready" : "Connect API"}</Link></li>
          <li className={progress.hasCredential ? "complete" : "next"}><i>4</i><Link href="/dashboard/credentials/new">{progress.hasCredential ? "First credential created" : "Create first credential"}</Link></li>
        </ol>
      </section> : null}
    </>
  );

  return <>
    <aside className="workspace-sidebar">
      <Link className="workspace-sidebar-brand" href="/"><img src="/brand/tecrid-logo.png" width="34" height="34" alt="" /><span><strong>TEC Registry</strong><small>Organization workspace</small></span></Link>
      <div className="workspace-identity"><span>{roleNames[organization.type] ?? "Organization"}</span><strong>{organization.name}</strong><code>{organization.code}</code></div>
      {menu}
      <footer><div><strong>{user.displayName}</strong><small>{user.email}</small></div><a href={signOutHref}>Sign out</a><Link href="/">View public site ↗</Link></footer>
    </aside>
    <details className="workspace-mobile-nav"><summary><span><strong>{organization.name}</strong><small>{roleNames[organization.type] ?? "Organization"}</small></span><i>Workspace menu</i></summary><div>{menu}<footer><Link href="/dashboard/settings">Profile &amp; settings</Link><a href={signOutHref}>Sign out</a></footer></div></details>
  </>;
}
