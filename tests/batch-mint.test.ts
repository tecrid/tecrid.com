// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { env } from "./support/cloudflare-env";
import { claimInvitedLaboratory, confirmInvitedLaboratory, inviteLaboratoryForAdmin, recordIssuerPublicKey } from "../lib/lab-invite";
import { createIssuerKeyChallenge, reviewIssuerVerificationCheck, uploadIssuerEvidence, verifyIssuerKeyChallenge } from "../lib/issuer-verification";
import { BatchRateLimitError, CREDENTIAL_BATCH_MAX, createCredentialBatch, getCredentialBatchJob } from "../lib/credential-batch";
import { importLegacyBackfill } from "../lib/legacy-backfill";
import { canonicalizeCredential, createApiKey, generateTecridIdentifier, getCredential, getOrganizationForUser, publicCredentialDocument, reviewIssuerApplication } from "../lib/tec";
import { ISSUER_API_SCOPES } from "../lib/api-scopes";
import type { organizations } from "../db/schema";

const admin = { userId: "reviewer-a", email: "first@ics.test", displayName: "First", fullName: null };
const second = { userId: "reviewer-b", email: "second@ics.test", displayName: "Second", fullName: null };
const owner = { userId: "email:light-owner", email: "quality@lightlabs.test", displayName: "Owner", fullName: null };
const inviteInput = {
  legalName: "Light Labs",
  laboratoryAddress: "Ann Arbor, MI",
  laboratoryWebsite: "https://lightlabs.test",
  ownerName: "Laboratory Owner",
  ownerEmail: owner.email,
  accreditationBody: "PJLA",
  accreditationNumber: "L26-904",
  accreditationExpiresOn: "2028-11-30",
  scopeSummary: "ISO/IEC 17025 scope for the Ann Arbor laboratory",
  accreditedSites: "Ann Arbor, MI",
  accreditedAnalytes: "Lead\nArsenic",
};
const lookup = {
  registerUrl: "https://accreditation.test/register/L26-904",
  registerResult: "SYNTHETIC current ISO/IEC 17025 certificate L26-904 and requested scope match",
  registerCheckedAt: "2026-11-10",
};
let mf: Miniflare;
let privateKey: CryptoKey;
let publicJwk = "";
let org: typeof organizations.$inferSelect;

function pdfSha(label: string) {
  return Buffer.from(label).toString("hex").padEnd(64, "0").slice(0, 64);
}

async function sign(text: string) {
  return {
    keyId: "light-key",
    algorithm: "Ed25519" as const,
    signature: Buffer.from(await crypto.subtle.sign("Ed25519", privateKey, new TextEncoder().encode(text))).toString("base64url"),
  };
}

function draft(issuerCode: string, reportId: string, site: string, analyte: string, sha: string) {
  return {
    reportId,
    sampleId: `sample-${reportId}`,
    laboratorySite: site,
    sampleName: "Olive oil",
    releasedAt: "2024-03-15",
    publish: true,
    tecrid: generateTecridIdentifier(issuerCode),
    sourceDocument: { sha256: sha, filename: `${reportId}.pdf`, reportNumber: reportId },
    results: [{ analyte, resultText: "0.02", unit: "mg/kg" }],
  };
}

async function signed(value: ReturnType<typeof draft>) {
  const proof = await sign(canonicalizeCredential(value).canonicalPayload);
  return { ...value, proof };
}

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default {fetch(){return new Response('test')}}",
    compatibilityDate: "2026-05-22",
    d1Databases: ["DB"],
    r2Buckets: ["DOCUMENTS"],
  });
  env.DB = await mf.getD1Database("DB");
  env.DOCUMENTS = await mf.getR2Bucket("DOCUMENTS");
  env.ICS_ADMIN_EMAILS = `${admin.email},${second.email}`;
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    for (const sql of readFileSync(`drizzle/${file}`, "utf8").split("--> statement-breakpoint")) {
      if (sql.trim()) await env.DB.prepare(sql).run();
    }
  }
  await env.DB.prepare("INSERT INTO auth_user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,0,0)").bind(owner.userId.slice(6), "Owner", owner.email).run();
  const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  privateKey = pair.privateKey;
  publicJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.publicKey));
}, 60000);

afterAll(async () => { await mf?.dispose(); });

it("keeps two different admins in charge and flags certificate scope", async () => {
  await expect(inviteLaboratoryForAdmin(admin, { ...inviteInput, accreditedSites: "", accreditedAnalytes: "" })).rejects.toThrow(/sites covered/);
  const invite = await inviteLaboratoryForAdmin(admin, inviteInput);
  expect(invite.issuerStatus).toBe("pending");
  await claimInvitedLaboratory(owner);
  await confirmInvitedLaboratory(owner);
  await recordIssuerPublicKey(owner, { keyId: "light-key", publicKeyJwk: publicJwk });
  const scope = new FormData();
  scope.set("documentType", "accreditation_scope");
  scope.set("document", new File(["%PDF-1.7 synthetic scope"], "scope.pdf", { type: "application/pdf" }));
  await uploadIssuerEvidence(owner, scope);
  const challenge = await createIssuerKeyChallenge(owner);
  await verifyIssuerKeyChallenge(owner, { challengeId: challenge.id, signature: (await sign(challenge.canonicalPayload)).signature });
  for (const checkType of ["identity", "accreditation", "scope"] as const) {
    await reviewIssuerVerificationCheck(admin, invite.applicationId, { checkType, status: "passed", evidenceNote: "Synthetic independent review", ...lookup });
  }
  await expect(reviewIssuerApplication(admin, invite.applicationId, { decision: "approve", reviewNote: "Same admin cannot finish approval" })).rejects.toThrow(/Two different/);
  expect((await getOrganizationForUser(owner.userId))!.organization.issuerStatus).not.toBe("verified");
  const pending = (await getOrganizationForUser(owner.userId))!.organization;
  const tooEarly = await createCredentialBatch(pending, { credentials: [draft(pending.issuerCode, "LL-EARLY", "Ann Arbor, MI", "Lead", pdfSha("early"))] });
  expect(tooEarly.results[0]).toMatchObject({ status: "error" });
  await reviewIssuerApplication(second, invite.applicationId, { decision: "approve", reviewNote: "Second independent review of identity, accreditation, and scope" });
  org = (await getOrganizationForUser(owner.userId))!.organization;
  expect(org.issuerStatus).toBe("verified");
  const key = await createApiKey(owner, "Issuer key", [...ISSUER_API_SCOPES]);
  expect(key.scopes).toEqual([...ISSUER_API_SCOPES].sort());

  const covered = await signed(draft(org.issuerCode, "LL-LEAD", "Ann Arbor, MI", "Lead", pdfSha("lead")));
  const outsideAnalyte = await signed(draft(org.issuerCode, "LL-CADMIUM", "Ann Arbor, MI", "Cadmium", pdfSha("cadmium")));
  const outsideSite = await signed(draft(org.issuerCode, "LL-DETROIT", "Detroit, MI", "Lead", pdfSha("detroit")));
  const minted = await createCredentialBatch(org, { credentials: [covered, outsideAnalyte, outsideSite] });
  expect(minted.summary).toMatchObject({ created: 3, existing: 0, errors: 0 });
  const lead = await getCredential(minted.results[0].tecrid!, true);
  const cadmium = await getCredential(minted.results[1].tecrid!, true);
  const detroit = await getCredential(minted.results[2].tecrid!, true);
  expect(lead!.credential.accreditationLabel).toBe("accredited");
  expect(lead!.credential.siteOnCertificate).toBe(true);
  expect(lead!.results[0].onAccreditedScope).toBe(true);
  expect(cadmium!.credential.accreditationLabel).toBe("accredited");
  expect(cadmium!.results[0].onAccreditedScope).toBe(false);
  expect(detroit!.credential.accreditationLabel).toBe("not_accredited");
  expect(detroit!.credential.siteOnCertificate).toBe(false);
  const leadDocument = publicCredentialDocument(lead!);
  const cadmiumDocument = publicCredentialDocument(cadmium!);
  expect(leadDocument.accreditation).toMatchObject({ label: "accredited", siteOnCertificate: true });
  expect(cadmiumDocument.results[0]).toMatchObject({ onAccreditedScope: false, scopeNote: "Not on the accredited scope." });
  expect(`${cadmiumDocument.accreditation?.note} ${cadmiumDocument.results[0].scopeNote}`).not.toMatch(/in-spec|out-of-spec|pass\/fail|registry/i);
  expect(detroit!.credential.status).toBe("issued");

  const repeat = await createCredentialBatch(org, { credentials: [{ reportId: "LL-LEAD", sampleName: "changed" }] });
  expect(repeat.results[0]).toMatchObject({ status: "existing", tecrid: minted.results[0].tecrid });
  const rows = await env.DB.prepare("SELECT identifier FROM credentials WHERE issuer_report_id=?").bind("LL-LEAD").all();
  expect(rows.results).toHaveLength(1);

  const bad = await signed(draft(org.issuerCode, "LL-BAD", "Ann Arbor, MI", "Lead", pdfSha("bad")));
  bad.proof = { ...bad.proof, signature: "not-a-valid-signature" };
  const partial = await createCredentialBatch(org, { credentials: [bad, await signed(draft(org.issuerCode, "LL-GOOD", "Ann Arbor, MI", "Arsenic", pdfSha("good")))] });
  expect(partial.results.map((item) => item.status)).toEqual(["error", "created"]);
  expect(partial.results[0].reason).toMatch(/signature|proof/i);
  expect(partial.summary).toMatchObject({ created: 1, errors: 1 });

  await expect(createCredentialBatch(org, { credentials: Array.from({ length: CREDENTIAL_BATCH_MAX + 1 }, () => ({})) })).rejects.toThrow(/500/);
  const atCap = await createCredentialBatch(org, { credentials: Array.from({ length: CREDENTIAL_BATCH_MAX }, () => ({})) });
  expect(atCap.results).toHaveLength(CREDENTIAL_BATCH_MAX);
  expect(atCap.summary.errors).toBe(CREDENTIAL_BATCH_MAX);
  const storedJob = await getCredentialBatchJob(org.id, atCap.jobId);
  expect(storedJob?.summary.errors).toBe(CREDENTIAL_BATCH_MAX);
});

it("backfills past reports once, keeps the original date, and mints from the returned payload", async () => {
  const pdf = new TextEncoder().encode("%PDF-1.7 synthetic backfill only\n");
  const sha = Buffer.from(await crypto.subtle.digest("SHA-256", pdf)).toString("hex");
  const item = {
    reportId: "LL-2024-100",
    sampleId: "S-100",
    sampleName: "Olive oil",
    originalReportDate: "2024-03-15",
    laboratorySite: "Ann Arbor, MI",
    sha256: sha,
    filename: "LL-2024-100.pdf",
    results: [
      { analyte: "Lead", resultText: "0.01", unit: "mg/kg" },
      { analyte: "Cadmium", resultText: "0.04", unit: "mg/kg" },
    ],
  };
  const form = new FormData();
  form.set("manifest", JSON.stringify({ items: [item] }));
  form.set("document", new File([pdf], "LL-2024-100.pdf", { type: "application/pdf" }));
  const imported = await importLegacyBackfill(org, owner.userId, { form });
  expect(imported.results[0]).toMatchObject({ status: "created", backfilled: true, originalReportDate: "2024-03-15", minted: false });
  const again = await importLegacyBackfill(org, owner.userId, { json: { items: [item] } }, async () => {
    throw new Error("existing fingerprint must not be downloaded again");
  });
  expect(again.results[0]).toMatchObject({ status: "existing", legacyReportId: imported.results[0].legacyReportId, tecrid: imported.results[0].tecrid });
  const proof = await sign(imported.results[0].canonicalPayload!);
  const minted = await importLegacyBackfill(org, owner.userId, { json: { items: [{ ...item, proof }] } });
  expect(minted.results[0]).toMatchObject({ status: "existing", minted: true, tecrid: imported.results[0].tecrid });
  const record = await getCredential(imported.results[0].tecrid!, true);
  expect(record!.credential.backfilled).toBe(true);
  expect(record!.credential.originalReportDate).toBe("2024-03-15");
  expect(record!.credential.releasedAt).toBe("2024-03-15");
  expect(record!.credential.issuedAt).not.toBe("2024-03-15");
  expect(record!.results.find((row) => row.analyte === "Cadmium")!.onAccreditedScope).toBe(false);
  expect(publicCredentialDocument(record!).backfill).toMatchObject({ backfilled: true, originalReportDate: "2024-03-15" });

  const csvPdf = new TextEncoder().encode("%PDF-1.7 synthetic csv backfill\n");
  const csvSha = Buffer.from(await crypto.subtle.digest("SHA-256", csvPdf)).toString("hex");
  const csv = [
    "reportId,sampleId,sampleName,originalReportDate,laboratorySite,sha256,filename,analyte,resultText,unit",
    `LL-CSV,S-CSV,Olive oil,2023-01-02,"Ann Arbor, MI",${csvSha},csv.pdf,Lead,0.01,mg/kg`,
    `LL-CSV,S-CSV,Olive oil,2023-01-02,"Ann Arbor, MI",${csvSha},csv.pdf,Arsenic,0.02,mg/kg`,
  ].join("\n");
  const csvForm = new FormData();
  csvForm.set("manifest", csv);
  csvForm.set("file", new File([csvPdf], "csv.pdf", { type: "application/pdf" }));
  const csvImport = await importLegacyBackfill(org, owner.userId, { form: csvForm });
  expect(csvImport.summary).toMatchObject({ created: 1, errors: 0 });
  expect(csvImport.results[0]).toMatchObject({ originalReportDate: "2023-01-02", backfilled: true });
  const grouped = await env.DB.prepare("SELECT COUNT(*) AS count FROM legacy_report_results WHERE legacy_report_id=?").bind(csvImport.results[0].legacyReportId).first<{ count: number }>();
  expect(grouped?.count).toBe(2);

  const blocked = await importLegacyBackfill(org, owner.userId, {
    json: { items: [{ ...item, reportId: "LL-URL", sampleId: "S-URL", sha256: "c".repeat(64), pdfUrl: "https://127.0.0.1/report.pdf", filename: "remote.pdf" }] },
  }, async () => { throw new Error("private addresses must not be fetched"); });
  expect(blocked.results[0]).toMatchObject({ status: "error" });
  expect(blocked.results[0].reason).toMatch(/public https/);

  await expect(importLegacyBackfill(org, owner.userId, {
    json: { items: Array.from({ length: 26 }, (_, index) => ({ ...item, reportId: `LL-${index}`, sha256: pdfSha(`extra-${index}`) })) },
  })).rejects.toThrow(/25/);
});

it("rate limits batch calls and still returns the existing TECRID inside the allowance", async () => {
  await env.DB.prepare("DELETE FROM auth_rate_limit").run();
  for (let count = 0; count < 10; count += 1) {
    const result = await createCredentialBatch(org, { credentials: [{ reportId: "LL-LEAD" }] });
    expect(result.results[0]).toMatchObject({ status: "existing" });
  }
  await expect(createCredentialBatch(org, { credentials: [{ reportId: "LL-LEAD" }] })).rejects.toBeInstanceOf(BatchRateLimitError);
});
