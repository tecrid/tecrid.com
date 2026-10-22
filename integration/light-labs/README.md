# Laboratory connector installation

New here? Read [START-HERE.md](START-HERE.md) first. Run the commands below from this directory.

This package operates the existing TECRID v1 API. It does not grant laboratory authority. Node.js 22 or later is required; there are no npm dependencies. Run on the laboratory's controlled workstation or service host. The currently supported automated route is **new marked reports**; use the existing private legacy intake for unchanged historical PDFs.

## Owners and inputs before production

- Laboratory authorized representative: legal entity, authority role, site and contact. Confirm the contact with the lab; a printed PDF email is not account authorization.
- Quality manager: current competence/accreditation evidence, approved matrices/analytes/methods/sites and exclusions. ICS reviewer records the identity, competence and scope decisions.
- Laboratory signing owner: Ed25519 public key ID/JWK, successful challenge and conformance; retain encrypted private key locally or use the laboratory HSM/signing service.
- Kasandrinos account owner: confirmed account, disclosure authority and product SKU/routing authorization if findings are restricted.
- Integration owner: LIMS/vendor/version or manual report workflow, export format and sample JSON, report release trigger, stable report/revision IDs, PDF rendering template, deployment host/OS, outbound HTTPS access, secret manager, retry operator.

Visit `/dashboard/issuance` for actual workspace readiness. Complete `/dashboard#laboratory-verification`. No real laboratory was approved by this installation work.

## Credentials and key custody

Create a dedicated **Laboratory report connector** key at `/dashboard/settings#api-keys` with `read`, `reports:write`, `credentials:write`. It cannot perform other organization write operations. Existing old keys retain their original access; rotate deliberately. An intake-only operator uses `read`, `legacy:write`. Revoke unused keys in the same screen.

Set `TECRID_API_KEY` using your secret manager. Set `TECRID_KEYSTORE_PATH` to the encrypted keystore on the laboratory host and supply `TECRID_KEY_PASSPHRASE` only for local signing. Do not paste these into chat, commit them, or ship a private key with this package. No command transmits the private key or passphrase. A lab HSM can instead add the API's `{keyId, algorithm: "Ed25519", signature}` proof to the reviewed job without running the local `sign` command.

`TECRID_BASE_URL` defaults to `https://tecrid.com`. HTTPS is mandatory except localhost. Each saved job is bound to its environment. Job files contain confidential analytical data and must remain on the controlled host; the connector writes them mode 0600. A proxy/logger must redact bearer tokens and analytical bodies.

## Demonstration sandbox

```sh
node connector.mjs sandbox
```

This exercises the existing demonstration state transitions with fictional records. **It is not a cryptographic production issuance test.** The registry repository’s [`tests/issuance-backend.test.ts`](https://github.com/tecrid/tecrid.com/blob/main/tests/issuance-backend.test.ts) separately exercises the real backend using isolated D1/R2 and generated test signing keys, including onboarding gates, key control, signatures, revisions, duplicates and access denials. Neither test approves Light Labs or creates a real TECRID.

## New reports: reserve → render → fingerprint → review → sign → finalize

1. Copy `reservation.example.json`. Set the actual product name/SKU and laboratory report reference. Set a stable `idempotencyKey` derived from the laboratory job and revision, without patient/customer identifiers. Reuse it after every uncertain response. Restricted findings also need the current brand-controlled `routingToken` before reservation.
2. Reserve and retain the job:

```sh
node connector.mjs reserve reservation.json job.json
```

3. Render the returned `reservation.reportMark` on the **new** PDF using the laboratory report template. Do not modify historical originals. The reservation expires after 48 hours by default (maximum 168); an expired reservation requires an explicitly new revision/job and rerendered report. Do not automatically generate a new idempotency key after failures.
4. Copy `credential.example.json`; enter exact sample/lot, testing/release dates, results, units, qualifiers and LOQs. Use `numericValue: null` for ND, NR and censored values. `sourceDocument.reportNumber` and `productSku` must match the reservation. Set `visibility: "controlled"` only with the authorized routing token used in reservation; otherwise choose public disclosure only with authority.

```sh
node connector.mjs prepare job.json credential.json final-marked.pdf unsigned.json
```

5. An authorized lab reviewer compares the PDF and canonical payload, analytical scope, qualifier/unit fidelity and disclosure. Then sign on the lab host:

```sh
node connector.mjs sign unsigned.json signed.json --reviewed
node connector.mjs finalize signed.json receipt.json --approved
```

Only the reviewed public key can validate the signature. A suspended/unverified lab cannot issue. Authentication and a CLI flag do not replace the laboratory's internal approval process.
6. Verify the current issued identifier:

```sh
node connector.mjs verify 'TECRID·YOUR-IDENTIFIER' verification.json
```

For controlled findings this command fails closed until supplied an authorized full document through the recipient workflow; it does not treat public metadata as full verification. Use the existing `/dashboard/evidence-routing` and `/dashboard/sharing` recipient grants/share-code workflow.

## Failure and retry behavior

The connector retries bounded network failures, 429 and selected 5xx only for replay-safe reservation/finalization. Reservation uniqueness is enforced in D1 per laboratory/idempotency key; changed content under that key is rejected. Finalization checks existing signed content and recovers a committed credential if the reservation marker update was interrupted. A changed payload cannot silently replace an issued report. A `finalizing` job without a committed credential requires operator investigation; no automatic second issuance is attempted. Preserve the job and all response receipts.

400: correct the input, expired reservation or idempotency mismatch. 403: check key scope, issuer approval, signature or routing authorization; do not retry with broader credentials automatically. A `routingWarning` means issuance succeeded but delivery needs reconciliation in the routing workspace; never issue a second credential to fix delivery.

## Historical Light Labs reports

Use the separately prepared `light-labs-handoff/drafts` JSON files and unchanged PDFs. At `/dashboard/reports/new`, import one draft, attach its matching original, confirm the invited lab contact and submit private intake. Copy the secure link for the authorized lab reviewer. No message is sent automatically. The lab claims, reviews, signs and authorizes **public** findings publication; the PDF stays private. This legacy route does not support controlled findings; if public disclosure is not authorized, keep the intake private and arrange the existing controlled report/reissue workflow with the laboratory and brand. Do not relabel a historical test as a new test or alter its original PDF.

## Corrections and revocation

Never replace a signed payload in place. The issuer calls `POST /api/v1/credentials/{identifier}/canonicalize` with `action: "correct"` or `"revoke"` and a reason; signs the returned canonical revision locally; submits the same request plus proof to `/versions`. Verify current status again afterward. Historical versions and original source fingerprints remain linked. A changed original document requires explicit laboratory version reconciliation, not duplicate intake or a silent hash substitution.
