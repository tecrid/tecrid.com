# F14: bounded confirmation links

Three failing regressions precede the fix. Confirmation reads and actions now require a current workflow and a link issued within 24 hours. Withdrawn, declined, unknown, expired and revoked links fail closed. Current controller/issuer organization access by report ID remains independent, preserving ordinary authorized audit reads.

Owners/admins of the submitting or claimed issuer organization can POST an action of rotate or revoke to `/api/legacy-reports/{reportId}/confirmation`. Same-origin verified-session checks and private/no-store/no-referrer headers protect the endpoint. Rotation returns the new path once and invalidates the old one. Revocation invalidates the replacement. No email is sent. Both changes are atomic with an actor audit event; concurrent stale writes cannot leave a false event or multiple usable links.

Expiry derives from the immutable original creation time or the matching audited rotation event, preserving source provenance without a new schema field. Tokens remain hashed; audit events retain hashes/metadata only, never plaintext. Existing historical links older than 24 hours need deliberate rotation. Closed workflows cannot be revived by rotation.

Seven focused link tests, full build, 163 unit/backend tests, 42 Worker/rendered checks, lint and whitespace pass. Coverage includes named/wrong organization, time expiry, withdrawal/decline, rotation, revocation, concurrency and original issuance replay. All PDFs/keys are synthetic in disposable D1/R2. No production data/migration, real credential, email, merge or deploy.
