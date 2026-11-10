import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { listSharingForUser } from "../../../lib/sharing";
import { organizationRole } from "../../../lib/roles";
import { ProductFooter, ProductNav } from "../../site-nav";
import { SharingClient } from "./sharing-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Evidence sharing, TECRID" };

export default async function SharingPage() {
  const user = await requireChatGPTUser("/dashboard/sharing");
  const data = await listSharingForUser(user);
  const organizationId = data.membership.organization.id;
  if (data.membership.organization.slug.startsWith("setup--")) redirect("/dashboard/setup?return_to=/dashboard/sharing");
  const role = organizationRole(data.membership.organization.organizationType);
  if (role === "retailer" || role === "certification_body") redirect("/dashboard/received");
  const name = (id: string) => data.organizationMap[id]?.name ?? "Unknown organization";
  const codes = data.codes.map((code) => ({
    ...code,
    recipientName: name(code.recipientOrganizationId),
    controllerName: name(code.controllerOrganizationId),
    isController: code.controllerOrganizationId === organizationId,
    scopeValues: JSON.parse(code.scopeJson) as string[],
    analytes: code.analyteScopeJson ? JSON.parse(code.analyteScopeJson) as string[] : [],
  }));
  const redemptions = data.redemptions.map((redemption) => {
    const snapshot = JSON.parse(redemption.packageJson) as {
      grant?: { label?: string; purpose?: string; accessLevel?: string };
      evidence?: Array<{ tecrid?: string | null; subject?: { productSku?: string | null } | null }>;
    };
    return {
      id: redemption.id,
      label: snapshot.grant?.label ?? "Evidence package",
      purpose: snapshot.grant?.purpose ?? "",
      accessLevel: snapshot.grant?.accessLevel ?? "scoped",
      controllerName: name(redemption.controllerOrganizationId),
      recipientName: name(redemption.recipientOrganizationId),
      recordCount: redemption.recordCount,
      packageFingerprint: redemption.packageFingerprint,
      redeemedAt: redemption.redeemedAt,
      records: (snapshot.evidence ?? []).map((item) => ({ tecrid: item.tecrid ?? "TECRID", sku: item.subject?.productSku ?? "No SKU" })),
    };
  });
  return (
    <main className="product-page app-page">
      <ProductNav compact />
      <header className="app-heading">
        <p className="section-kicker">{data.membership.organization.name}</p>
        <h1>Sharing</h1>
        <p>Create a one-time code for selected SKUs, selected TECRIDs, or the current portfolio.</p>
      </header>
      <SharingClient
        organization={{
          name: data.membership.organization.name,
          code: data.membership.organization.issuerCode,
          type: data.membership.organization.organizationType,
          website: data.membership.organization.website,
        }}
        codes={codes}
        redemptions={redemptions}
        invitations={data.invitations.map((invite) => ({ ...invite, skus: JSON.parse(invite.productSkusJson) as string[] }))}
        profile={data.profile ? {
          displayName: data.profile.displayName,
          website: data.profile.website,
          summary: data.profile.summary,
          isPublic: data.profile.isPublic,
          participationStatus: data.profile.participationStatus,
        } : null}
      />
      <ProductFooter />
    </main>
  );
}
