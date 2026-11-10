import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { adminGate } from "../../../lib/admin-mfa";
import { AdminMfaClient } from "./mfa-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin second factor | TECRID", robots: { index: false, follow: false } };

export default async function AdminSecurityPage() {
  const user = await requireChatGPTUser("/admin/security");
  const token = (await cookies()).get("tecrid_admin_mfa")?.value;
  const gate = await adminGate(user, token ? `tecrid_admin_mfa=${token}` : null);
  if (gate === "denied") notFound();
  if (gate === "ok") redirect("/admin/issuers");
  return (
    <div className="product-page admin-page">

      <header className="dashboard-header"><div><p className="section-kicker light">ICS restricted operation</p><h1>Second factor</h1><p>The email link alone no longer opens admin tools.</p></div></header>
      <AdminMfaClient enrolled={gate === "challenge"} />

    </div>
  );
}
