# Security policy

## Report privately

Use this repository's **Security → Report a vulnerability** flow for wrong or substituted mints, hostile buy links, injection, impersonation, or another issue that could put users or funds at risk.

If GitHub does not show that private-reporting option, open a public issue containing **no exploit details or sensitive data** and ask the maintainer to establish a private channel. Do not include a proof of concept until that channel exists.

Reports are reviewed on a best-effort basis. We aim to **acknowledge security reports within 7 days** and to keep status updates until a fix or a clear “won’t fix / out of scope” decision. A report should identify the affected file or URL, impact, reproduction conditions, and a safe way to confirm the fix. Thank you for responsible disclosure.

## Scope

The supported version is the current `main` branch. Third-party wallets, exchanges, explorers, social networks, and token contracts are outside this repository's control; report their vulnerabilities to their operators.

Never send seed phrases, private keys, or funds to test or report an issue.

## Build trust

CI uses read-only tokens unless a Pages deployment needs narrowly scoped write access. Third-party
workflow actions are pinned to full commit SHAs, with monthly Dependabot updates preserving the
reviewable version comments. Checkout credentials are not retained. The lockfile is committed and CI
installs it with `npm ci --ignore-scripts`; this repository has no required dependency lifecycle scripts.
