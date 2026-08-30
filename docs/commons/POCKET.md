# Pocket

Native Solana Mobile / Seeker client. **Not a WebView of getdasha.com.**

Repo: [Uuriko/dasha-pocket](https://github.com/Uuriko/dasha-pocket). Seed PR: [Uuriko/dasha-pocket#1](https://github.com/Uuriko/dasha-pocket/pull/1) (spike branch `cursor/pocket-spike-51b9`).

dasha-desk does **not** build Android. `verify.yml` stays Node + embed checks. Pocket Gradle would tax every mint/docs PR.

## Why mobile-native

MWA + Seed Vault are OS/wallet APIs. A WebView of www cannot sign with Seed Vault or hold a Seeker session. Pocket is a client of Commons, not a second bounty system.

## What the spike proves

1. **Connect** — Mobile Wallet Adapter. Seed Vault when present.
2. **Tape** — Commons kinds: created / funded / submitted / selected / paid / cancelled. Not `/digest`.
3. **Discovery** — `GET https://www.getdasha.com/bounties.json` (`dasha-bounties-feed/v1`). Empty `listings` is honest.
4. **One action** — Fund after a tap. Wallet only then. Simulated signer for tests. No custody. No auto-sign. No keys.

Vendors dasha-desk leaf files: `schema.mjs` `machine.mjs` `loop.mjs` `tape.mjs` `tx.mjs`. Skips `adapter.mjs` (Kotlin reads the public JSON).

## Copy this out

If you are looking at an older tree that still has a `pocket/` folder: copy that folder plus the five Commons files above into `Uuriko/dasha-pocket`. This slice created the GitHub repo instead, so the Android sources live there.

Do not add `pocket/` to dasha-desk `npm test`.

## What still needs Seeker

A real wallet session, Seed Vault sign, on-chain USDC, an APK, Play signing, push, camera/IRL drops, SKR perks.
