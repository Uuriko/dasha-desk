---
name: dasha-repo-health
description: Run the bounded nightly health check for Uuriko/dasha-desk and live getdasha.com. Use for scheduled route-contract verification, deterministic test failures, and minimal reviewable repair proposals. Do not merge, deploy, alter Cloudflare, use wallets, or expose secrets.
---

# Dasha repository health

Verify the canonical repository and public production contract without turning a routine check into an autonomous deployment workflow.

## Safety boundary

- Work in an isolated Git worktree based on the current default branch.
- Never merge, deploy, publish, run `wrangler`, change DNS, alter Cloudflare, sign a wallet transaction, or use a production credential.
- Never read or print `.env*`, credential stores, shell history, browser profiles, wallet files, private deployment notes, or ignored files.
- Do not modify generated artifacts merely to make a test pass.
- A healthy run makes no GitHub write.
- An ambiguous or transient failure makes no branch, commit, pull request, or issue.
- Maximum one external GitHub write per run: either one issue/report or one pull request, never both.

## Source-of-record boundary

`watch.mjs` defines the public getdasha.com contract, but the live `www` and lobby routes are served by the operator-owned `dasha-lobby` Cloudflare Worker, whose source is not this repository.

Therefore:

- If production violates `watch.mjs` but the correcting implementation is not present in this repository, report the exact failed contract and stop. Do not fabricate a fix in fixtures or static mirrors.
- Open a repository pull request only when the root cause and smallest tested correction are genuinely inside `Uuriko/dasha-desk`.
- Do not weaken a monitor to accommodate broken production unless the contract itself has been explicitly changed by a maintainer.

## Nightly sequence

1. Confirm the worktree is clean and record the starting commit:

```bash
git status --short
git rev-parse HEAD
git remote -v
```

Stop if there are unexpected local changes or the repository/remote is not `Uuriko/dasha-desk`.

2. Inspect the current contract before running commands:

- `package.json`
- `watch.mjs`
- `README.md`
- any file named by a failing test

Do not infer current behavior from an old issue or pull request when the default branch differs.

3. Run the deterministic repository suite:

```bash
npm test
```

4. Run the public production monitor separately and retain structured output:

```bash
node watch.mjs --json
```

5. Classify the result:

### Healthy

Both commands pass. Return a short report containing:

- starting commit;
- commands run;
- pass status;
- production monitor timestamp;
- `no external write`.

Do not create a branch, commit, issue, or pull request.

### Transient or ambiguous

Examples: DNS/network failure, upstream 429/5xx, incomplete response, one-off timeout, or a failure that cannot be reproduced.

- Retry only through the retry behavior already implemented by the monitor.
- Do not add an unbounded retry loop.
- Record the exact command, route, status/error class, and uncertainty.
- Make no external write.

### Deterministic production-only drift

The live route repeatedly violates the existing contract, but the serving implementation is not in this repository.

- Confirm the corresponding fixture/local test still expresses the intended contract.
- Return a report naming the exact route, assertion, observed status/copy, and source-of-record boundary.
- If GitHub write permission is available and the same unresolved failure is not already tracked, open one concise issue. Do not create code or fixture changes.

### Deterministic repository defect

A failure is reproducible and the root cause is in this repository.

Before editing:

- identify the exact contract;
- identify the smallest owned source file;
- state why the change does not weaken production monitoring, exact-mint checks, security, privacy, wallet boundaries, or deployment ownership.

Then:

1. Make the smallest correction.
2. Add or update a regression test that fails without the correction.
3. Re-run the focused test, `npm test`, and `node watch.mjs --json`.
4. Review `git diff --check` and `git diff --stat`.
5. Scan the diff for credentials, private identifiers, wallet material, and accidental generated output.
6. Create one isolated branch and pull request only when all required checks pass.

The pull request must include:

- starting and final commit;
- exact reproduced failure;
- root cause;
- files changed;
- commands and results;
- why the change stays inside repository ownership;
- explicit statement: `No merge or deploy performed.`

## Repair limits

Stop without a pull request when the proposed repair would:

- require Cloudflare/dashboard access or a Worker source tree not present here;
- alter wallet signing, custody, payments, token authority, DNS, OAuth, production secrets, or deployment credentials;
- modify more than the smallest coherent behavior and regression coverage;
- remove or weaken a monitor because production is failing;
- depend on an undocumented external API or guessed endpoint;
- conflict with another open pull request touching the same contract;
- leave `npm test` or the live monitor failing for a new reason.

## Required final format

Return these fields in the Scheduled review result:

```text
Status: healthy | transient | production-drift | repository-fix-proposed | blocked
Start commit:
Commands:
Repository suite:
Production monitor:
External write: none | issue URL | pull request URL
Evidence:
Uncertainty or remaining blocker:
No merge or deploy performed.
```

Keep the report factual. Do not claim a route, integration, verification, partnership, payment, or deployment is live unless the run directly proved it.