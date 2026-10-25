# Native VLE evidence stream

Mint step 4 follow-up. Draft code only. The VLE receiver stays OFF. This producer must ship with the separate consumer repair and the reviewed mint/security chain; passing local tests does not authorize release, production migration, credentials or real delivery.

## Identity and consent

`originatingSupplier` is an exact TECRID organization ID explicitly supplied by the issuer. `tec-credential/3` signs it with the lot/SKU/ingredient and source-document fields. Legacy v1/v2 canonical payloads are unchanged and never silently upgraded. A correction/revocation preserves a previously signed supplier identity; changing it is rejected. Legacy and unmapped records are withheld with a durable reason.

`POST /api/marketplace/mappings` requires a verified ICS operator session and an evidence note documenting review of both registry identities. The separate mapping records TECRID supplier ID, recipient TECRID marketplace organization ID and the VLE supplier ID. An email domain, name or controlling brand is never inferred as a supplier. The implemented authority path is ICS review; no unverified self-service claim is supported. Mapping withdrawal is audited and generates tombstones. Changing a reviewed supplier identity requires a separate remapping review rather than an in-place reassignment.

`POST /api/marketplace/grants/:grantId/consent` requires the controlling organization's owner/admin. Defaults without a consent record are `publicStatus=false`, `brandOrganizationIds=[]`, `expiresAt=null`. Public or downstream expansion requires a controlling brand, explicit boolean/list input and an audit event. `brandOrganizationIds` are exact VLE organization IDs explicitly authorized by that brand. There is no domain-derived or implicit downstream access. A replacement explicitly names `supersedesGrantId` for the same controller, recipient and SKU; cycles and changes to a recorded replacement identity are rejected. Independent grants remain independent.

`GET /api/marketplace/holds` supplies a controller admin with metadata-only processing reasons. It never exposes snapshots. All administration routes require authenticated sessions, server-side capability checks and same-origin writes; forged identity headers do not establish a principal.

## Stream contract

One append-only stream per `(TECRID, recipient TECRID organization)` has ID `SHA-256(JSON.stringify([tecrid, recipientId]))`. The database allocates monotonically increasing positive sequences atomically with immutable event bodies, job completion and the notification-outbox receipt. Grant ID is separate from stream ID. Multiple grants may appear in the same stream. The same job cannot append twice; concurrent reconciliation of unchanged state cannot duplicate that grant's current event. Different controller grants are never combined into a broader payload.

| Field | Meaning |
| --- | --- |
| `schemaVersion`, `environment` | Exactly `vle-evidence/1`, `production`. Sandbox records do not become production evidence. |
| `streamId`, `sequence` | The per-credential/recipient identity and monotonic database sequence. |
| `eventId`, `deliveryId`, `occurredAt` | Stable event and receipt identity plus UTC occurrence time. Retries preserve all body bytes and IDs. |
| `event`, `operation` | Issued/corrected upserts or credential/grant revocation tombstones. Withdrawal reasons are explicit. |
| `recipient` | Exact TECRID marketplace organization ID and type. |
| `credential` | Native middle-dot TECRID, version, status, registry fingerprint, reviewed lab name, issued date, null retest due and exact public verification URL. |
| `credential.program` | `analytical-record`, displayed as Lab result, not a certification. No certification status is inferred. |
| `credential.identity` | Signed `originatingSupplier` in TECRID namespace; reviewed `originatingSupplierId` in VLE namespace; mapping record ID; exact signed ingredient, SKU and supplier lot fields. |
| `grant` | Independent ID, controlling/recipient organizations, current scope, explicit consent, nullable expiry and optional replacement ID. |
| `snapshot`, `snapshotFingerprint` | Grant-restricted registry projection and SHA-256 of `JSON.stringify(snapshot)`. Full-record canonical/signed content is withheld from narrower scopes. |

Upserts require a currently valid issuer signature, registry fingerprint/current version, active recipient/grant/authority, matching signed scope, reviewed mapping and current consent at generation and immediately before dispatch. A queued upsert is canceled if those checks change. The existing authenticated snapshot-read safeguards remain intact. Old `tecrid.delivery/1` marketplace payloads are suppressed; non-marketplace recipients retain their existing contract.

Revocation, loss of recipient eligibility, routing-authority withdrawal, mapping withdrawal, consent changes and replacement-grant state enter durable jobs through database triggers in the same transaction as the triggering change. Native events are immutable. Tombstones contain credential/grant metadata, reason and no snapshot, result, canonical payload or snapshot fingerprint. They do not claim current evidence verification; their authority is the authenticated stream. Consumers must delete the affected payload and retain only minimal audit metadata. A supersession removes the named predecessor grant's payload without deleting unrelated grants.

Ordinary upserts wait for earlier channel deliveries. Tombstones may overtake a failed or delayed earlier upsert, so withdrawal is not starved. Consumers must advance the stream watermark, reject older/duplicate conflicting bodies, and prevent delayed upserts from restoring withdrawn data. Provider outages, disabled channels and terminal failures remain visible operational conditions; transport is not a physical guarantee of erasing already downloaded copies.

## Transport and bounds

The worker uses the existing operator-approved HTTPS webhook hosts, encrypted channel configuration, bounded leases/backoff and raw-byte HMAC-SHA256 header. `X-TECRID-Event-Id` equals the immutable body's ID. A retry changes only the timestamp/signature. Native stream events go to webhooks only; push/email retain the existing metadata-only notification allowlist. Stream receipts appear in the controlling brand's metadata-only delivery timeline and use the existing signed acknowledgment endpoint.

Bodies are bounded below the consumer's 64 KiB limit. Oversized full records are held explicitly; an already shared view receives a metadata-only withdrawal instead of leaving stale results active. Narrower valid grants may continue independently. No result values, private payloads or secret material are written to delivery errors, notifications or logs.

## Release and verification limits

Migration 0024 is schema-only, draft, and was exercised only in disposable D1. Existing-delivery reconciliation is a separate, idempotent operator script at `ops/sql/marketplace-stream-review-queue.sql`, never an automatic migration/deploy step. It requires a separate operator GATE before any production execution. Legacy records without signed supplier identity stay withheld. Replacement lineage is permanent: revoking or withdrawing a replacement never restores its predecessor. Historical stream bodies are retained for operator audit with no recipient read API. The VLE consumer must clear its own payload on tombstones and gate reads on current grant state. Neither this migration nor an activation switch was applied to a live environment.

This draft stacks on existing security #37, which descends from latest mint #24. It does not rewrite #18, #20-#24 or #26-#37. The independent #33 budget correction still needs the ordered main-into-branch propagation already recorded in the security plan. Keep the integrated mint/security release, distinct service credentials, private report storage, paired consumer PR and disposable-account rehearsal as separate operator gates. A physical phone/device SLA is not claimed by intercepted Worker tests.
