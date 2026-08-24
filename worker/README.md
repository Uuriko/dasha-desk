# Worker-first getdasha.com

This directory is the **same product** as the static desk / Studio / bounties files in the repo root: `$dasha` / dash_eats on [getdasha.com](https://www.getdasha.com/). It is not a second coin or a second site.

Live www is Worker-first. The Worker owns the public contract below. Designer publish is not how this tree ships.

## Public contract (live 2026-08-24)

| Route | Status | Notes |
| --- | --- | --- |
| `/` | 200 | Home rewrite. First paint `$dasha` + Buy. `sameAs`: X `dash_eats`, site, `jup.ag/tokens` + mint. `stripHomeOtherCoinWarning` — no VVAIFU / Not CoinGecko on home. |
| `/studio` `/privacy` `/dasha` `/desk` `/verse` `/learn` | 308 | Permanent redirect to `/` |
| `/bag` | 200 | Mint-dead. Freeze-dead. Burned Raydium LP. |
| `/which` | 200 | dash_eats vs VVAIFU. VVAIFU belongs here, not on home. |
| `/llms.txt` `/llms-full.txt` `/ai.txt` | 200 | Machine identity |
| `/sitemap.xml` `/robots.txt` | 200 | Crawl files |

Identity (public, not secrets):

- Mint `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`
- Pair `9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7`
- Jupiter `https://jup.ag/tokens/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump` — never `plugin.jup.ag`
- X [@dash_eats](https://x.com/dash_eats)
- Official Telegram `https://t.me/+xB7S8mIQaKFiZjRh`

## What this tree does not include

No faucet signer or keypairs. No treasury or personal wallet hardcoded as a destination. No wrangler OAuth. No CLAIMS / dasha-ship ops. No OAuth client secrets. No Cloudflare `account_id`.

`wrangler.jsonc.example` is the deploy shape. Copy it locally; do not commit `account_id` or tokens.

## Run

```bash
# from repo root
node worker/worker.test.mjs

# optional local edge (needs wrangler on your machine; not a repo dependency)
cp worker/wrangler.jsonc.example worker/wrangler.jsonc
npx wrangler dev --config worker/wrangler.jsonc
```

If `ORIGIN` is unset, `/` serves the Worker-owned home (still rewritten). If `ORIGIN` is set, the Worker fetches that HTML and applies `rewriteHome`.
