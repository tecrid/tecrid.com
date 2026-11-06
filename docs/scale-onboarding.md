# Public laboratory applications

`/labs/apply` accepts the laboratory legal name, ISO/IEC 17025 accreditation body and number, metals scope, contact email, and a private certificate PDF (5 MB maximum). The public API returns `PENDING` with `productionAuthority:false`. It creates no organization, signing key, or authority.

The applicant then confirms its work email through `/join?role=laboratory` and completes the existing laboratory application, including its signing key. `/admin/labs` lists public intakes in cursor pages of 25. Certificate downloads and review decisions require both an `ICS_ADMIN_EMAILS` administrator and the existing admin second factor. Approval delegates to the existing issuer review, preserving independent reviewer, accreditation, key-control, and conformance checks. An already approved application must still match the current verified organization and signing key. Successful intake approval returns `productionAuthority:true`.

Unique normalized-name and email constraints handle concurrent duplicate requests. IP/email budgets use atomic database counters; multipart bodies are bounded before parsing. Queue indexes support cursor pagination. The existing `/admin/issuers` queue is also bounded to 25 per page.

## Release and verification

Apply existing migrations through `0022_accreditation_expiry` in order, then `0023_public_lab_applications.sql`, before releasing this source. Preserve the `DB` and `DOCUMENTS` bindings and the existing admin configuration.

Run `npm run test:onboarding` and `npm run build`. The onboarding suite exercises the real SQLite migrations and intake persistence, certificate validation, duplicate races, rate budgets, indexed pagination over 1,000 records, permissions, and cleanup. The existing issuer review is substituted only at its boundary in this suite; its existing security suite remains responsible for its verification gates.

After deployment, check the live public route returns 200. Submit a clearly identified synthetic certificate through the live form; confirm `PENDING` in `/admin/labs`, then remove the pending record through the MFA-protected DELETE endpoint and verify the private certificate was removed. No production test submission was made during implementation because publishing was unavailable.
