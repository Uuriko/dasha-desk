# dasha desk

**Open tools for `$dasha` — and whatever the community wants to build next.**

Unofficial. MIT. Static by default. Live today: [getdasha.com/dasha](https://www.getdasha.com/dasha) · source of truth for mint verification, public culture, and buy rails.

The mint desk is the first useful thing. It is not the ceiling.

## North star

Build a **shared workshop** for crypto culture products:

- **Infra that helps people** — verify addresses, clear buy paths, honest market data, shareable tools, better defaults
- **Consumer experiences** that feel alive — memes, remix, social loops, design systems worth stealing
- **Creative experiments** — if it’s cool, useful, or weird in a good way, open an issue and let’s talk

**Roadmap is community input.** We don’t pretend to know every product from the maintainer seat. Propose. Ship small. Compose.

## What’s here now

| | |
|--|--|
| **Repo** | https://github.com/Uuriko/dasha-desk |
| **Live desk** | https://www.getdasha.com/dasha |
| **Home / Studio** | https://www.getdasha.com · https://www.getdasha.com/studio |
| **Mint** | `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump` |

**Today’s desk:** associated mint · copy / check · public quotes · Dex numbers · share pack · Jupiter / chart / explorers.

**Nearby (same brand surface, more repos welcome):** Meme Studio remix · culture landing · more tools as they earn a home.

## Quick start

```bash
git clone https://github.com/Uuriko/dasha-desk.git
cd dasha-desk
python3 -m http.server 8766
# → http://127.0.0.1:8766/
```

```bash
node build.mjs --write   # regenerate embeds / standalone
node build.mjs --check   # fail on drift
node dasha-share.test.mjs
```

Canonical sources: [`src/body.html`](src/body.html) · [`src/styles.css`](src/styles.css) · [`src/app.js`](src/app.js) · [`config/dasha.json`](config/dasha.json).

## Contribute

**Anyone can contribute.** Designers, engineers, meme lords, infra people, writers.

1. **Idea** → [open an issue](https://github.com/Uuriko/dasha-desk/issues/new/choose) (feature, experiment, docs, or “what if…”)
2. **Code** → fork, branch, PR — see [CONTRIBUTING.md](CONTRIBUTING.md)
3. **Shape the series** → comment on what should exist next (desk modules, studio, APIs, kits, research tools — open field)

Good first moves: polish UX, accessibility, i18n, better public-data hooks, docs, examples, new static modules, creative surfaces that plug into the same mint honesty.

We care about **community signal on what to build** more than a fixed feature list.

Longer brainstorm (pick anything up): [`docs/ROADMAP.md`](docs/ROADMAP.md) · how we work: [`docs/COMMUNITY.md`](docs/COMMUNITY.md)

## License & honesty

- Code: [MIT](LICENSE)
- Media: see [`assets/ATTRIBUTION.md`](assets/ATTRIBUTION.md) (not all assets are MIT)
- Association with public culture is **not endorsement**
- Third-party data can fail; the page should still be usable

## Deploy

See [`docs/DEPLOY.md`](docs/DEPLOY.md). Webflow embeds use `src/app.html`. GitHub Pages optional from `main`.
