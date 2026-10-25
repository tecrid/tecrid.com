# Standing laboratory authorization

TECRID-MINT-TO-PHONE-1, step 2. This builds on step 1. No deployment, merge, live migration, or real notification is included.

A brand or ingredient supplier's owner or administrator can authorize a verified laboratory, name a SKU, ingredient code, or both, and select specific active grants owned by that controller. The authorization is valid until revoked. It never gives the lab permission to change the brand's grants. Existing expiring routing tokens continue to work.

## Signed ingredient scope and compatibility

`ingredientCode` is optional and additive. When supplied, it must be a nonempty string of at most 120 characters. The canonical payload includes `signatureVersion: "tec-credential/2"` and the normalized `ingredientCode`. The issuer's Ed25519 signature and the registry version fingerprint both cover it. Clients should obtain the canonical payload from the canonicalization endpoint before signing.

When the field is omitted, the previous canonical payload is preserved byte for byte, with no added version marker or null ingredient field. Existing signatures and version fingerprints remain unchanged. Corrections and revocations preserve the ingredient scope. The current-version integrity check also compares the signed SKU and ingredient scope with the stored credential fields before routing.

Ingredient codes use trimmed full Unicode case folding. SKU matching also preserves the existing canonical SKU conversion, including whitespace to hyphens, before case folding. Empty supplied codes are rejected. The legacy non-null routing SKU storage column uses an empty internal sentinel only when an ingredient-only scope omits SKU; this is never accepted as a supplied code and does not change old routing rows.

## Matching and brand separation

For a credential with `ingredientCode`, match the laboratory and ingredient code. A rule that additionally names the matching SKU is more specific than an ingredient-only rule. SKU-only rules are not used as a fallback when the signed credential carries an ingredient code.

For a credential without `ingredientCode`, match the laboratory and canonical SKU using SKU-only rules. Select the most specific matching rule separately for each controlling brand. A shared ingredient may therefore produce one controller receipt and that brand's selected grant snapshots for each authorized brand. One brand's grants are never selected for another brand's authorization.

Ingredient-only authority can select that controlling brand's grants across its SKUs. Each delivered snapshot retains the laboratory's actual signed subject. Delivery does not assert that an ingredient result is a test of a finished product. An authority specifying a SKU can select only grants for that SKU.

If a lab also attaches an explicit routing token, its precedence applies only to that token's controlling brand. Other brands' matching standing authorizations remain eligible. Controlled direct issuance and two-pass report finalization both discover standing authority without a token.

## Durability and revocation

Credential issuance and standing routing jobs are committed in the same D1 batch. One durable job exists per credential and authorization. The worker recovers pending jobs; immediate processing uses the same function. The step 1 automatic-delivery switch remains off by default until the required safety release is approved.

Before each delivery, authorization and selected active grants are read again. Database guards reject stale, revoked, expired, wrong-lab, wrong-controller, or wrong-version delivery writes. Issuer signature, fingerprint, and current-version checks remain required. Recipient snapshot, notification, audit entry, and one-time grant fulfillment are committed together. Retries deduplicate the controller receipt and each grant delivery.

Revocation stops queued and future work. It does not rewrite historical receipts. A queued job rejected for revoked authority is canceled. Infrastructure failures retry with backoff.

## Verification

The isolated D1 suite covers legacy SKU routing and exact pre-ingredient signature compatibility, new ingredient routing, two-brand grant separation, per-brand specificity, tampered ingredient signatures, ingredient-only records, existing SKU normalization, explicit-token coexistence, controlled two-pass finalization, durable recovery, and revocation. No production registry or HMTc operation is used.
