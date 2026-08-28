import assert from "node:assert/strict";
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
  assert.match(html, /Demonstration record/);
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
  assert.match(join, /Membership purchases workflow and implementation/);
  assert.match(developers, /TEC Registry API/);
  assert.match(developers, /POST \/api\/v1\/credentials/);
  assert.match(developers, /Bearer keys/);
});

test("keeps durable infrastructure, proof enforcement, and production metadata wired", async () => {
  const [hosting, schema, service, migration, proofMigration, intakeMigration, releaseMigration, intakeService, layout, packageJson] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/tec.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_nosy_gressill.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_clumsy_princess_powerful.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_dapper_ultimatum.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0004_polite_corsair.sql", import.meta.url), "utf8"),
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
  assert.match(service, /Ed25519/);
  assert.match(service, /crypto\.subtle\.verify/);
  assert.match(service, /TECRID·/);
  assert.match(migration, /DELETE FROM `credentials` WHERE `identifier` = 'TEC·GLP-26-7F3A92'/);
  assert.match(proofMigration, /credential_versions_no_update/);
  assert.match(proofMigration, /credential_versions_no_delete/);
  assert.match(intakeMigration, /legacy_report_source_immutable/);
  assert.match(intakeMigration, /legacy_report_events_no_update/);
  assert.match(releaseMigration, /released_at/);
  assert.match(intakeService, /sourceSha256/);
  assert.match(intakeService, /legacy_report_confirmation/);
  assert.match(intakeService, /ready_for_signature/);
  assert.match(intakeService, /confirmationTokenHash/);
  assert.match(service, /verifyStoredProof/);
  assert.match(service, /signedPayload/);
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

test("keeps the sample honest and separate from the live registry", async () => {
  const response = await render("/demo");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Demonstration only/);
  assert.match(html, /no public TECRID/i);
  assert.match(html, /excluded from the live resolver and public API/i);
  assert.doesNotMatch(html, /Issuer signature verified/);
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
