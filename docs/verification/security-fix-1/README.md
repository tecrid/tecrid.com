# SECURITY-FIX-1 verification

Applied to TECRID PR #33, branch `codex/security-abuse-budgets`, starting from published head `5506227506404f1008a2cbbd1d63d5f821bbc45d`.

## FIX 1

IP and optional principal budgets now run before the shared global budget. Requests denied at either client check never consume global capacity. The effective global limit is `max(configured global limit, 25 * configured IP limit)`, preserving the default 3000/120 headroom even when operators supply a smaller global value.

The first follow-up commit adds failing regression tests. On the old implementation: **4 passed, 3 failed**, including a fresh client receiving 429 after another client sent 110 requests. The other failures show a low global override defeating client isolation and one principal exhausting global capacity across IPs. See [before evidence](regression-before.txt).

With the fix:

- **152 unit/backend tests passed**, 36 files: [unit log](unit-tests.txt).
- **47 Node/Worker checks passed**, including all seven focused abuse checks: [Worker log](worker-tests.txt).
- Production build passed: [build log](build-after.txt).
- Focused ESLint passed for the changed guard and both abuse test files: [lint log](lint.txt).
- Git whitespace check passed.

The built-Worker flood test sends 110 concurrent requests from one synthetic IP with rotating synthetic bearer values. Exactly two reach the authenticated handler; 108 receive 429. A second IP still reaches the handler twice, then hits its own independent limit. The 401 handler response deliberately proves passage through the budget without granting anonymous access. Direct-guard tests use the sign-in mutation path and real disposable D1 counters to verify the configuration floor, principal-denial isolation, aggregate global enforcement and fail-closed storage handling. Oversized JSON rejection and retry/cache headers remain covered.

Reproduction:

```sh
npm run build
npm run test:unit
node --test tests/security-abuse-worker.test.mjs tests/security-abuse-budget.test.mjs tests/identity-worker.test.mjs tests/rendered-html.test.mjs tests/www-redirect.test.mjs
npx eslint lib/abuse-budget.js tests/security-abuse-budget.test.mjs tests/security-abuse-worker.test.mjs
git diff --check
```

On this host, Worker/D1 tests require local loopback sockets outside the restricted sandbox. Production application transports are intercepted; no real account, email, notification or production database is used. The initial socket-permission error was rerun with permitted loopback networking and is not counted as an application regression.

The limit isolates one trusted edge-IP bucket; it is not a claim to prevent distributed denial of service or to distinguish users behind the same NAT/missing-IP bucket. Live edge-header trust remains a release rehearsal check.

## FIX 3

[Dependency report and future main-into-branch plan](DEPENDENCY-PLAN.md) includes full published heads, verified ancestry and a read-only conflict forecast. All six unmerged mint implementations (#18, #20-#24) remain in the existing security ancestry; #19 and #25 are already merged. #22's implementation is inherited, but its later audit commit is not.

Only #33 is updated here. #34-#37 still need the fix propagated through the reviewed future merge sequence. No security PR was rebuilt. No branch merge, rebase, force-push, retarget, deployment or production mutation occurred.
