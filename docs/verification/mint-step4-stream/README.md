# Mint step 4 native stream verification

Draft producer on a new branch above existing security #37, which includes latest mint #24. Existing PR branches are unchanged. The separate VLE receiver repair and cross-test remain required; receiver OFF. No live migration, configuration, credential, real issuance, real notification or production data operation occurred.

Validation on this source:

- Production build passes.
- All 176 unit/backend/Worker checks across 41 files pass.
- All 46 Node checks pass, including identity/abuse/header boundaries and the 28 rendered/redirect checks.
- Twelve focused supplier/stream checks pass: v1/v2 preservation and v3 identity; strict input; operator mapping and unmapped holds; defaults and consent; immutable bodies; concurrent idempotent per-recipient sequencing across grants; raw HMAC stable-body retries; correction/revocation; wrong recipient; mapping/identity withdrawal; replacement/cycle/remapping denial; oversized full-record hold with independent status-only delivery.
- A control run of the new supplier-domain tests against the original #37 tec.ts fails as expected; the new implementation passes. No original authority, disclosure or privacy test was removed.
- The old marketplace transport assertion was replaced with stricter legacy withholding. The built-Worker E2E now signs an independent supplier ID and reviews its mapping, requires native vle-evidence/1, retains certifier disclosure checks, denies the GATED recipient, decrypts intercepted metadata-only push, measures healthy-provider latency, verifies raw HMAC and signed durable acknowledgments, and rejects forged identity headers on every new admin route.
- Focused ESLint, generated-schema drift and new-file whitespace pass. Standalone TypeScript is still not globally clean because of inherited Cloudflare ambient and BufferSource diagnostics; no new stream/API/test diagnostics were observed. A blanket type-check PASS is not claimed.

Only synthetic metadata-only or tombstone envelopes are exported in consumer-fixtures.json for the paired VLE cross-test. No production key or person is represented. The Worker proof is intercepted transport in local Miniflare, not a physical phone SLA. Upserts are checked again immediately before dispatch; a network request already in flight cannot be recalled. Tombstones can overtake a blocked old upsert so withdrawal is not starved; consumers must keep a durable stream watermark and drop delayed older payloads.

Migration 0024 and reviewed mappings/brand consent need operator review before activation. The existing mint/security chain and #33 budget-fix propagation remain release gates. See ../../VLE-EVIDENCE-STREAM.md for fields, authority, APIs, sequencing and limits.
