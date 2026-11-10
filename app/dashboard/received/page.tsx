import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { listEvidenceRoutingForUser } from "../../../lib/evidence-routing";
import { listSharingForUser } from "../../../lib/sharing";
import { organizationRole } from "../../../lib/roles";
import { ProductFooter } from "../../site-nav";
import { WorkQueue, type QueueRow } from "../work-queue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Received reports | TECRID", robots: { index: false } };

function subjectOf(snapshotJson: string) {
  try {
    const snapshot = JSON.parse(snapshotJson) as { subject?: { sampleName?: string; productSku?: string | null; lotNumber?: string | null }; evidence?: Array<{ tecrid?: string | null; subject?: { productSku?: string | null } | null }> };
    return snapshot;
  } catch {
    return {};
  }
}

export default async function ReceivedPage() {
  const user = await requireChatGPTUser("/dashboard/received");
  const routing = await listEvidenceRoutingForUser(user);
  const sharing = await listSharingForUser(user);
  const organization = routing.membership.organization;
  if (organization.slug.startsWith("setup--")) redirect("/dashboard/setup?return_to=/dashboard/received");
  const role = organizationRole(organization.organizationType);
  if (role === "brand" || role === "supplier" || role === "laboratory") redirect("/dashboard");
  const rows: QueueRow[] = [];
  for (const delivery of routing.deliveries) {
    if (delivery.recipientOrganizationId !== organization.id) continue;
    const subject = subjectOf(delivery.snapshotJson).subject;
    rows.push({
      id: delivery.id,
      product: subject?.productSku || subject?.sampleName || delivery.credentialIdentifier,
      lot: subject?.lotNumber || "Not recorded",
      sample: subject?.sampleName || "Laboratory report",
      report: delivery.credentialIdentifier,
      href: `/records/${encodeURIComponent(delivery.credentialIdentifier)}`,
      status: "received",
    });
  }
  for (const redemption of sharing.redemptions) {
    if (redemption.recipientOrganizationId !== organization.id) continue;
    const snapshot = subjectOf(redemption.packageJson);
    const first = snapshot.evidence?.[0];
    rows.push({
      id: redemption.id,
      product: first?.subject?.productSku || "Shared package",
      lot: "Not recorded",
      sample: "Shared package",
      report: first?.tecrid || redemption.id,
      status: "received",
    });
  }
  return (
    <main className="product-page app-page">
      <header className="app-heading">
        <p className="section-kicker">{organization.name}</p>
        <h1>Received</h1>
        <p>Reports shared with your organization.</p>
        <a className="button-dark" href="/dashboard/evidence-routing">Request a report</a>
      </header>
      <WorkQueue rows={rows} empty="No reports yet." />
      <ProductFooter />
    </main>
  );
}
