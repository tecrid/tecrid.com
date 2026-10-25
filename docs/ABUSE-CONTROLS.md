# F11: bounded mutations and issuance-bound mail

No live setting or credential has been provisioned. Review both sender/receiver PRs before a separately gated rollout.

Mail requires the existing relay credential plus a distinct TECRID_MAIL_ISSUANCE_SECRET assertion created only inside the token-issuance hook. The assertion signs the exact token URL and recipient, uses the scoped protocol's 60-second expiry and durable nonce, and cannot be supplied by a mail-only credential. A changed address/token or replay fails. A hashed token/recipient delivery claim and provider idempotency key prevent duplicate delivery, including a freshly signed duplicate. Delivery failure requires a fresh sign-in request; the relay does not blindly replay an uncertain provider call.

Mail defaults: three distinct messages per recipient per 15 minutes across IPs, plus 1000 globally per 15 minutes. Operators can set TECRID_MAIL_RECIPIENT_LIMIT and TECRID_MAIL_GLOBAL_LIMIT under the release gate. A provider message contains the token only in its intended email; neither token nor recipient is stored in budget keys or logs.

Both Workers enforce mutation budgets before API handlers: 120 requests per IP/minute, 90 per hashed cookie/bearer principal/minute, 3000 globally/minute. TECRID_API_IP_LIMIT, TECRID_API_PRINCIPAL_LIMIT and TECRID_API_GLOBAL_LIMIT can tune these. Protected TECRID organization mutations also share a 60/minute organization budget (TECRID_ORG_MUTATION_LIMIT), across keys/users/IPs. VLE team and sourcing mutations share per-account budgets of 60 and 120/minute respectively. Unknown/missing IP metadata shares a conservative fallback bucket; deployed edge-IP handling remains a rehearsal check.

JSON mutation bodies are bounded to 128000 UTF-8 bytes before parsing. Team and sourcing JSON have narrower local bounds. Multipart PDF workflows retain their existing file/header checks; this patch does not claim a general streaming multipart parser replacement. Public read-only resolvers keep their existing read behavior.

Budgets and idempotency use reserved SHA-256 key namespaces in the existing auth_rate_limit table, with atomic count/claim operations and bounded retention. No body, token, email, cookie, API key or raw IP is retained there. Missing storage fails closed. No schema/migration file is added. Rate-limited responses are private/no-store and advertise a retry delay.

Verification uses synthetic keys/links, disposable D1, concurrent counters, changed recipients/tokens, replay/idempotency and intercepted mail. No production data, real notification, merge or deployment occurs.
