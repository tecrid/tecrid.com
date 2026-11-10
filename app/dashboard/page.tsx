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
import { WorkQueue, type QueueRow } from "./work-queue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your TECRID home", robots: { index: false } };

function subjectOf(snapshotJson: string) {
  try {
    const snapshot = JSON.parse(snapshotJson) as { subject?: { sampleName?: string; productSku?: string | null; lotNumber?: string | null } };
    return snapshot.subject ?? {};
  } catch {
    return {};
  }
}

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const data = await getDashboardData(user.userId);
  if (!data) return <main className="product-page"><ProductNav /><RolePicker onboarding /><ProductFooter /></main>;
  const role = organizationRole(data.organization.organizationType);
  const lab = role === "laboratory";
  const controller = role === "brand" || role === "supplier";
  const recipient = role === "retailer" || role === "certification_body";
  const verified = data.organization.issuerStatus === "verified";
  const applicationStatus = data.issuerApplication?.status;
  const progress = getVerificationProgress(data.organization.issuerStatus, applicationStatus);
  const legacyReports = controller ? await listLegacyReportsForUser(user) : [];
  const routing = controller || recipient ? await listEvidenceRoutingForUser(user) : null;
  const rows: QueueRow[] = [];
  if (lab) {
    for (const record of data.records) {
      rows.push({
        id: record.identifier,
        product: record.productSku || record.sampleName,
        lot: record.lotNumber || "Not recorded",
        sample: record.sampleName,
        report: record.identifier,
        href: record.publicRecord ? `/records/${encodeURIComponent(record.identifier)}` : undefined,
        status: record.status,
        needsAction: record.status === "draft",
      });
    }
  }
  if (controller && routing) {
    for (const receipt of routing.controllerReceipts) {
      const subject = subjectOf(receipt.snapshotJson);
      rows.push({
        id: receipt.id,
        product: subject.productSku || receipt.credentialIdentifier,
        lot: subject.lotNumber || "Not recorded",
        sample: subject.sampleName || "Laboratory report",
        report: receipt.credentialIdentifier,
        href: `/records/${encodeURIComponent(receipt.credentialIdentifier)}`,
        status: "received",
      });
    }
    for (const report of legacyReports) {
      rows.push({
        id: report.id,
        product: report.sampleName,
        lot: report.lotNumber || "Not recorded",
        sample: report.sampleName,
        report: report.reportNumber || report.id,
        href: `/dashboard/reports/${encodeURIComponent(report.id)}`,
        status: report.status,
        needsAction: report.status === "awaiting_lab_claim",
      });
    }
  }
  if (recipient && routing) {
    for (const request of routing.requests) {
      if (request.requesterOrganizationId !== data.organization.id) continue;
      rows.push({
        id: request.id,
        product: request.productName,
        lot: "Not recorded",
        sample: request.productSku,
        report: "Request",
        href: "/dashboard/evidence-routing",
        status: request.status === "accepted" ? "active" : request.status,
        needsAction: request.status === "pending",
      });
    }
    for (const delivery of routing.deliveries) {
      if (delivery.recipientOrganizationId !== data.organization.id) continue;
      const subject = subjectOf(delivery.snapshotJson);
      rows.push({
        id: delivery.id,
        product: subject.productSku || subject.sampleName || delivery.credentialIdentifier,
        lot: subject.lotNumber || "Not recorded",
        sample: subject.sampleName || "Laboratory report",
        report: delivery.credentialIdentifier,
        href: `/records/${encodeURIComponent(delivery.credentialIdentifier)}`,
        status: "received",
      });
    }
  }
  const labNext = !verified ? {
    href: "/dashboard/laboratory",
    label: applicationStatus === "invited" ? "Confirm your lab" : applicationStatus === "submitted" ? "View review status" : applicationStatus === "needs_information" ? "Update verification application" : applicationStatus === "rejected" ? "Submit a replacement application" : "Finish verification",
    copy: applicationStatus === "invited" ? "ICS prepared this laboratory. Confirm the details. Issuing stays locked." : applicationStatus === "submitted" ? "We're verifying your lab, usually 1 business day" : progress.detail,
  } : { href: "/dashboard/issuance", label: "Issue a report", copy: "Prepare your next signed laboratory record." };
  const action = lab ? labNext : controller
    ? { href: "/dashboard/reports/new", label: "Add a report", copy: "Start with a laboratory report you already have." }
    : role === "public"
      ? { href: "/verify", label: "Verify a report", copy: "Enter a TECRID to check its source and status." }
      : { href: "/dashboard/evidence-routing", label: "Request a report", copy: "Ask a brand for the evidence you need." };
  return (
    <main className="product-page simple-dashboard app-page">
      <ProductNav compact />
      <header className="simple-dashboard-heading app-heading">
        <p className="section-kicker">Your workspace</p>
        <h1>Welcome back.</h1>
        <p>{data.organization.name}</p>
        <NotificationBell />
      </header>
      {lab && !verified ? <p className="simple-lab-status" role="status">{labNext.copy} <a href="/dashboard/laboratory">{labNext.label}</a></p> : null}
      <section className="simple-primary-actions" aria-label="Your next steps">
        <a href={action.href}><h2>{action.label}</h2><p>{action.copy}</p><span aria-hidden="true">↗</span></a>
      </section>
      {role !== "public" ? <WorkQueue rows={rows} empty={recipient ? "No reports yet." : lab ? "Your laboratory records will appear here." : "New reports will appear here."} /> : null}
      {controller ? <KasandrinosWorkspaceLink /> : null}
      <ProductFooter />
    </main>
  );
}
