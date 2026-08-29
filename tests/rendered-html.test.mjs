import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      DB: null,
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the TEC Registry public product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /TEC Registry/);
  assert.match(html, /Lab results that/);
  assert.match(html, /Test Evidence Credential/);
  assert.match(html, /Join the registry/);
  assert.match(html, /TECRID/);
  assert.match(html, /Resolver sample/);
  assert.match(html, /Look up a TECRID/);
  assert.match(html, /Try the sample TECRID/);
  assert.match(html, /Institute of Contaminant Standards/);
  assert.doesNotMatch(html, /codex-preview|loading skeleton|react-loading-skeleton/i);
});

test("renders pricing and API documentation", async () => {
  const [join, developersResponse] = await Promise.all([
    readFile(new URL("../app/join/page.tsx", import.meta.url), "utf8"),
    render("/developers"),
  ]);
  assert.equal(developersResponse.status, 200);
  const developers = await developersResponse.text();
  assert.match(join, /Founding Organization/);
  assert.match(join, /\$2,500/);
  assert.match(join, /buy\.stripe\.com/);
  assert.match(join, /first 10 historical reports/);
  assert.match(join, /What happens next/);
  assert.match(join, /locked_prefilled_email/);
  assert.match(join, /client_reference_id/);
  assert.match(developers, /TEC Registry API/);
  assert.match(developers, /POST \/api\/v1\/credentials/);
  assert.match(developers, /Bearer keys/);
});

test("keeps durable infrastructure, proof enforcement, and production metadata wired", async () => {
  const [hosting, schema, service, migration, proofMigration, intakeMigration, releaseMigration, foundingMigration, intakeService, layout, packageJson] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/tec.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_nosy_gressill.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_clumsy_princess_powerful.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_dapper_ultimatum.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0004_polite_corsair.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0005_smiling_exodus.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/legacy-reports.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "DOCUMENTS"/);
  assert.match(schema, /billingEvents/);
  assert.match(schema, /credentialResults/);
  assert.match(schema, /credentialVersions/);
  assert.match(schema, /issuerApplications/);
  assert.match(schema, /issuerSignature/);
  assert.match(schema, /legacyReports/);
  assert.match(schema, /legacyReportEvents/);
  assert.match(schema, /foundingOnboarding/);
  assert.match(service, /Ed25519/);
  assert.match(service, /crypto\.subtle\.verify/);
  assert.match(service, /TECRID·/);
  assert.match(migration, /DELETE FROM `credentials` WHERE `identifier` = 'TEC·GLP-26-7F3A92'/);
  assert.match(proofMigration, /credential_versions_no_update/);
  assert.match(proofMigration, /credential_versions_no_delete/);
  assert.match(intakeMigration, /legacy_report_source_immutable/);
  assert.match(intakeMigration, /legacy_report_events_no_update/);
  assert.match(releaseMigration, /released_at/);
  assert.match(foundingMigration, /founding_onboarding/);
  assert.match(intakeService, /sourceSha256/);
  assert.match(intakeService, /legacy_report_confirmation/);
  assert.match(intakeService, /ready_for_signature/);
  assert.match(intakeService, /confirmationTokenHash/);
  assert.match(service, /verifyStoredProof/);
  assert.match(service, /signedPayload/);
  assert.match(service, /checkout\.session\.async_payment_succeeded/);
  assert.match(service, /paymentConfirmed/);
  assert.match(layout, /TEC Registry/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.doesNotReject(access(new URL("../drizzle/0000_narrow_vengeance.sql", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/api/v1/health/route.ts", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/api/v1/credentials/canonicalize/route.ts", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/api/v1/credentials/[identifier]/versions/route.ts", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/standard/page.tsx", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/api/legacy-reports/route.ts", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/api/legacy-reports/[reportId]/document/route.ts", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/confirm/[token]/page.tsx", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/dashboard/founding/page.tsx", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/api/founding-onboarding/route.ts", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/admin/founding/page.tsx", import.meta.url)));
  await assert.doesNotReject(access(new URL("../public/og.png", import.meta.url)));
  await assert.doesNotReject(access(new URL("../dist/server/index.js", import.meta.url)));
});

test("explains and exposes the honest historical-report intake path", async () => {
  const response = await render("/submit-report");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /A PDF can begin the process/);
  assert.match(html, /Submission is not verification/);
  assert.match(html, /Start private intake/);
  assert.match(html, /Laboratory signed/);
  assert.doesNotMatch(html, /automatically verified|instant verification/i);
});

test("resolves a reserved sample TECRID without asserting laboratory authority", async () => {
  const [demoResponse, recordResponse, apiResponse] = await Promise.all([
    render("/demo"),
    render("/records/TECRID%C2%B7DEMO-26-HM0001"),
    render("/api/v1/credentials/TECRID%C2%B7DEMO-26-HM0001"),
  ]);
  assert.equal(demoResponse.status, 200);
  assert.equal(recordResponse.status, 200);
  assert.equal(apiResponse.status, 200);
  const [demo, record, api] = await Promise.all([
    demoResponse.text(), recordResponse.text(), apiResponse.json(),
  ]);
  assert.match(demo, /reserved sample namespace/i);
  assert.match(demo, /no production TECRID/i);
  assert.match(record, /You just resolved a TECRID/);
  assert.match(record, /Sample · no live authority/);
  assert.match(record, /This record demonstrates resolution/);
  assert.equal(api.tecrid, "TECRID·DEMO-26-HM0001");
  assert.equal(api.sample, true);
  assert.equal(api.productionAuthority, false);
  assert.equal(api.integrity.issuerSignatureVerified, false);
  assert.equal(
    createHash("sha256").update(api.versions[0].canonicalPayload).digest("hex"),
    api.integrity.fingerprint,
  );
  assert.doesNotMatch(`${demo}${record}`, /Issuer signature verified/);
});

test("renders an isolated fictional lab and two complete dummy findings", async () => {
  const [labResponse, metalsResponse, avocadoResponse] = await Promise.all([
    render("/demo/lab"),
    render("/demo/heavy-metals"),
    render("/demo/avocado-oil"),
  ]);
  assert.equal(labResponse.status, 200);
  assert.equal(metalsResponse.status, 200);
  assert.equal(avocadoResponse.status, 200);
  const [lab, metals, avocado] = await Promise.all([
    labResponse.text(), metalsResponse.text(), avocadoResponse.text(),
  ]);
  assert.match(lab, /Northstar Laboratory Demonstration/);
  assert.match(lab, /Not a registered issuer/);
  for (const analyte of ["Lead", "Mercury", "Arsenic", "Cadmium", "Nickel", "Aluminum", "Chromium[(]VI[)]", "Tin"]) {
    assert.match(metals, new RegExp(analyte));
  }
  assert.match(metals, /Every value is invented/);
  assert.match(avocado, /100% refined avocado oil/);
  assert.match(avocado, /non-avocado vegetable-oil contribution/);
  assert.match(avocado, /UC Davis/);
  assert.doesNotMatch(`${lab}${metals}${avocado}`, /Issuer signature verified/);
});

test("renders a multi-party portal with personal sandbox and API-key boundaries", async () => {
  const [response, route, page, sessionRoute, keyRoute, schema, migration] = await Promise.all([
    render("/sandbox"),
    readFile(new URL("../app/api/sandbox/v1/scenario/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sandbox/sandbox-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sandbox/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sandbox/keys/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0006_dark_micromacro.sql", import.meta.url), "utf8"),
  ]);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Run the workflow from every side/);
  assert.match(html, /Atlas Pantry/);
  assert.match(html, /Northstar Analytical/);
  assert.match(html, /Organization portal/);
  assert.match(html, /API console/);
  assert.match(html, /API &amp; integrations/);
  assert.match(html, /Organization settings/);
  assert.match(html, /Sign in to preserve progress/);
  assert.match(route, /authenticateSandboxApiRequest/);
  assert.match(route, /productionAuthority: false/);
  assert.match(page, /tec_sandbox_/);
  assert.match(page, /Only its one-way hash is stored/);
  assert.match(sessionRoute, /getChatGPTUser/);
  assert.match(keyRoute, /createSandboxApiKey/);
  assert.match(schema, /sandboxSessions/);
  assert.match(schema, /sandboxApiKeys/);
  assert.match(migration, /CREATE TABLE `sandbox_sessions`/);
  assert.match(migration, /CREATE TABLE `sandbox_api_keys`/);
  assert.doesNotMatch(`${sessionRoute}${keyRoute}`, /productionAuthority:\s*true/);
});

test("renders the disclosure-operations wedge as workflow rather than an unproven savings claim", async () => {
  const response = await render("/demo/disclosure-operations");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /One laboratory file/);
  assert.match(html, /Production aggregates/);
  assert.match(html, />12</);
  assert.match(html, />11</);
  assert.match(html, /Mercury result missing/);
  assert.match(html, /People review the exception/);
  assert.match(html, /workflow math, not a claimed customer result/i);
  assert.match(html, /brand records stay distinct from laboratory-issued TECRIDs/i);
  assert.doesNotMatch(html, /10x guaranteed|compliance guaranteed/i);
});

test("wires durable disclosure intake, publication gates, public JSON, and honest authority labels", async () => {
  const [schema, migration, service, dashboard, client, importRoute, publishRoute, publicRoute, publicFeedRoute, publicPage, template] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0007_lovely_phalanx.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/disclosures.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/disclosures/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/disclosures/disclosure-operations-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/disclosures/import/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/disclosures/[batchId]/publish/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public/disclosures/[organizationSlug]/[batchId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public/disclosures/[organizationSlug]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/disclosures/[organizationSlug]/[batchId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/templates/ab899-production-aggregate-template.csv", import.meta.url), "utf8"),
  ]);
  for (const table of ["disclosureProducts", "disclosureImports", "disclosureImportRows", "disclosureBatches", "disclosureResults"]) {
    assert.match(schema, new RegExp(table));
  }
  assert.match(migration, /PRAGMA optimize/);
  assert.match(service, /REQUIRED_DISCLOSURE_ANALYTES/);
  for (const analyte of ["Lead", "Cadmium", "Arsenic", "Mercury"]) assert.match(service, new RegExp(analyte));
  assert.match(service, /source_sha256 must be a 64-character SHA-256 digest/);
  assert.match(service, /Publication is blocked until/);
  assert.match(service, /representation: record\.batch\.labConfirmed \? "laboratory_confirmed" : "brand_disclosure"/);
  assert.match(service, /Disclosure is not a safety or legal-compliance determination|not a safety or legal-compliance determination/i);
  assert.match(dashboard, /One source file/);
  assert.match(client, /Validate and stage/);
  assert.match(client, /Brand disclosure published\. This did not create a laboratory-issued TECRID/);
  assert.match(importRoute, /rejectCrossOriginWrite/);
  assert.match(publishRoute, /publishDisclosureBatch/);
  assert.match(publicRoute, /publicDisclosureDocument/);
  assert.match(publicFeedRoute, /publicDisclosureFeedDocument/);
  assert.match(publicFeedRoute, /format.*csv/);
  assert.match(publicFeedRoute, /Regulator|regulator|disclosures\.csv/);
  assert.match(publicPage, /Brand disclosure · laboratory confirmation pending/);
  assert.match(publicPage, /Suggested citation/);
  assert.match(template, /lead_ppb.*cadmium_ppb.*arsenic_ppb.*mercury_ppb/);
});
