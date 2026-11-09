# TECRID is independent of VLE

Direction: VLE may depend on TECRID. TECRID never calls VLE. `tests/one-way-dependency.test.ts` enforces this for server code.

## Former TECRID → VLE calls (removed in this change)

| Caller in TECRID | VLE endpoint | Replacement |
| --- | --- | --- |
| `lib/email-auth-factory.ts` (sign-in link) | `POST /api/tecrid-email` | Direct Resend from `TECRID_EMAIL_FROM` (`lib/email-sender.ts`) |
| `lib/operational-email.ts` (corrections, revocations, grants) | `POST /api/tecrid-email` (`kind: tecrid-notice`) | Direct Resend |
| `lib/test-report-access.ts` (TEST card/results/PDF) | `POST /api/tecrid-report-access` | TECRID D1 permissions + TECRID R2 `DOCUMENTS` |
| `lib/kasandrinos-test-workspace.ts` (request/grant/revoke/decline/status/workspace) | `POST /api/tecrid-report-permissions` | `lib/test-report-permissions.ts`, migration `0023` |
| `lib/notifications.ts` `vleNotifications` (inbox) | `POST /api/tecrid-report-permissions` (`notifications`) | `accessNotifications` (`access:` ids) |
| Ops only (closed PRs #30/#33, never on main): report import, transcripts, delivery-test | `/api/tecrid-report-import`, `/api/tecrid-report-transcripts`, `/api/tecrid-request-notification` | `POST /api/admin/test-reports/import` (ICS admin + second factor) |

Removed inbound bridge: `POST /api/integrations/vle/notifications` (VLE read TECRID inboxes with the shared relay secret). VLE should stop calling it. Its call already fails over gracefully because it uses `Promise.allSettled`.

The `TECRID_EMAIL_RELAY_*` secrets and the scoped service secrets from #30/#33 (`TECRID_MAIL_ISSUANCE_SECRET`, `TECRID_REPORT_*`, `TECRID_NOTIFICATION_SERVICE_SECRET`) are no longer needed by TECRID.

## New configuration (Sites secrets, never source)

- `RESEND_API_KEY`: TECRID's own Resend account, sending access only.
- `TECRID_EMAIL_FROM`: `TECRID <no-reply@tecrid.com>` (must be a tecrid.com address on a verified Resend domain).
- `TECRID_KAS_TEST_CONTROLLER_EMAILS` (optional): extra Kasandrinos TEST controllers. Owners and admins of `org_test_kasandrinos` also qualify.

## Data to move once at cutover

- Rows from VLE `kas_report_permissions`, `kas_report_permission_events`, `kas_access_notifications` and `evidence_notification_reads` go into the same TECRID tables (same columns). Prefix copied read markers `vle:` → `access:`.
- The 8 source PDFs and 8 transcripts go into TECRID `DOCUMENTS` under `kasandrinos/source-reports/<sha256>.pdf` and `kasandrinos/test-transcripts/<sha256>.json`, uploaded through `/api/admin/test-reports/import`. Each upload is rejected unless it matches the published fingerprint.
