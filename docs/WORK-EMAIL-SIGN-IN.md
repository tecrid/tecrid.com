# Work-email sign-in

Start at https://tecrid.com/sign-in. Enter a work email and open its one-use link within 10 minutes. No ChatGPT account or password is required. New users reach the existing organization setup: choose Laboratory, create the workspace, then use Profile & settings and Laboratory issuance to complete onboarding. Mailbox verification does not grant issuer approval.

Existing ChatGPT users can expand “Already use ChatGPT sign-in?” to access their existing workspace. Work-email identities use a separate `email:` namespace and are not merged by email with existing platform accounts. Account consolidation requires a separately authorized migration; never change ownership based on an unverified address.

## Operations

Better Auth handles verified mailbox sessions, hashed single-use magic-link tokens, 10-minute link expiry, seven-day sessions, secure HttpOnly SameSite=Lax cookies, persisted rate limits and CSRF/origin checks. Sign-out requires POST and revokes the session. Production issuer checks remain unchanged.

Runtime configuration is stored as Sites secrets, never source:
- `TECRID_AUTH_SECRET`: independent TECRID session secret.
- `TECRID_AUTH_URL`: `https://tecrid.com`.
- `TECRID_EMAIL_RELAY_URL`: `https://vle.exchange/api/tecrid-email`.
- `TECRID_EMAIL_RELAY_SECRET`: shared only with the narrow VLE server relay.

The VLE relay uses its existing Resend credential and approved `VLE_EMAIL_FROM` sender. It accepts authenticated requests containing a recipient and only a TECRID magic-link verification URL, validates callback origins, and supplies a fixed TECRID subject/body. It does not expose the provider key or accept arbitrary mail content. Messages currently come from the existing VLE sender address and explain the shared delivery service.

If delivery fails, the client displays an error instead of claiming success. Check provider delivery in the existing VLE/Resend account; do not log tokens, URLs or provider response bodies. Rotating the relay secret requires updating both Sites and redeploying both. VLE relay availability is currently a dependency for new sign-in links. Existing sessions remain valid independently of email delivery.

## Validation

`npx vitest run tests/email-auth.test.ts` exercises isolated real D1 with mocked email transport: verified login, expiry and one-use behavior, separate mailboxes, secure cookie, sign-out revocation, hostile origin/redirect rejection, persisted rate limits, provider failure, laboratory creation, public profile, issuer application and production issuance denial before approval. Real recipient inbox delivery is a separate deployment smoke test performed by the account holder.

The VLE source includes `tests/tecrid-email-relay.mjs` for relay authorization and link/destination restrictions. No email bypass, test-login endpoint, credentials or real private PDFs are included.
