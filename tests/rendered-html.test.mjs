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
  assert.match(html, /<meta name="google-site-verification" content="1NWO0uv6B0GJqNBADyugLLo1W4d9dXlJ5T9nEide21Y"/i);
  assert.doesNotMatch(html, /codex-preview|loading skeleton|react-loading-skeleton/i);
});

test("publishes focused search-intent pages, the laboratory one-pager, and agent-guided setup", async () => {
  const [homeResponse, labsResponse, valueResponse, pilotResponse, brandsResponse, recipientsResponse, integrateResponse, sitemapResponse, nav] = await Promise.all([
    render("/"),
    render("/for-laboratories"),
    render("/laboratory-value"),
    render("/laboratory-pilot"),
    render("/for-brands"),
    render("/for-certifiers-retailers"),
    render("/integrate"),
    render("/sitemap.xml"),
    readFile(new URL("../app/site-nav.tsx", import.meta.url), "utf8"),
  ]);
  for (const response of [homeResponse, labsResponse, valueResponse, pilotResponse, brandsResponse, recipientsResponse, integrateResponse, sitemapResponse]) assert.equal(response.status, 200);
  const [home, labs, value, pilot, brands, recipients, integrate, sitemap] = await Promise.all([
    homeResponse.text(), labsResponse.text(), valueResponse.text(), pilotResponse.text(), brandsResponse.text(), recipientsResponse.text(), integrateResponse.text(), sitemapResponse.text(),
  ]);
  assert.match(home, /persistent identifier and verification record for laboratory reports/i);
  assert.match(home, /Certificate of Analysis authentication/i);
  assert.match(home, /Who TECRID serves/);
  assert.match(home, /Founding laboratory pilot/);
  assert.match(labs, /Stop answering the same report question twice/);
  assert.match(labs, /laboratory report verification/i);
  assert.match(value, /Protect the report after it leaves the laboratory/);
  assert.match(value, /The laboratory keeps paying for a report it already finished/);
  assert.match(pilot, /Five production gates/);
  assert.match(pilot, /An account is not an authenticated issuer/);
  assert.match(brands, /governed evidence portfolio/i);
  assert.match(recipients, /Receive laboratory evidence as data/i);
  assert.match(integrate, /Open the repo/);
  assert.match(integrate, /TECRID-INTEGRATION-REPORT\.md/);
  assert.match(integrate, /Human approval still controls identity, secrets, deployment, and production writes/);
  for (const path of ["for-laboratories", "laboratory-value", "laboratory-pilot", "for-brands", "for-certifiers-retailers", "integrate"]) {
    assert.match(sitemap, new RegExp(`https:\\/\\/tecrid\\.com\\/${path}`));
    assert.match(nav, new RegExp(`href="\\/${path}`));
  }
});

test("locks laboratory approval behind evidence, key-control, and conformance gates", async () => {
  const [schema, migration, verificationService, issuerService, dashboardPanel, adminPanel] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0014_spooky_shen.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/issuer-verification.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/tec.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/issuer-application.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/issuers/review-controls.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /issuerApplicationDocuments/);
  assert.match(schema, /issuerVerificationChecks/);
  assert.match(schema, /issuerKeyChallenges/);
  assert.match(migration, /issuer_application_documents_no_update/);
  assert.match(migration, /issuer_key_challenges_identity_immutable/);
  assert.match(verificationService, /TECRIDIssuerKeyConformanceChallenge/);
  assert.match(verificationService, /crypto\.subtle\.verify/);
  assert.match(verificationService, /expiresAt/);
  assert.match(verificationService, /key_control/);
  assert.match(verificationService, /conformance/);
  assert.match(issuerService, /Approval is locked until these verification gates pass/);
  assert.match(issuerService, /"identity", "accreditation", "scope", "key_control", "conformance"/);
  assert.match(dashboardPanel, /Upload private evidence/);
  assert.match(dashboardPanel, /Create 15-minute challenge/);
  assert.match(adminPanel, /approvalReady/);
  await assert.doesNotReject(access(new URL("../app/api/issuer-application/evidence/route.ts", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/api/issuer-application/key-challenge/verify/route.ts", import.meta.url)));
  await assert.doesNotReject(access(new URL("../app/api/admin/issuer-applications/[applicationId]/checks/route.ts", import.meta.url)));
});

test("defines TECRID for people, search engines, and AI answer systems", async () => {
  const [response, homeResponse, robotsResponse, sitemapResponse, styles] = await Promise.all([
    render("/what-is-a-tecrid"),
    render("/"),
    render("/robots.txt"),
    render("/sitemap.xml"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.equal(response.status, 200);
  assert.equal(homeResponse.status, 200);
  assert.equal(robotsResponse.status, 200);
  assert.equal(sitemapResponse.status, 200);
  const [html, home, robots, sitemap] = await Promise.all([
    response.text(), homeResponse.text(), robotsResponse.text(), sitemapResponse.text(),
  ]);
  assert.match(html, /<title>What is a TECRID\? Meaning, purpose and how it works<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/tecrid\.com\/what-is-a-tecrid"/);
  assert.match(html, /TECRID stands for Test Evidence Credential Record Identifier/);
  assert.match(html, /A DOI persistently identifies a research output/);
  assert.match(html, /reduces opportunities for evidence fraud/i);
  assert.match(html, /It does not make fraud impossible/i);
  assert.match(html, /Evidence can cross borders without losing its source/);
  assert.match(html, /Private, controlled or public/);
  assert.match(html, /Maintained by the Institute of Contaminant Standards · Reviewed 29 Aug 2026/);
  assert.match(styles, /\.explainer-definition \{[^}]*font-size: 17px/);
  assert.match(styles, /\.explainer-hero \.explainer-review \{[^}]*font-size: 8px/);
  assert.doesNotMatch(styles, /\.explainer-hero > div > p:not\(\.section-kicker\)/);
  assert.match(home, /href="\/what-is-a-tecrid"/);

  const siteIdentity = [...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .map((match) => JSON.parse(match[1]))
    .find((value) => value["@graph"]?.some((item) => item["@type"] === "WebSite"));
  assert.ok(siteIdentity);
  assert.equal(siteIdentity["@graph"].find((item) => item["@type"] === "WebSite").name, "TECRID");

  const structuredData = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .map((match) => JSON.parse(match[1]))
    .find((value) => value["@graph"]?.some((item) => item["@type"] === "DefinedTerm"));
  assert.ok(structuredData);
  const term = structuredData["@graph"].find((item) => item["@type"] === "DefinedTerm");
  assert.equal(term.name, "TECRID");
  assert.equal(term.alternateName, "Test Evidence Credential Record Identifier");
  assert.match(robots, /Sitemap: https:\/\/tecrid\.com\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/dashboard\//);
  assert.match(sitemap, /https:\/\/tecrid\.com\/what-is-a-tecrid/);
  assert.match(sitemap, /https:\/\/tecrid\.com\/badge/);
  assert.doesNotMatch(sitemap, /\/sandbox|\/demo\//);
});

test("publishes a portable, minification-safe TECRID identity mark and email-signature workflow", async () => {
  const [response, nav, sharingClient, participantDirectory, participantRoute, identifierMark] = await Promise.all([
    render("/badge?code=PFND"),
    readFile(new URL("../app/site-nav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/sharing/sharing-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/participants/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/participants/[issuerCode]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/brand/tecrid-id.svg", import.meta.url), "utf8"),
  ]);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Put your TECRID profile where trust begins/);
  assert.match(html, /Email signature builder/);
  assert.match(html, /The badge is a link—not a blanket endorsement/);
  assert.match(html, /https:\/\/tecrid\.com\/participants\/PFND/);
  assert.match(nav, /\/brand\/tecrid-logo\.png/);
  assert.match(nav, /href="\/badge"/);
  assert.match(sharingClient, /Copy email-signature HTML/);
  assert.match(sharingClient, /tecrid-profile-badge\.png/);
  assert.match(participantDirectory, /className="product-hero participants-hero"/);
  assert.match(participantRoute, /getPublicParticipant/);
  assert.match(participantRoute, /What this profile proves/);
  assert.match(participantRoute, /\/brand\/tecrid-logo\.png/);
  assert.match(identifierMark, /viewBox="0 0 64 64"/);
  assert.match(identifierMark, /fill="#1743E3"/);
  assert.match(identifierMark, /fill="white"/);
  assert.match(identifierMark, /M18 18H46V26H37V42H33V50H27V26H18V18Z/);
  assert.doesNotMatch(identifierMark, /<text|gradient|filter|stroke=/i);
  await assert.doesNotReject(access(new URL("../public/brand/tecrid-id.svg", import.meta.url)));
  await assert.doesNotReject(access(new URL("../public/brand/tecrid-id.png", import.meta.url)));
  await assert.doesNotReject(access(new URL("../public/brand/tecrid-profile-badge.svg", import.meta.url)));
  await assert.doesNotReject(access(new URL("../public/brand/tecrid-profile-badge.png", import.meta.url)));
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
  assert.match(developers, /Open the repository/);
  assert.match(developers, /TECRID Connect/);
  assert.match(developers, /POST \/api\/v1\/credentials/);
  assert.match(developers, /Bearer keys/);
});

test("publishes privacy boundaries that match controlled TECRID workflows", async () => {
  const [response, footer, onboarding, intake, join, issuerApplication, foundingLaunch] = await Promise.all([
    render("/privacy"),
    readFile(new URL("../app/site-nav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/dashboard-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/reports/new/report-intake-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/join/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/issuer-application.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/founding/founding-launch-form.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Private by default/);
  assert.match(html, /A private TECRID cannot be turned into a public record by a requester/);
  assert.match(html, /strict confidentiality rules/i);
  assert.match(html, /global trend analysis/i);
  assert.match(html, /pseudonymized, de-identified, or aggregated data/i);
  assert.match(html, /does not sell confidential evidence/i);
  assert.match(html, /does not use private laboratory reports or controlled findings to train a general-purpose/i);
  assert.match(html, /valid compulsory process/i);
  assert.match(html, /does not change a private TECRID.*registry visibility/i);
  assert.match(html, /human review/i);
  assert.doesNotMatch(html, /cannot be compelled|never disclose under any circumstance/i);
  for (const source of [footer, onboarding, intake, join, issuerApplication, foundingLaunch]) assert.match(source, /href="\/privacy"/);
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
  assert.match(record, /ATL-COCOA-340/);
  assert.match(record, /DEMO-CP-0826/);
  assert.match(record, /DEMO-SMP-260821-04/);
  assert.match(record, /August 21, 2026/);
  assert.match(record, /August 22, 2026/);
  assert.match(record, /August 23, 2026/);
  assert.match(record, /Open fictional source COA/);
  assert.equal(api.tecrid, "TECRID·DEMO-26-HM0001");
  assert.equal(api.sample, true);
  assert.equal(api.productionAuthority, false);
  assert.equal(api.subject.sku, "ATL-COCOA-340");
  assert.equal(api.subject.lotNumber, "DEMO-CP-0826");
  assert.equal(api.subject.sampleId, "DEMO-SMP-260821-04");
  assert.equal(api.report.reportNumber, "DEMO-NS-260823-01");
  assert.equal(api.report.orderNumber, "DEMO-ORD-0821");
  assert.equal(api.report.testNumber, "DEMO-TST-260821-04");
  assert.equal(api.timeline.receivedAt, "2026-08-21");
  assert.equal(api.timeline.testedAt, "2026-08-22");
  assert.equal(api.timeline.releasedAt, "2026-08-23");
  assert.equal(api.results.length, 8);
  assert.equal(api.results.find((row) => row.analyte === "Chromium(VI)").qualifier, "less_than");
  assert.equal(api.sourceDocument.publicPath, "/demo/northstar-demo-heavy-metals-report.pdf");
  const sourcePdf = await readFile(new URL("../public/demo/northstar-demo-heavy-metals-report.pdf", import.meta.url));
  assert.equal(createHash("sha256").update(sourcePdf).digest("hex"), api.sourceDocument.sha256);
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
  assert.match(html, /ICS Certification/);
  assert.match(html, /Third-party certifier/);
  assert.match(page, /Who may receive this SKU/);
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

test("wires controller-gated evidence routing for certifiers, retailers, and government", async () => {
  const [schema, migration, bindingMigration, service, tec, certification, sandboxService, sandboxPage, dashboardPage, dashboardClient, browserRequestRoute, browserGrantRoute, browserAuthorizationRoute, apiRoute, issuanceRoute, developersResponse] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0010_nebulous_old_lace.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0011_chemical_ender_wiggin.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/evidence-routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/tec.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/certification.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/sandbox.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sandbox/sandbox-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/evidence-routing/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/evidence-routing/routing-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/evidence-routing/requests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/evidence-routing/grants/[grantId]/revoke/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/evidence-routing/authorizations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/routing/deliveries/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/credentials/route.ts", import.meta.url), "utf8"),
    render("/developers"),
  ]);

  for (const table of ["evidenceRequests", "evidenceAccessGrants", "routingAuthorizations", "evidenceDeliveries"]) {
    assert.match(schema, new RegExp(table));
  }
  assert.match(schema, /certifierDeliveryStatus/);
  assert.match(schema, /retailerDeliveryStatus/);
  assert.match(migration, /evidence_requests_scope_immutable/);
  assert.match(migration, /evidence_grants_scope_immutable/);
  assert.match(migration, /evidence_deliveries_no_update/);
  assert.match(migration, /routing_authorizations_identity_immutable/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(bindingMigration, /ADD `product_sku`/);
  assert.match(bindingMigration, /PRAGMA optimize/);
  assert.match(service, /RECIPIENT_TYPES.*certification_body.*retailer.*government/s);
  assert.match(service, /CONTROLLER_TYPES.*brand.*supplier/s);
  assert.match(service, /cannot approve broader access/i);
  assert.match(service, /cannot widen a one-time request to future delivery/i);
  assert.match(service, /subset of the requested analytes/i);
  assert.match(service, /tokenHash: await sha256\(plainTextToken\)/);
  assert.match(service, /laboratoryOrganizationId && record\.authorization\.laboratoryOrganizationId/);
  assert.match(service, /eq\(evidenceAccessGrants\.status, "active"\)/);
  assert.match(service, /snapshotFingerprint = await sha256\(snapshotJson\)/);
  assert.match(service, /signed productSku does not match this routing authorization/);
  assert.match(service, /coverageState: missingAnalytes\.length \? "incomplete" : "complete"/);
  assert.match(service, /the registry does not infer a passing result/i);
  assert.match(service, /deliveryMode === "one_time"/);
  assert.match(tec, /Controlled-result issuance requires a current routing authorization/);
  assert.match(tec, /Controlled-result issuance requires productSku/);
  assert.match(tec, /resultsControlled \? \[\]/);
  assert.match(tec, /canonicalPayload: null/);
  assert.match(tec, /signedPayload: null/);
  assert.match(certification, /controlled findings require an evidence delivery grant/);
  assert.match(sandboxService, /No active recipient has an undelivered grant/);
  assert.match(sandboxPage, /ICS Certification/);
  assert.match(sandboxPage, /Approve certifier request/);
  assert.match(sandboxPage, /Revoke future delivery/);
  assert.match(sandboxPage, /invented sandbox values/);
  assert.match(dashboardPage, /Issuer authority is not disclosure authority/);
  assert.match(dashboardClient, /One recipient does not imply another/);
  assert.match(dashboardClient, /recipient-specific evidence packages/);
  for (const route of [browserRequestRoute, browserGrantRoute, browserAuthorizationRoute]) {
    assert.match(route, /rejectCrossOriginWrite/);
    assert.match(route, /getChatGPTUser/);
  }
  assert.match(apiRoute, /authenticateApiRequest/);
  assert.match(apiRoute, /routeExistingCredential/);
  assert.match(issuanceRoute, /controlledRoutingAuthorized/);
  assert.match(issuanceRoute, /productSku must match the SKU bound/);
  assert.match(issuanceRoute, /deliverCredentialWithAuthorization/);
  const developers = await developersResponse.text();
  assert.match(developers, /CONTROLLED ROUTING/);
  assert.match(developers, /POST \/api\/v1\/routing\/deliveries/);
  assert.match(developers, /receive routed evidence/i);
});

test("wires two-pass report marking, controller receipts, legacy API intake, and source-linked insights", async () => {
  const [schema, migration, issuance, routing, reservationRoute, finalizeRoute, legacyRoute, insights, insightsRoute, dashboard, routingPage, developers] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0012_purple_runaways.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/report-issuance.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/evidence-routing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/report-reservations/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/report-reservations/[reservationId]/finalize/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/legacy-reports/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/insights.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/insights/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/insights/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/evidence-routing/routing-client.tsx", import.meta.url), "utf8"),
    render("/developers"),
  ]);
  for (const table of ["reportReservations", "controllerEvidenceReceipts", "organizationNotifications"]) assert.match(schema, new RegExp(table));
  assert.match(migration, /controller_evidence_receipts_no_update/);
  assert.match(migration, /report_reservations_identity_immutable/);
  assert.match(migration, /report_reservations_no_delete/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(issuance, /Reserve a new TECRID and render the report again/);
  assert.match(issuance, /SHA-256 fingerprint and filename of the final TECRID-marked PDF/);
  assert.match(issuance, /reservedIdentifier: reservation\.identifier/);
  assert.match(issuance, /sourceSystem must be generic, labware, labvantage, or starlims/);
  assert.match(routing, /controllerEvidenceReceipts/);
  assert.match(routing, /Full controller receipt|includeControlledResults: true/);
  assert.match(routing, /organizationNotifications/);
  assert.match(reservationRoute, /authenticateApiRequest/);
  assert.match(finalizeRoute, /finalizeReportTecrid/);
  assert.match(legacyRoute, /createLegacyReportForApi/);
  assert.match(insightsRoute, /getEvidenceInsightsForOrganization/);
  assert.match(insights, /descriptive portfolio summaries/);
  assert.match(insights, /latestTecrid/);
  assert.match(dashboard, /Every source remains resolvable/);
  assert.match(routingPage, /The brand or supplier receives the complete signed record first/);
  const developerHtml = await developers.text();
  assert.match(developerHtml, /Reserve\. Render\. Fingerprint\. Sign\. Finalize/);
  assert.match(developerHtml, /POST \/api\/v1\/report-reservations/);
  assert.match(developerHtml, /GET \/api\/v1\/insights/);
  assert.match(developerHtml, /not vendor-certified integrations/i);
  assert.match(developerHtml, /Outbound email is not yet a production claim/);
  await assert.doesNotReject(access(new URL("../public/downloads/tecrid-connect.zip", import.meta.url)));
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

test("renders public verification and an honest laboratory dispute demonstration", async () => {
  const [verifyResponse, demoResponse, client, service] = await Promise.all([
    render("/verify"),
    render("/demo/lab-defense"),
    readFile(new URL("../app/verify/verification-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/lab-defense.ts", import.meta.url), "utf8"),
  ]);
  assert.equal(verifyResponse.status, 200);
  assert.equal(demoResponse.status, 200);
  const [verify, demo] = await Promise.all([verifyResponse.text(), demoResponse.text()]);
  assert.match(verify, /Did this report come/);
  assert.match(verify, /document itself is not uploaded/i);
  assert.match(verify, /Identity and integrity/);
  assert.match(client, /crypto\.subtle\.digest/);
  assert.match(client, /documentSha256: fingerprint/);
  assert.doesNotMatch(client, /FormData|body:\s*file/);
  assert.match(service, /This comparison identifies compatibility and missing context/);
  assert.match(service, /does not determine which laboratory is correct/);
  assert.match(service, /Resolver samples cannot become evidence cases/);
  assert.match(demo, /Stop arguing over/);
  assert.match(demo, /does not declare a winner/i);
  assert.match(demo, /workflow logic, not a claimed customer result/i);
});

test("wires append-only certification intake by share link, CSV, and scoped API", async () => {
  const [schema, migration, manifestMigration, service, apiRoute, browserRoute, manifestRoute, consolePage, submitPage, developers, template] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0008_lazy_shinko_yamashiro.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0009_puzzling_midnight.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/certification.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/certification/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/certification/submit/[token]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/certification/intakes/[intakeId]/manifest/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/certification/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/certify/[token]/page.tsx", import.meta.url), "utf8"),
    render("/developers"),
    readFile(new URL("../public/templates/certification-tecrid-intake.csv", import.meta.url), "utf8"),
  ]);
  for (const table of ["certificationPrograms", "certificationIntakes", "certificationIntakeItems", "verificationChecks", "disputeCases"]) assert.match(schema, new RegExp(table));
  assert.match(migration, /certification_intakes_no_update/);
  assert.match(migration, /certification_intake_items_no_delete/);
  assert.match(migration, /verification_checks_no_update/);
  assert.match(migration, /dispute_evidence_immutable/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(manifestMigration, /manifest_json/);
  assert.match(manifestMigration, /PRAGMA optimize/);
  assert.match(service, /apiTokenHash: await sha256\(plainTextApiToken\)/);
  assert.match(service, /sample TECRIDs have no production authority/);
  assert.match(service, /issuing laboratory is not verified/);
  assert.match(service, /issuer signature is not verified/);
  assert.match(service, /current fingerprint could not be recomputed/);
  assert.match(service, /current row and version history are inconsistent/);
  assert.match(service, /snapshotFingerprint/);
  assert.match(service, /const manifestFingerprint = await sha256\(manifestJson\)/);
  assert.match(apiRoute, /authenticateCertificationIntakeRequest/);
  assert.match(browserRoute, /rejectCrossOriginWrite/);
  assert.match(browserRoute, /getChatGPTUser/);
  assert.match(manifestRoute, /new Response\(record\.intake\.manifestJson/);
  assert.match(consolePage, /Receive evidence by ID/);
  assert.match(submitPage, /Submit a CSV of identifiers/);
  assert.match(await developers.text(), /POST \/api\/v1\/certification\/submissions/);
  assert.match(template, /^tecrid/m);
});

test("wires recipient-bound evidence codes, opt-in participants, and safe result projection", async () => {
  const [schema, migration, sharing, dashboard, participants, redeemRoute, invitationRoute, developers] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0013_nosy_chamber.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/sharing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/sharing/sharing-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/participants/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/v1/share-codes/redeem/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/laboratory-invitations/route.ts", import.meta.url), "utf8"),
    render("/developers"),
  ]);
  for (const table of ["participantProfiles", "evidenceShareCodes", "evidenceShareRedemptions", "laboratoryInvitations"]) {
    assert.match(schema, new RegExp(table));
  }
  assert.match(migration, /share_codes_identity_immutable/);
  assert.match(migration, /share_redemptions_no_update/);
  assert.match(migration, /share_redemptions_no_delete/);
  assert.match(migration, /Paleo Foundation/);
  assert.match(migration, /Heavy Metal Tested & Certified/);
  assert.match(sharing, /recipientOrganizationId/);
  assert.match(sharing, /payloadWithheld/);
  assert.match(sharing, /signedPayload: null/);
  assert.match(sharing, /status: "redeemed"/);
  assert.match(sharing, /portfolio/);
  assert.match(dashboard, /current portfolio/i);
  assert.match(dashboard, /Selected SKUs/);
  assert.match(dashboard, /one-time bearer credential/i);
  assert.match(participants, /What the directory proves/);
  assert.match(redeemRoute, /redeemEvidenceShareCode/);
  assert.match(invitationRoute, /createLaboratoryInvitation/);
  const developerHtml = await developers.text();
  assert.match(developerHtml, /POST \/api\/v1\/share-codes\/redeem/);
  assert.match(developerHtml, /github\.com\/tecrid\/tecrid-connect/);
});

test("gives authenticated organizations a role-aware workspace shell and a real settings destination", async () => {
  const [layout, sidebar, dashboard, settings, profile, application] = await Promise.all([
    readFile(new URL("../app/dashboard/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/workspace-sidebar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/settings/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/settings/profile-settings-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/issuer-application.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /getChatGPTUser/);
  assert.match(layout, /getDashboardData/);
  assert.match(layout, /WorkspaceSidebar/);
  assert.match(sidebar, /usePathname/);
  assert.match(sidebar, /aria-current/);
  assert.match(sidebar, /Laboratory launch/);
  for (const destination of [
    "/dashboard/sharing",
    "/dashboard/lab-defense",
    "/dashboard/certification",
    "/dashboard/evidence-routing",
    "/dashboard/insights",
    "/dashboard/reports/new",
    "/dashboard/credentials/new",
    "/dashboard/settings",
  ]) assert.match(sidebar, new RegExp(destination.replaceAll("/", "\\/")));

  assert.match(dashboard, /className="dashboard-workflow-card sharing-card" href="\/dashboard\/sharing"/);
  assert.match(dashboard, /className="dashboard-workflow-card insights-card" href="\/dashboard\/insights"/);
  assert.match(settings, /robots: \{ index: false/);
  assert.match(settings, /ApiKeyPanel/);
  assert.match(profile, /\/api\/participant-profile/);
  assert.match(profile, /never makes private evidence public/i);
  assert.match(profile, /does not publish TECRIDs or report findings/i);
  assert.match(application, /id="laboratory-verification"/);
});
