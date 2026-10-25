# F12: transactional key audit

Three failing regressions precede the fix. Sandbox key creation/revocation now append safe actor/action/environment events in the same D1 batch as the key mutation. Production key creation/revocation are also atomic with their existing audit events. Deterministic revoke-event identities prevent concurrent duplicate success events. Existing key secrecy and revocation behavior are retained; plaintext remains creation-only.

Injected audit failures prove both sandbox and production key creation roll back rather than leave an unaudited secret. Full build, 155 unit/backend tests, 42 Worker/rendered checks, focused lint and whitespace pass. All keys and accounts are synthetic in disposable D1; no live key or production resource is used. Audit events are append-only through application APIs; this does not claim database administrator tamper resistance. No schema/migration files change. Draft PR only, no merge/deploy or real messages.
