# SECURITY-FIX-1: TECRID dependency and integration plan

Scope: FIX 1 on existing PR #33 and FIX 3 analysis only. No branch merge, rebase, security-stack rebuild, retarget, deployment, production data change or real message was performed.

## Verified repository state

GitHub main is `ef946aba6d7a8f24fe2a4f91630d2733afe80ec2`. #19 is already merged at `74839de826a1d827159ab693f701bdfe587e3620`, and #25 is already merged at the current main head. The security branches still descend from the pre-#25 live-sync head `8336d36aaee6fcece56e8aafac40368317e75a41`.

The existing chain is:

`#19 (merged) -> #18 -> #20 -> #21 -> #22 implementation -> #23 -> #24 -> #26 -> #27 -> #28 -> #29 -> #30 -> #31 -> #32 -> #33 -> #34 -> #35 -> #36 -> #37`

#25 is already on main and is not an unmerged prerequisite. It must be preserved when main is brought into the existing mint/security branches. #26 is the verified-session prerequisite for #27.

## Exactly which mint PRs are required

For the existing stack, all six unmerged mint implementation PRs **#18, #20, #21, #22, #23 and #24** must be resolved before #27 and later can merge in the requested order. #19 is a satisfied prerequisite. This distinguishes ancestry/integration requirements from direct imports; it does not claim every mint feature is individually necessary to write a standalone share-code fix.

| PR | Published head | Relationship to #27 and later |
| --- | --- | --- |
| #18 | `9f107293b0773af9b9c56bef5816289e94b3cca3` | Ancestor of #24, #26 and every #27-#37 head. Adds outbox/channels, migration 0020 and Worker delivery processing. #28's recipient webhook uses `notificationPayload` from its `lib/notification-delivery.ts`; #33 and #37 modify the inherited Worker. |
| #19 | `8336d36aaee6fcece56e8aafac40368317e75a41` | Already merged. Shared live inbox/mobile baseline, migration 0019, notification bridge and source for #30's service-call hardening. Do not reopen or rebuild it. |
| #20 | `f2d8704f30781875aa4853f46c9164c21799f4b8` | Ancestor of all security heads. Standing authorization, signed ingredient linkage and migration 0021 feed #28's current routing-authority checks and #29's routing-role checks. |
| #21 | `36f7837a72a4ed59e2e07c72c9b3ddcb845d9373` | Direct #27 dependency: `lib/sharing.ts` imports `recipientDisclosureGate` from the organization-access module introduced here. #28 uses `grantDeliveryGate`. Identity/terms state comes from migration 0022. |
| #22 | `6c686aa9552a373bb97b3de27f84829366fb1d45` | Its implementation commit `db10682176a602cf27c810245716aeac60d793f5` is an ancestor of #23, #24 and all security heads. Provides marketplace recipient handling in sharing and `lib/recipient-webhook.ts`, hardened by #28. **The current head is not an ancestor:** its later audit-only commit is missing downstream; details below. |
| #23 | `ba9267cdd92b32a99ca2dca184f12f77d7d8468e` | Required by the preserved ancestry: direct parent baseline for #24, hence for #26/#27 and later. Carries delivery timeline, acknowledgments, Worker E2E and key-import compatibility. No new #23 export is independently imported by the #27 diff. Do not drop it by rebuilding #27. |
| #24 | `cd4746531f1b25f7025fa979e2b5a5c020ba028b` | Direct base of #26 and ancestor of #27-#37. Carries issuance deduplication, signed source/sample linkage, sandbox registry and migration 0023. Later security changes modify the resulting issuance/routing/key/legacy-report code and retain its tests and boundaries. |

Ancestry was checked with `git merge-base --is-ancestor` against every published #26-#37 head, not inferred solely from PR descriptions. [Raw PR snapshot](pr-snapshot.json) and [ancestry results](ancestry.json) preserve the exact heads reviewed.

### The #22 divergence

#23 was built on #22 implementation head `db10682176a602cf27c810245716aeac60d793f5`. #22 later advanced to `6c686aa9552a373bb97b3de27f84829366fb1d45` with five audit/document/probe files (+376 lines), no application code or migration changes:

- `docs/VLE-DELIVERY-CONTRACT.md`
- `docs/verification/mint-contract-alignment/README.md`
- `docs/verification/mint-contract-alignment/boundary-checks.json`
- `docs/verification/mint-contract-alignment/full-stack-test-results.txt`
- `scripts/audit-vle-boundary.mjs`

That audit commit is absent from #23, #24 and #26-#37. The future main-into-#23 merge after #22 lands must carry it forward. This is not missing marketplace implementation, and it is not a reason to rebuild the security PRs.

The audit's compatibility blocker remains real: the existing producer is `tecrid.delivery/1`; the ordered `vle-evidence/1` supplier identity, consent and ordered tombstone contract is a separate repair. Nothing in this abuse-budget fix completes that repair. Receiver/automatic delivery stay OFF. Elon must resolve #22's explicit merge hold and review the separate contract repair before treating that integration as compatible.

## Proposed main-into-branch sequence (not executed)

1. Fetch and pin current main and all target heads immediately before integration. Start from each existing published branch with a clean checkout. Use ordinary merge commits and plain pushes; never rebase, force-push, cherry-pick/recreate the security stack, or discard either side wholesale.
2. For **#18**, merge the then-current `origin/main` into `codex/tecrid-mint-1-delivery-channels`. Resolve the role-sidebar conflict by retaining #25's role-aware navigation while preserving access to delivery-channel settings. Run build, unit/backend, Worker/rendered/redirect checks and relevant role/navigation checks. Plain-push, report the new SHA, and leave PR retargeting/review/merge to Elon.
3. **Only after Elon merges #18**, repeat main-into-existing-branch, resolve, validate, plain-push and report for **#20**, then **#21**, then **#22**, then **#23**, then **#24**, one at a time after the preceding PR reaches main. #22 remains gated on the compatibility/disabled-baseline decision above. This ordering propagates each reviewed resolution and #22's audit without rewriting descendants.
4. After #24 is on main, repeat for **#26**, then **#27, #28, #29, #30, #31, #32, #33, #34, #35, #36, #37**, in that order. Each next branch takes the latest main after Elon's predecessor merge. Preserve #26's session-only identity, #27's current recipient checks, #28's revocation enforcement and every later security boundary when resolving overlaps.
5. The FIX 1 commits land only on **#33** in this task. **#34-#37 do not yet contain them.** After #33 merges, bringing main into #34, then each later branch in the sequence, carries the fix forward. Do not merge later security heads as an aggregate before that propagation is verified.
6. At every step check the diff against current main, preserve migrations 0019-0023 and their journal entries, rerun the inherited security suites, and confirm the previous reviewed SHA is an ancestor of the new head. Report PR number, base, full head SHA and validation. No deploy or live migration follows from a branch merge.

Example for a future separately authorized integration step:

```sh
git fetch origin
git switch <existing-pr-branch>
git merge --no-ff origin/main
# Resolve conflicts, inspect the combined diff, and run that branch's checks.
git push origin HEAD:refs/heads/<existing-pr-branch>
git rev-parse HEAD
```

If a plain push is rejected, fetch and inspect the concurrent head; do not force or silently overwrite it.

## Conflict forecast and resolution priorities

A traditional read-only three-tree preview (`git merge-tree --trivial-merge <merge-base> <published-head> <main>`) produced these textual conflicts. It wrote no working files, index, refs or merge commits. This is a snapshot forecast for merging today's main independently into each branch, not the final conflict set after sequential integration.

| Branch/PR | Conflicting paths against current main |
| --- | --- |
| #18 | `app/dashboard/workspace-sidebar.tsx` |
| #20 | Above plus `lib/tec.ts` |
| #21 | Above plus `app/dashboard/evidence-routing/page.tsx` |
| #22 | Above plus `app/dashboard/dashboard-client.tsx` |
| #23, #24, #26, #27, original #33, #37 | Above plus `app/dashboard/page.tsx` |

[Exact preview inputs/results](merge-preview.json). Treat `lib/tec.ts` as a semantic resolution: retain main's deferred organization setup, owner-only detail save and issuer code/slug recomputation together with mint signed-code, idempotency and sample-linkage guarantees. Later merges must also retain current verified-lab key restrictions, independent review, role guards and atomic audit writes. In the dashboard/routing files retain #25's small role-specific navigation and setup guards while carrying the mint channel, recipient gate and latency features. A conflict-free merge alone is not sufficient evidence.

Validation after integration should include the complete inherited unit suite; built Worker identity, abuse, rendered and redirect tests; role onboarding/navigation and deferred issuer tests from main; share replay/revocation, current recipient reads, owner/admin operations, independent review, key scopes/audit, confirmation expiry and CSP/private-response tests as those PRs enter the stack. Use disposable databases/intercepted transports. Migration 0023's historical-source preflight remains a separate release gate, not an instruction to query production here.

## Published security heads before FIX 1

These remain unchanged except #33's normal follow-up commits in this task. Full current #33 is reported in STATUS after push.

| PR | Existing branch | Snapshot head |
| --- | --- | --- |
| #26 | `codex/security-identity-boundary` | `7e0371d1afac8f2de9d30395150d4e92beef9e03` |
| #27 | `codex/security-share-codes` | `73bd55ca6f9e29ae55af291f2a36333d4c2318e8` |
| #28 | `codex/security-recipient-reads` | `b174d816696dac7b0274f5a010cceaeb7d5a2d2e` |
| #29 | `codex/security-role-checks` | `eab0db532e89f77cc5bc86bb96e9742eb6e1f3fb` |
| #30 | `codex/security-service-sender` | `52c0e216f3641c11cb3bf3d6a304115c1268126d` |
| #31 | `codex/security-key-scopes` | `f149b5050d648b23a7792c496a82d8d668262bef` |
| #32 | `codex/security-independent-review` | `e7af56c924072019d08621556cf1e0b90e66698f` |
| #33 | `codex/security-abuse-budgets` | `5506227506404f1008a2cbbd1d63d5f821bbc45d` |
| #34 | `codex/security-key-audit` | `b8197d1fac89fd4fa5957cc4eca96eed7ff1df7b` |
| #35 | `codex/security-auth-log-privacy` | `daf5f6522ae078c26495c2b01cde43f49cde645b` |
| #36 | `codex/security-confirmation-links` | `419601bab319d5431b863bc10175d76edc94b6bc` |
| #37 | `codex/security-response-headers` | `6b61d6de27117e749a27d749bbc36d861543e676` |

No VLE branch was changed. Release coordination remains VLE #68 with TECRID #30, and VLE #70 with TECRID #33, after distinct secrets are provisioned under the separate release gate.
