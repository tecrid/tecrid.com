import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { listEvidenceRoutingForUser } from "../../../lib/evidence-routing";
import { organizationRole } from "../../../lib/roles";
import { ProductFooter } from "../../site-nav";
import { EvidenceRoutingClient } from "./routing-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Approvals | TEC Registry" };

export default async function EvidenceRoutingPage() {
  const user = await requireChatGPTUser("/dashboard/evidence-routing");
  const data = await listEvidenceRoutingForUser(user);
  const organizationId = data.membership.organization.id;
  if (data.membership.organization.slug.startsWith("setup--")) redirect("/dashboard/setup?return_to=/dashboard/evidence-routing");
  const role = organizationRole(data.membership.organization.organizationType);
  const name = (id: string) => data.organizationMap[id]?.name ?? "Unknown organization";
  const requests = data.requests.map((request) => ({
    ...request,
    requesterName: name(request.requesterOrganizationId),
    controllerName: name(request.controllerOrganizationId),
    direction: request.controllerOrganizationId === organizationId ? "inbound" : "outbound",
    analytes: request.analyteScopeJson ? JSON.parse(request.analyteScopeJson) as string[] : [],
  }));
  const grants = data.grants.map((grant) => ({
    ...grant,
    controllerName: name(grant.controllerOrganizationId),
    recipientName: name(grant.recipientOrganizationId),
    isController: grant.controllerOrganizationId === organizationId,
    analytes: grant.analyteScopeJson ? JSON.parse(grant.analyteScopeJson) as string[] : [],
  }));
  const authorizations = data.authorizations.map((authorization) => ({
    ...authorization,
    laboratoryName: name(authorization.laboratoryOrganizationId),
  }));
  const recipient = role === "retailer" || role === "certification_body";
  const title = role === "laboratory" ? "Approvals" : recipient ? "Requests" : "Approvals";
  const summary = role === "laboratory"
    ? "Brands approve who can receive evidence. Labs issue the report."
    : recipient
      ? "Ask a brand for evidence, then follow the decision here."
      : "Approve or revoke who can receive evidence.";
  return (
    <main className="product-page app-page">
      <header className="app-heading">
        <p className="section-kicker">{data.membership.organization.name}</p>
        <h1>{title}</h1>
        <p>{summary}</p>
      </header>
      <EvidenceRoutingClient
        organization={{ id: organizationId, name: data.membership.organization.name, code: data.membership.organization.issuerCode, type: data.membership.organization.organizationType }}
        requests={requests}
        grants={grants}
        deliveries={[]}
        controllerReceipts={[]}
        authorizations={authorizations}
      />
      <ProductFooter />
    </main>
  );
}
