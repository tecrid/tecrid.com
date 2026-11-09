# Work-email sign-in

Start at https://tecrid.com/sign-in. Enter a work email and open its one-use link within 10 minutes. No password is required. New users reach the existing organization setup: choose Laboratory, create the workspace, then use Profile & settings and Laboratory issuance to complete onboarding. Mailbox verification does not grant issuer approval.

Work-email identities use a separate `email:` namespace. Existing legacy workspaces are not automatically merged by email. Account consolidation requires a separately authorized migration; never change ownership based on an unverified address.

## Operations

Better Auth handles verified mailbox sessions, hashed single-use magic-link tokens, 10-minute link expiry, seven-day sessions, secure HttpOnly SameSite=Lax cookies, persisted rate limits and CSRF/origin checks. Sign-out requires POST and revokes the session. Production issuer checks remain unchanged.

Runtime configuration is stored as Sites secrets, never source:
- `TECRID_AUTH_SECRET`: independent TECRID session secret.
- `TECRID_AUTH_URL`: `https://tecrid.com`.
- `RESEND_API_KEY`: a key from TECRID's own Resend account (sending access only).
- `TECRID_EMAIL_FROM`: a tecrid.com sender, for example `TECRID <no-reply@tecrid.com>`, on a domain verified in that Resend account.

TECRID sends sign-in mail directly through Resend. There is no relay and no dependency on VLE. The message has a fixed subject and body and contains only the verification link for this site. If either email setting is missing, `POST /api/auth/sign-in/magic-link` returns 503 "Sign-in email is temporarily unavailable" and sends nothing. Existing sessions need only `TECRID_AUTH_SECRET` and keep working during an email outage. Never log provider responses, keys or links. Check delivery in TECRID's Resend dashboard.

## Validation

`npx vitest run tests/email-auth.test.ts` exercises isolated real D1 with mocked email transport: verified login, expiry and one-use behavior, separate mailboxes, secure cookie, sign-out revocation, hostile origin/redirect rejection, persisted rate limits, provider failure, laboratory creation, public profile, issuer application and production issuance denial before approval. Real recipient inbox delivery is a separate deployment smoke test performed by the account holder.

No email bypass, test-login endpoint, credentials or real private PDFs are included.
