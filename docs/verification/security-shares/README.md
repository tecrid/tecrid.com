# F03 and F04: authenticated, current share access

GATE-SECURITY-E2E-1 step 2. Stacked on identity PR #26. First commit records nine failing regressions; the second closes the holes.

Share redemption now requires a verified session and current membership in the named recipient organization. Public organization codes remain routing labels. Initial reads, replays and recipient sharing-page reads recheck share status/expiry, current identity verification and configured terms. The share itself supplies the explicit controller grant, so an unrelated routing grant is not required. Redeemed codes can be revoked from both the service and its existing Revoke button. Expired/revoked recipient packages disappear; immutable controller audit receipts remain.

A conditional share foreign key rechecks active status, expiry, current membership, identity and terms within the atomic redemption batch. A concurrent revoke aborts insertion and notification writes. Current authority is checked again before returning any payload. Invalid expiry values fail closed. No new schema or migration is needed.

Validation: 126 unit/backend tests in 31 files, including missing session, wrong organization, removed member, GATED identity, new terms, authenticated replay, clock-driven expiry, redeemed revocation, concurrent revoke and controller audit retention. Forty built-Worker/rendered/redirect checks and production build pass. Focused lint has zero errors and one preexisting image warning in the touched sharing component. Whitespace passes. Published trees match the local commits.

All signed evidence, keys and data are synthetic in disposable D1; transports are intercepted. No production data, migration, real email, notification, merge or deploy. Earlier downloaded copies cannot be recalled. F05 addresses the separate underlying delivery/credential withdrawal path next.
