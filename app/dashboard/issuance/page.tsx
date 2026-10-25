/* eslint-disable @next/next/no-html-link-for-pages */
import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getDashboardData } from "../../../lib/tec";
import { ProductFooter } from "../../site-nav";
export const dynamic = "force-dynamic";
export const metadata = { title: "Issue a report | TECRID", robots: { index: false } };
export default async function IssuanceReadiness() {
  const user = await requireChatGPTUser("/dashboard/issuance");
  const data = await getDashboardData(user.userId);
  if (!data || data.organization.organizationType !== "laboratory") redirect("/dashboard");
  const verified = data.organization.issuerStatus === "verified";
  return <main className="product-page simple-dashboard"><header className="simple-dashboard-heading"><p className="section-kicker">Laboratory</p><h1>Issue a report.</h1><p>{data.organization.name}</p></header>
    {!verified ? <p className="simple-lab-status" role="status">{data.issuerApplication?.status === "submitted" ? "We're verifying your lab, usually 1 business day" : "Explore and prepare private drafts while you complete lab verification."} Issuing stays locked until ICS approves your lab.</p> : null}
    <section className="simple-primary-actions" aria-label="Your next step"><a href={verified ? "/dashboard/credentials/new" : "/dashboard/laboratory"}><h2>{verified ? "Prepare a report" : "Continue lab verification"}</h2><p>{verified ? "Create a private draft for your laboratory to review and sign." : "Share your lab details in four short steps."}</p><span aria-hidden="true">↗</span></a></section>
    <section className="simple-records"><details><summary>Report tools</summary><p><a href="/dashboard/credentials/new">Prepare a private draft</a></p><p><a href="/dashboard/reports/new">Add an existing report</a></p><p><a href="/dashboard/settings#api-keys">Connect your laboratory system</a></p><p><a href="/downloads/laboratory-connector.zip" download>Download the laboratory connector</a></p><p>A submitted PDF stays private. The named laboratory must claim, confirm, and sign it before issuance. Public results require explicit disclosure authorization. Existing signature, fingerprint, version, and issuer approval checks apply.</p></details></section><ProductFooter /></main>;
}
