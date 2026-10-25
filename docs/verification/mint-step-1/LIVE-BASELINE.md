# Live inbox baseline reconciliation

This PR is now stacked on live source-sync PR #19 at 8336d36. The live mobile shell, blue icons, manifest, anonymous hero and inbox remain intact. The inbox keeps lib/notifications.ts; outbound channels use lib/notification-delivery.ts. Both inbox and delivery test suites remain separate. Migration 0019 remains the live read-marker migration, and outbox is migration 0020. Existing lifecycle inbox rows and native lifecycle triggers share an outbox ID to avoid double alerts for one issuance.

No live Site, deployment, merge or data migration is changed by this reconciliation.
