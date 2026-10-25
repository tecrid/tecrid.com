# Verification with the current live inbox source

The six mint PRs now stack on TECRID live source-sync PR 19, source 8336d36aaee6fcece56e8aafac40368317e75a41. That PR was expanded by another process during this run. Its mobile shell and existing inbox are preserved.

The inbox continues using lib/notifications.ts and tests/notifications.test.ts. Outbound delivery uses lib/notification-delivery.ts and tests/notification-delivery.test.ts. Both suites run together. Migration 0019 remains notification_reads. Outbox, standing authorization, organization gating and safety are migrations 0020, 0021, 0022 and 0023 respectively. Snapshot metadata includes the read-marker table; drizzle-kit reports no schema changes. The live manifest keeps its existing application ID, start URL and blue icons.

The live credential.issued inbox row remains in the same atomic issuance batch. Its outbox ID is shared with the native lifecycle event, so one issuance does not create two external alerts. Concurrent retry tests still verify one credential and one issuance event.

Each step passed the production build, all unit/backend tests and all 28 rendered/redirect checks on this baseline:

| Step | Unit/backend tests | Files |
| --- | --- | --- |
| 1 | 70 | 21 |
| 2 | 83 | 22 |
| 3 | 88 | 23 |
| 4 | 92 | 24 |
| 5 | 95 | 26 |
| 6 | 102 | 28 |

Commands: npm run build; node --test tests/rendered-html.test.mjs tests/www-redirect.test.mjs; npm run test:unit. Miniflare uses isolated D1 and intercepted providers. The final runtime proof is integrated-latency-and-push.json: push 135 ms, certifier 135 ms, marketplace 136 ms, zero GATED snapshot or network counts, and explicit acknowledgments. These are local measurements, not a live phone SLA.

Byte parity with PR 19 was checked for app/page.tsx, app/layout.tsx, app/mobile-navigation.tsx, app/mobile.css, app/notifications.css, app/notification-center.tsx, lib/notifications.ts, public/manifest.webmanifest and drizzle/0019_notification_reads.sql. The hero, sample, proof boundaries, live inbox and read markers are retained. Existing www redirect tests also pass.

Initial main-based evidence remains for provenance. Integrated logs record the final tested heads. No live Site, database, notification destination, deployment or merge was changed. Terms remain unconfigured and off; automation remains off by default. Historical duplicate-source preflight remains required before an approved migration.
