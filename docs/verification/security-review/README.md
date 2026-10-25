# F10: independent issuer review

Four failing regressions precede the fix. Applicant owners, members and submission actors cannot record manual checks or issue final review decisions for their own organization, even when they are ICS administrators. Approval also rejects passed manual checks authored by a related reviewer. The existing automated key-control/conformance checks remain separate. Independent authorized reviewers retain the original five-gate approval flow.

Full build, unit/backend suites and 40 Worker/rendered checks pass; focused review tests include all five fixture gates and independent approval. Focused lint and whitespace pass. Related membership/ownership and submission audit are checked on the server before writes. No production issuer, account, database, schema or migration was changed. All tests use synthetic applications, keys and signed evidence in disposable D1. Draft PR only, no merge or deploy.
