import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getDashboardData } from "../../../lib/tec";
import { IssuerApplicationPanel } from "../issuer-application";
import { IssuerKeyButton } from "../issuer-key-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Laboratory", robots: { index: false, follow: false } };

export default async function LaboratorySetup() {
  const user = await requireChatGPTUser("/dashboard/laboratory");
  const data = await getDashboardData(user.userId);
  if (!data || data.organization.organizationType !== "laboratory") redirect("/dashboard");
  const verified = data.organization.issuerStatus === "verified";
  const status = data.issuerApplication?.status;
  const title = verified ? "Your lab is verified." : status === "invited" ? "Confirm your lab." : status === "submitted" ? "Waiting on ICS review." : status === "needs_information" ? "Update verification application." : status === "rejected" ? "Submit a replacement application." : "Finish lab verification.";
  const summary = verified
    ? "You can issue signed reports."
    : status === "submitted"
      ? "We're verifying your lab, usually 1 business day. Issuing stays locked until two different ICS admins approve."
      : status === "invited"
        ? "ICS filled in this laboratory. Confirm the details. Issuing stays locked until two different ICS admins approve."
        : "Finish verification before you can issue a report.";
  return (
    <div className="product-page app-page">
      <header className="app-heading">
        <p className="section-kicker">Laboratory</p>
        <h1>{title}</h1>
        <p>{summary}</p>
        {verified ? <a className="button-dark" href="/dashboard/issuance">Issue a report</a> : <a href="/dashboard">Back to Home</a>}
        {verified ? <IssuerKeyButton /> : null}
      </header>
      <IssuerApplicationPanel application={data.issuerApplication} issuerStatus={data.organization.issuerStatus} documents={data.issuerDocuments} checks={data.issuerChecks} confirmedEmail={user.userId.startsWith("email:") ? user.email : null} />

    </div>
  );
}
