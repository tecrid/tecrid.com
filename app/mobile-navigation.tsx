"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { NotificationCount } from "./notification-center";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/", label: "Home", path: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" },
  { href: "/verify", label: "Verify", path: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Zm-4 9 3 3 5-6" },
  { href: "/dashboard", label: "Workspace", path: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z" },
  { href: "/notifications", label: "Alerts", path: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Zm5 3h4" },
];

const sections = [
  { title: "Get started", links: [["Join the registry", "/join"], ["Sign in", "/sign-in"], ["Submit a report", "/submit-report"], ["Sample laboratory", "/sample-lab"]] },
  { title: "Understand", links: [["What is a TECRID?", "/what-is-a-tecrid"], ["Why TECRID", "/why"], ["FAQ", "/faq"], ["The standard", "/standard"], ["Participants", "/participants"], ["Verified issuers", "/issuers"]] },
  { title: "For organizations", links: [["Laboratories", "/for-laboratories"], ["Lab go-time pack", "/laboratory-go-time"], ["Laboratory value", "/laboratory-value"], ["Laboratory pilot", "/laboratory-pilot"], ["Brands & suppliers", "/for-brands"], ["Certifiers & retailers", "/for-certifiers-retailers"]] },
  { title: "Tools & resources", links: [["Sandbox", "/sandbox"], ["Agent-guided setup", "/integrate"], ["API & integrations", "/developers"], ["TECRID badge", "/badge"], ["Pricing", "/pricing"], ["Privacy", "/privacy"]] },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        summary.current?.focus();
      }
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && menu.current?.open && !menu.current.contains(event.target)) menu.current.open = false;
    }
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);

  return <nav className="mobile-tab-bar" aria-label="Mobile navigation">
    {destinations.map(({ href, label, path }) => {
      const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
        <span>{label}</span>{href === "/notifications" ? <NotificationCount /> : null}
      </Link>;
    })}
    <details className="mobile-more" ref={menu}>
      <summary ref={summary}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg><span>More</span></summary>
      <div className="mobile-more-panel">
        <div className="mobile-more-heading"><strong>Explore TECRID</strong><button type="button" onClick={() => { if (menu.current) menu.current.open = false; summary.current?.focus(); }}>Close <span aria-hidden="true">×</span></button></div>
        {sections.map(({ title, links }) => <section key={title} aria-label={title}><h2>{title}</h2>{links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => { if (menu.current) menu.current.open = false; }}>{label}<span aria-hidden="true">↗</span></Link>)}</section>)}
        <p className="mobile-install-note">Keep TECRID on your iPhone: open Safari’s Share menu and choose Add to Home Screen.</p>
      </div>
    </details>
  </nav>;
}
