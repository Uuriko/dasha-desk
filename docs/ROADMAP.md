# Roadmap

**Nothing is assigned. Nothing is promised.** This is a living brainstorm so anyone can pick something up—or open an issue and add a better idea. **Community input decides what we prioritize.**

Difficulty is a rough hint, not a gate: **S** an afternoon · **M** a weekend · **L** a real project · **XL** would change what Dasha is.

---

## 1. The Studio — making things

The Studio turns a line of text into an image people post. Everything is drawn in canvas from a
five-colour palette, so there is no asset pipeline and nothing to license.

### Looks and output
- **New looks.** The highest-value contribution in the whole repo. A look is one function that draws
  a composition. Add one and it inherits export, formats, animation and the remix link for free. **S**
- **A pluggable look format** so a look can be contributed as a self-contained file without touching
  core, and a gallery page that renders every registered look. Turns "ask to add art" into "open a
  PR". **M**
- **MP4 / WebM export** alongside GIF, for platforms that prefer video. **M**
- **Sound.** A two-second sting exported with the video. Slot reels, a coin drop, silence as a joke. **M**
- **Print export** — CMYK-safe, bleed, 300dpi. Stickers and posters are how a coin escapes the
  timeline. **M**
- **Sticker-pack export** for Telegram and iMessage: a whole set from one session. **M**
- **ASCII / plain-text mode.** The mark already has a typeable form. A whole look that is copy-pasteable
  text goes where images cannot — bios, commit messages, terminal MOTDs. **S**
- **Long-form composition** — multi-panel comic strips, quote cards with attribution, before/after. **M**

### Editing
- **Direct manipulation** — drag the text block, nudge the mark, pick the crop. **L**
- **Palette locking and per-look variants** so a look can ship several colourways. **S**
- **A second text field** (kicker, caption, attribution) available to looks that want it. **S**
- **Font stack choices** within the type rules, without letting the system drift. **S**
- **Undo/redo and session history.** **M**
- **Generative variants** — one line, sixteen compositions, pick the one that lands. **M**
- **Import your own image** as a layer, with the licensing consequences stated plainly in the UI. **L**

### The character
- **More expressions and poses** for the cherry. It has five; it wants twenty. **S**
- **A pose/expression picker** in the Cherry look. **S**
- **A generative avatar** — the cherry with hats, glasses, backgrounds, deterministic from a seed or
  a wallet address, exported as a PFP. **L**
- **A second character.** The vocabulary can hold more than one, if the new one is built from the
  same geometry. **M**
- **Animated character loops** — blink, double-take, slow head turn. **M**

---

## 2. The Desk — verification and trust

The Desk exists so someone can check a token honestly before they touch it. Every item here should
make it *easier to be careful*, and none should ever imply a prediction.

- **Deeper mint verification** — mint and freeze authority, LP lock state, top-holder concentration,
  each with its raw source linked so a reader can re-derive it. **M**
- **"What changed since you last looked"** — a local diff of the facts between visits. No account,
  no server. **M**
- **A rug-heuristics panel** that shows the checks, the values and the limits of each check, and
  refuses to output a single safety score. Scores are the lie; the checks are the product. **L**
- **A generic verification desk** for any Solana mint, not just this one. The most useful thing this
  repo could give the wider ecosystem, and the clearest argument that the trust posture is real. **XL**
- **Historical snapshots** so claims can be checked against what was true at the time. **L**
- **Explorer disagreement detection** — when two independent sources disagree about a token, say so
  loudly instead of picking one. **M**
- **A public honesty audit** run on a schedule against the live site, with results published whether
  or not they are flattering. **M**

---

## 3. Culture and lore

- **Lore Vault** — submitted artifacts, curated into a canon, with provenance for each. **L**
- **A remix lineage graph.** Every Studio image already carries an editable link to its parent; draw
  the resulting tree. Culture is legible as a shape. **L**
- **A gallery of made things**, opt-in, no ranking by price or volume. **M**
- **A quote wall** with sources, distinguishing what someone said from what a meme says they said. **M**
- **Seasonal kits** — looks that exist for two weeks and then stop. Scarcity of *form*, not of supply. **M**
- **A lorebook** — the written canon, versioned, contributed by pull request. **M**
- **Community bounties** for creative work, paid in recognition, judged in public. **M**

---

## 4. Distribution

- **Embeddable widgets** other sites can drop in — the mint verifier, a Studio mini, the mark. Every
  embed is a doorway. **M**
- **A card-render service** so any link to a made image unfurls as that image. **L**
- **A browser extension** — verify any mint on any page, make an image from any selected text. **L**
- **A CLI** — `npx dasha "your line"` writes a PNG. Developers are a distribution channel that
  nobody in this category is serving. **M**
- **A share-target PWA** so the Studio appears in the OS share sheet. **M**
- **On-chain actions** (Solana Actions / Blinks) so a link can carry a verified buy. High
  consequence: it returns a transaction for someone to sign, so it needs a threat model, an
  allowlist, simulation and an incident plan before a line of it ships. **XL**

---

## 5. Make it reusable by other projects

The fastest way to matter beyond one token is to be the thing other people build on.

- **A design-token package** — the palette, type scale and motifs as a published, versioned artifact. **S**
- **The kit as a library** — `drawMark`, `drawFace`, the looks, importable and CC0. **M**
- **A headless renderer** for server-side image generation. **L**
- **A "culture coin starter"** — everything here, genericised, so the next project can begin with an
  honest desk and a working studio instead of a hero image and a promise. **XL**

---

## 6. Onboarding and education

- **How to buy, honestly** — wallet, self-custody, slippage, what can go wrong, no urgency. **S**
- **How to read a chart without lying to yourself.** **M**
- **How to spot a scam**, using real anonymised examples, including near-misses in this ecosystem. **M**
- **A glossary** that assumes no prior crypto knowledge. **S**
- **Localisation**, including right-to-left layouts. **L**

---

## 7. Quality — always open, always welcome

Never needs a proposal. Open the pull request.

- Screen-reader passes on every surface, and real keyboard-only walkthroughs.
- Reduced-motion, high-contrast and forced-colors support.
- Performance: first paint, canvas work off the main thread.
- Test coverage for anything currently verified only by eye.
- Documentation, typo fixes, dead links, clearer error messages.
- Refactors that delete more than they add.

---

## The few hard lines

Everything above is negotiable. These are not, and they are about not hurting people:

1. **No price predictions, targets, returns or urgency.** Ever, anywhere, including jokes that could
   be screenshotted without the joke.
2. **No fabricated traction** — no invented holders, volume, endorsements or quotes.
3. **No implied endorsement by any real person**, and no use of a real person's likeness to promote
   the token.
4. **No custody of anyone's funds or keys**, and no path that could be mistaken for one.
5. **Third-party media needs recorded rights** before it ships in this repo.
6. **Security-sensitive findings go through `SECURITY.md` privately**, never a public issue.

If an idea is good and one of these blocks it, say so in an issue — the line might be in the wrong
place, and that is worth discussing in the open.
