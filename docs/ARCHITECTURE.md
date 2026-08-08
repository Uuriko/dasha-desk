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

**`src/styles.css`** — scoped under `#dd-app.dd`, which holds the design tokens (`--text`, `--muted`,
`--accent`…). Nothing is styled by element selector alone; a bare `p { }` would reach into the host
page and change something that is not ours.

**`src/app.js`** — no framework, no build step, no dependencies. It fetches public market data,
renders it, and degrades. It never connects a wallet and never constructs a transaction.

**`config/dasha.json`** — the mint and the source links. One place, so a wrong address cannot be right
in one file and wrong in another.

## What the gates protect

Each of these exists because of a specific failure, not as ceremony.

| Gate | Protects |
| --- | --- |
| `build.mjs --check` | The generated files match the sources. Catches an edit made in the wrong file. |
| `dasha-mint-consistency.test.mjs` | Every surface shows the same mint. This is the one string where being wrong costs someone money. |
| `dasha-share.test.mjs` | Share text carries the mint and no invented claim. |
| `dasha-desk-resilience.test.mjs` | The mint and source links survive every way the data API can fail — 500, connection drop, truncated JSON, empty results, nulls in every field — and no number is ever fabricated to fill a gap. |
| `dasha-oss-docs.test.mjs` | The docs in this repo do not contradict each other. |

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
python3 -m http.server 8766     # → http://127.0.0.1:8766/
node build.mjs --write          # after changing anything in src/
node build.mjs --check          # what CI runs
```

No install step. No `node_modules`. That is deliberate: the moment this needs a toolchain, the number
of people who can fix a typo drops by an order of magnitude.
