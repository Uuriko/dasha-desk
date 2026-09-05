# How the Desk is put together

Short version: three source files become four generated ones, and a set of gates exist because each
of them was once broken in production. If you understand why the build exists, everything else here
follows.

## The shape

```
src/body.html   ─┐
src/styles.css  ─┼─→ build.mjs ─→ src/app.html      one file, for pasting into a CMS
src/app.js      ─┘               index.html        this repo, served by GitHub Pages
config/dasha.json                dist/index.html   standalone copy
                                 /tmp/dasha-webflow-embed.html

studio/         local/Pages Meme Studio (not a live www product; www /studio 308s home)
home/           pasteable Home: $dasha + Chat + Buy — no Studio, no chess-door, no Simp
lobby/          pasteable Lobby: the one community room (www /forum 308s here)
privacy/        pasteable /privacy (live must 200, H1 Privacy)
desk/           /desk and /dasha 308 → /how-to-buy on www
404.html        branded miss page
bounties/       self-contained bounty board (index.html + board.js + board.css)
bounties/app.html       inlined paste for Webflow — do not iframe
bounties/feed.json      static listings feed (`schema: dasha-bounties-feed/v1`); GitHub Pages serves it at /dasha-desk/bounties/feed.json
bounties.json           same feed at the Pages site root (/dasha-desk/bounties.json). Live www.getdasha.com/bounties.json is the edge feed (`x-dasha-edge: bounties-feed`).
config/bounties.seed.json   same listings (seed copy)
```

Edit the four on the left. Never edit the four on the right — `node build.mjs --check` fails if they
drift, and CI runs it on every pull request.

## Why generate at all

The Desk has to exist in two places at once: as a normal static site (this repo, GitHub Pages) and as
a fragment pasted into a page we do not control. Those want opposite things — one wants separate
`.css` and `.js` files, the other wants a single self-contained blob with no external requests.

Maintaining both by hand means they drift, and the drift is silent: the version you test is not the
version most people load. So there is one source and a build, and a gate that fails when the outputs
are stale. That is the whole reason for the indirection.

## The pieces

**`src/body.html`** — markup only. No styles, no behaviour. Everything is inside `#dd-app`, and every
class is prefixed `dd-`, because this markup gets dropped into a page with its own CSS.

**`src/styles.css`** — scoped under `#dd-app.dd`, which holds the five poster tokens (`--ink`, `--paper`, `--acid`, `--hot`, `--violet`). Nothing is styled by element selector alone; a bare `p { }` would reach into the host page and change something that is not ours. Visual rules: [DASHA-ART-DIRECTION.md](DASHA-ART-DIRECTION.md).

**`src/app.js`** — no framework, no build step, no dependencies. It fetches public market data,
renders it, and degrades. It never connects a wallet and never constructs a transaction.

**`config/dasha.json`** — the mint and the source links. One place, so a wrong address cannot be right
in one file and wrong in another.

**`bounties/`** — a sibling of Studio, not part of the Desk generate step. Vanilla HTML/CSS/JS.
Anybody can list a GitHub issue/PR (`kind: item`) or a whole project (`kind: project`) with owner-written rules.
Listings come from `bounties/feed.json` (also published as GitHub Pages `/dasha-desk/bounties.json` and raw GitHub; live `www.getdasha.com/bounties.json` is the edge listings feed), open GitHub issues (`bounty-project` / `[bounty]`), this-device
localStorage, `#l=` share JSON, and Demigod’s public feed (`options.extraSeedUrls`, defaulting to `bounties-feed.json` on GitHub raw / jsDelivr — not mixed into the local seed first-OK-wins list). Failure is non-fatal.
Demigod-sourced rows are captioned; they are not Dasha mint or Studio work. `listingId` dedupes items by repo/type/number.
Project-level pools are optional. Accepted outcomes need a GitHub PR, issue, or comment URL — no score without a link.
GitHub identity is required to list, claim, or pay. X is optional and reuses `lobby.getdasha.com` OAuth (`/oauth/x/start`, window name `dasha_x`) — the same session as Simp Board. Never invent ranks or dollar amounts. If a mint/CA appears here, it must come from `config/dasha.json`.

## What the gates protect

Each of these exists because of a specific failure, not as ceremony.

| Gate | Protects |
| --- | --- |
| `build.mjs --check` | The generated files match the sources. Catches an edit made in the wrong file. |
| `dasha-mint-consistency.test.mjs` | Every surface shows the same mint. This is the one string where being wrong costs someone money. |
| `dasha-share.test.mjs` | Share text carries the mint and no invented claim. |
| `dasha-desk-resilience.test.mjs` | The mint and source links survive every way the data API can fail — 500, connection drop, truncated JSON, empty results, nulls in every field — and no number is ever fabricated to fill a gap. |
| `dasha-oss-docs.test.mjs` | The docs in this repo do not contradict each other. |
| `studio/studio.test.mjs` | The Studio stays self-contained, every look id a remix URL can name still exists, and the embed is generated rather than hand-edited. |
| `bounties/bounties.test.mjs` | Listing JSON parses (item + project), malformed issues are skipped, empty outcomes copy, proof URLs required, the form builds a GitHub `issues/new` URL, static feed matches root `bounties.json` and carries `schema: dasha-bounties-feed/v1`, seed has no fake leaderboard, extra Demigod feed merge/dedup is non-fatal. |
| `watch.mjs` | What the **live Worker** actually serves. Contract is [`ROUTES.md`](ROUTES.md): privacy 200, Studio/verse/learn/graph 308 home, desk/dasha 308 how-to-buy, `/compute` 200 product page, chess `var API` = lobby host. Still fails on blank pages, wrong redirects, stale SRI, missing H1, broken OAuth start, wrong mint, `plugin.jup.ag`. Local: `node watch.mjs --fixture`. Do not invent the Worker here. Live vs this tree: [`STATUS.md`](STATUS.md). |

`watch.mjs` is the odd one out and the most important. Every other gate reads files in this repo, and
the failures that reach visitors happen *between* the repo and the site: a Worker 308 that lands
on the wrong page, an empty chess `var API`, a stale SRI pin, a mint typo. Every file-reading gate
can pass while www is wrong. It splits findings into failures (things that mislead someone or cost
them money) and warnings (things merely worse than they should be), because a monitor that is
permanently amber gets muted, and a muted monitor is worse than none — it looks like coverage.

Live owner is dasha-lobby, not GitHub Pages and not Designer-publish. Studio is retired on www.

The resilience gate is the one worth reading if you only read one. It injects each failure mode and
asserts the page still does its actual job. It also counts intercepted requests, so it cannot pass by
accidentally testing nothing — an earlier version did exactly that for five failure modes at once.

## Rules that are not style preferences

- **No wallet connection, no custody, no transaction construction.** The Desk shows you things and
  links to Jupiter. If a change moves value, it does not belong here.
- **No fabricated numbers.** If data is missing, say it is missing. A plausible placeholder is worse
  than a blank, because a blank is honest.
- **The mint comes from `config/dasha.json`.** Never type an address into markup.
- **Third-party data can fail at any time.** Every feature must have a defined behaviour when it does.

## Running it

```bash
python3 -m http.server 8766     # → http://127.0.0.1:8766/ and /bounties/ (local Studio is /studio/)
node build.mjs --write          # after changing anything in src/
node build.mjs --check          # what CI runs
node bounties/bounties.test.mjs # listing parse / no fabricated ranks
```

The site and build have no runtime dependencies or install step. The full test suite uses one
development-only browser driver so the data-failure promise is checked in a real page. Documentation
and source edits remain possible without installing it.
