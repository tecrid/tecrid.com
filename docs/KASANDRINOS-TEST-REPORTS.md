# Kasandrinos and Light Labs test report setup

The operator-prepared profiles are `/participants/KASTEST` and `/participants/LLTEST`. Both are explicitly TEST, unclaimed, approval pending, and have no account members or signing keys. These are staging identities, not claims that either organization has approved participation. Do not attach an account automatically by matching a name or email domain.

Migration 0018 registers the eight fingerprint-pinned reports in `test_report_imports`. Their SBX resolver and JSON expose only report metadata, a document-gate URL and the test profiles. No production credentials or findings are created.

Original PDF bytes are held in VLE's private R2 document store, shared by the existing VLE report service. They are not copied into TECRID public assets or the GitHub repository. `/reports/ll-<number>` retains the exact report through work-email login. The PDF API checks the existing verified company-email brand-buyer policy on every request and logs access. This is VLE's buyer policy, not a recipient-specific TECRID grant or automatic cross-site session sharing.

The VLE service-only POST `/api/tecrid-report-import` accepts the existing TECRID service bearer credential, imports only the fixed eight mapped reports, checks the original size and SHA-256, and returns per-report storage outcomes. It accepts no arbitrary source, recipient or report selection, returns no file bytes, and grants no viewer access. Source changes fail closed. Credentials remain in runtime secrets.

Production conversion requires independently verified organization ownership, laboratory approval, signing-key proof, report disclosure approval and issuance. Preserve the SBX references as test history; never relabel them as signed production credentials.

Validation: issuance-backend tests check all eight import mappings, absent memberships/keys and blocked production reservations. VLE `tests/report-gate.mjs` checks each report destination, anonymous/non-buyer UI and unsafe return-path rejection. Live import verifies all eight exact originals in private storage. An account holder must complete the real-mailbox PDF-open check.

## Signed-in results on TECRID

The public report page passes only analyte names and the test identifier to the results component. It fetches `/api/test-reports/<encoded identifier>/results` with the current TECRID cookie. The server validates a verified work-email session, then sends that server-derived identity to the fixed VLE report service using the existing private service credential. Browser-supplied emails, roles and sandbox keys do not authorize this route. The original PDF is served by the similarly protected `/document` route.

VLE evaluates its existing company-email buyer policy (including its existing owner exception) for every request. No new access comes from the test profiles. The service restricts delivery to the eight fixed source-bound reports, logs the viewer and report access, and returns private/no-store responses. TECRID checks report number, source fingerprint and TEST flags before returning values. Public resolver JSON remains empty of results.

Unapproved source transcriptions are stored only in private VLE R2 under the original PDF fingerprint, uploaded through the service-authenticated fixed-eight import endpoint. They include exact source result strings, LOQs and printed limits/status without interpreting ND or NR as zero or inventing missing fields. Original PDFs remain unchanged and authoritative. No real result transcriptions or credentials belong in GitHub. These TEST transcriptions do not grant Light Labs approval, signature or production authority.
