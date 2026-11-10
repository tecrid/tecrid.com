import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { getOrganizationForUser } from "../../../../lib/tec";
import { LegacyReportIntakeForm } from "./report-intake-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private report intake, TECRID",
  robots: { index: false, follow: false },
};

export default async function NewLegacyReportPage() {
  const user = await requireChatGPTUser("/dashboard/reports/new");
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) redirect("/dashboard");
  if (membership.organization.slug.startsWith("setup--")) redirect("/dashboard/setup?return_to=/dashboard/reports/new");
  return (
    <div className="product-page">

      <header className="app-heading">
        <p className="section-kicker">{membership.organization.name}</p>
        <h1>Add a report</h1>
        <p>Upload a private laboratory report and name the lab. Nothing is issued until that lab claims and signs it.</p>
      </header>
      <section className="legacy-intake-shell">
        <LegacyReportIntakeForm />
      </section>

    </div>
  );
}
