# Dasha Meme Studio

Make a `$dasha` image in your browser. Six looks, three formats, PNG and animated GIF out.

**[Use it →](https://www.getdasha.com/studio)**

No account. No wallet. No upload. Nothing you type or make leaves your machine — every image is
drawn on a canvas in your own browser, which is also why it works with the wifi off.

## Run it

```bash
python3 -m http.server 8766     # → http://127.0.0.1:8766/studio/
node studio.test.mjs            # the gate; plain node, no install
```

There is no build step and no `node_modules`. `index.html` is the whole tool — one file, ~40 KB,
openable straight off disk. That is deliberate: the moment this needs a toolchain, the number of
people who can fix a typo in it drops by an order of magnitude.

## The files

| | |
| --- | --- |
| `index.html` | The Studio. All of it — markup, styles, drawing code. |
| `embed.html` | The same tool as a fragment you can paste into any page. **Generated** — do not edit. |
| `embed-build.mjs` | Makes `embed.html` from `index.html`. Run it after any change. |
| `assets/` | The cherries mark, the favicon, and the character. |
| `studio.test.mjs` | What CI runs. |

`embed.html` wraps everything in a shadow root so it cannot restyle the page hosting it and that
page cannot restyle the Studio. That is why the code inside looks up elements through the root
instead of `document` — an unscoped `getElementById` would reach into somebody else's page, and the
test fails if one appears.

## Add a look

A "look" is a layout: poster, ticket, print, marquee, signal, face. Adding one is the most useful
change you can make here and it is contained to two places.

1. Add an entry to `LOOKS` in `index.html` — an `id`, a label, and a draw function.
2. Draw it. Everything is Canvas 2D against a five-colour palette (`--ink`, `--paper`, `--acid`,
   `--hot`, `--violet`). No external images, ever — see the rules below.
3. `node embed-build.mjs && node studio.test.mjs`

Look at `poster` first; it is the simplest. The drawing helpers you probably want are `wrap()` for
text that has to fit a box, `blockStart()` for optical centring, and `drawMark()` for the cherries.

**Never rename an existing look id.** Remix links carry it — `?look=ticket` posted months ago has to
still open a ticket. The test enforces this.

## Rules

These are not style preferences; each one is load-bearing.

- **Nothing loads over the network.** No CDN, no font host, no remote image. One `<script src>` and
  the tool stops working offline and starts depending on someone else's uptime.
- **Everything is drawn, not photographed.** The art is procedural for a plain reason: we cannot
  grant anyone rights to a real person's photograph, so we do not use one.
- **The mint appears only as the real one.** The test rejects any other pump-suffixed address.
- **Keep the CC0 notice and its carve-out together.** CC0 dedicates our drawing to the public domain.
  It cannot grant rights to a real person's name or likeness, and stating only the first half would
  imply that it did.

## Licence

Everything in this folder — the code, the mark, the character, and every image the Studio exports —
is [CC0 1.0](LICENSE). Copy it, change it, sell it, no credit needed.

The carve-out is not a licence term so much as a fact about what a licence can do: it covers our
drawings and our code. It does not and cannot grant permission over any real person's name, likeness
or endorsement, and it is not a trademark grant.
