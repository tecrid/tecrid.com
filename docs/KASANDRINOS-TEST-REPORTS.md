# Kasandrinos and Light Labs test report setup

The operator-prepared profiles are `/participants/KASTEST` and `/participants/LLTEST`. Both are explicitly TEST, unclaimed, approval pending, and have no account members or signing keys. These are staging identities, not claims that either organization has approved participation. Do not attach an account automatically by matching a name or email domain.

Migration 0018 registers the eight fingerprint-pinned reports in `test_report_imports`. Their SBX resolver and JSON expose only report metadata, a document-gate URL and the test profiles. No production credentials or findings are created.

Original PDF bytes are held in VLE's private R2 document store, shared by the existing VLE report service. They are not copied into TECRID public assets or the GitHub repository. `/reports/ll-<number>` retains the exact report through work-email login. The PDF API checks the existing verified company-email brand-buyer policy on every request and logs access. This is VLE's buyer policy, not a recipient-specific TECRID grant or automatic cross-site session sharing.

The VLE service-only POST `/api/tecrid-report-import` accepts the existing TECRID service bearer credential, imports only the fixed eight mapped reports, checks the original size and SHA-256, and returns per-report storage outcomes. It accepts no arbitrary source, recipient or report selection, returns no file bytes, and grants no viewer access. Source changes fail closed. Credentials remain in runtime secrets.

Production conversion requires independently verified organization ownership, laboratory approval, signing-key proof, report disclosure approval and issuance. Preserve the SBX references as test history; never relabel them as signed production credentials.

Validation: issuance-backend tests check all eight import mappings, absent memberships/keys and blocked production reservations. VLE `tests/report-gate.mjs` checks each report destination, anonymous/non-buyer UI and unsafe return-path rejection. Live import verifies all eight exact originals in private storage. An account holder must complete the real-mailbox PDF-open check.
