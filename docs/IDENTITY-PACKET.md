# Dasha Identity Packet (P0)

This packet serves as the canonical source of record for external token, directory, wallet, and registry listings (Jupiter VRFD, CoinMarketCap, Solscan, Birdeye, DexScreener).

## Canonical Identity Fields

| Field | Canonical Value | Source / Verification |
| --- | --- | --- |
| **Token Name (On-Chain)** | `dash_eats` | Pump creation metadata (`QmU9TM9DYc8YCxZiZSmvdBcdwWvhHhZvBneoxEAkmgiLxV`) |
| **Project Display Brand** | `Dasha` | Public project brand on [getdasha.com](https://www.getdasha.com) |
| **Symbol** | `$dasha` / `DASHA` | On-chain symbol & CoinGecko / Jupiter ticker |
| **Solana Mint** | `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump` | Pinned in `config/dasha.json` and 13 repository consistency gates |
| **Canonical Pool** | `9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7` | Raydium pool on [GeckoTerminal](https://www.geckoterminal.com/solana/pools/9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7) |
| **Direct Project Token Image** | `https://www.getdasha.com/assets/dasha-token.png` | 400×400 square PNG committed in `assets/dasha-token.png` |
| **IPFS Token Art (Reference)** | `https://ipfs.io/ipfs/Qmb4fcJYbM1RSU43bvNPwUjhwGXK42L9xGvjEEijmWtAcg` | Exact original pump.fun artwork bytes (SHA-256: `99af4d07...`) |
| **Project Mailbox** | `team@getdasha.com` | Tested forwarding route for registry verifications |
| **Submitter / Authority** | John / `@potterlab` | Community maintainer (neither original issuer nor metadata update authority) |
| **Repository** | `https://github.com/Uuriko/dasha-desk` | Public MIT codebase |
| **Machine Manifest** | `https://www.getdasha.com/.well-known/dasha.json` | Public `dasha.identity/v1` machine-readable profile |

## Rights Rationale & Asset Integrity

1. **Original Art Preservation:** The token artwork originates from on-chain Pump metadata created at mint time (`QmU9TM9DYc8YCxZiZSmvdBcdwWvhHhZvBneoxEAkmgiLxV` -> CID `Qmb4fcJYbM1RSU43bvNPwUjhwGXK42L9xGvjEEijmWtAcg`).
2. **Direct Project Domain Serving:** The image is served directly from the project root at `assets/dasha-token.png` (PNG format, 400×400, no animation, no query strings, HTTPS, no redirect) to eliminate third-party IPFS gateway timeouts during Solscan/CMC review.
3. **Neutral Branding & No Misrepresentation:** The asset is presented strictly as the neutral public token icon. It does not claim ownership or likeness endorsement of individuals associated with `@dash_eats`.
4. **Authority Boundary:** Submissions identify John (`@potterlab`) as the open-source repository maintainer and community submitter, not as the creator or mutable metadata update authority.

## Directory Review Checklist

- [x] Direct project-domain square token PNG committed (`assets/dasha-token.png`).
- [x] Machine-readable identity manifest committed (`.well-known/dasha.json`).
- [x] Pinned canonical mint consistency across all project surfaces (`53uxQtB9...pump`).
- [x] Neutral `dash_eats (DASHA)` description aligning Dasha project brand with on-chain ticker.
- [x] Verified independent explorer links (Solscan, DexScreener, GeckoTerminal, Jupiter).
