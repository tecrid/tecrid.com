import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { adminGate } from "../../../../lib/admin-mfa";
import { listInvitedLaboratoriesForAdmin } from "../../../../lib/lab-invite";
import { ProductFooter } from "../../../site-nav";
import { InviteLabForm } from "./invite-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invite a lab | TECRID", robots: { index: false, follow: false } };

export default async function InviteLabPage() {
  const user = await requireChatGPTUser("/admin/issuers/invite");
  const token = (await cookies()).get("tecrid_admin_mfa")?.value;
  const gate = await adminGate(user, token ? `tecrid_admin_mfa=${token}` : null);
  if (gate === "denied") notFound();
  if (gate !== "ok") redirect("/admin/security");
  const invited = await listInvitedLaboratoriesForAdmin(user);
  return (
    <main className="product-page app-page">
      <header className="app-heading">
        <p className="section-kicker">ICS</p>
        <h1>Invite a lab</h1>
        <p>Create a laboratory workspace and a pending application. The owner signs in and confirms. The laboratory stays unverified until two different ICS admins approve it.</p>
        <nav className="app-tabs" aria-label="ICS review"><a href="/admin/issuers">Issuer applications</a><a href="/admin/reports">Report intake audit</a><a href="/admin/founding">Founding launches</a></nav>
      </header>
      <InviteLabForm />
      <section className="work-queue">
        <h2>Waiting for the laboratory</h2>
        {invited.length ? (
          <table className="work-table">
            <thead><tr><th>Laboratory</th><th>Owner</th><th>Status</th><th>Invite</th></tr></thead>
            <tbody>
              {invited.map((row) => (
                <tr key={row.id}>
                  <td>{row.legalName}<br /><small>{row.issuerCode}</small></td>
                  <td>{row.ownerName}<br /><small>{row.ownerEmail}</small></td>
                  <td>Unverified</td>
                  <td><a href={row.mailto}>Send invite email</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="queue-empty"><strong>No laboratory invites waiting.</strong></div>}
      </section>
      <ProductFooter />
    </main>
  );
}
