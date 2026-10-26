# PR0c — Named laboratory issuers

This is a local draft follow-up to PR0b head 8ebe1c1fc8c57f05fcba8791bfba11f90d76043b. It adds laboratory-person authority, server-recorded attribution, and offboarding. It does not connect an identity provider.

A person signs in using their own confirmed work-email account, registers their own device passkey, and requests a lab membership at /dashboard/team. The lab owner or admin approves membership. The request email must exactly match the domain pinned from the independently approved lab application; an editable website cannot change that domain. A person cannot silently transfer from another existing workspace. ICS can inspect named people using the team link from the lab review page.

Membership approval leaves identity_status=pending. No public request, admin action, provider callback, or environment switch in this patch can mark identity verified. Until a separately approved government-ID provider integration supplies a verified result, production issuance remains closed. No government IDs, selfies, biometric data, provider tokens, or real provider calls are collected here. The provider choice, costs, enrollment/reverification/privacy policy, and integration remain deferred.

## Issuance and attribution

The authenticated actor must be an active approved lab member, personally identity-verified, still using a confirmed account on the pinned domain, and have their own stored passkey. The lab must currently be verified. These checks re-read current database state. Write API keys belong to the creating user and their stable issuer-person ID. Existing unbound keys cannot write; read-only keys remain available to other organization roles.

API issuance, revisions, report finalization, and legacy confirmation all pass the named actor to the same issuance service. API identity comes from the authenticated key, never request-body attribution. Every new issued credential and version receives issuer person ID, user ID, internal display-name snapshot, server timestamp, lab, and API key ID when applicable. The audit event stores the same attribution in the issuance transaction. Original credential attribution remains immutable; a correction or revocation records its own acting person in the new version.

The lab signing key and Ed25519 content verification remain in place. Person attribution is a registry assertion and enters the registry fingerprint; this patch does not claim a separate personal cryptographic signature over the analytical payload. The stored passkey requirement is an enrollment gate, not a fresh passkey ceremony on every API issuance.

Public JSON includes the lab and opaque stable person ID. Internal user IDs, personal names, email addresses, and API key IDs are excluded from public version selection and public canonical payloads. The private lab team page shows recent issuance names and original attribution. Historical records lacking attribution remain explicitly unknown; no person is invented.

Draft SQL migration 0026 adds the people table and attribution fields. Database triggers recheck active person/account/domain/passkey/key and current lab at credential/version insertion, so an authority snapshot cannot outlive offboarding during signing. A draft-to-public update is guarded too. Attribution cannot be rewritten on an already public credential. The migration pins historical lab domains only when an approved application carries the current signup verification audit marker. No people or identity results are backfilled.

## Offboarding and release limits

A lab owner/admin can remove a person. ICS can suspend a person or the whole lab. Each action requires a reason and commits status, key revocation, and audit together. Person identity failure also revokes bound keys through a trigger. Every attempted write rechecks person and lab; deleting their passkey also immediately prevents writes. Past records retain attribution and remain verifiable. Suspension cannot be cleared by applicant resubmission; a database guard also covers a concurrent submission. Recovery, reinstatement, approver-roster governance, accreditation expiry, and withdrawal notifications to external peers are separate queued work.

Apply this patch only on the completed PR0b bundle/tree. Draft migrations 0025/0026 must be reconciled with the separate security PR stack and migration journal by the integration owner. They have only run against disposable local D1. Do not apply them to production from this handoff. Existing legacy write keys require named-person re-enrollment and rotation after an approved ID integration; there is no bypass.

## Validation

- 109/109 unit/backend/UI tests in 26 files: eight new PR0c cases, real P-256 fixture passkeys, disposable D1, Ed25519 issuance/revisions, domain and account substitution denial, pending identity and missing passkey denial, unowned-key denial, public privacy, immutable history, stale-authority database guard, offboarding/audit rollback, and whole-lab suspension.
- 29/29 compiled Worker/rendered/redirect checks; local build passes.
- Real compiled HTTP/browser regression: original six review pairs and virtual platform authenticators still work. Two extra synthetic owner/staff passkeys exercise the 390px membership request, owner approval, pending-ID write-key denial, roster isolation, and ICS person suspension. Private/no-store headers and two team views without horizontal overflow are checked.
- New PR0c source/tests lint passes; lint across all changed TypeScript has one inherited unused _props finding in dashboard-client.tsx. Typecheck has the same 58 inherited diagnostics as PR0b, with no new normalized diagnostics. Existing lint/dependency debt is not claimed clean.
- Physical Face ID, Safari/Home Screen, real government-ID verification, provider integration, production migrations, mail delivery, load and complete issuance HTTP E2E are not proven. The new E2E chat owns the full lifecycle and volume harness.

Reproduce locally with npm run test:unit -- --maxWorkers=1 --no-file-parallelism, npm run build, npm run test:rendered, and TECRID_TEST_LAB_PEOPLE=1 TECRID_TEST_OUTPUT=../../outputs/PR0c TECRID_TEST_BROWSER_EXECUTABLE=<existing Chromium path> npm run test:passkeys. The browser test intercepts email links and blocks external transports; it does not send real mail.
