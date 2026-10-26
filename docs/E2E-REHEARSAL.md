# Disposable HTTP rehearsal (TECRID-E2E-1)

This harness reuses the PR0b compiled-worker HTTP wrapper, email interception,
Chromium platform authenticator and throwaway Miniflare D1/R2 pattern. It imports
no private application issuing function. All onboarding, review, key, issuance,
public resolution, withdrawal and suspension business actions use loopback HTTP.
It is a synthetic rehearsal, never proof of a real identity or accreditation.

## Run

Use the pinned lockfile and Node >=22.13; install dependencies without lifecycle
scripts if needed. No new dependencies are introduced by this patch.

```
npm ci --ignore-scripts
npm run build
TECRID_TEST_BROWSER_EXECUTABLE="/path/to/test/chromium" npm run test:e2e
TECRID_E2E_VOLUME=1 TECRID_E2E_OUTPUT=/absolute/disposable/output \
  TECRID_TEST_BROWSER_EXECUTABLE="/path/to/test/chromium" npm run test:e2e
```

The harness does not accept a remote target URL, read `.env`, or load hosting
secrets. It chooses a loopback-only disposable port, intercepts fake mail in
memory, denies external application fetches, and restricts browser page requests
to that local origin. Ed25519 private keys, WebAuthn material, session tokens and
API bearer plaintext remain in memory. Receipts contain statuses, durations,
counts and sanitized route templates, never cookies or bearer values. Do not
save browser storage, traces, HARs, database dumps, or authenticator credentials.

## Fixture boundary

Four synthetic ICS accounts and six distinct synthetic applicants authenticate
by intercepted email link and enroll user-verifying virtual platform passkeys.
The display name is supplied in the actual magic-link signup HTTP input. Each
laboratory submits its scope PDF, work-domain evidence and public Ed25519 key via
HTTP, proves key control, and gets two explicit passkey-confirmed decisions. All
six pairs of the four reviewers run; repeated or applicant-associated reviewers
fail. Register lookup results are synthetic inputs, not real register checks.

The harness FIRST observes that the approved laboratory, active membership and
passkey still cannot create a write key while the personal identity is pending.
There is no provider integration or supported HTTP setter for verified identity.
Only then does the fixture phase pre-establish ONE synthetic external attestation
in the throwaway database:

```
UPDATE issuer_people SET identity_status='verified',identity_verified_at=? WHERE id=?
```

This is the only fixture mutation after schema initialization. It applies only
to a synthetic account. The positive API rehearsal must always be described as
conditional on this pre-established external prerequisite. It is not pure-HTTP
end-to-end provider onboarding and cannot establish production readiness.

## Database layout

The disposable setup applies the checked-in SQL files, sorted by filename,
0000 through 0019 followed by 0025_passkey_phone_review.sql and
0026_issuer_people.sql. The exact filenames are written to runtime-receipt.json.
It does NOT use or rewrite the production migration ledger. Missing 0020-0024 and
the draft 0025/0026 semantic journal reconciliation remain a release gate.
No production migrations, D1 rows, R2 objects, or hosting settings are touched.

## Measurements and limits

Volume mode sends 5,000 single-record issuance requests (each preceded by real
HTTP canonicalization), then 1,000 write-key creation requests. Concurrency is
four, with ONE fixed synthetic trusted-edge IP. No limits are disabled, no load
traffic rotates IP, and no generated fixture IDs are counted as issued. The six
controlled onboarding fixtures use separate synthetic trusted-edge IP addresses;
that mode is separate from both fixed-IP load and shared-NAT email abuse probes.

CSV latencies measure server handler wall time through body materialization,
excluding network transit and caller signing. Aggregate phase+route p50/p95 use
nearest-rank percentiles; overall operation durations include client overhead.
Database row/unique-ID/audit counts are read after the actions. Load with no 429
is evidence of observed permissiveness, not proof of the absent #33 limiter.
The pinned corrected #33 commit is not an ancestor of this baseline.

## Unsupported flows and interpretation

No batch endpoint is implemented here. The S1 proposal below is a separate gate.
Raw reference JSON/CSV exports and PDF OCR have no importer in this snapshot.
LabWare/LabVantage/STARLIMS strings are accepted reservation source labels only;
they are not vendor parsers. Thermo's selector is rejected. Files in fixtures/
are OUR synthetic shapes, not vendor exports or support claims. The COA is a
valid plainly synthetic one-page PDF; the signed source fingerprint binds bytes
but does not prove laboratory contents or OCR. A changed PDF must not resolve.

The current HTTP controls cover API-key revocation, credential revocation, and
lab suspension. There is no distinct laboratory-authority-revocation HTTP action.
Physical Face ID, Safari, iOS Home Screen, actual provider/register integration,
hosted Sites plans and hosted D1 throughput are unverified. The public 390px
screenshot is evidence of rendering, not a claim that every table fits mobile.
Existing security release F05 remains open and the VLE receiver remains OFF.

## S1 batch proposal (ten lines; not implemented)

1. Add a separately approved POST /api/v1/credentials/batch route.
2. Require current verified lab, named verified person and scoped active key.
3. Require request idempotency key and per-item stable client reference.
4. Bind a canonical request hash to lab, actor, key and idempotency key.
5. Bound initial batch size to 50 and total request bytes explicitly.
6. Verify every item's Ed25519 signature before committing its issuance.
7. Return per-item success/error, stable TECRID, and a partial-failure summary.
8. Commit each item's credential/results/version/audit attribution atomically.
9. Replays return stored results; changed content under the same key is refused.
10. Test concurrent retries, partial failure, offboarding, quotas and D1 overhead.
