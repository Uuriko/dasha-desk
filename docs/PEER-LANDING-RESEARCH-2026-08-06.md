# Peer meme / culture-coin landing research → $dasha desk

**Date:** 2026-08-06  
**Scope:** Patterns from Solana/meme culture landings (BONK-era community energy, WIF single-mascot focus, generic Dex-era “CA first” pages) applied to **dasha desk** without fake roadmaps or endorsement claims.

## Peers / patterns consulted

| Source | Pattern observed |
|--------|------------------|
| DexScreener-centric meme UX (guides, trader habit) | CA is the product; always copyable, same place, never buried |
| Meme promotion practice 2026 (site + BUY + socials before hype) | Website = CA + buy + visuals + FAQ/risk, not a whitepaper |
| BONK community framing | Ecosystem/community identity over celebrity “official” claim |
| dogwifhat / pure meme coins | One joke, dense visual identity, viral share objects |
| Solana trader folklore (CA verify culture) | Mint checker + explorer links reduce fake-CA DMs |
| Successful share loops | Prefilled X intent + multi-format copy packs for Discord/Telegram paste |

Peer URLs / references (audit trail):

- https://www.cryptotrafficmarket.com/how-to-promote-a-meme-coin-in-2026-a-practical-guide-by-cryptotrafficmarket/
- https://smithii.io/en/add-social-media-link-dexscreener/
- https://messari.io/compare/bonk-vs-dogwifcoin
- https://coindcx.com/blog/cryptocurrency/bonk-vs-dogwifhat/
- DexScreener CA-copy culture (trader tutorials / habit, not a single site)

## Transferable ideas (implemented on desk)

1. **Top-of-page risk + identity strip** — Culture-coin disclaimer and “association ≠ endorsement” visible before the meme dump (peer: serious meme sites put risk near first paint, not only footer).
2. **Raid / copy-pack selector** — Multiple share templates (X caption, Discord paste, verify-CA pack) + Draft on X intents (peer: raid culture lives on prefilled pasteables).
3. **Click-to-copy meme cards** — Voice board cards become share objects: click copies quote + $dasha tag (peer: single-joke tokens ship shareable meme units).
4. **How to verify rail** — Explicit steps + explorer CTAs so fakes lose (peer: CA-first culture).
5. **Community room strip** — Labeled third-party + OSS + “steal these lines” chips as the hangout surface (peer: community tape without claiming official channels).

## Self-prompt (execution brief)

> Improve dasha desk landing only. Add voice-safe copy (no endorsement). Ship ≥3 new durable media on catbox/local public URLs. Wire shareable community tools: multi copy-packs, X intents, clickable quote cards. Implement three peer ideas above in real UI. Rebuild with build.mjs. Keep mint `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`, hero, and disclaimer. Expose pure share builders for unit tests. Do not touch Demigod or domain DNS.

## Non-claims

This desk is a community culture surface for an associated mint. Not official Dasha / Red Scare / @dash_eats product.

## Fresh product direction — primary-source pass

The defensible wedge is an inspectable chain from mint → sources → claims → changes, not another chart terminal or launcher.

| Rank | Opportunity | Decision |
|------|-------------|----------|
| 1 | Mint evidence bundle | **Built:** finalized Mint account type, program, supply, decimals, revoked authorities, raw-account hash, association label, and copyable JSON |
| 2 | Source-locked thesis receipt | Next experiment only after people use/share the evidence bundle |
| 3 | Deterministic manifest linter | Extract from current build and URL guards; output pass/warn facts, never a safety score |
| 4 | Reusable desk generator | Wait for a second real mint desk before generalizing `$dasha` |
| 5 | Change/takeover ledger | Wait for the first meaningful authority, metadata, or association change |

Primary evidence:

- Solana defines the Mint Account fields that matter here—including supply, decimals, mint authority, and freeze authority—and explains that setting authorities to `None` permanently removes those capabilities: https://solana.com/docs/tokens/basics
- Metaplex token metadata includes mutable presentation data and an off-chain URI, so a symbol or logo is not identity proof: https://solana.com/docs/tokens/metaplex
- Dexscreener exposes profiles, boosts, ads, community takeovers, and paid orders separately from pair data; promotional state must therefore remain labeled separately from on-chain facts: https://docs.dexscreener.com/api/reference
- Jupiter's swap product requires transaction assembly and signing for embedded execution. Dasha keeps an external Jupiter link and remains wallet-free instead of inheriting that transaction trust surface: https://dev.jup.ag/docs/swap/order-and-execute

Explicitly rejected for now: generic screener, embedded wallet/swap, token launcher, “AI alpha,” opaque risk score, copy trading, staking, governance mechanics, on-chain reputation graph, and auto-generated social/news aggregation. Each either duplicates a mature provider, weakens the static no-wallet boundary, creates unprovable claims, or adds infrastructure before demand.
