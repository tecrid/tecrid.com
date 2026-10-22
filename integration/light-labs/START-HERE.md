# Light Labs: start here

This package is ready for an integration pilot. It is not a completed installation in Light Labs’ LIMS and does not grant issuer approval. Node.js 22.13+ is required. The standalone scripts have no npm dependencies.

## Sign in and create your lab profile

Go to https://tecrid.com/sign-in and enter your work email. Open the single-use link within 10 minutes. No ChatGPT account or password is required. In the dashboard, create your laboratory profile, then complete issuer onboarding at https://tecrid.com/dashboard/issuance. Email verification does not grant production issuance approval; identity, scope and signing-key review are separate.

Existing ChatGPT users can still use their original sign-in option; email accounts are separate and are not automatically merged. See [work-email setup and operations](../../docs/WORK-EMAIL-SIGN-IN.md).

## 1. Try the eight-report sandbox

Open https://tecrid.com/sample-lab, sign in with your own account, and choose **Run the eight-report API test**. This exercises local signing and server verification with a temporary test key. No Light Labs account approval is required.

For an API trial, create a personal sandbox key at https://tecrid.com/sandbox and supply it through your local secret manager as `TECRID_SANDBOX_API_KEY`. Never paste it into GitHub, a document, or chat. From the repository root:

```sh
node integration/light-labs/sample-lab.mjs /secure/path/kasandrinos-test-results.json
```

Each report should print “sample signature verified”. Repeat the same command: the API should reuse your saved personal proofs. The output contains eight `SBX` references and test proofs; it must never be displayed as laboratory confirmation, a production credential, or VLE qualification.

See [SAMPLE-LAB.md](SAMPLE-LAB.md) for endpoints and the API contract. See the connected [Kasandrinos display](https://vle.exchange/suppliers/kasandrinos#tecrid-test-reports); original PDFs still require VLE buyer access.

## 2. Choose the real-report path

**Existing eight Kasandrinos reports:** use private historical intake at https://tecrid.com/dashboard/reports/new. The original PDFs remain unchanged. Obtain the privately prepared drafts from the pilot owner; they are deliberately not in this public repository. An authorized Light Labs reviewer claims, reconciles, approves disclosure, and signs. Uploading a PDF is not issuance. The current legacy workflow publishes findings only with explicit authority and keeps the PDF private; controlled findings require the appropriate authorized reissue/routing workflow.

**Future reports:** follow [README.md](README.md). Complete laboratory identity, scope and signing-key verification at https://tecrid.com/dashboard/issuance, then configure a dedicated scoped API key and a locally held signing key. Reserve an ID, render it on the new PDF, fingerprint the final bytes, review and sign the canonical findings, then finalize. The README contains exact commands and retry/recovery steps. No production operation is performed by the sandbox command.

## 3. Validate before production cutover

An authorized lab integration owner maps the actual LIMS release event, fields, report template and key storage. Record the LIMS/version and validate against its own test export; the generic client is not a vendor-certified installation.

Acceptance: one unchanged historical report reviewed and signed; one new report reserved, rendered and finalized; signature and source fingerprint independently checked; retry produces no duplicate; revoked/corrected status is recognized; disclosure is correct; VLE matches the production report, sample, lot and fingerprint before displaying a production link. Keep SBX references separate. Follow the repository’s LIMS validation checklist for shadow runs and QA sign-off.

## What has been demonstrated

The registry backend tests use isolated D1/R2 storage and actual Ed25519 test signatures. They cover issuance gates, duplicates, finalization recovery, corrections/revocation, historical PDF preservation, private access, controlled-data redaction and sandbox account isolation. Connector tests cover local encrypted-key signing, unsafe request rejection and denied-write retry behavior. Live checks confirmed the eight test JSON records and human resolver pages.

These checks do not demonstrate Light Labs staff usability, production LIMS installation, or real Light Labs production issuance. Those require the supervised pilot above.

## Where the code lives

- [tecrid-connect](https://github.com/tecrid/tecrid-connect): this runnable package, client tests and lab-facing instructions.
- [tecrid.com](https://github.com/tecrid/tecrid.com): registry APIs, sample-lab pages, schema/migrations, and `tests/issuance-backend.test.ts` plus `tests/sample-lab-route.test.ts`.
- [VLE-HANDOFF.md](VLE-HANDOFF.md): production evidence contract; sample-display instructions are in SAMPLE-LAB.md.

The standalone scripts use `TECRID_BASE_URL`; the existing TypeScript CLI uses `TECRID_API_BASE`. Both default to https://tecrid.com. Do not mix sandbox and production keys. Private drafts, originals, credentials and signing keys are excluded from GitHub.
