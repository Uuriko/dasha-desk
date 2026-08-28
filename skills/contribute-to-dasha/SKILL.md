# Contribute to Dasha

Use this skill to make a real, reviewable contribution to `Uuriko/dasha-desk`.

## Objective

Select one live piece of useful work, implement it conservatively, verify it, and leave a PR-ready evidence trail. Optimize for accepted outcomes, not activity volume.

## Source of truth

- Repository: `https://github.com/Uuriko/dasha-desk`
- Project manifest: `projects/dasha/project.json`
- Live issues and current repository state outrank stale prose or cached task descriptions.
- GitHub maintainer acceptance is final. An agent must never claim its own work is accepted.

## Workflow

1. Read `projects/dasha/project.json`, `README.md`, `CONTRIBUTING.md`, route/deploy docs, and any instructions relevant to the files you will touch.
2. Inspect live GitHub issues and recent merged/open PRs before choosing work. Do not duplicate an active effort.
3. Prefer one bounded task with a clear user-visible or reliability benefit. If a public bounty exists, preserve its exact published terms and do not reinterpret them as guaranteed payment.
4. Reproduce the problem or establish a concrete acceptance target before editing.
5. Make the smallest coherent implementation that solves the task. Preserve existing product identity, mint, custody, security and deployment boundaries.
6. Add or update focused tests. Run the narrowest relevant tests first, then the repository's normal verification gate when practical.
7. Review your own diff for accidental scope expansion, secrets, invented data, misleading product claims, unsafe external URLs, and generated-file drift.
8. Prepare a PR with: problem, solution, exact verification performed, user-visible effect, known limitations, and any deployment step that still remains.

## Evidence contract

A contribution is not complete without evidence. Include enough information for a maintainer or independent reviewer to reproduce the conclusion:

- issue/task URL or precise problem statement;
- files changed and why;
- test commands and results;
- live checks only when they were actually run;
- screenshots only when they materially prove UI behavior;
- exact remaining deployment or configuration requirements.

## Hard boundaries

Never:

- invent or expose secrets, API tokens, keypairs, wallet credentials or private user data;
- fabricate a Solana address, payout destination, transaction, balance, score or reward state;
- claim a deployment occurred without direct evidence;
- claim a maintainer accepted work before GitHub records it;
- weaken tests merely to make CI green;
- rewrite unrelated surfaces or restore retired routes without an explicit task;
- change the canonical $DASHA mint;
- move, sign or custody funds;
- create a private task-claim state that conflicts with GitHub.

## Completion standard

The ideal output is one understandable PR that a maintainer can evaluate quickly. Fewer high-quality accepted outcomes are better than many speculative changes.
