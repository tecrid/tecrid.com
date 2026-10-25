# Identity boundary regression

GATE-SECURITY-E2E-1 step 2. Draft PR only, stacked on TECRID #24.

The baseline accepted unsigned oai-authenticated-user headers, including an administrator email, without a session. The first commit adds regression tests and captures 13 failures. The fix accepts only the current verified Better Auth email session, including secure cookie names. Missing, invalid and revoked sessions cannot fall back to header identity. Session backend errors propagate and cannot establish a principal. Anonymous rendering avoids initializing the session database.

Validation: production build; 116 unit/backend tests in 29 files; 40 built-Worker, rendered and redirect checks. Four origin cases cover the canonical host, www redirect, existing platform host and an arbitrary alternate Worker hostname, with absent, invalid and secure invalid cookies. The Worker tests intercept all outbound requests. Existing real-session tests verify mailbox identity, expiry and sign-out revocation in disposable D1 with intercepted mail. Focused lint and whitespace checks pass.

This removes the trust dependency in application code on every origin. It does not claim to have probed production or enumerated deployed aliases. Existing platform-header-only identities must sign in through the existing verified email flow; no account ownership is migrated by this PR. No schema change, production migration, live message, merge or deploy.

The separate role-first #25 branch is unchanged. Merge sequencing and any later identity migration remain review gates.
