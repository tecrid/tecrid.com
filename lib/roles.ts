export const roles = [
  { id: "brand", label: "Brand", detail: "See your reports and choose who can access them." },
  { id: "supplier", label: "Supplier", detail: "Keep evidence with the products you supply." },
  { id: "laboratory", label: "Lab", detail: "Prepare and issue signed laboratory reports." },
  { id: "certification_body", label: "Certification body", detail: "Request and receive the evidence you need." },
  { id: "retailer", label: "Retailer", detail: "Receive reports from the brands you work with." },
  { id: "public", label: "Other", detail: "For journalists and anyone checking a report." },
] as const;
export type Role = typeof roles[number]["id"];
export const ROLE_COOKIE = "tecrid_role_v1";
export function parseRole(value: unknown): Role | null {
  return roles.some(role => role.id === value) ? value as Role : null;
}
export function organizationRole(type: string): Role {
  if (type === "government") return "certification_body";
  return parseRole(type) ?? "public";
}
export function roleNavigation(role: Role, signedIn = false) {
  if (role === "public") return [
    { href: "/verify", label: "Verify" },
    { href: "/what-is-a-tecrid", label: "What is a TECRID" },
    { href: signedIn ? "/dashboard/settings" : "/sign-in", label: signedIn ? "Settings" : "Sign in" },
  ];
  const home = { href: "/dashboard", label: "Home" };
  const settings = { href: "/dashboard/settings", label: "Settings" };
  if (role === "brand" || role === "supplier") return [home,
    { href: "/dashboard/evidence-routing", label: "Approvals" },
    { href: "/dashboard/reports/new", label: "Add a report" }, settings];
  if (role === "laboratory") return [home,
    { href: "/dashboard/issuance", label: "Issue" },
    { href: "/dashboard/evidence-routing", label: "Approvals" }, settings];
  return [home, { href: "/dashboard/evidence-routing", label: "Requests" },
    { href: "/dashboard/sharing", label: "Received" }, settings];
}
export function isCurrentDestination(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
