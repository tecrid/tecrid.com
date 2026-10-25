# Mint step 4 contract alignment: ASK required

The bridge's 2026-10-25 09:20 decision requires the TECRID sender to match VLE #64's `docs/PROOF-EXCHANGE.md` field for field or open an ASK. This audit takes that ASK path. It does not claim interoperability or activate a receiver.

Audited source:

- TECRID #22: db10682176a602cf27c810245716aeac60d793f5, tree e035f77b542cc2000190b1f2598f73b2b9887461. `lib/recipient-webhook.ts` blob 7d17a38712923077234b5c184f7e0c0206e22e9b.
- VLE #64: ca263d9f90f81baccd2806562e442096289779b3. `server/proof-contract.js` blob 099f0bef24405e2eff54eef85665eb8f046994c2. Local copies match the exact files fetched from GitHub.
- Existing mint step 6: TECRID #24 cd4746531f1b25f7025fa979e2b5a5c020ba028b, tree 9567189a3a45a6ca554dfec03941963d9ac0c12a. The locally revalidated complete stack has this exact tree.

## Field-by-field comparison

| Required VLE field or behavior | Existing sender source | Alignment needed |
| --- | --- | --- |
| `schemaVersion=vle-evidence/1`, `environment=production` | `tecrid.delivery/1`; no environment | Separate marketplace envelope. Keep push/email notification contract unchanged. |
| `deliveryId`, `eventId` | Nested delivery ID and metadata event ID | Stable top-level stream receipt IDs, valid in both systems. |
| Monotonic `sequence` | No per-credential/grant stream sequence | Persist sequence and immutable event body atomically; retries must not change the body. |
| `event` and `occurredAt` | `evidence_routing.delivered`; lifecycle metadata only; no top-level occurrence time | Issued, corrected, revoked and grant-revoked stream events with event timestamps. |
| `recipient.type`, `organizationId` | Recipient ID nested in delivery | Explicit marketplace recipient projection. |
| `credential.tecrid`, `version`, `status` | Nested identifier/version; registry uses issued | Map issued to active. VLE's ASCII-only identifier validator rejects every normal middle-dot TECRID and native lifecycle event IDs containing one. Coordinated receiver repair is required. |
| `program` | Analytical credential has no signed program field | Do not substitute a certification program from a recipient request. Decide a neutral analytical-record label or add explicit sourced metadata. |
| `issuingLab`, `issuedAt`, `retestDue` | Reviewed issuer name and issuance time available; no retest policy | Use the reviewed name and issuance date; null retestDue is allowed. Do not infer a due date. |
| `verificationUrl`, `fingerprint` | Registry URL and credential fingerprint available; snapshot fingerprint is a different digest | Project the exact registry URL and current credential fingerprint, never substitute a snapshot digest. |
| `verification.signatureVerified`, `fingerprintVerified`, `currentVersion` | Checked before current snapshot delivery | Project current server checks as HMAC-authenticated attestations. Preserve checks for each event version, including revocation. |
| Signed `identity.originatingSupplierId` | Canonical payload signs ingredientCode/SKU/lotNumber, but no registry supplier identity | A controlling brand ID and a display-name submittingParty are not proof of originating supplier identity or a VLE team mapping. Add an explicit signed stable supplier identity and reviewed cross-registry mapping. Preserve old signature domains. |
| Signed lot identity | Ingredient/SKU/lot number signed | Preserve exact codes. Define supplier lot number mapping explicitly; never match by brand name or category. |
| `grant.id`, recipient, status, accessLevel | Stored in existing grant | Available; keep controller isolation. |
| `grant.publicStatus` | No explicit public-status consent field | Default false. Existing recipient access does not authorize public proof. Add an explicit owner-approved consent field before enabling any public wall. |
| `grant.expiresAt` | Existing grants have no expiry | Null faithfully means no expiry; do not invent one. |
| `grant.brandOrganizationIds` | No explicit downstream VLE organization scope | Empty array is the safe default. Any nonempty value needs explicit mapped downstream consent. |
| Revocation and correction invalidations | Lifecycle payload stays notification-only; grant revoke writes an audit event without a marketplace tombstone | Persist a metadata-only invalidation stream for previous recipients. Current delivery gates must continue blocking findings after revoke while allowing an authenticated tombstone. |
| Multiple grants for one TECRID | TECRID can route independent controller grants | VLE stores one lot/grant identity per TECRID and rejects a changed grant ID. Agree the stream identity and replacement-grant behavior. |
| Raw-body HMAC and five-minute verification | Same header convention | Compatible transport authentication does not repair an incompatible schema. |

## Reproducible evidence

Run from this TECRID checkout:

```sh
node scripts/audit-vle-boundary.mjs /absolute/path/to/VLE-checkout
```

`boundary-checks.json` records 10 passing characterization checks against the exact VLE consumer source: the documented producer schema is rejected with 422; a notification-only body is rejected; an ASCII synthetic control passes; a native middle-dot TECRID and its lifecycle event ID fail; missing supplier identity, program, public consent and downstream scope fail; and an HMAC-valid producer-format body still fails schema validation. These are contract-boundary probes using synthetic metadata. They do not execute an actual producer-to-consumer delivery and do not claim a successful integration. There are zero database or network calls, and the HMAC key is generated at runtime and never saved or printed.

The existing full mint stack was also revalidated without application changes: production build, 102 unit/backend tests across 28 files, and 28 rendered/redirect checks passed. Its exact tree matches #24. Its own provider-interception E2E evidence remains at `docs/verification/mint-step-6/integrated-latency-and-push.json` in #24. Passing those tests does not test the VLE #64 contract. No live phone SLA or cross-site acceptance is claimed.

## ASK to Elon

Recommended: retain `vle-evidence/1` and authorize a coordinated contract repair. TECRID step 4 adds durable marketplace stream events, a backward-compatible signed originating-supplier identity, explicit public/downstream consent with false/empty defaults, and metadata-only invalidation delivery. VLE receives a narrowly scoped identifier/parser repair and agreed grant-stream identity behavior in a separate PR stacked on #64. For records without the required signed supplier identity, withhold marketplace evidence and show a clear mapping-needed reason; do not infer a supplier or rewrite old signatures. Use a neutral analytical-record label only after its contract meaning is agreed. Receiver activation remains a later Elon gate.

Alternative: keep both sides disabled and defer marketplace integration until the identity/consent contract is separately specified. Do not relabel the current sender as compatible or enable the receiver with a translator that invents fields.

This follow-up changes audit documentation and its read-only probe only. Application code, database schema and migrations remain unchanged. The heads of #18, #20, #21, #23, #24 and VLE #64 remain unchanged. No merge, deploy, real issuance, production migration, email or notification occurred.
