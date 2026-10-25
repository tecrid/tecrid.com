"use client";
/* The existing SVG identity mark is already sized and does not need image transformation. */
/* eslint-disable @next/next/no-img-element */
import { usePathname } from "next/navigation";
import { useRole } from "./role-context";
import { roleNavigation, isCurrentDestination } from "../lib/roles";
export function ProductNav({ compact = false }: { compact?: boolean }) {
  const { role, signedIn, hasWorkspace } = useRole();
  const pathname = usePathname();
  if (hasWorkspace && pathname.startsWith("/dashboard")) return null;
  return <header className={`nav simple-nav ${compact ? "nav-compact" : ""}`}>
    <a className="brand" href={signedIn ? "/dashboard" : "/"} aria-label="TEC Registry home"><img className="brand-mark" src="/icons/tecrid.svg" alt="" width="30" height="30" /><span className="brand-stack"><strong>TEC Registry</strong><small>Institute of Contaminant Standards</small></span></a>
    <nav className="role-desktop-links" aria-label={signedIn ? "Workspace navigation" : "Primary navigation"}>{roleNavigation(role, signedIn).map(item => <a key={item.href} href={item.href} aria-current={isCurrentDestination(pathname, item.href) ? "page" : undefined}>{item.label}</a>)}</nav>
  </header>;
}
export function ProductFooter() {
  return <footer className="site-footer simple-footer"><a href="/privacy">Privacy</a><a href="/privacy#contact">Contact</a></footer>;
}
