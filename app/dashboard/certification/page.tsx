import type { Metadata } from "next";
import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { listCertificationConsole } from "../../../lib/certification";
import { ProductFooter, ProductNav } from "../../site-nav";
import { CertificationClient } from "./certification-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Certification intake — TEC Registry" };

export default async function CertificationPage() {
  const user = await requireChatGPTUser("/dashboard/certification");
  const data = await listCertificationConsole(user);
  const rows = data.intakes.reduce((total, record) => total + record.intake.rowCount, 0);
  const blocked = data.intakes.reduce((total, record) => total + record.intake.blockedRows, 0);
  return <main className="product-page certification-page"><ProductNav compact /><header className="dashboard-header certification-hero"><div><p className="section-kicker light">Certification intake</p><h1>Receive evidence by ID,<br />not by attachment.</h1><p>Give applicants a secure submission link or an API token. TECRID resolves each record, enforces the authority gate, and freezes the exact version reviewed.</p></div><span className="workspace-code">Receiving organization <strong>{data.membership.organization.name}</strong></span></header>
    <div className="certification-shell"><section className="dashboard-summary"><article><span>Programs</span><strong>{data.programs.length}</strong><small>Active submission channels</small></article><article><span>Submissions</span><strong>{data.intakes.length}</strong><small>Latest 100 intakes</small></article><article><span>TECRID rows</span><strong>{rows}</strong><small>No OCR or result re-keying</small></article><article><span>Blocked rows</span><strong>{blocked}</strong><small>Samples or proof failures stopped</small></article></section>
      <CertificationClient programs={data.programs.map((program) => ({ id: program.id, name: program.name, publicToken: program.publicToken, apiTokenPrefix: program.apiTokenPrefix, apiTokenLastFour: program.apiTokenLastFour, active: program.active, createdAt: program.createdAt }))} />
      <section className="dashboard-panel certification-intake-log"><div className="panel-heading"><div><p className="section-kicker">Applicant submissions</p><h2>Validated evidence packages</h2></div></div><p className="panel-copy">Each intake preserves the submitted IDs, validation failures, exact public record snapshots, and one manifest fingerprint. Certification decisions remain outside TECRID.</p><div className="certification-intake-list">{data.intakes.length ? data.intakes.map(({ intake, programName }) => <Link key={intake.id} href={`/dashboard/certification/${intake.id}`}><span className={`record-status record-${intake.status}`}>{intake.status.replaceAll("_", " ")}</span><div><strong>{intake.applicantOrganization}</strong><small>{programName} · {intake.rowCount} rows · {new Date(intake.createdAt).toLocaleString()}</small></div><div><strong>{intake.validRows} valid</strong><small>{intake.blockedRows} blocked</small></div><i>→</i></Link>) : <div className="empty-state"><strong>No certification submissions yet.</strong><p>Create a program, copy its submission link, and let an applicant send a CSV of TECRIDs.</p></div>}</div></section>
    </div><ProductFooter /></main>;
}
