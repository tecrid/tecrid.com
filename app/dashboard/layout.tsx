import { Shell } from "../blue-atlas/shared";
import type { ReactNode } from "react";
import { getChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { getDashboardData } from "../../lib/tec";
import { claimInvitedLaboratory } from "../../lib/lab-invite";
import { WorkspaceSidebar } from "./workspace-sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getChatGPTUser();
  if (user) await claimInvitedLaboratory(user);
  const data = user ? await getDashboardData(user.userId) : null;

  if (!user || !data) return <Shell compact className="atlas-workspace">{children}</Shell>;

  return (
    <Shell minimal className="atlas-workspace has-sidebar"><div className="dashboard-workspace-frame">
      <WorkspaceSidebar
        organization={{
          name: data.organization.name,
          code: data.organization.issuerCode,
          type: data.organization.organizationType,
          issuerStatus: data.organization.issuerStatus,
          plan: data.organization.plan,
        }}
        progress={{
          applicationStatus: data.issuerApplication?.status ?? null,
          hasApiKey: data.keys.some((key) => !key.revokedAt),
          hasCredential: data.records.length > 0,
        }}
        user={{ displayName: user.displayName, email: user.email }}
        signOutHref={chatGPTSignOutPath("/")}
      />
      <div className="dashboard-workspace-main">{children}</div>
    </div></Shell>
  );
}
