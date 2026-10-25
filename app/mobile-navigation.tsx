"use client";
// Native links keep role navigation usable even when the client router is unavailable.
import { usePathname } from "next/navigation";
import { useRole } from "./role-context";
import { roleNavigation, isCurrentDestination } from "../lib/roles";
export function MobileNavigation() {
  const { role, signedIn } = useRole();
  const pathname = usePathname();
  return <nav className="mobile-tab-bar role-tab-bar" aria-label="Mobile navigation">{roleNavigation(role, signedIn).map((item, index) => <a key={item.href} href={item.href} aria-current={isCurrentDestination(pathname, item.href) ? "page" : undefined}><span className="role-tab-symbol" aria-hidden="true">{["⌂", "◎", "+", "⚙"][index]}</span><span>{item.label}</span></a>)}</nav>;
}
