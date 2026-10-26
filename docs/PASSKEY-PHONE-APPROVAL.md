# PR0b: passkeys and phone review

All users can sign in with a platform passkey from /sign-in. Device verification can be Face ID, Touch ID, fingerprint or screen lock. The existing one-time email link remains the fallback and recovery path. /account/passkeys and the first-login welcome screen offer enrollment. Each enrollment requires a separate, hashed, five-minute, one-use proof issued by a successful email-link callback and bound to that exact session. A copied session cookie alone cannot register a new passkey. No SMS or new identity provider is introduced.

The installed Better Auth passkey plugin uses SimpleWebAuthn. Registration and sign-in explicitly require user verification; registration is session-bound and requires the fresh-email proof. Production uses the configured authentication origin and its RP ID, normally tecrid.com. A different Sites preview hostname cannot reuse a canonical-domain credential; local tests use localhost. No production origin/configuration was changed.

ICS approvers use /admin/issuers: a pending list, then one laboratory per screen with identity/domain/accreditation/scope, private PDFs, signing-key status, register lookup and prior approver names. The decision area has two large buttons: Approve and Request changes / Reject. Both require a reason and a new device ceremony; approval additionally confirms all three checks and register evidence.

Two different independent people must explicitly approve the same evidence version. Saved manual checks alone never count as an approval. Both approvals bind the verified user, current session, application, evidence version, decision and reason to a fresh random challenge with a short expiry. The server verifies the exact origin/RP ID and a registered public key with user verification required. A single database transaction consumes the ceremony, updates its counter, records the vote/audit and applies a final decision only after two votes. Each audit records the credential ID, verification time and UV result. Applicant ownership/membership/contact, changed evidence, revoked sessions/credentials and repeated voters fail closed. Concurrent independent approvals finalize once. Evidence changes invalidate earlier version votes without deleting their audit history.

The signed-in approver gets an in-app bell and a personal unread review count in the mobile bar. Other roles do not get that review tab. Waiting notices are derived from current eligible applications. Submission atomically queues one email for each configured approver; final decisions also queue lab mail and an in-app notice. The opt-in mail adapter is OFF by default. Its code supports atomic claims, stale-claim recovery, bounded retries, stable idempotency identities and stale-recipient/application cancellation. Tests inject a fake transport; no mail is sent by this runner. A real adapter, its contract, scheduling and these bindings require a separate approved operator step:

- TECRID_REVIEW_MAIL_ENABLED
- TECRID_REVIEW_MAIL_URL
- TECRID_REVIEW_MAIL_SECRET

ICS_ADMIN_EMAILS accepts comma-separated mailbox identifiers, trims whitespace and normalizes case. Missing/empty means nobody is an approver. The actual four human identities and their no-lab associations remain operator attestations; no real addresses or values are in fixtures or this report.

## Evidence and limits

The local candidate passes 101 unit/backend/UI tests, 29 compiled/rendered/redirect checks and one HTTP/browser test. The browser test enrolls five virtual platform passkeys, signs in with a passkey, denies enrollment with only a stolen session cookie, denies non-approvers and missing step-up, and exercises all six pairs of four synthetic reviewers through real HTTP and the 390px UI. Twelve review views have no horizontal overflow and twelve private PDF requests return 200. Both before/after-first-approval screenshots are saved in the PR0b packet. This is the narrow passkey/review flow, not the separately ordered issuance or load E2E harness.

The first browser run hit the existing missing-IP shared email limiter. The positive matrix uses distinct synthetic trusted-edge IP fixtures; no application limiter changed. The live edge trust, shared-NAT behavior and volume limits remain release/load checks.

The compiled Worker runs in a local Node HTTP harness with disposable Miniflare D1/R2, not on live Sites. Hosted runtime compatibility still needs a separately authorized rehearsal. Physical iPhone Face ID, Android hardware, Safari and Home Screen installation were not tested. User-verifying virtual Chromium platform authenticators are the evidence here. Email provider delivery remains unconfigured/unverified. Do not claim universal device readiness.

Draft migration 0025_passkey_phone_review.sql adds the private passkey/review/proof tables and evidence-version triggers. It was applied only to disposable local databases. Numbers 0020–0024 are reserved by the unmerged mint/security stack; integrate its schema and journal semantically before release. No production migration, publish or configuration change is authorized. The final metadata snapshot includes the already-existing handwritten 0019 table without recreating it.

New-source focused lint passes. Five existing findings remain in the touched auth/notification files. Typecheck remains at 58 inherited diagnostics, with no new normalized diagnostics. A fresh online npm audit reports the same 26 advisories as the preserved baseline lockfile; none is on a newly added package after selecting patched SimpleWebAuthn server 13.3.3. This is not a clean-dependency/security PASS. Existing security drafts, corrected #33 propagation and Security E2E/F05 gates remain.

Primary references: [Better Auth passkey plugin](https://better-auth.com/docs/plugins/passkey), [SimpleWebAuthn verification](https://simplewebauthn.dev/docs/packages/server), [WebAuthn verification requirements](https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion), [Chromium virtual authenticator API](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/).

## Reproduce without production access

Run npm ci --ignore-scripts, npm run build, npm run test:unit -- --maxWorkers=1 --no-file-parallelism, npm run test:rendered, then npm run test:passkeys with an installed test Chromium executable selected through TECRID_TEST_BROWSER_EXECUTABLE. TECRID_TEST_OUTPUT selects the local output directory. The browser harness creates throwaway D1/R2, blocks external application transports and intercepts synthetic email. It never reads local environment files or production bindings. Never publish its fake fixtures.
