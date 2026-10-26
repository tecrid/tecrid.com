"use client";
// Native links keep role navigation usable even when the client router is unavailable.
import Link from "next/link";
import { ApproverUnreadCount } from "./notification-center";
import { usePathname } from "next/navigation";
import { useRole } from "./role-context";
import { roleNavigation, isCurrentDestination } from "../lib/roles";
export function MobileNavigation() {
  const { role, signedIn, isApprover } = useRole();
  const pathname = usePathname();
  return <nav className="mobile-tab-bar role-tab-bar" aria-label="Mobile navigation">{roleNavigation(role, signedIn).map((item, index) => <a key={item.href} href={item.href} aria-current={isCurrentDestination(pathname, item.href) ? "page" : undefined}><span className="role-tab-symbol" aria-hidden="true">{["⌂", "◎", "+", "⚙"][index]}</span><span>{item.label}</span></a>)}{isApprover?<Link className="approver-review-tab" href="/admin/issuers"><span className="role-tab-symbol" aria-hidden="true">✓</span><span>Approvals <ApproverUnreadCount/></span></Link>:null}</nav>;
}
