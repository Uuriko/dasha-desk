# Dasha Meme Studio

Make a `$dasha` image in your browser. Six looks, three formats, PNG and animated GIF out.
Editable handoff links live in the URL fragment so look/format/line can be opened and changed later.
**Copy editable link**, share with image, and **Prepare 3 sizes** cover the daily content path.
A first-export checklist (line → share/save → copy link) dismisses itself once finished on this device.

Product ambition (factory + growth + social, Phase A+): operator doc
`DASHA-CULTURE-STUDIO-PRODUCT.md` on the main Dasha tree — not required to use the Studio.

**[Use it →](https://www.getdasha.com/studio)** ·
[GitHub Pages edition](https://uuriko.github.io/dasha-desk/studio/)

No account or wallet. Local uploads stay in your browser. The procedural looks work offline; the
sourced Dasha gallery fetches registered public images when selected. Those photographs are not
covered by this folder's CC0 dedication.

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
| `assets/` | The cherries mark, favicon and character. |
| `media.json` | Registered gallery URLs and their shared rights boundary. |
| `studio.test.mjs` | What CI runs. |

`embed.html` wraps everything in a shadow root so it cannot restyle the page hosting it and that
page cannot restyle the Studio. That is why the code inside looks up elements through the root
instead of `document` — an unscoped `getElementById` would reach into somebody else's page, and the
test fails if one appears.

## Put it on your site

Two lines. It works on any page, including ones you do not control.

```html
<div class="dasha-studio-embed"></div>
<script src="https://uuriko.github.io/dasha-desk/studio/embed.js"
        integrity="sha384-RraRXzma/x3OWmUighYr3IUlTo91DV/AAVRri2E+I0nm2K8eydDbs9UBw7CMT+nR"
        crossorigin="anonymous"></script>
```

That is the whole thing. No build step, no key, no account, nothing to sign up for, and no request
back to us — the script is the tool, and everything it draws happens in your visitor's browser.
The integrity value pins the reviewed script: if the hosted file changes unexpectedly, the browser
refuses to execute it. Copy both attributes with the script tag.

It cannot break your page and your page cannot break it. Everything lives in a shadow root, so your
CSS does not reach in and its CSS does not reach out; the ids it uses cannot collide with yours.
That is tested by rendering it inside a deliberately hostile page whose stylesheet tries to hide
canvases, shrink headings and claim the same ids.

Keep the `<div>` immediately before the `<script>` — the script finds its host by looking at the
element right before itself, so `async` and `defer` will stop it working.

Prefer to self-host? [`embed.html`](embed.html) is the same thing inline, one paste, no external
request at all. It is bigger; refresh it deliberately when adopting a reviewed update.

Images made through your copy are yours and your visitors', on the same terms as everything else
here — see the licence below.

## Add a look

A "look" is a layout: poster, ticket, print, marquee, signal, face. Adding one is the most useful
change you can make here and it is contained to two places.

1. Add an entry to `LOOKS` in `index.html` — an `id`, a label, and a draw function.
2. Draw it. Procedural looks use Canvas 2D against a five-colour palette (`--ink`, `--paper`,
   `--acid`, `--hot`, `--violet`) and must not depend on gallery images.
3. `node embed-build.mjs && node studio.test.mjs`

Look at `poster` first; it is the simplest. The drawing helpers you probably want are `wrap()` for
text that has to fit a box, `blockStart()` for optical centring, and `drawMark()` for the cherries.

**Never rename an existing look id.** Remix links carry it — `?look=ticket` posted months ago has to
still open a ticket. The test enforces this.

## Rules

These are not style preferences; each one is load-bearing.

- **No external code.** No CDN scripts, font hosts or stylesheets. Procedural looks work offline.
- **Register every gallery image.** Its exact URL must appear in `media.json`; unknown hosts fail the
  gate. A failed photograph must not break the procedural editor.
- **Local uploads remain local.** The browser may read them for editing but never uploads them.
- **The mint appears only as the real one.** The test rejects any other pump-suffixed address.
- **Keep the CC0 notice and its carve-out together.** CC0 dedicates our drawing to the public domain.
  It cannot grant rights to a real person's name or likeness, and stating only the first half would
  imply that it did.

## Licence

The code, mark, character and original procedural drawings are [CC0 1.0](LICENSE). Copy them, change
them, sell them, no credit needed. Uploaded and externally sourced photographs keep their own rights.

The carve-out is not a licence term so much as a fact about what a licence can do: it covers our
drawings and our code. It does not and cannot grant permission over any real person's name, likeness
or endorsement, and it is not a trademark grant.
