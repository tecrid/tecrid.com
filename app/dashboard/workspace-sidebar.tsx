"use client";
// Native links keep role navigation usable even when the client router is unavailable.
/* eslint-disable @next/next/no-img-element */
import { Fragment } from "react";
import { usePathname } from "next/navigation";
import { roleNavigation, organizationRole, isCurrentDestination } from "../../lib/roles";
type Organization = { name: string; code: string; type: string; issuerStatus: string; plan: string };
type Progress = { applicationStatus: string | null; hasApiKey: boolean; hasCredential: boolean };
export function WorkspaceSidebar({ organization, user, signOutHref, icsAdmin = false }: { organization: Organization; progress: Progress; user: { displayName: string; email: string }; signOutHref: string; icsAdmin?: boolean }) {
  const pathname = usePathname();
  return <aside className="workspace-sidebar simple-sidebar"><a className="workspace-sidebar-brand" href="/dashboard"><img src="/icons/tecrid.svg" width="34" height="34" alt="" /><strong>TECRID</strong></a><div className="workspace-identity"><strong>{organization.name}</strong></div><nav className="workspace-sidebar-nav" aria-label="Workspace navigation">{[...roleNavigation(organizationRole(organization.type), true), ...(["brand", "supplier"].includes(organization.type) ? [{href:"/dashboard/access",label:"Who can see my results"}] : []), {href:"/dashboard/settings/members",label:"Members"}, ...(icsAdmin ? [{href:"/admin/issuers",label:"ICS administration"}] : [])].map(item => <Fragment key={item.href}>{item.href === "/dashboard/settings" ? <span className="workspace-nav-group">Manage</span> : null}<a href={item.href} className={(item.href === "/dashboard/settings" ? pathname === item.href : isCurrentDestination(pathname, item.href)) ? "active" : ""} aria-current={(item.href === "/dashboard/settings" ? pathname === item.href : isCurrentDestination(pathname, item.href)) ? "page" : undefined}>{item.label}</a></Fragment>)}</nav><footer>{user.displayName !== user.email ? <strong>{user.displayName}</strong> : null}<small>{user.email}</small><a href={signOutHref}>Sign out</a></footer></aside>;
}
