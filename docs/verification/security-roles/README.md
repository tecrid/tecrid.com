# F06: explicit administrative capabilities

The failing-test commit records four failed role cases. The fix requires a current owner/admin membership for approval decisions, grant revocation, routing token/standing authorization creation and revocation, share creation/revocation and production API key creation/revocation. Unknown or revoked membership roles cannot establish an organization context. Ordinary members retain request and intended read workflows. The existing owner/admin capability model is reused; no role can be obtained from signup choice or a mailbox domain.

The matrix exercises eight mutation paths for member, viewer, editor and revoked roles, plus positive owner/admin key management and hashed-only stored keys. Existing sharing and standing-routing suites pass. Full build, unit/backend suites, Worker/rendered/redirect checks, focused lint and whitespace pass; exact counts are in unit.txt and worker.txt. All fixtures are synthetic in disposable D1 with intercepted providers. No schema or migration change. Existing issued organization API keys remain valid until their explicit revocation; no key secret is exposed after creation.

This PR covers mutation authority. F09's separate organization-type/write-scope restriction remains a later P2 area. Stacked on F05 #28; draft PR only, no merge/deploy, production data/migrations, real issuance or messages.
