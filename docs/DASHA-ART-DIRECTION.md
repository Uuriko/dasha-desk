---
status: canonical
canonical_for: visual
last_verified: 2026-08-13
---

# Dasha art direction

Written: 2026-08-07. Overhauled: 2026-08-13. Owner of the visual system. Landing, Desk, Studio,
Lobby, Board and every exported image answer to this file. If a surface disagrees with it, the
surface is wrong.

Palette does not change. Five colours. There is no sixth.

## What the projects with real aesthetics actually do

Researched 2026-08-07 across Nouns, mfers, Milady/Remilia, Azuki, Pudgy Penguins and the 2026
AI-slop backlash. Five things recur, and none of them is "a nice logo".

1. **The brand is a generator, not a picture.** Nouns is 32×32 traits assembled by rule. Milady is a
   generative neochibi system. Azuki is a house style anyone in the studio can draw in. What gets
   recognised is the *system's fingerprint*, visible across thousands of different images.
2. **One primitive anyone can reproduce badly.** Noggles spread because you can put them on any face,
   and they survived being redrawn as ASCII in bios and code comments. The test is not "is it
   beautiful" — it is *can a fan redraw it from memory in five seconds and still be right*.
3. **Explicit permission.** Nouns, mfers and Milady are CC0. a16z's read is that CC0 is exceptional
   at producing grassroots engagement: derivative work multiplies the parent instead of competing
   with it. Ambiguity about rights is friction, and friction is fatal to proliferation.
4. **Restraint is the lever.** Fewer colours, fewer type weights, one consistent treatment. Art
   direction is mostly deciding what to say no to.
5. **An identifiable hand.** mfers is sartoshi's drawing. In 2026 the opposite reads instantly:
   "slop" was Merriam-Webster's 2025 word of the year, and Valentino and McDonald's both pulled AI
   campaigns after audiences called them flat. Brands that win use AI invisibly for throughput and
   keep the customer-facing image human-made.

## Where Dasha already stands

Strong, and better than it looks. There is a committed palette, one type voice, three repeating
motifs, and — the part most projects lack — the Studio, which is already the generator layer. Most
projects have to *build* the thing that lets a community produce on-brand work. Ours ships.

Weak: Desk still ships lavender glass. That is a bug, not a variant. `src/styles.css` must be
rewritten to the tokens below. That rewrite *is* the overhaul.

## The system

### Palette

Five colours. There is no sixth.

| Token | Hex | Role — and only this role |
|---|---|---|
| Ink | `#070608` | Ground. Almost everything sits on it. |
| Paper | `#f4eddb` | Type and surfaces. Warm, never pure white — white reads as a default, paper reads as a choice. |
| Acid | `#dfff00` | One thing per image: the primary action, the mark, or the band. Acid everywhere is acid nowhere. |
| Hot | `#ff3b81` | Offset shadows and the risk line. Never a background for body text. |
| Violet | `#7c4dff` | Depth only — glows, panels, arcs. Never type. |

Acid on paper fails contrast at small sizes. Acid belongs on ink.

### Every live surface

Home, Studio, Lobby, Desk, Board — all of them sit on **ink**, set type in **paper**, put the
primary action in **acid**, and offset it **4px hard, usually hot**. Display type is **Arial Black /
Helvetica 900**, uppercase. Violet is never type.

A soft shadow is a bug. `0 8px 24px` is a bug. `backdrop-filter` as the look is a bug.

### Type

Arial Black / Helvetica 900, uppercase, letter-spacing about `-0.05em`, line-height under 1. No
second display face. No light weights. Body copy is the same family at normal weight — the voice
comes from *weight and spacing*, not from collecting typefaces.

Monospace (`ui-monospace`) appears in exactly one place: machine-ish output — contract addresses,
the Printout look, transmission labels. It is a costume, not a second brand.

**Webflow must not load a second font stack.** Drop Exo, Bangers, and Raleway. The WebFont.load of
those three is a leak from the old Demigod/Webflow project, not Dasha.

### The three motifs

Every surface should carry at least one, and never more than two:

- **The band** — a full-bleed acid strip carrying repeating uppercase text. The ticker. **Required
  on home.** Empty markup plus `animation: none` is not a ticker.
- **The arc** — concentric rings, violet and acid, implying broadcast.
- **The offset** — a hard shadow at 4px, no blur, usually hot. Nothing in Dasha has a soft shadow.

### The mark

Slot-machine cherries. Two circles, two stems, nothing thinner than 7 units on a 64 grid, and
deliberately no leaf — at 16px a leaf merges into the stem. `dasha-favicon.svg` carries its own ink
tile because acid on transparent disappears against a light tab strip.

Favicon is **acid cherries on ink**, never the Webflow default `favicon.ico`, never a Nekrasova
likeness.

It passes the noggles test: redrawable from memory, and it has a free typeable equivalent — 🍒 —
which means holders can carry the mark in a display name the day they decide to.

**Write the ASCII form down and use it**: `(:` is wrong, `🍒` is the mark. In plain text, `$dasha 🍒`.

### CSS sources of truth

Hex is copied from these files. Nowhere else invents colour.

| Surface | File | What to copy |
|---|---|---|
| Home / landing | landing `:root` (getdasha home / `dasha-home.html` inline) | `--ink --paper --acid --hot --violet` |
| Studio | `studio/index.html` `:root` | same five + `--line --muted` |
| Board | `bounties/board.css` `:root` | same five |

**`src/styles.css` must be rewritten to those tokens.** Until it is, Desk is the surface that
disagrees, and the surface is wrong. Do not "harmonise" landing toward lavender. Pull Desk onto ink.

### Forbidden

- A sixth colour, a second display typeface, a soft shadow, a gradient behind body text.
- **Lavender / glass Desk.** Explicitly banned on every surface, especially `/dasha`:
  - `#c4a5ff` (lavender accent)
  - `#f6f1ff` (lilac paper)
  - soft shadows `0 8px 24px`
  - `backdrop-filter` as the look
  - `system-ui` as the display face
  - gradient CTA `#7c3aed` (the old `.dd-btn-primary`)
- Exo, Bangers, Raleway — Webflow must not load them.
- Demigod `.dgnav` class names on Dasha surfaces.
- Webflow default favicon. Cherries on ink, or it is not shipped.
- Stock photography, and any third-party image whose reuse rights are not recorded **in a file we
  ship**. This is narrower than it sounds, and the distinction matters because three docs looked
  like they disagreed until it was written down:

  | Act | Rule | Owner |
  |---|---|---|
  | **Hotlinking** X media in page HTML (`pbs.twimg.com`, `referrerpolicy="no-referrer"`, honest alt, "not endorsement" caption) — optional tape only | Allowed | [`DASHA-BIBLE.md`](DASHA-BIBLE.md) §5 image policy |
  | **Redistributing a copy** in the repo, the kit or an export | Only with recorded rights | [`dasha-desk/assets/ATTRIBUTION.md`](../assets/ATTRIBUTION.md) |
  | **Drawing it ourselves** in canvas or SVG | Always fine, and the default | this file |
  | **Shipped brand art** (logo, favicon, mark, Studio chrome, default poster) | No Nekrasova likeness. Cherries. | **this file wins** |

  Embedding someone's public post is not the same as shipping their file, and `assets/x/*` is
  already flagged in the ledger as having no documented redistribution licence. When in doubt, draw
  it — the Studio exists so that is the cheap option.
- **AI-generated imagery as brand art.** Use AI for throughput — drafts, variants, code — never as
  the finished public image. This is a positioning decision, not a taste one: the 2026 audience
  identifies slop quickly and reads it as carelessness, which is exactly the opposite of a project
  whose whole differentiator is not being slimy.
- Any likeness of Dasha Nekrasova **as the mark**, or anything implying her participation or
  endorsement. Optional tape may hotlink a still under bible §5. The cherries are the logo.

## The three moves that would change how this looks

Ranked by effect per unit of work. Status as of 2026-08-13.

1. **Declare the kit CC0, visibly — DONE.** [`DASHA-KIT-LICENSE.md`](DASHA-KIT-LICENSE.md) covers the
   mark, the looks and everything the Studio exports, with the CC0 1.0 legal text in `LICENSE-KIT`.
   Stated in the Studio itself, not only in the repo, because a licence nobody sees produces no
   remixes. Both carve-outs are stated and gated: CC0 waives copyright, and touches neither
   trademark nor anyone's name and likeness.
2. **A drawn character — DONE.** [`DASHA-CHARACTER.md`](DASHA-CHARACTER.md): one of the mark's
   cherries with a face on it, five expressions, drawn in coordinates. The mark and the character
   are the same object, so the vocabulary does not grow — the logo teaches the character and the
   character teaches the logo. It ships as the Studio's Cherry look and is deliberately replaceable:
   when the artist friends draw a version, theirs wins.

   The rule this replaced — "wait for a human" — was wrong, and the correction is worth keeping:
   never park work because it would be nicer if someone else did it. The slop objection is to
   *generated* imagery passed off as craft, not to the tool that types the coordinates.
3. **Put the mark everywhere at every scale — DONE, with a remaining leak.** Favicon on Studio and
   Board is cherries. Home must not ship the Webflow default ico. Desk must stop using a likeness as
   if it were the mark. Gated: `dasha-brand.test.mjs` renders each look with and without the mark
   and fails if any look stops carrying it, or if it dies at GIF scale.
4. **Rewrite Desk onto the five tokens — THE OVERHAUL.** `src/styles.css` still is lavender glass.
   Copy landing / studio / `bounties/board.css` `:root`. Acid CTA, 4px hot offset, Arial Black
   uppercase. Then Desk agrees with this file.

## How this stays true

The Studio is the enforcement mechanism: it can only draw from this palette and this type, so
anything it exports is on-brand by construction. That is the reason to keep adding looks to the
Studio rather than making one-off images by hand — a one-off drifts, a look cannot.

Home enforces the band. Board enforces the tokens in `bounties/board.css`. Desk must join them.
