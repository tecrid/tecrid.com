import { requireChatGPTUser } from "../chatgpt-auth";
import { getDashboardData } from "../../lib/tec";
import { listLegacyReportsForUser } from "../../lib/legacy-reports";
import { listEvidenceRoutingForUser } from "../../lib/evidence-routing";
import { organizationRole } from "../../lib/roles";
import { ProductNav, ProductFooter } from "../site-nav";
import { RolePicker } from "../role-picker";
import { NotificationBell } from "../notification-center";
import { KasandrinosWorkspaceLink } from "./kasandrinos/workspace";
import { getVerificationProgress } from "./laboratory-progress";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your TECRID home", robots: { index: false } };
export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const data = await getDashboardData(user.userId);
  if (!data) return <main className="product-page"><ProductNav /><RolePicker onboarding /><ProductFooter /></main>;
  const role = organizationRole(data.organization.organizationType);
  const lab = role === "laboratory";
  const controller = role === "brand" || role === "supplier";
  const legacyReports = controller ? await listLegacyReportsForUser(user) : [];
  const routing = controller ? await listEvidenceRoutingForUser(user) : null;
  const progress = getVerificationProgress(data.organization.issuerStatus, data.issuerApplication?.status);
  const actions = lab ? [
    { href: "/dashboard/issuance", label: "Issue a report", copy: "Prepare your next signed laboratory record." },
    { href: "/dashboard/lab-defense", label: "Check a report", copy: "Answer a question about a report you issued." },
  ] : controller ? [
    { href: "/dashboard/reports/new", label: "Add a report", copy: "Start with a laboratory report you already have." },
    { href: "/dashboard/evidence-routing", label: "Review approvals", copy: "Choose who can see your evidence." },
  ] : role === "public" ? [
    { href: "/verify", label: "Verify a report", copy: "Enter a TECRID to check its source and status." },
  ] : [
    { href: "/dashboard/evidence-routing", label: "Request a report", copy: "Ask a brand for the evidence you need." },
    { href: "/dashboard/sharing", label: "Open received evidence", copy: "See reports shared with your organization." },
  ];
  return <main className="product-page simple-dashboard"><ProductNav compact /><header className="simple-dashboard-heading"><p className="section-kicker">Your workspace</p><h1>Welcome back.</h1><p>{data.organization.name}</p><NotificationBell /></header>
    {lab && data.organization.issuerStatus !== "verified" ? <p className="simple-lab-status" role="status">{data.issuerApplication?.status === "submitted" ? "We're verifying your lab, usually 1 business day" : data.issuerApplication?.status === "needs_information" || data.issuerApplication?.status === "rejected" ? progress.detail : "Explore your workspace. We will verify your lab before you issue."} <a href="/dashboard/laboratory">{data.issuerApplication?.status === "submitted" ? "View progress" : "Continue lab verification"}</a></p> : null}
    <section className="simple-primary-actions" aria-label="Your next steps">{actions.map(action => <a key={action.href} href={action.href}><h2>{action.label}</h2><p>{action.copy}</p><span aria-hidden="true">↗</span></a>)}</section>
    {controller ? <><section className="simple-records"><h2>Your reports</h2>{routing?.controllerReceipts.length ? routing.controllerReceipts.map(receipt => <a key={receipt.id} href="/dashboard/evidence-routing#laboratory-reports"><strong>{receipt.credentialIdentifier}</strong><span>Received from your lab</span></a>) : <p>New TECRIDs from your lab will appear here.</p>}{legacyReports.map(report => <a key={report.id} href={`/dashboard/reports/${encodeURIComponent(report.id)}`}><strong>{report.sampleName}</strong><span>{report.status.replaceAll("_", " ")}</span></a>)}</section><KasandrinosWorkspaceLink /></> : null}
    {lab ? <section className="simple-records"><h2>Your reports</h2>{data.records.length ? data.records.map(record => <article key={record.identifier}><strong>{record.sampleName}</strong><span>{record.status}</span>{record.publicRecord ? <a href={`/records/${encodeURIComponent(record.identifier)}`}>Open report</a> : <span>Private draft</span>}</article>) : <p>Your laboratory records will appear here.</p>}</section> : null}
    <ProductFooter /></main>;
}
