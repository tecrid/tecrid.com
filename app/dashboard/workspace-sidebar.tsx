"use client";
// Native links keep role navigation usable even when the client router is unavailable.
/* eslint-disable @next/next/no-img-element */
import { usePathname } from "next/navigation";
import { roleNavigation, organizationRole, isCurrentDestination } from "../../lib/roles";
type Organization = { name: string; code: string; type: string; issuerStatus: string; plan: string };
type Progress = { applicationStatus: string | null; hasApiKey: boolean; hasCredential: boolean };
export function WorkspaceSidebar({ organization }: { organization: Organization; progress: Progress; user: { displayName: string; email: string }; signOutHref: string }) {
  const pathname = usePathname();
  return <aside className="workspace-sidebar simple-sidebar"><a className="workspace-sidebar-brand" href="/dashboard"><img src="/icons/tecrid.svg" width="34" height="34" alt="" /><strong>TEC Registry</strong></a><div className="workspace-identity"><strong>{organization.name}</strong></div><nav className="workspace-sidebar-nav" aria-label="Workspace navigation">{roleNavigation(organizationRole(organization.type), true).map(item => <a key={item.href} href={item.href} className={isCurrentDestination(pathname, item.href) ? "active" : ""} aria-current={isCurrentDestination(pathname, item.href) ? "page" : undefined}>{item.label}</a>)}</nav></aside>;
}
