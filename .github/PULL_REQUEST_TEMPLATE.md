## Why

What does this unlock for users or contributors?

Issue / contract addressed: `#`

## What changed

-

## External interface evidence

Complete this section for any wallet, chain, payment, provider, marketplace, SDK, API, webhook, or deployment integration.

- Official documentation or pinned SDK/fixture:
- Exact interface/version tested:
- What remains simulated, test-mode, devnet, or unverified:

Do not invent endpoints, test hosts, headers, program IDs, status values, or partner approval. A local mock proves only the local contract.

## How checked

- [ ] Read the full linked issue, blockers, predecessor PRs, and current repository before implementation
- [ ] Added actual implementation and tests, not only pseudocode or a generated solution document
- [ ] Reused canonical schemas, validators, and state machines instead of creating a looser parallel model
- [ ] `node build.mjs --write` (if sources changed), then `npm ci && npm test`
- [ ] Spot-checked in a browser / local server where relevant
- [ ] Recorded the exact final commit and actual test result
- [ ] Did **not** hand-edit generated `index.html` / `dist/` / `src/app.html`
- [ ] Did **not** use real funds, production secrets, automatic signing, merging, or deployment in ordinary tests

For financial state, a wallet-returned signature is submitted evidence, not proof of funding or payment. State the independent observation and reconciliation path before claiming a paid/funded acceptance criterion.

## Limitations and boundaries

What is still not implemented or proven? How does this preserve custody, signing, exact-mint identity, privacy, and deployment authority?

## Community

Does this relate to an issue? Link it. Use `Closes #N` only when the actual implementation satisfies that issue's current acceptance criteria. Otherwise use `Advances #N` or `Related to #N`.

**First PR?** Welcome. Keep the change small and ask questions on the issue before building around an uncertain external interface. AI coding tools are welcome, but the submitter is responsible for checking the repository, validating external facts, and running the stated tests.

<!-- Maintainer only: if the OSS points lane is active, apply exactly one impact: label or simp:no-score before merge. Contributors need no label permissions. -->
