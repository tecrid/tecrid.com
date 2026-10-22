# Kasandrinos and Light Labs TEST reports

The eight source-bound SBX identifiers remain TEST, with no production authority. Light Labs has not approved or signed their transcribed results. The operator-prepared participant pages are `/participants/KASTEST` and `/participants/LLTEST`. Organization verification and production claiming remain separate from the operational TEST access workspace.

Migration 0018 registers the eight fingerprint-pinned reports in `test_report_imports`. Public resolver pages and credential JSON expose report metadata and analyte names, with an empty results array. No production credentials or public findings are created.

## Private results and original PDFs

Original PDF bytes and unapproved result transcriptions are held in VLE's private R2 store, bound to each original SHA-256. Originals are unchanged. Transcriptions preserve source result strings, LOQs and printed limits/status without interpreting ND or NR as zero or inventing missing fields. Original documents remain authoritative. Real transcriptions, PDFs and runtime credentials do not belong in GitHub.

The TECRID report component fetches `/api/test-reports/<encoded identifier>/results` with its current email-session cookie. The server validates that session, then sends the server-derived identity to the fixed VLE report service using the existing private service credential. Browser-supplied emails/roles, sandbox API keys and legacy identity headers cannot authorize these routes. The original PDF uses the similarly protected `/document` route.

VLE checks the current Kasandrinos role or exact-email/report grant and expiry on every delivery, including direct VLE PDF URLs. Results and PDFs have independent scopes. TECRID checks the report number, source fingerprint and TEST flags before returning values. Responses are private/no-store and access is logged. A work-email login or company domain alone grants no access to these eight reports.

Service-only import endpoints retain the fixed-eight source mapping. PDF imports check original byte count and SHA-256. Transcript imports require all eight matching source fingerprints and force TEST/unapproved flags. These endpoints return storage outcomes, accept no arbitrary source URL or recipient, and do not grant viewer permission.

## Kasandrinos-controlled workspace

Start at https://tecrid.com/dashboard/kasandrinos and sign in with work email. Kasandrinos's **existing explicit VLE team owner and administrators** can manage all eight TEST records using the same verified email. Current VLE membership is authoritative; no name or domain match grants management. The TEST participant profile links to this workspace, and a management entry appears on the ordinary dashboard for authorized controllers. No separate organization creation is needed for this pilot.

Controller steps:

1. Sign in with the exact email in the existing Kasandrinos VLE owner/admin membership. Review that membership in VLE Account & team if access is missing.
2. Enter a recipient's exact email, select one or all eight TEST reports, and approve **results**, **original PDF**, or both. Optionally set an expiry date in UTC. No invitation email is sent; share the record URL through your usual channel.
3. Review pending requests in **Access requests and permissions**. Approve the requested scope, decline it, or choose **Edit scope** to narrow it before saving.
4. Choose **Revoke both** to block future result and PDF requests on TECRID and direct VLE PDF endpoints. Previously downloaded documents cannot be recalled. Owner/admin viewing and management follow VLE membership; revoke those roles in VLE Account & team.
5. Review **Permission history** for the verified actor, recipient, report, action and time. Refresh before retrying a conflicting edit.

Recipient steps: open a TEST record, sign in with the exact recipient email, and choose **Request results**, **Request PDF**, or **Request results and PDF**. Requests remain blocked until Kasandrinos approves them. Return to the report or use **Retry report access** after approval. PDF-only access does not expose inline results; results-only access does not expose the PDF. Returning focus to the report rechecks authorization.

VLE migration `0007_kas_report_permissions` adds exact-email/report permissions and an append-only decision ledger. Every mutation uses a revision and a transactional unique event so stale tabs cannot overwrite newer decisions. No domain-wide grants are created. Light Labs receives no implicit signing or document authority from its TEST profile.

## Approval and production conversion

Production conversion requires independently verified organization ownership, laboratory approval, signing-key proof, report disclosure approval and issuance. Preserve the SBX references as TEST history; never relabel them as signed production credentials. Operational TEST grants do not satisfy any of these production requirements.

## Validation

VLE `tests/tecrid-report-service.mjs` exercises all eight reports, owner/admin access, no company-domain default, recipient requests, separate result/PDF scope, expiry, bulk grant/revoke, stale edits, role revocation and audit history. TECRID proxy tests reject forged identities and cross-origin writes; real isolated email-session tests verify management access ends on sign-out; rendered component tests exercise request, approve and revoke controls. Issuance tests preserve the absent signing keys and blocked production reservations. A live account holder must complete the mailbox sign-in walkthrough.
