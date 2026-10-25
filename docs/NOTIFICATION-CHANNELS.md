# Delivery events and channels

Order: TECRID-MINT-TO-PHONE-1, step 1. PR only. No live deployment, migrations, real notifications, or HMTc operations are part of this change.

Organization owners and administrators manage channels at `/dashboard/notifications`. The workspace menu links there. Phone push is a browser subscription attached to the organization, not an SMS number. Install the PWA from the browser and enable push from the installed app. On iPhone, use Safari's Add to Home Screen action first.

## Data and privacy

Migration 0020 adds encrypted organization channels, an event outbox, channel delivery rows, and transactional database triggers. Every new `organization_notifications` row produces an outbox event. Public credential issuance, correction and revocation produce lifecycle events. Laboratories also receive claimed and routed events. Existing findings, signatures, scoped snapshots, and public resolver projections are unchanged.

Push, email and step 1 webhooks use only event metadata. An explicit payload allowlist prevents notification titles, notification bodies, audit contents, result values, and signed payloads from being copied into alerts. A push has `eventId`, `event`, `sku`, and an authenticated dashboard URL. Email has the same information. Missing SKU is explicit. Existing notification bodies never become external alert text.

Channel configurations, including webhook secrets, email destinations and push subscription keys, are encrypted using AES-256-GCM with the organization ID as authenticated data. The dashboard never returns these stored secrets. A newly generated webhook secret is shown once. Disabling a channel cancels its pending deliveries when processed.

Email enrollment currently accepts the signed-in account's verified mailbox. Arbitrary third-party mailbox enrollment is deliberately rejected until a separate mailbox-verification flow exists. A server administrator must approve exact webhook hostnames before delivery. Webhook and relay redirects are never followed; IP literals, credentials in URLs, non-TLS URLs, local hostnames, and unusual ports are rejected. No host allowlist is enabled by default.

## Setup after review

Apply the committed SQL migration through the site's normal migration process. This PR does not apply it to a live database.

Configure the following secrets in the hosting runtime. Never commit their values:

| Setting | Purpose |
| --- | --- |
| `TECRID_CHANNEL_SECRET` | 32 random bytes, base64url encoded, used for channel encryption |
| `TECRID_VAPID_PUBLIC_KEY`, `TECRID_VAPID_PRIVATE_KEY` | One persistent Web Push VAPID key pair |
| `TECRID_VAPID_SUBJECT` | Operator-controlled HTTPS URL or mailto contact for the push service |
| `TECRID_NOTIFICATION_EMAIL_RELAY_URL` | Trusted HTTPS notification relay |
| `TECRID_NOTIFICATION_EMAIL_RELAY_SECRET` | Relay bearer credential |
| `TECRID_WEBHOOK_HOSTS` | Exact approved public DNS hostnames, comma separated |
| `TECRID_DELIVERY_WORKER_SECRET` | Bearer credential for the protected queue worker endpoint |
| `TECRID_DELIVERY_ENABLED` | Defaults off. Enable only after the required safety release is approved |

The notification email relay is separate from the sign-in magic-link relay. It accepts POST JSON with `email`, `eventId`, a fixed `subject`, and `text`; it must preserve the event/SKU/link-only restriction. `Idempotency-Key` is the event ID. HTTP 2xx means accepted; other statuses retry.

Successful write requests wake the outbox in a Worker `waitUntil` task when automation is enabled. A `scheduled` Worker handler supports retry processing. Hosting must register a scheduler, or call `POST /api/internal/notification-worker` with its dedicated bearer secret at a suitable interval, for recovery during periods without requests. Exporting a scheduled handler does not register a schedule. This PR does not activate a scheduler. Explicit user-requested channel tests process only their own synthetic test event while automatic credential delivery is off.

## Webhook contract

The body is JSON with `eventId`, `event`, `sku`, and `url`. Headers:

- `X-TECRID-Event-Id`: stable event ID for consumer deduplication.
- `X-TECRID-Signature`: `t=<unix-seconds>,v1=<hex-HMAC-SHA256>`.

Verify the HMAC over `<timestamp>.<exact-body-bytes>` using the channel secret. Use a timing-safe comparison and a five-minute timestamp tolerance. Persist each processed event ID before returning HTTP 2xx; retries reuse the event ID and may have a new timestamp/signature. Return 2xx promptly after durable acceptance. Do not claim a notification was viewed solely because a delivery endpoint accepted it.

The worker uses unique event/channel pairs, atomic leases, a 60-second lease timeout, bounded concurrency, and exponential retry delays starting at five seconds and capped at 24 hours. Ten failed attempts produce a failed row. Expired push subscriptions returning 404 or 410 are disabled. Accepted requests are recorded in the organization's dashboard delivery log. After a process crash, leases expire and jobs can be retried. Exactly-once network delivery is not promised; consumers deduplicate by event ID.

## Verification

The tests use isolated Miniflare D1/R2 databases, synthetic signing keys, and intercepted outbound requests. No production database or notification destination is used. The built Worker test decrypts its captured RFC8291 Web Push body and verifies VAPID authentication. The decrypted payload proof is recorded under `docs/verification/mint-step-1/`.

The production build and 23 existing rendered-page checks pass. Standalone `tsc --noEmit` is not a passing baseline check: main already lacks Cloudflare ambient types and has unrelated existing type errors. This change does not claim a clean whole-repository typecheck.

Protocol implementation: [web-push library](https://github.com/web-push-libs/web-push). Phone support reference: [Apple Web Push documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).
