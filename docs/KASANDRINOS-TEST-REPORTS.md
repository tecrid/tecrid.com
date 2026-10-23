# Kasandrinos and Light Labs TEST reports

The eight source-bound SBX identifiers remain TEST, with no production authority. Light Labs has not approved or signed their transcribed results. The operator-prepared participant pages are `/participants/KASTEST` and `/participants/LLTEST`. Organization verification and production claiming remain separate from the operational TEST access workspace.

Migration 0018 registers the eight fingerprint-pinned reports in `test_report_imports`. Public resolver pages and credential JSON expose report metadata and analyte names, with an empty results array. No production credentials or public findings are created.

## Gated digital TECRID cards

Original PDF bytes and unapproved result transcriptions are held in VLE's private R2 store, bound to each original SHA-256. Originals are unchanged. Transcriptions preserve source result strings, LOQs and printed limits/status without interpreting ND or NR as zero or inventing missing fields. Original documents remain authoritative. Real transcriptions, PDFs and runtime credentials do not belong in GitHub.

The TECRID digital card component fetches `/api/test-reports/<encoded identifier>/card` with its current email-session cookie. The server validates that session, then sends the server-derived identity to the fixed VLE report service using the existing private service credential. Browser-supplied emails/roles, sandbox API keys and legacy identity headers cannot authorize these routes. The card response contains the source-bound structured results plus sample, lot, laboratory, method, dates, fingerprint, and pending approval state. It is rendered in the browser as the credential card. Original PDFs are private source evidence; `/document` remains controller-only for source inspection.

VLE checks the current Kasandrinos role or exact-email/card grant and expiry on every card delivery. Recipient card grants never release PDF bytes, including direct VLE PDF URLs. Only current Kasandrinos team owners/admins can inspect originals. TECRID checks the report number, source fingerprint and TEST flags before returning values. Responses are private/no-store and access is logged. A work-email login or company domain alone grants no access to these eight reports.

Service-only import endpoints retain the fixed-eight source mapping. PDF imports check original byte count and SHA-256. Transcript imports require all eight matching source fingerprints and force TEST/unapproved flags. These endpoints return storage outcomes, accept no arbitrary source URL or recipient, and do not grant viewer permission.

## Kasandrinos-controlled workspace

Start at https://tecrid.com/dashboard/kasandrinos and sign in with work email. Kasandrinos's **existing explicit VLE team owner and administrators** can manage all eight TEST records using the same verified email. Current VLE membership is authoritative; no name or domain match grants management. The TEST participant profile links to this workspace, and a management entry appears on the ordinary dashboard for authorized controllers. No separate organization creation is needed for this pilot.

Controller steps:

1. Sign in with the exact email in the existing Kasandrinos VLE owner/admin membership. Review that membership in VLE Account & team if access is missing.
2. Enter a recipient's exact email, select one or all eight TEST digital cards, and approve **digital card access**. Optionally set an expiry date in UTC. No invitation email is sent; share the record URL through your usual channel.
3. New requests email the configured Kasandrinos contact, `karen@paleofoundation.com`, with the requester, report and requested digital card. Follow **Review request · approve or decline**; sign in with an authorized owner/admin email and confirm the decision. Opening or scanning the email link never changes permissions. You can also review pending requests in **Access requests and permissions**. Approve the digital card, decline it, or choose **Edit card access** before saving.
4. Choose **Revoke card access** to block future card loads. Returning focus to the card or checking access again removes the displayed values after revocation. Previously viewed information cannot be recalled. Owner/admin viewing and management follow VLE membership; revoke those roles in VLE Account & team.
5. Review **Permission history** for the verified actor, recipient, report, action and time. Refresh before retrying a conflicting edit.

Recipient steps: open a TEST TECRID from VLE or its resolver URL, sign in with the exact recipient email, and choose **Request digital card access**. Karen receives a TEST email with a protected review link. The card stays locked until Kasandrinos approves. Return to the same card or choose **Check card access again** after approval. The unlocked card displays the structured actual results, with TEST and Light Labs approval pending labels. There is no recipient PDF unlock or download.

Compatibility: existing `results_access` / `requested_results` database columns now represent digital-card access; `canReadResults` and the protected `/results` endpoint remain compatibility aliases under the same card gate. New clients send `card:true`. A `pdf:true` request or grant is rejected. Legacy PDF-only grants grant neither card nor PDF access. Legacy PDF-only pending requests require a fresh card request; managers cannot approve them as cards from the request row. Undelivered file-only notifications are cancelled, and no existing permission is silently widened.

VLE migration `0007_kas_report_permissions` adds exact-email/report permissions and an append-only decision ledger. Every mutation uses a revision and a transactional unique event so stale tabs cannot overwrite newer decisions. No domain-wide grants are created. Light Labs receives no implicit signing or document authority from its TEST profile.

## Approval and production conversion

Production conversion requires independently verified organization ownership, laboratory approval, signing-key proof, report disclosure approval and issuance. Preserve the SBX references as TEST history; never relabel them as signed production credentials. Operational TEST grants do not satisfy any of these production requirements.

## Validation

VLE `tests/tecrid-report-service.mjs` exercises all eight reports, owner/admin access, no company-domain default, recipient requests, digital-card permission and rejection of PDF grants, expiry, bulk grant/revoke, stale edits, role revocation and audit history. TECRID proxy tests reject forged identities and cross-origin writes; real isolated email-session tests verify management access ends on sign-out; rendered component tests exercise request, approve and revoke controls. Issuance tests preserve the absent signing keys and blocked production reservations. A live account holder must complete the mailbox sign-in walkthrough.


## Request email delivery

New request events and notification outbox rows commit together in VLE migration `0008_kas_access_notifications`. Only new request cycles send mail; repeating an already-pending request does not send another email. The destination is fixed to the requested Kasandrinos contact in server code, never a browser-supplied address. Emails are marked TEST and contain metadata plus an opaque review link, with no results, PDF attachment, sign-in token or approval capability.

The existing VLE provider/sender attempts delivery immediately after the request is saved. Leases and a stable provider idempotency key suppress competing sends. Failures remain queued with backoff, and the Worker retries due items on subsequent report-permission API activity, including workspace refreshes, new requests and VLE bootstrap activity. There is no unattended retry timer. The installation migration queues one fixed TEST delivery-check email that creates no access request or grant. A request resolved before delivery is cancelled in the queue. The workspace shows sent/queued state on current pending requests.

The service-only `/api/tecrid-request-notification` accepts only `delivery-test`, requires the existing private service credential, and sends fixed TEST check content to the same contact at most once per UTC day. It creates no access request and changes no permissions. It accepts no arbitrary recipient or email body and returns only delivery status. Never put service credentials in URLs, GitHub or browser forms.

VLE `tests/kasandrinos-request-notifications.mjs` validates the transactional outbox, fixed recipient, card-only scope and legacy file-only rejection, TEST copy, protected request targeting, duplicate/concurrent send suppression, provider failure/backoff/retry, resolved-request cancellation and service-only test delivery. TECRID tests verify review targets survive sign-in and email links cannot approve or decline without a deliberate signed-in action.
