# In-app notifications and VLE bridge

TECRID `/notifications` and VLE `/notifications` show credential issuance/delivery, incoming evidence requests, and access decisions. The mobile Alerts tab and signed-in navigation display unread counts. Feeds refresh every 45 seconds while visible and on return to the app; no device push subscription or background delivery is implemented.

TECRID stores organization events alongside the associated issuance/request/decision transaction. Existing controller receipts and authorized recipient deliveries also feed the inbox. Drafts and unapproved TEST reports are not reported as issued production credentials. Each organization member gets a personal read marker; opening an update does not approve or mark it read.

VLE remains the permission authority for Kasandrinos TEST digital cards. Requests and grant/decline/revoke events create the inbox projection from committed, revision-controlled events. Both apps already read that same recipient-email permission record. A grant or revocation through either review interface takes effect on both sites; no permission is copied or automatically accepted by the notification API. Original PDFs remain private and laboratory approval/signature remains pending.

## Endpoints

- TECRID browser: `GET /api/notifications`, `POST /api/notifications` with `{ "action": "read", "id": "tecrid:…" }` or a `vle:…` ID. Requires a validated session; VLE items require work-email sign-in. Writes require the same Origin.
- VLE browser: `GET /api/evidence-notifications`, corresponding same-origin `POST` with the same read shape. Requires a validated email session; account membership and manager role are rechecked server-side.
- TECRID service: `POST /api/integrations/vle/notifications` with `action: list|read` and `actor: {email,emailVerified:true}`. VLE derives the actor exclusively from its validated email session. Organization membership is resolved by exact normalized email.
- VLE service: existing `POST /api/tecrid-report-permissions`, extended with `action: notifications|notification-read`, optional `id`, and the existing verified TECRID actor. Only owner/admin roles see incoming TEST requests; recipients see only their own decisions.

The server bridges authenticate with purpose-scoped, short-lived signed assertions using `TECRID_NOTIFICATION_SERVICE_SECRET`. See `SERVICE-AUTH.md`. Mail credentials cannot authorize either inbox. Browser requests cannot choose an actor. Cross-site fetches bypass framework caching, reject redirects, and time out after eight seconds. Each server bridge serves only its own source, preventing recursion. Both sites must be deployed for the combined feed.

Responses contain `items`, `unreadCount`, and `unavailable` source names. The UI explicitly reports partial outages. Up to 100 recent items per source are shown. Notification IDs are stable and namespaced; reads are idempotent and scoped to the verified email at the originating service, so reading in either app updates the other without affecting teammates. No grant changes occur on list/read operations.

Migrations: TECRID `0019_notification_reads.sql`; VLE `0009_evidence_notification_reads.sql`. They only add per-recipient read markers. Integration tests use isolated D1 databases, synthetic identities, and mocked email/network transports.
