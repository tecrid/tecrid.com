# VLE recipient webhook contract

Order TECRID-MINT-TO-PHONE-1, step 4. VLE registers a `marketplace` organization. Its identity must be verified, and the controlling brand or supplier must approve the recipient's grant and select it in a laboratory standing authorization. The configurable terms gate applies when enabled. Register an organization webhook in `/dashboard/notifications`; an operator must approve the exact HTTPS hostname. Save the secret when shown once. No VLE endpoint is implemented in this PR.

## Envelope

All notifications carry `eventId`, `event`, `sku` (nullable) and an authenticated dashboard `url`. Push and email always contain only that metadata. A webhook for `evidence_routing.delivered` additionally carries `schemaVersion: "tecrid.delivery/1"` and this `delivery` object:

| Field | Meaning |
| --- | --- |
| `id` | Stable snapshot delivery ID. Deduplicate evidence by this ID. |
| `grantId` | Grant that authorized this recipient's snapshot. |
| `controllerOrganizationId`, `recipientOrganizationId` | Exact authority and destination. Reject an unexpected destination. |
| `tecrid`, `version` | Registry identifier and positive integer record version. |
| `link.verificationUrl` | Public verification page at `/records/<TECRID>`. Controlled results remain withheld there. |
| `link.productSku`, `link.ingredientCode`, `link.lotNumber` | Nullable signed subject identifiers. Ingredient codes use the v2 signature. Match an ingredient when present, otherwise the SKU; retain the original lot link. A source ingredient does not prove a finished product. |
| `accessLevel` | `status_only`, `selected_analytes` or `full_record`. |
| `snapshotJson` | Exact UTF-8 JSON snapshot as a JSON string, already restricted to the grant. Parse only after verifying its fingerprint. |
| `snapshotFingerprint` | Lowercase SHA-256 hex digest of the exact UTF-8 `snapshotJson` bytes. |
| `fingerprintAlgorithm` | `SHA-256`. |
| `deliveredAt` | Time the authorized snapshot was saved in TECRID. This is distinct from webhook acceptance time. |

Status-only snapshots have no result values or signed payloads. Selected-analyte snapshots contain only selected results and withhold full canonical/signed payloads. Full-record snapshots require a full-record grant. A registry extraction is not a new laboratory signature; retain the snapshot fingerprint, grant, scope, and original integrity fields.

Before sending, TECRID checks the current organization gate, active grant, active routing authority, exact recipient, snapshot fingerprint, issuer signature, record fingerprint and current version again. A revoked, tampered or superseded snapshot is withheld. Corrected and revoked lifecycle events remain metadata-only invalidations; mark the stored view stale and resolve through an authenticated authorized workflow. Never treat an earlier frozen snapshot as proof that a newer version is valid.

## Consumer acceptance

1. Read the raw HTTP body without reserializing it. Enforce a suitable body-size limit for the receiver.
2. Parse `X-TECRID-Signature: t=<unix-seconds>,v1=<hex>` and reject timestamps outside five minutes. Compute HMAC-SHA256 with the channel secret over `<timestamp>.<raw-body-bytes>` and compare in constant time. Validate signature before parsing or using content.
3. Confirm `X-TECRID-Event-Id` equals the body's `eventId`. Deduplicate notification processing by event ID, and evidence updates by `delivery.id`. Verify the recipient and schema version. Reject unsupported scopes and malformed identifiers.
4. Verify SHA-256 over the UTF-8 snapshot string. Check snapshot TECRID/version match the envelope. Match a real lot by signed ingredient/lot or SKU linkage. An unmatched record stays pending; do not invent a lot or infer proof for an unconfirmed private-label release.
5. Persist the received-at time, event ID, delivery ID, version, scope, fingerprint and authorized snapshot atomically. Return HTTP 2xx only after durable acceptance. Do not publish result values outside the grant. Keep evidence from different controllers separate even when an ingredient code matches.

TECRID retries non-2xx responses and transport failures with backoff. Event and delivery IDs are stable across retries; the timestamp and signature can change. The worker does not follow redirects. Ten failed attempts are visible as failed in the organization delivery log. A 2xx response records transport acceptance, not a human view. Explicit acknowledgment is a separate timeline operation added in step 5.

There is no automatic retry guarantee within 60 seconds during a provider outage. Initial dispatch wakes on writes when enabled; an operator must configure scheduled recovery. Automation remains off by default pending the safety release. This PR neither deploys nor enables it.

## Verification

`tests/marketplace-delivery.test.ts` exercises marketplace onboarding, the existing request and grant workflow, all three disclosure levels, exact snapshot fingerprints, HMAC over the scoped body, metadata-only lifecycle events, cross-recipient denial, tampering, revocation and stale-record rejection. Tests use synthetic identities and isolated databases with intercepted outbound requests.

## Explicit acknowledgment (step 5)

The webhook headers also include `X-TECRID-Channel-Id` and `X-TECRID-Acknowledgment-Url`. After durable consumer acceptance, POST to that URL with JSON `{ "eventId": "<received event>", "channelId": "<received channel>" }`. Sign its exact body bytes with the same channel secret and the same timestamp/HMAC header format. The timestamp must be within five minutes. Only a dispatched event belonging to that active webhook channel can be acknowledged. Repeating the acknowledgment preserves its first timestamp. The URL carries no bearer secret.

An acknowledgment can race the original HTTP response and is accepted while that job is sending or delivered. The timeline keeps transport acceptance and acknowledgment separate. HTTP 2xx from the original endpoint alone never sets acknowledged. A signed consumer acknowledgment is not a human-read claim.
