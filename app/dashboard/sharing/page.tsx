import type { Metadata } from "next";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { listSharingForUser } from "../../../lib/sharing";
import { ProductFooter, ProductNav } from "../../site-nav";
import { SharingClient } from "./sharing-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Evidence sharing — TEC Registry" };

export default async function SharingPage() {
  const user = await requireChatGPTUser("/dashboard/sharing");
  const data = await listSharingForUser(user);
  const organizationId = data.membership.organization.id;
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
    <main className="product-page sharing-page">
      <ProductNav compact />
      <header className="dashboard-header sharing-hero">
        <div><p className="section-kicker light">Brand-controlled disclosure</p><h1>Share the evidence.<br />Keep the boundary.</h1><p>Create one-time, recipient-bound packages for selected TECRIDs, selected SKUs, or an explicitly broad portfolio. Every redemption is fingerprinted and receipted.</p></div>
        <span className="workspace-code">Organization <strong>{data.membership.organization.issuerCode}</strong></span>
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
