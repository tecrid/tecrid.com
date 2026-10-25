# Issuance safety and sandbox key tier

Order TECRID-MINT-TO-PHONE-1, step 6. Stacked on the latency proof PR. PR only. No deployment, production migration, live issuance or automatic delivery activation.

## Production issuance

New issuance requires a source-document SHA-256 hash and filename inside the signed canonical payload. POST `/api/v1/credentials` with `publish: true` also requires an `Idempotency-Key` header, 1 to 120 characters using letters, numbers, period, colon, underscore or hyphen. Keep that key and the exact signed input stable across timeouts and retries. Drafts remain private and do not require an issuance key or source document.

The key is scoped to the laboratory, hashed, bound to a normalized request hash, and committed atomically with the credential, version, routing jobs, audit entry and transactional outbox events. Concurrent identical requests return the same identifier. The first success is HTTP 201; replay is HTTP 200 with `credential.idempotent: true`. A replay returns the original issuance receipt, including its original fingerprint and status. Resolve current status separately; a replay cannot undo a correction or revocation.

A unique partial database index on laboratory plus source-document hash includes issued and revoked credentials. Drafts are excluded. An identical source retry under another key returns the same original credential; changed content or another reserved identifier for that source is HTTP 409. Corrections use the existing version workflow. Keys and source hashes remain consumed after revocation. Idempotency bindings cannot be changed or deleted. A failed conflicting transaction leaves no second credential, version or notification event.

Two-pass report finalization binds issuance to `reservation:<reservation ID>` and the preprinted identifier. Legacy confirmation binds it to `legacy:<report ID>`. Other trusted internal issuance derives a stable key from the signed source hash. Existing resolver records, signature formats, fingerprints and historical source provenance are not rewritten.

An automatically routed SKU must have either a nonempty signed `lotNumber` or a nonempty signed `sourceDocument.intakeId` sample reference. A sample name alone is insufficient. This is checked before new routed issuance and before routing an existing record, with database guards on controller and recipient insertions. Corrections preserve the original signed sample reference. The current-version integrity gate now also checks stored lot and source hash against the signed subject.

## Sandbox registry

Create the existing personal `tec_sandbox_` key in `/sandbox` under API and integrations. The real signed registry endpoints additionally require membership in a laboratory workspace. They use separate sandbox credential and idempotency tables and never insert production credentials, versions, routing jobs, notifications or outbox events. Sandbox requests do not wake production delivery processing. Production `tec_live_` keys are rejected at these endpoints, and sandbox keys remain rejected by the production API.

1. POST `/api/sandbox/v1/credentials/canonicalize` with the test credential and sandbox bearer key. Use synthetic source data, a source hash, `publish: true`, and lot/sample linkage for a SKU.
2. Sign the returned exact UTF-8 `canonicalPayload` locally with an Ed25519 test key. It has the distinct `SandboxTestEvidenceCredential` type, `tecrid.sandbox/1` schema and sandbox environment. This domain-separated signature cannot be promoted to production even if that same key pair is later reviewed for production.
3. POST `/api/sandbox/v1/credentials` with the same subject, `Idempotency-Key`, and `proof: { algorithm: "Ed25519", keyId: "<test key ID>", publicKeyJwk: <public JWK>, signature: "<base64url>" }`. Never send a private key. The server verifies the signature and stores a real signed test record, rather than only changing a demonstration stage.
4. Read or list records with GET `/api/sandbox/v1/credentials/<identifier>` or GET `/api/sandbox/v1/credentials`. Access is limited to the key owner's laboratory workspace. A different laboratory gets 404 for that identifier. Revoking the sandbox key stops access.

Identifiers start with SBX. The document explicitly says `environment: "sandbox"`, `status: "sandbox_issued"`, `productionAuthority: false`, and `issuer.identityVerified: false`. Its test key and evidence do not establish production issuer approval. The production resolver and public credential API do not read this table. The existing fictional scenario and eight sample references are unchanged.

## Migration preflight before an approved release

Migration 0023 does not delete, rewrite or choose between historical records. Before applying it, run this read-only query in the approved target database:

```sql
SELECT organization_id, source_document_hash, COUNT(*) AS record_count
FROM credentials
WHERE source_document_hash IS NOT NULL AND status <> 'draft'
GROUP BY organization_id, source_document_hash
HAVING COUNT(*) > 1;
```

If it returns rows, stop the migration and have the registry operator resolve the historical conflict through an approved provenance decision. The unique index fails closed. No automatic historical deduplication is attempted, and this PR does not run the query on a live database.

After review of the complete stack, the release operator still needs the normal migrations, channel secrets, exact webhook hostname approvals and scheduled recovery before enabling `TECRID_DELIVERY_ENABLED`. No default or live flag is changed by this PR.

## Verification

The isolated D1 tests exercise concurrent issuance, identical source retries under another key, changed key/content conflicts, independent laboratories, revoked-source retries, missing key/hash rejection, database uniqueness and required-source guards, signed lot/sample linkage, and preservation of sample references during correction preparation.

The built Worker tests exercise sandbox key tiers, canonicalization, real signed sandbox issuance, concurrent retry deduplication, cross-laboratory isolation, invalid/private keys, tampered ingredients, domain-separated promotion denial, public resolver exclusion and revocation. Production credential and outbox counts remain zero during sandbox issuance, with no network request.

The complete mint-to-push and UNGATED recipient flow also runs after these safety changes with a signed source hash and idempotency key. All tests use synthetic keys and intercepted providers in isolated Miniflare databases. No production issuance or real notification occurs.
