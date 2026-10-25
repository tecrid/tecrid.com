# F09: production write-key boundaries

Seven failing cases precede the fix. Non-laboratory and pending-laboratory workspaces cannot create production write/wildcard keys. Authorization rechecks current laboratory type and verified issuer status on every write, including legacy wildcard keys. Unknown write routes fail closed even for a verified lab wildcard. Intended read access and verified-lab scoped writes remain available. Existing sandbox/publish/signature gates remain independent.

Focused scope tests, full build, unit/backend and 40 Worker/rendered checks pass; counts are in unit.txt. Focused lint and whitespace pass. The sandbox-registry fixture now provisions its production-prefix test key while its synthetic lab is verified, then returns that lab to pending for the sandbox boundary tests. All keys/data are synthetic in disposable D1. No live key, organization, migration or configuration changed. Draft only, no merge or deploy.
