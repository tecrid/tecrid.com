# In-app notifications

TECRID `/notifications` shows credential issuance/delivery, incoming evidence requests, access decisions and Kasandrinos TEST card access requests/decisions. The mobile Alerts tab and signed-in navigation display unread counts. Feeds refresh every 45 seconds while visible; no push delivery is implemented.

TECRID owns every item it shows. Organization events are stored with the issuance/request/decision transaction. Kasandrinos TEST card permissions live in TECRID (`kas_report_permissions`, `kas_report_permission_events`, `kas_access_notifications`, `evidence_notification_reads`, migration `0023`). Controllers are owners/admins of `org_test_kasandrinos` or emails in `TECRID_KAS_TEST_CONTROLLER_EMAILS`.

## Endpoints

- `GET /api/notifications`, `POST /api/notifications` with `{ "action": "read", "id": "tecrid:…" | "access:…" }`. Requires a validated session; `access:` items require work-email sign-in. Writes require the same Origin.

TECRID makes no server calls to VLE. The former `/api/integrations/vle/notifications` bridge is removed. VLE reads TECRID only through TECRID's public API (`/api/v1/credentials/{id}`, `/records/{id}`).

Operational email (corrections, revocations, new grants and TEST access requests) is sent directly through TECRID's own Resend account from `TECRID_EMAIL_FROM`. If email is not configured, notices stay in the inbox and nothing is sent.
