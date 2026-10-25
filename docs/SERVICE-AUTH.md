# Scoped TECRID service authentication

Security F08. This is a coordinated receiver/sender change. Draft PRs only; no live configuration, deployment or credential provisioning has occurred.

| Environment binding | Purpose |
| --- | --- |
| TECRID_MAIL_ISSUANCE_SECRET | Token/recipient assertions from the authentication issuance hook |
| TECRID_EMAIL_RELAY_SECRET | Existing mail relay only; never report or notification authority |
| TECRID_REPORT_READ_SECRET | Original/digital report reads and read-only permission workspace/status |
| TECRID_REPORT_PERMISSION_SECRET | Report permission requests and grant/revoke/decline mutations |
| TECRID_REPORT_IMPORT_SECRET | Fixed report/transcript import operations |
| TECRID_NOTIFICATION_SERVICE_SECRET | The two inbox bridges and fixed notification delivery worker |

New service secrets must be at least 32 characters and distinct from mail and every other purpose. Missing/reused credentials fail closed with no legacy fallback. An operator must provision them under a separate release gate before either changed service is activated. Never put values in source, logs, tickets or STATUS. The existing authentication-session secret is never shared.

`tecrid-service/1` assertions bind the audience, POST method, exact origin/path, timestamp, UUID nonce and exact UTF-8 body, including the server-verified actor. HMAC-SHA256 signatures expire after 60 seconds, with at most 15 seconds of future skew. Sender functions accept only verified local principals. Receiver routes choose their expected capability; a read signature cannot become a permission/import operation. Header signatures contain no service-secret value. Redirects remain disallowed by callers.

Replay claims use an atomic INSERT OR IGNORE against the existing unique key in auth_rate_limit. The reserved tecrid-service-nonce namespace stores a SHA-256 digest, count and timestamp only. Old claims are cleaned after five minutes, beyond the assertion validity window. This is internal security bookkeeping in an existing operational table, not a new schema or migration. A missing/unavailable store fails closed. Request reads are bounded before signature verification.

Verification includes independent Node HMAC reference bytes, actor/audience/origin/path tampering, timestamps, purpose separation, concurrent single-use claims, missing storage and bounded oversized bodies. From the VLE checkout, `node scripts/verify-service-peer.mjs /path/to/tecrid/lib/service-assertion.js` tests both actual checked-out protocol modules in separate disposable databases. Evidence records identical source hashes, two accepted directions, two replay denials and zero external calls. Existing report, permission and notification tests now sign requests through the same protocol.

F11 adds the separate token/recipient issuance assertion and mutation budgets documented in ABUSE-CONTROLS.md. Receiver stays OFF; no source PDF, production account, real message or production database is used by verification.
