import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { getCertificationProgramByPublicToken } from "../../../lib/certification";
import { ProductFooter, ProductNav } from "../../site-nav";
import { CertificationSubmissionClient } from "./submission-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Submit TECRIDs for certification — TEC Registry" };
type RouteContext = { params: Promise<{ token: string }> };
export default async function CertificationSubmissionPage({ params }: RouteContext) {
  const { token } = await params;
  const program = await getCertificationProgramByPublicToken(token);
  if (!program) notFound();
  const user = await requireChatGPTUser(`/certify/${token}`);
  return <main className="product-page certification-submission-page"><ProductNav compact /><header className="form-page-header certification-submit-hero"><div><p className="section-kicker light">TECRID evidence submission</p><h1>{program.program.name}</h1><p>Submit a CSV of identifiers instead of uploading a folder of laboratory PDFs.</p></div><span className="workspace-code">Receiving organization <strong>{program.organization.name}</strong></span></header><CertificationSubmissionClient token={token} email={user.email} displayName={user.displayName} programName={program.program.name} receiverName={program.organization.name} /><ProductFooter /></main>;
}
