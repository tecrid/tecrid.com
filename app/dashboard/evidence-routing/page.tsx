import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { listEvidenceRoutingForUser } from "../../../lib/evidence-routing";
import { ProductFooter, ProductNav } from "../../site-nav";
import { EvidenceRoutingClient } from "./routing-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Evidence routing — TEC Registry" };

export default async function EvidenceRoutingPage() {
  const user = await requireChatGPTUser("/dashboard/evidence-routing");
  const data = await listEvidenceRoutingForUser(user);
  const organizationId = data.membership.organization.id;
  const name = (id: string) => data.organizationMap[id]?.name ?? "Unknown organization";
  const code = (id: string) => data.organizationMap[id]?.code ?? "—";
  const requests = data.requests.map((request) => ({
    ...request,
    requesterName: name(request.requesterOrganizationId),
    requesterCode: code(request.requesterOrganizationId),
    controllerName: name(request.controllerOrganizationId),
    controllerCode: code(request.controllerOrganizationId),
    direction: request.controllerOrganizationId === organizationId ? "inbound" : "outbound",
    analytes: request.analyteScopeJson ? JSON.parse(request.analyteScopeJson) as string[] : [],
  }));
  const grants = data.grants.map((grant) => ({
    ...grant,
    controllerName: name(grant.controllerOrganizationId),
    recipientName: name(grant.recipientOrganizationId),
    recipientCode: code(grant.recipientOrganizationId),
    isController: grant.controllerOrganizationId === organizationId,
    analytes: grant.analyteScopeJson ? JSON.parse(grant.analyteScopeJson) as string[] : [],
  }));
  const deliveries = data.deliveries.map((delivery) => {
    const snapshot = JSON.parse(delivery.snapshotJson) as {
      subject?: { sampleName?: string };
      results?: Array<{ analyte: string; resultText: string; unit: string }>;
      resultsAccess?: { note?: string; missingAnalytes?: string[] };
    };
    return {
      id: delivery.id,
      grantId: delivery.grantId,
      credentialIdentifier: delivery.credentialIdentifier,
      credentialVersion: delivery.credentialVersion,
      accessLevel: delivery.accessLevel,
      snapshotFingerprint: delivery.snapshotFingerprint,
      deliveredAt: delivery.deliveredAt,
      controllerName: name(delivery.controllerOrganizationId),
      recipientName: name(delivery.recipientOrganizationId),
      sampleName: snapshot.subject?.sampleName ?? "Laboratory evidence",
      resultCount: snapshot.results?.length ?? 0,
      results: snapshot.results ?? [],
      scopeNote: snapshot.resultsAccess?.note ?? null,
      missingAnalytes: snapshot.resultsAccess?.missingAnalytes ?? [],
    };
  });
  const controllerReceipts = data.controllerReceipts.map((receipt) => {
    const snapshot = JSON.parse(receipt.snapshotJson) as {
      subject?: { sampleName?: string; productSku?: string | null };
      results?: Array<{ analyte: string; resultText: string; unit: string }>;
    };
    return {
      id: receipt.id,
      credentialIdentifier: receipt.credentialIdentifier,
      credentialVersion: receipt.credentialVersion,
      snapshotFingerprint: receipt.snapshotFingerprint,
      deliveredAt: receipt.deliveredAt,
      laboratoryName: name(receipt.laboratoryOrganizationId),
      sampleName: snapshot.subject?.sampleName ?? "Laboratory evidence",
      productSku: snapshot.subject?.productSku ?? null,
      results: snapshot.results ?? [],
    };
  });
  const authorizations = data.authorizations.map((authorization) => ({
    ...authorization,
    laboratoryName: name(authorization.laboratoryOrganizationId),
  }));
  const pendingInbound = requests.filter((request) => request.direction === "inbound" && request.status === "pending").length;
  const activeGrants = grants.filter((grant) => grant.status === "active").length;
  return (
    <main className="product-page routing-page">
      <ProductNav compact />
      <header className="dashboard-header routing-hero"><div><p className="section-kicker light">Controlled evidence routing</p><h1>The lab issues.<br />The brand decides who receives.</h1><p>Request access by SKU, approve a narrower scope, authorize a named laboratory, and route signed TECRIDs without moving PDFs between inboxes.</p></div><span className="workspace-code">Controller or recipient <strong>{data.membership.organization.name}</strong></span></header>
      <div className="routing-shell">
        <section className="dashboard-summary"><article><span>Pending requests</span><strong>{pendingInbound}</strong><small>Waiting for this organization</small></article><article><span>Laboratory reports</span><strong>{controllerReceipts.length}</strong><small>Direct brand or supplier receipts</small></article><article><span>Recipient deliveries</span><strong>{deliveries.length}</strong><small>Frozen scoped views</small></article><article><span>Lab routes</span><strong>{authorizations.filter((item) => item.status === "active").length}</strong><small>{activeGrants} active recipient grants</small></article></section>
        <section className="routing-principle"><div><p className="section-kicker light">Separation of authority</p><h2>Issuer authority is not disclosure authority.</h2></div><ol><li><span>01</span><p><strong>Recipient requests</strong> a product, SKU, purpose, and result scope.</p></li><li><span>02</span><p><strong>Brand or supplier grants</strong> one recipient no more than it requested.</p></li><li><span>03</span><p><strong>Named laboratory routes</strong> the signed TECRID with a revocable token.</p></li><li><span>04</span><p><strong>TECRID freezes</strong> the exact recipient-specific view and fingerprint.</p></li></ol></section>
        <EvidenceRoutingClient organization={{ id: organizationId, name: data.membership.organization.name, code: data.membership.organization.issuerCode, type: data.membership.organization.organizationType }} requests={requests} grants={grants} deliveries={deliveries} controllerReceipts={controllerReceipts} authorizations={authorizations} />
      </div>
      <ProductFooter />
    </main>
  );
}
