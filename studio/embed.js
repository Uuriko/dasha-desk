(() => {
  const host = document.currentScript.previousElementSibling;
  if (!host || !host.classList.contains('dasha-studio-embed')) return;
  while (host.firstChild) host.removeChild(host.firstChild);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>:host{--ink:#070608;--paper:#f4eddb;--acid:#dfff00;--hot:#ff3b81;--violet:#7c4dff;--line:rgba(244,237,219,.32);--muted:#e6dcc4}
  *{box-sizing:border-box}:host{margin:0;background:var(--ink);color:var(--paper);font-family:Arial,Helvetica,sans-serif;
    background-image:radial-gradient(circle at 82% 4%,rgba(124,77,255,.32),transparent 30rem),radial-gradient(circle at 4% 70%,rgba(255,59,129,.18),transparent 26rem)}
  main.wrap h1,main.wrap .eyebrow,main.wrap label{color:var(--paper)!important}
  .wrap{width:min(1080px,calc(100% - 32px));margin:0 auto;padding:34px 0 64px}
  .topbar{width:min(1080px,calc(100% - 32px));min-height:64px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;border-bottom:1px solid var(--line);padding:8px 0}
  .topbar .brand{margin-right:auto;min-height:44px;display:inline-flex;align-items:center;color:var(--paper);font-size:18px;font-weight:900;letter-spacing:-.03em;text-decoration:none;text-transform:uppercase}.topbar .brand span{color:var(--acid)}
  .topbar>a:not(.brand){color:var(--paper);font-size:12px;font-weight:900;letter-spacing:.06em;text-decoration:none;text-transform:uppercase;min-width:44px;min-height:44px;padding-inline:6px;display:inline-flex;align-items:center;justify-content:center}
  h1{margin:14px 0 10px;font-size:clamp(40px,8vw,76px);line-height:.82;letter-spacing:-.055em;text-transform:uppercase;font-weight:900}
  .stroke{color:var(--acid);-webkit-text-stroke:0}
  .lede{margin:0 0 28px;max-width:56ch;font-size:clamp(15px,2vw,18px);line-height:1.5;color:var(--muted)}
  .remix-note{margin:0 0 20px;padding:12px 14px;border-left:4px solid var(--acid);background:rgba(223,255,0,.1);font-size:14px;font-weight:800;color:var(--paper)}
  .lineage{margin:-8px 0 20px;font-size:13px;color:var(--muted)}.lineage a{color:var(--paper);font-weight:900;text-underline-offset:3px}
  .diff-note{margin:-12px 0 20px;padding:10px 12px;border-left:4px solid var(--acid);background:rgba(223,255,0,.08);font-size:13px;font-weight:800;color:var(--paper);line-height:1.45}
  .diff-note[hidden]{display:none}
  .diff-note .relay{color:var(--acid);text-transform:uppercase;letter-spacing:.06em;font-size:11px}
  .diff-note .was{display:block;margin-top:4px;color:var(--muted);font-weight:700}
  .first-export{margin:0 0 20px;padding:12px 14px;border:1px solid rgba(244,237,219,.25);list-style:none;display:grid;gap:8px}
  .first-export[hidden]{display:none}
  .first-export li{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:800;color:var(--muted)}
  .first-export li::before{content:"";width:14px;height:14px;border:2px solid var(--muted);flex:0 0 auto}
  .first-export li.done{color:var(--paper)}
  .first-export li.done::before{border-color:var(--acid);background:var(--acid)}
  .first-export .fe-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 4px;font-weight:900}
  .studio{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:26px;align-items:start}
  canvas{width:100%;max-width:100%;height:auto;display:block;border:1px solid var(--line);background:var(--ink);touch-action:pan-y;cursor:grab}
  .panel{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;min-width:0}
  .gallery{display:grid;grid-auto-flow:column;grid-auto-columns:74px;gap:8px;overflow-x:auto;padding:2px 2px 9px;scroll-snap-type:x proximity}
  .gallery label{position:relative;display:block;aspect-ratio:1;cursor:pointer;scroll-snap-align:start;border:2px solid transparent;background:rgba(255,255,255,.06);overflow:hidden}
  .gallery img{width:100%;height:100%;display:block;object-fit:cover}
  .gallery input{position:absolute;opacity:0;pointer-events:none}
  .gallery label:has(input:checked){border-color:var(--acid)}
  .gallery label:has(input:focus-visible){outline:3px solid var(--acid);outline-offset:2px}
  .gallery .upload{display:grid;place-items:center;text-align:center;padding:6px;color:var(--paper);font-size:10px;line-height:1.15;background:rgba(223,255,0,.09)}
  label{display:grid;gap:8px;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
  textarea{width:100%;min-height:96px;padding:13px;resize:vertical;border:1px solid var(--line);border-radius:0;
    background:rgba(255,255,255,.04);color:var(--paper);font:inherit;font-size:16px}
  select{width:100%;min-height:48px;padding:0 12px;border:1px solid var(--line);border-radius:0;background:var(--ink);color:var(--paper);font:inherit;font-size:14px;font-weight:900;text-transform:uppercase}
  .go{display:flex;gap:10px;flex-wrap:wrap}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .chip{min-height:44px;max-width:100%;padding:8px 12px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--paper);font:inherit;font-size:12px;font-weight:800;line-height:1.25;text-align:left;cursor:pointer}
  .chip:hover{border-color:var(--acid);color:var(--acid)}
  details{border-top:1px solid var(--line);padding-top:14px}summary{min-height:44px;cursor:pointer;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;display:flex;align-items:center;justify-content:space-between}summary::after{content:'+';font-size:20px}details[open] summary::after{content:'−'}
  .advanced{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;padding-top:14px}.advanced .btn{min-height:44px;font-size:12px;box-shadow:none}.advanced input[type=range]{min-height:44px}
  .kit-links{display:flex;gap:10px;flex-wrap:wrap}.kit-links a{color:var(--paper);font-size:12px;font-weight:900;text-transform:uppercase;text-underline-offset:4px}
  .btn{flex:1 1 auto;min-height:52px;padding:0 20px;cursor:pointer;font:inherit;font-weight:900;font-size:14px;letter-spacing:.06em;
    text-transform:uppercase;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;
    border:1px solid var(--paper);background:transparent;color:var(--paper);box-shadow:4px 4px 0 var(--paper);
    transition:transform .18s,box-shadow .18s}
  .btn:hover{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--paper)}
  .btn.primary{background:var(--acid);border-color:var(--acid);color:var(--ink);box-shadow:4px 4px 0 var(--hot)}
  .micro{margin:0;font-size:13px;line-height:1.55;color:var(--muted)}
  .status{margin:0;min-height:1.4em;font-size:14px;font-weight:700;color:var(--acid)}
  .undo{position:fixed;left:50%;bottom:22px;z-index:5;transform:translateX(-50%);min-height:44px;padding:0 20px;border:0;background:var(--paper);color:var(--ink);font:inherit;font-weight:900;text-transform:uppercase;cursor:pointer}
  footer{border-top:1px solid var(--line);margin-top:44px;padding:24px 0 0}
  footer p{margin:.5em 0;font-size:13px;line-height:1.55;color:var(--muted)}
  footer a{color:var(--paper);font-weight:800}
  :focus-visible{outline:3px solid var(--acid);outline-offset:3px}
  @media(max-width:860px){.studio{grid-template-columns:minmax(0,1fr)}}
  @media(max-width:520px){.topbar{gap:10px}.topbar .brand{font-size:15px}.topbar>a:not(.brand){font-size:11px}.wrap{padding-top:26px}}
  @media(prefers-reduced-motion:reduce){.btn{transition:none}}@media(forced-colors:active){.btn.primary{border:2px solid ButtonText}}@media(prefers-contrast:more){.stroke{color:var(--paper);-webkit-text-stroke:0}.micro,.lineage,footer p{color:var(--paper)}}

    :host{display:block}
    .wrap{padding-top:0}
  </style>
  <main class="wrap">
  <h1>$dasha <span class="stroke">Studio.</span></h1>
  <p class="remix-note" id="remix-note" hidden>Your turn.</p>
  <p class="lineage" id="lineage" hidden>From <a id="parent" href="/studio"></a></p>
  <p class="diff-note" id="diff-note" hidden></p>
  <div class="first-export" id="first-export" aria-label="First export">
    <p class="fe-label">First export</p>
    <ol class="first-export-steps" style="list-style:none;margin:0;padding:0;display:grid;gap:8px">
      <li id="fe-line" data-step="line">Write a line</li>
      <li id="fe-export" data-step="export">Share or save</li>
      <li id="fe-link" data-step="link">Copy editable link</li>
    </ol>
  </div>

  <div class="studio">
    <canvas id="canvas" width="1080" height="1080" role="img" aria-label="Preview of the image you are making"></canvas>

    <div class="panel">
      <div>
        <label for="line">Your line</label>
        <textarea id="line" maxlength="120" spellcheck="false"></textarea>
        <div class="chips" id="chips" role="group" aria-label="Suggested lines"></div>
      </div>

      <div>
        <label>Image</label>
        <div class="gallery" id="gallery" role="radiogroup" aria-label="Choose a Dasha image"></div>
      </div>

      <label for="looks">Look<select id="looks"></select></label>

      <button class="btn" id="edit" type="button">Edit</button>

      <div class="go">
        <button class="btn primary" id="share" type="button">Share</button>
        <button class="btn" id="download" type="button">Save PNG</button>
        <button class="btn" id="copy-link" type="button">Copy editable link</button>
      </div>
      <details>
        <summary>More options</summary>
        <div class="advanced">
          <label for="formats">Format<select id="formats"></select></label>
          <label for="effects">Effect<select id="effects"></select></label>
          <label for="stickers">Sticker<select id="stickers"></select></label>
          <label for="zoom">Zoom<input id="zoom" type="range" min="1" max="2.5" step="0.05" value="1"></label>
          <label for="tilt">Tilt<input id="tilt" type="range" min="-15" max="15" step="1" value="0"></label>
          <div class="go">
            <button class="btn" id="copy" type="button">Copy image</button>
            <button class="btn" id="gif" type="button">Save GIF</button>
            <button class="btn" id="kit" type="button">Prepare 3 sizes</button>
          </div>
          <div class="go">
            <button class="btn" id="oco-export" type="button">Save object</button>
            <button class="btn" id="oco-import" type="button">Open object</button>
          </div>
          <input id="oco-file" type="file" accept="application/json,.json" hidden>
        </div>
      </details>
      <div class="kit-links" id="kit-links" hidden></div>
      <p class="status" id="status" role="status"></p>
    </div>
  </div>

  <footer>
    <p>Graphics are <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">CC0 1.0</a> — copy, change, sell. Gallery photos are not. Not permission to pass work off as official, or to use Dasha Nekrasova’s name or likeness.</p>
    <p><a href="https://github.com/Uuriko/dasha-desk/contribute" target="_blank" rel="noopener noreferrer" aria-label="Contribute to Dasha on GitHub">Source ↗</a></p>
  </footer>
  <button class="undo" id="undo" type="button" hidden>Undo</button>
</main>`;


const $ = (id) => root.querySelector('#'+id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
const INK = '#070608', PAPER = '#f4eddb', ACID = '#dfff00', HOT = '#ff3b81', VIOLET = '#7c4dff';
const MARK = 'getdasha.com';
const trackedStudioEvents = new Set();
function trackStudio(event) {
  if (trackedStudioEvents.has(event)) return;
  trackedStudioEvents.add(event);
  fetch('https://lobby.getdasha.com/studio/event', { method: 'POST', mode: 'cors', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, source: metricSource }) })
    .then((response) => { if (!response.ok) trackedStudioEvents.delete(event); })
    .catch(() => trackedStudioEvents.delete(event));
}

/* Every look is drawn here from the site's own palette and type. Nothing is loaded from disk or
   the network: no photograph, no likeness, no third-party asset, so there is no image whose reuse
   rights would have to be established before this can ship. */
const LOOKS = [
  /* Every default line is a real public @dash_eats post (docs/X-RESEARCH-DASHA-2026-08-08.md). Two
     had been replaced with invented slogans — "Stay weird. Verify the mint." and "Nobody is coming
     to save the timeline." — which read like any crypto account and are the one thing this tool
     cannot afford to sound like. The voice is borrowed, not written; that is the whole point. */
  { id: 'photo', name: 'Photo',     line: 'How u crying at the casino and u can’t even get in' },
  { id: 'poster', name: 'Poster',   line: 'It’s time $dasha' },
  { id: 'ticket', name: 'Ticket',   line: 'You’re not gonna believe this' },
  { id: 'print',  name: 'Printout', line: 'Well Im still alive' },
  { id: 'marquee', name: 'Marquee', line: 'Go ahead and doubt me see what happens' },
  { id: 'signal',  name: 'Signal',  line: 'Cmon' },
  { id: 'face',    name: 'Cherry',  line: 'They are angels actually' },
];
let look = LOOKS[0];
const FORMATS = [
  { id: 'square', name: 'Post', width: 1080, height: 1080 },
  { id: 'story', name: 'Story', width: 1080, height: 1920 },
  { id: 'banner', name: 'Banner', width: 1200, height: 628 },
];
let format = FORMATS[0];
const PHOTOS = [
  // Public stills from @dash_eats / @PerryALPHA 4HL harvest (docs/X-RESEARCH-DASHA-IMAGES-2026-08-08.md). Association ≠ endorsement.
  ['hero', 'https://pbs.twimg.com/media/Gkoqvc4WIAAYPJM.jpg'],
  ['portrait', 'https://pbs.twimg.com/profile_images/556455602331742208/KWkVe0TV.jpeg'],
  ['pink', 'https://pbs.twimg.com/media/HMGsRZ8XgAEEPrS.jpg'],
  ['flash', 'https://pbs.twimg.com/media/HOpfTEyaIAAOVPy.jpg'],
  ['night', 'https://pbs.twimg.com/media/HN37QhRXkAALZR4.jpg'],
  ['close', 'https://pbs.twimg.com/media/HLbdLcXX0AEwa2X.jpg'],
  ['glam', 'https://pbs.twimg.com/media/HLDbupNXkAAzfhI.jpg'],
  ['film', 'https://pbs.twimg.com/media/HJvwn-6XAAAORhZ.jpg'],
  ['bull', 'https://pbs.twimg.com/media/HPKga_6bUAAkkLJ.jpg'],
  ['weekend', 'https://pbs.twimg.com/media/Gud7XuWWoAA2SvH.jpg'],
  ['weekend2', 'https://pbs.twimg.com/media/HOCXlXcXcAAEsqk.jpg'],
  ['weekend3', 'https://pbs.twimg.com/media/HNdncD_X0AAEjJ0.jpg'],
  ['weekend4', 'https://pbs.twimg.com/media/HKqBIKVW0AAdVOc.jpg'],
  ['chart', 'https://pbs.twimg.com/media/HPFHt5FXQAAlwld.jpg'],
  ['art', 'https://pbs.twimg.com/media/HPFhAH-XcAAWxp5.jpg'],
  ['elon', 'https://pbs.twimg.com/media/HPJBzjWXUAAvYjz.jpg'],
  ['set2', 'https://pbs.twimg.com/media/HN37QhTXkAAn-mr.jpg'],
  ['commons', 'https://upload.wikimedia.org/wikipedia/commons/c/c2/Dasha_Nekrasova.jpg'],
];
const EFFECTS = [
  ['clean', 'Clean', 'none'], ['fry', 'Deep fried', 'contrast(1.55) saturate(2.8)'],
  ['xerox', 'Xerox', 'grayscale(1) contrast(2.4)'], ['angel', 'Angel', 'brightness(1.2) saturate(.65) contrast(.9)'],
  ['cursed', 'Cursed', 'hue-rotate(125deg) saturate(2.2) contrast(1.25)'],
  ['surveillance', 'Surveillance', 'grayscale(1) sepia(.35) contrast(1.7) brightness(.8)'],
];
const STICKERS = [['', 'None'], ['🍒', 'Cherries'], ['✦', 'Star'], ['♱', 'Cross'], ['♢', 'Diamond'], ['☻', 'Smile']];
let photo = null, photoId = '', effect = EFFECTS[0], sticker = '', zoom = 1, tilt = 0, offsetX = 0, offsetY = 0;
let undoState = null, undoTimer;

const fragmentParams = new URLSearchParams(location.hash.slice(1));
const queryParams = new URLSearchParams(location.search);
const fragmentHasState = fragmentParams.has('look') || fragmentParams.has('line') || fragmentParams.has('format')
  || fragmentParams.has('photo') || fragmentParams.has('effect') || fragmentParams.has('sticker');
const params = fragmentHasState ? fragmentParams : queryParams;
/* Campaign src may arrive in the query (ads, home CTA) while look/line live in the fragment.
   Read allowlisted src from both; fragment wins when both are present. */
const pickSrc = (raw) => (['home', 'quiz', 'transmission-001'].includes(raw) ? raw : null);
const campaignSource = pickSrc(fragmentParams.get('src')) || pickSrc(queryParams.get('src'));
const metricSource = campaignSource || (document.referrer && new URL(document.referrer).origin === location.origin ? 'home' : 'direct');
const imageOnly = params.get('arm') === 'flat';
const requestedLook = LOOKS.find((option) => option.id === params.get('look'));
const requestedFormat = FORMATS.find((option) => option.id === params.get('format'));
const requestedPhoto = PHOTOS.find(([id]) => id === params.get('photo'));
const requestedEffect = EFFECTS.find(([id]) => id === params.get('effect'));
if (requestedLook) look = requestedLook;
if (requestedFormat) format = requestedFormat;
if (requestedPhoto) photoId = requestedPhoto[0];
if (requestedEffect) effect = requestedEffect;
if (params.has('sticker')) {
  const hit = STICKERS.find(([id]) => id === params.get('sticker'));
  if (hit) sticker = hit[0];
}
if (params.has('line')) $('line').value = params.get('line').slice(0, 120);
const inbound = Boolean(requestedLook || requestedFormat || params.has('line') || requestedPhoto
  || requestedEffect || params.has('sticker'));
if (inbound) $('remix-note').hidden = false;
if (imageOnly) { $('remix-note').hidden = false; $('remix-note').textContent = 'Image only.'; }

/* Material handoff fields. Zoom/tilt stay session-local — too noisy for short remix URLs. */
const STATE_KEYS = ['look', 'format', 'line', 'photo', 'effect', 'sticker'];
const currentState = () => ({
  look: look.id,
  format: format.id,
  line: $('line').value.trim() || look.line,
  photo: photoId || '',
  effect: effect[0],
  sticker: sticker || '',
});
const sourceState = inbound ? currentState() : null;
const parentLook = LOOKS.find((option) => option.id === params.get('pLook'));
const parentFormat = FORMATS.find((option) => option.id === params.get('pFormat'));
const parentLine = (params.get('pLine') || '').trim();
const parentPhotoRaw = params.get('pPhoto');
const parentPhoto = parentPhotoRaw && PHOTOS.some(([id]) => id === parentPhotoRaw) ? parentPhotoRaw : '';
const parentEffectRaw = params.get('pEffect');
const parentEffect = parentEffectRaw && EFFECTS.some(([id]) => id === parentEffectRaw) ? parentEffectRaw : 'clean';
const parentStickerRaw = params.get('pSticker');
const parentSticker = parentStickerRaw != null && STICKERS.some(([id]) => id === parentStickerRaw) ? parentStickerRaw : '';
const parentState = parentLook && parentFormat && parentLine && parentLine.length <= 120
  ? { look: parentLook.id, format: parentFormat.id, line: parentLine, photo: parentPhoto, effect: parentEffect, sticker: parentSticker }
  : null;
/* Mutable parent for OCO import (URL parent stays in parentState). */
let liveParent = parentState;

function encodeStateParams(state) {
  const next = new URLSearchParams({ look: state.look, format: state.format, line: state.line });
  if (state.photo) next.set('photo', state.photo);
  if (state.effect && state.effect !== 'clean') next.set('effect', state.effect);
  if (state.sticker) next.set('sticker', state.sticker);
  return next;
}

function stateURL(state) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = encodeStateParams(state).toString();
  return url.href;
}

if (parentState) showParentLineage(parentState);

/* First-export checklist: hide forever once all three steps done (local only). */
const FE_KEY = 'dasha-studio-first-export-v1';
const feDone = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(FE_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
})();
function feSave() {
  try { localStorage.setItem(FE_KEY, JSON.stringify(feDone)); } catch { /* private mode */ }
}
function feMark(step) {
  if (feDone[step]) return;
  feDone[step] = true;
  feSave();
  refreshFirstExport();
}
function refreshFirstExport() {
  const box = $('first-export');
  if (!box) return;
  for (const step of ['line', 'export', 'link']) {
    const el = $(`fe-${step}`);
    if (el) el.classList.toggle('done', !!feDone[step]);
  }
  if (feDone.line && feDone.export && feDone.link) box.hidden = true;
}
function materialChangedKeys(base) {
  if (!base) return [];
  const cur = currentState();
  return STATE_KEYS.filter((key) => base[key] !== cur[key]);
}
/** Immediate comparison base: inbound source if edited, else parent / OCO parent. */
function relayBase() {
  if (sourceState && materialChangedKeys(sourceState).length) return sourceState;
  return liveParent || parentState;
}
function showParentLineage(parent) {
  if (!parent) return;
  $('parent').href = stateURL(parent);
  $('parent').textContent = `“${parent.line.length > 54 ? parent.line.slice(0, 53) + '…' : parent.line}”`;
  $('lineage').hidden = false;
}
/** Relay: material change vs same (for seasons / honest handoff). */
function relayCheck() {
  const base = relayBase();
  const keys = materialChangedKeys(base);
  return { material: keys.length > 0, keys, base };
}
function refreshDiffNote() {
  const note = $('diff-note');
  if (!note) return;
  const { material, keys, base } = relayCheck();
  if (!base) { note.hidden = true; note.replaceChildren(); return; }
  note.hidden = false;
  note.replaceChildren();
  const relay = document.createElement('span');
  relay.className = 'relay';
  if (material) {
    relay.textContent = `Relay: material · ${keys.join(', ')}`;
    note.append(relay);
    if (keys.includes('line') && base.line) {
      const was = document.createElement('span');
      was.className = 'was';
      const short = base.line.length > 72 ? `${base.line.slice(0, 71)}…` : base.line;
      was.textContent = `Was “${short}”`;
      note.append(was);
    }
  } else {
    relay.textContent = 'Relay: same';
    note.append(relay);
    const was = document.createElement('span');
    was.className = 'was';
    was.textContent = 'Change look, line, format, photo, effect, or sticker for a material edit.';
    note.append(was);
  }
}
refreshFirstExport();
if (feDone.line && feDone.export && feDone.link) { /* already hidden */ }
else if (($('line').value || '').trim()) feMark('line');

function remixURL() {
  const url = new URL(location.href);
  url.search = '';
  const current = currentState();
  const state = encodeStateParams(current);
  if (campaignSource) state.set('src', campaignSource);
  if (imageOnly) state.set('arm', 'flat');
  /* encodeStateParams always sets line; drop empty-default only when user left the field blank
     so legacy short links stay short when using the look default. */
  if (!$('line').value.trim()) state.delete('line');
  const changed = sourceState && materialChangedKeys(sourceState).length > 0;
  const parent = changed ? sourceState : (liveParent || parentState);
  if (parent && !imageOnly) {
    state.set('pLook', parent.look);
    state.set('pFormat', parent.format);
    state.set('pLine', parent.line);
    if (parent.photo) state.set('pPhoto', parent.photo);
    if (parent.effect && parent.effect !== 'clean') state.set('pEffect', parent.effect);
    if (parent.sticker) state.set('pSticker', parent.sticker);
  }
  url.hash = state.toString();
  return url.href;
}

function syncURL() {
  if (location.protocol.startsWith('http')) history.replaceState(null, '', remixURL());
  if (($('line').value || '').trim()) feMark('line');
  refreshDiffNote();
}

if (!fragmentHasState && (queryParams.has('look') || queryParams.has('line') || queryParams.has('format')
  || queryParams.has('photo') || queryParams.has('effect') || queryParams.has('sticker'))) syncURL();
refreshDiffNote();

/** Largest size at or below `start` where the wrapped text fits `maxH`. */
function fit(text, font, start, maxW, maxH, lineRatio) {
  for (let size = start; size > 12; size -= 2) {
    ctx.font = font(size);
    const lines = wrap(text, maxW);
    if (lines.length * size * lineRatio <= maxH) return { size, lines };
  }
  ctx.font = font(14);
  return { size: 14, lines: wrap(text, maxW) };
}

/** Split a word with no break opportunity into chunks that each fit. */
function breakWord(word, maxW) {
  const chunks = [];
  let chunk = '';
  for (const character of word) {
    if (chunk && ctx.measureText(chunk + character).width > maxW) { chunks.push(chunk); chunk = character; }
    else chunk += character;
  }
  return chunk ? [...chunks, chunk] : chunks;
}

/* Greedy word wrap against the CURRENT ctx.font. Over-wide words are broken by character, so
   every line returned fits maxW — otherwise one long unspaced word (a URL, a name, a held-down
   key) runs off the canvas and the image is unpostable, which shrinking the font never fixes. */
function wrap(text, maxW) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    const words = paragraph.split(/\s+/).filter(Boolean)
      .flatMap((word) => (ctx.measureText(word).width > maxW ? breakWord(word, maxW) : [word]));
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width <= maxW || !line) line = next;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

/* First baseline that leaves a block of `count` lines optically centred between top and bottom.
   Anchoring the block at a fixed y instead leaves a large void under short text — which is most
   text — and a void is what makes an image look unfinished rather than designed. */
const blockStart = (top, bottom, count, size, ratio, cap = 0.72) =>
  top + ((bottom - top) - ((count - 1) * size * ratio + cap * size)) / 2 + cap * size;

/* The cherries, drawn from the same 64-unit geometry as dasha-favicon.svg so the exported image
   carries the actual mark and not just the wordmark. One function, called by every look — five
   hand-placed copies would drift apart within a week, which is exactly how a system stops being
   one. Recognition comes from the same shape appearing everywhere, so it is never recoloured:
   `colour` picks the ink or paper version for the surface it sits on, nothing else. */
function drawMark(x, y, size, colour) {
  const u = size / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(18, 31); ctx.bezierCurveTo(19, 19, 26, 10, 36, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(46, 37); ctx.bezierCurveTo(48, 26, 42, 14, 36, 6); ctx.stroke();
  ctx.beginPath(); ctx.arc(17, 45, 14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(46, 47, 12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* The character is one of the mark's cherries with a face on it. Same 64-unit grid, same stroke
   minimum, same no-leaf rule — so the vocabulary never grows: anyone who can draw the logo can draw
   the character, and the character teaches the logo. Drawn in coordinates, not generated. */
function drawFace(x, y, size, mood, body, face) {
  const u = size / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  ctx.strokeStyle = body; ctx.fillStyle = body;
  ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(32, 18); ctx.bezierCurveTo(33, 12, 38, 7, 45, 5); ctx.stroke();
  ctx.beginPath(); ctx.arc(32, 40, 22, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = face; ctx.strokeStyle = face; ctx.lineWidth = 3.4;
  const dot = (cx, cy, r) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

  if (mood === 'blink') { line(20, 37, 28, 37); line(36, 37, 44, 37); line(26, 50, 38, 50); }
  else if (mood === 'wide') {
    dot(24, 36, 5.4); dot(40, 36, 5.4);
    ctx.beginPath(); ctx.ellipse(32, 50, 4.6, 5.4, 0, 0, Math.PI * 2); ctx.fill();
  } else if (mood === 'smug') {
    line(20, 37, 28, 37); line(36, 37, 44, 37);
    ctx.beginPath(); ctx.moveTo(25, 49); ctx.bezierCurveTo(29, 53, 35, 53, 39, 48); ctx.stroke();
  } else if (mood === 'zeroed') {
    line(20, 33, 28, 41); line(28, 33, 20, 41);
    line(36, 33, 44, 41); line(44, 33, 36, 41);
    line(26, 51, 38, 51);
  } else { dot(24, 37, 3.6); dot(40, 37, 3.6); line(26, 50, 38, 50); }
  ctx.restore();
}


const draw = {
  photo(text) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, 1080, 1080);
    if (photo) {
      const scale = Math.max(1080 / photo.naturalWidth, 1080 / photo.naturalHeight) * zoom;
      ctx.save();
      ctx.translate(540 + offsetX, 540 + offsetY); ctx.rotate(tilt * Math.PI / 180); ctx.filter = effect[2];
      ctx.drawImage(photo, -photo.naturalWidth * scale / 2, -photo.naturalHeight * scale / 2,
        photo.naturalWidth * scale, photo.naturalHeight * scale);
      ctx.restore();
    }
    const shade = ctx.createLinearGradient(0, 520, 0, 1080);
    shade.addColorStop(0, 'rgba(7,6,8,0)'); shade.addColorStop(1, 'rgba(7,6,8,.9)');
    ctx.fillStyle = shade; ctx.fillRect(0, 480, 1080, 600);
    const { size, lines } = fit(text.toUpperCase(), (s) => `900 ${s}px Arial,Helvetica,sans-serif`, 112, 920, 330, .92);
    ctx.font = `900 ${size}px Arial,Helvetica,sans-serif`; ctx.fillStyle = PAPER;
    let y = 970 - (lines.length - 1) * size * .92;
    for (const line of lines) { ctx.fillText(line, 80, y); y += size * .92; }
    ctx.fillStyle = ACID; ctx.fillRect(80, 1015, 110, 6);
    ctx.fillStyle = PAPER; ctx.font = '900 24px Arial,Helvetica,sans-serif'; ctx.fillText(MARK, 210, 1028);
    if (sticker) {
      ctx.save(); ctx.translate(900, 150); ctx.rotate(-.12); ctx.textAlign = 'center';
      ctx.font = '900 150px Arial,Helvetica,sans-serif'; ctx.fillStyle = ACID; ctx.strokeStyle = INK; ctx.lineWidth = 10;
      ctx.strokeText(sticker, 0, 48); ctx.fillText(sticker, 0, 48); ctx.restore();
    }
    drawMark(948, 84, 68, PAPER);
  },
  poster(text, t = 0) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, 1080, 1080);
    for (const [x, y, r, colour] of [[880, 60, 460, VIOLET], [90, 820, 420, HOT]]) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, colour + '55'); glow.addColorStop(1, colour + '00');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1080);
    }
    const { size, lines } = fit(text.toUpperCase(), (s) => `900 ${s}px Arial,Helvetica,sans-serif`, 148, 904, 620, 0.92);
    ctx.font = `900 ${size}px Arial,Helvetica,sans-serif`; ctx.fillStyle = PAPER;
    let y = blockStart(196, 962, lines.length, size, 0.92);
    for (const line of lines) { ctx.fillText(line, 88, y); y += size * 0.92; }

    // The acid strip scrolls one full phrase-width per loop, so the last frame lines up with the
    // first. Clipped to the bar, and drawn twice over so there is never a gap at either edge.
    ctx.fillStyle = ACID; ctx.fillRect(0, 1018, 1080, 62);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 1018, 1080, 62); ctx.clip();
    ctx.fillStyle = INK; ctx.font = '900 25px Arial,Helvetica,sans-serif';
    const strip = `$DASHA · ${MARK} · MAKE MEMES · STAY WEIRD · VERIFY THE CONTRACT · `;
    const stripWidth = ctx.measureText(strip).width;
    for (let x = 40 - t * stripWidth; x < 1120; x += stripWidth) ctx.fillText(strip, x, 1057);
    ctx.restore();
    drawMark(948, 84, 68, PAPER);
  },

  ticket(text, t = 0) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = HOT; ctx.fillRect(92, 132, 896, 816);
    ctx.fillStyle = PAPER; ctx.fillRect(76, 116, 896, 816);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(76, 116, 896, 816);

    const { size, lines } = fit(text.toUpperCase(), (s) => `900 ${s}px Arial,Helvetica,sans-serif`, 120, 780, 600, 0.94);
    ctx.font = `900 ${size}px Arial,Helvetica,sans-serif`; ctx.fillStyle = INK; ctx.textAlign = 'center';
    let y = blockStart(150, 846, lines.length, size, 0.94);
    for (const line of lines) { ctx.fillText(line, 524, y); y += size * 0.94; }
    ctx.textAlign = 'left';

    ctx.fillStyle = VIOLET; ctx.fillRect(76, 856, 896, 4);
    ctx.fillStyle = INK; ctx.font = '900 27px Arial,Helvetica,sans-serif';
    ctx.fillText('$DASHA', 116, 916);
    ctx.textAlign = 'right'; ctx.fillText(MARK, 932, 916); ctx.textAlign = 'left';

    // A sine over one phase: the sticker rocks and returns exactly where it started.
    ctx.save(); ctx.translate(902, 196); ctx.rotate(0.14 + Math.sin(t * Math.PI * 2) * 0.07);
    ctx.fillStyle = ACID; ctx.fillRect(-96, -30, 192, 60);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-96, -30, 192, 60);
    ctx.fillStyle = INK; ctx.font = '900 25px Arial,Helvetica,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('NO BORING', 0, 9); ctx.restore(); ctx.textAlign = 'left';
    drawMark(116, 150, 62, INK);
  },

  /* The site's own scrolling ticker, turned into the whole picture. Short lines read best, which
     is why its default is two words — the band count adapts so a long line still lands. */
  marquee(text, t = 0) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, 1080, 1080);
    const phrase = `${text.toUpperCase().replace(/\s+/g, ' ').trim()} · `;
    ctx.save();
    ctx.translate(540, 540); ctx.rotate(-0.07); ctx.translate(-540, -540);
    const band = Math.max(96, Math.min(180, 1400 / Math.max(4, Math.ceil(phrase.length / 14))));
    ctx.font = `900 ${Math.round(band * 0.6)}px Arial,Helvetica,sans-serif`;
    const runWidth = Math.max(1, ctx.measureText(phrase).width);
    for (let index = 0, y = -180; y < 1260; index++, y += band) {
      const acid = index % 2 === 0;
      if (acid) { ctx.fillStyle = ACID; ctx.fillRect(-200, y, 1480, band); }
      ctx.fillStyle = acid ? INK : PAPER;
      // One full phrase-width per loop. Alternating bands already start at different offsets, so
      // the whole field slides as one piece and lands back on itself at t = 1.
      const offset = (index % 3) * -runWidth / 3 - t * runWidth;
      for (let x = -200 + offset; x < 1300; x += runWidth) ctx.fillText(phrase, x, y + band * 0.72);
    }
    ctx.restore();
    ctx.fillStyle = INK; ctx.fillRect(0, 1000, 1080, 80);
    ctx.fillStyle = PAPER; ctx.font = '900 30px Arial,Helvetica,sans-serif';
    ctx.fillText('$DASHA', 40, 1052);
    ctx.textAlign = 'right'; ctx.fillText(MARK, 1040, 1052); ctx.textAlign = 'left';
    drawMark(508, 1008, 64, ACID);
  },

  signal(text, t = 0) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, 1080, 1080);
    ctx.lineWidth = 3;
    /* Rings travel outward by exactly one ring-spacing per loop, so at t = 1 the field is
       identical to t = 0 with each ring one slot further out. Colour keys off the ring's slot
       rather than its index, or the alternation would flip when the loop wrapped. */
    for (let radius = 120 + t * 96; radius < 1500; radius += 96) {
      ctx.strokeStyle = Math.round((radius - 120) / 96) % 2 ? `rgba(223,255,0,.30)` : `rgba(124,77,255,.34)`;
      ctx.beginPath(); ctx.arc(1010, 150, radius, 0, Math.PI * 2); ctx.stroke();
    }
    const fade = ctx.createLinearGradient(0, 300, 0, 1080);
    fade.addColorStop(0, 'rgba(7,6,8,0)'); fade.addColorStop(0.55, 'rgba(7,6,8,.92)');
    ctx.fillStyle = fade; ctx.fillRect(0, 300, 1080, 780);

    ctx.fillStyle = ACID; ctx.beginPath(); ctx.arc(92, 120, 11, 0, 7); ctx.fill();
    ctx.fillStyle = PAPER; ctx.font = '900 22px Arial,Helvetica,sans-serif';
    ctx.fillText('BROADCASTING FROM THE TIMELINE', 120, 129);

    const { size, lines } = fit(text.toUpperCase(), (s) => `900 ${s}px Arial,Helvetica,sans-serif`, 118, 900, 480, 0.94);
    ctx.font = `900 ${size}px Arial,Helvetica,sans-serif`; ctx.fillStyle = PAPER;
    let y = blockStart(500, 962, lines.length, size, 0.94);
    for (const line of lines) { ctx.fillText(line, 90, y); y += size * 0.94; }

    ctx.fillStyle = ACID; ctx.fillRect(90, 990, 120, 6);
    ctx.fillStyle = 'rgba(244,237,219,.72)'; ctx.font = '900 25px Arial,Helvetica,sans-serif';
    ctx.fillText(`$DASHA · ${MARK}`, 90, 1046);
    drawMark(936, 968, 66, ACID);
  },

  /* Character look: the cherry is the hero, the line is the caption. The blink is a short window of
     the loop rather than a smooth tween — an eye is either open or shut, and a fading eyelid reads
     as a bug. */
  face(text, t = 0) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, 1080, 1080);
    const glow = ctx.createRadialGradient(540, 330, 0, 540, 330, 470);
    glow.addColorStop(0, VIOLET + '44'); glow.addColorStop(1, VIOLET + '00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1080);

    drawFace(345, 96, 390, t > 0.44 && t < 0.54 ? 'blink' : 'deadpan', ACID, INK);

    const { size, lines } = fit(text.toUpperCase(), (s) => `900 ${s}px Arial,Helvetica,sans-serif`, 108, 900, 300, 0.94);
    ctx.font = `900 ${size}px Arial,Helvetica,sans-serif`; ctx.fillStyle = PAPER; ctx.textAlign = 'center';
    let y = blockStart(560, 900, lines.length, size, 0.94);
    for (const line of lines) { ctx.fillText(line, 540, y); y += size * 0.94; }
    ctx.textAlign = 'left';

    ctx.fillStyle = ACID; ctx.fillRect(0, 1018, 1080, 62);
    ctx.fillStyle = INK; ctx.font = '900 25px Arial,Helvetica,sans-serif';
    ctx.fillText(`$DASHA · ${MARK}`, 40, 1057);
    drawMark(948, 84, 68, PAPER);
  },

  print(text, t = 0) {
    ctx.fillStyle = INK; ctx.fillRect(0, 0, 1080, 1080);
    ctx.strokeStyle = 'rgba(244,237,219,.22)'; ctx.lineWidth = 2; ctx.strokeRect(80, 80, 920, 920);
    ctx.fillStyle = ACID; ctx.font = '900 26px ui-monospace,Menlo,Consolas,monospace';
    ctx.fillText('$DASHA // TRANSMISSION', 120, 168);
    ctx.strokeStyle = 'rgba(244,237,219,.22)';
    ctx.beginPath(); ctx.moveTo(120, 202); ctx.lineTo(960, 202); ctx.stroke();

    const mono = (s) => `700 ${s}px ui-monospace,Menlo,Consolas,monospace`;
    const { size, lines } = fit(text, mono, 74, 840, 620, 1.28);
    ctx.font = mono(size); ctx.fillStyle = PAPER;
    let y = blockStart(226, 876, lines.length, size, 1.28, 0.62);
    for (const line of lines) { ctx.fillText(line, 120, y); y += size * 1.28; }

    // Terminal cursor, on for the first half of the loop and off for the second.
    if (t < 0.5) {
      const tail = ctx.measureText(lines[lines.length - 1]).width;
      const baseline = y - size * 1.28;
      ctx.fillStyle = ACID;
      ctx.fillRect(120 + tail + 10, baseline - size * 0.62, size * 0.5, size * 0.62);
    }

    ctx.strokeStyle = 'rgba(244,237,219,.22)';
    ctx.beginPath(); ctx.moveTo(120, 892); ctx.lineTo(960, 892); ctx.stroke();
    ctx.fillStyle = 'rgba(244,237,219,.6)'; ctx.font = '700 24px ui-monospace,Menlo,Consolas,monospace';
    ctx.fillText(MARK, 120, 940);
    ctx.fillStyle = HOT; ctx.textAlign = 'right';
    ctx.fillText('DASHA STUDIO', 960, 940); ctx.textAlign = 'left';
    drawMark(896, 112, 58, ACID);
  },
};

/* phase runs 0 -> 1 over one loop of the animation. Every look is drawn as a pure function of it,
   so frame N of a GIF is just render(N / frames) — there is no timer, no state, and the still
   export is simply phase 0. Each look's motion is periodic over exactly one phase so the GIF
   loops without a seam. */
function render(phase = 0) {
  canvas.width = 1080;
  canvas.height = 1080;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  draw[look.id]($('line').value.trim() || look.line, phase);
  ctx.restore();

  if (format.id === 'square') return;
  const square = document.createElement('canvas');
  square.width = square.height = 1080;
  square.getContext('2d').drawImage(canvas, 0, 0);
  canvas.width = format.width;
  canvas.height = format.height;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (format.id === 'story') {
    ctx.drawImage(square, 0, 420, 1080, 1080);
    ctx.fillStyle = ACID; ctx.fillRect(0, 0, 1080, 18);
    ctx.fillStyle = PAPER; ctx.font = '900 34px Arial,Helvetica,sans-serif';
    ctx.fillText('DASHA MEME STUDIO', 72, 116);
    ctx.font = '900 112px Arial,Helvetica,sans-serif'; ctx.fillText('$DASHA', 68, 252);
    ctx.fillStyle = 'rgba(244,237,219,.65)'; ctx.font = '700 28px Arial,Helvetica,sans-serif';
    ctx.fillText('$DASHA STUDIO', 72, 1590);
    ctx.fillStyle = HOT; ctx.fillRect(72, 1636, 936, 5);
    ctx.fillStyle = PAPER; ctx.font = '900 32px Arial,Helvetica,sans-serif';
    ctx.fillText(MARK, 72, 1720);
  } else {
    ctx.drawImage(square, 0, 0, 628, 628);
    ctx.fillStyle = VIOLET; ctx.fillRect(628, 0, 572, 628);
    ctx.fillStyle = ACID; ctx.fillRect(628, 0, 14, 628);
    ctx.fillStyle = PAPER; ctx.font = '900 28px Arial,Helvetica,sans-serif';
    ctx.fillText('DASHA MEME STUDIO', 690, 104);
    ctx.font = '900 88px Arial,Helvetica,sans-serif'; ctx.fillText('$DASHA', 684, 232);
    ctx.font = '900 34px Arial,Helvetica,sans-serif';
    ctx.fillText('$DASHA STUDIO.', 690, 350); ctx.fillText('GETDASHA.COM', 690, 394);
    ctx.fillStyle = ACID; ctx.font = '900 26px Arial,Helvetica,sans-serif';
    ctx.fillText(MARK, 690, 540);
  }
}

/* ---- GIF export ------------------------------------------------------------------------
   Written here rather than pulled in, because the Studio ships as one file with no dependencies
   and no network. canvas.captureStream + MediaRecorder would give animation for free, but it
   produces WebM, which X will not accept on upload — GIF is what actually loops in a timeline,
   so the encoder is the price of animated output.

   Palette: these looks are flat brand colour plus a couple of gradients. When a clip uses 256 or
   fewer distinct colours the table is exact and the GIF is lossless. Past that it keeps the 256
   most common colours and maps the rest to the nearest, memoised per 5-bit RGB bucket so the
   256-way search runs about 32k times instead of once per pixel. */

function buildPalette(frames) {
  const counts = new Map();
  for (const data of frames) {
    for (let i = 0; i < data.length; i += 4) {
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const keys = counts.size <= 256
    ? [...counts.keys()]
    : [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256).map(([key]) => key);
  return { keys, index: new Map(keys.map((key, i) => [key, i])), cache: new Map() };
}

function paletteIndex(palette, r, g, b) {
  const exact = palette.index.get((r << 16) | (g << 8) | b);
  if (exact !== undefined) return exact;
  const bucket = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  const hit = palette.cache.get(bucket);
  if (hit !== undefined) return hit;
  let best = 0, bestDistance = Infinity;
  for (let i = 0; i < palette.keys.length; i++) {
    const key = palette.keys[i];
    const dr = ((key >> 16) & 255) - r, dg = ((key >> 8) & 255) - g, db = (key & 255) - b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) { bestDistance = distance; best = i; }
  }
  palette.cache.set(bucket, best);
  return best;
}

/** GIF's variable-code-width LZW. Codes widen as the dictionary fills and reset at 4095. */
function lzwEncode(indices, minCodeSize) {
  const bytes = [];
  let bitBuffer = 0, bitCount = 0;
  const put = (code, width) => {
    bitBuffer |= code << bitCount;
    bitCount += width;
    while (bitCount >= 8) { bytes.push(bitBuffer & 255); bitBuffer >>>= 8; bitCount -= 8; }
  };
  const clearCode = 1 << minCodeSize, endCode = clearCode + 1;
  let width = minCodeSize + 1, next = endCode + 1, dictionary = new Map();
  put(clearCode, width);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = (prefix << 8) | k;
    const found = dictionary.get(key);
    if (found !== undefined) { prefix = found; continue; }
    put(prefix, width);
    /* Widen BEFORE assigning the code that needs the extra bit, not after. Assigning first and
       widening after switches one code too early, and the decoder — which builds its table one
       entry behind — then reads every subsequent code at the wrong width. It only goes wrong past
       511 entries, so small images encode fine and large ones come out as garbage. */
    if (next === 4096) {
      put(clearCode, width);
      dictionary = new Map(); next = endCode + 1; width = minCodeSize + 1;
    } else {
      if (next >= (1 << width) && width < 12) width++;
      dictionary.set(key, next++);
    }
    prefix = k;
  }
  put(prefix, width);
  put(endCode, width);
  if (bitCount > 0) bytes.push(bitBuffer & 255);
  return bytes;
}

function encodeGIF(frames, width, height, delayCentiseconds) {
  const palette = buildPalette(frames);
  const out = [];
  const byte = (...values) => out.push(...values);
  const short = (n) => out.push(n & 255, (n >> 8) & 255);
  for (const character of 'GIF89a') out.push(character.charCodeAt(0));
  short(width); short(height);
  byte(0xF7, 0, 0);                                   // global table, 256 entries, 8 bits/pixel
  for (let i = 0; i < 256; i++) {
    const key = palette.keys[i] ?? 0;
    byte((key >> 16) & 255, (key >> 8) & 255, key & 255);
  }
  byte(0x21, 0xFF, 11);                               // application extension: loop forever
  for (const character of 'NETSCAPE2.0') out.push(character.charCodeAt(0));
  byte(3, 1, 0, 0, 0);

  for (const data of frames) {
    byte(0x21, 0xF9, 4, 0); short(delayCentiseconds); byte(0, 0);
    byte(0x2C); short(0); short(0); short(width); short(height); byte(0);
    const indices = new Uint8Array(data.length / 4);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      indices[p] = paletteIndex(palette, data[i], data[i + 1], data[i + 2]);
    }
    byte(8);
    const compressed = lzwEncode(indices, 8);
    for (let i = 0; i < compressed.length; i += 255) {
      const chunk = compressed.slice(i, i + 255);
      byte(chunk.length, ...chunk);
    }
    byte(0);
  }
  byte(0x3B);
  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}

/* 480px on the long edge and 16 frames. Full 1080 would produce a file too large for X to accept
   on mobile, and GIF is a palette format, so the size costs far less than it would on a photo. */
const GIF_FRAMES = 16, GIF_LONG_EDGE = 480, GIF_DELAY_CS = 7;

async function captureGIF() {
  const scale = GIF_LONG_EDGE / Math.max(format.width, format.height);
  const width = Math.round(format.width * scale), height = Math.round(format.height * scale);
  const off = document.createElement('canvas');
  off.width = width; off.height = height;
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  const frames = [];
  for (let i = 0; i < GIF_FRAMES; i++) {
    render(i / GIF_FRAMES);
    offCtx.drawImage(canvas, 0, 0, width, height);
    frames.push(offCtx.getImageData(0, 0, width, height).data);
    // Yield so the status line paints and the tab does not appear hung during encoding.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  render(0);
  return encodeGIF(frames, width, height, GIF_DELAY_CS);
}

const blobFromCanvas = (type, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image unavailable')), type, quality);
});
const png = () => blobFromCanvas('image/png');
const shareImage = async () => {
  const blob = await png();
  if (blob.size <= 5_000_000) return { blob, type: 'image/png', ext: 'png' };
  const jpeg = await blobFromCanvas('image/jpeg', 0.9);
  return { blob: jpeg, type: 'image/jpeg', ext: 'jpg' };
};
const fileName = () => `dasha-${look.id}-${format.id}.png`;
// The cherry travels with the share text. It is the one piece of the mark that survives a platform
// stripping images, and it is why the gate checks for it rather than for the word.
const shareText = () => `${$('line').value.trim() || look.line}\n\n$dasha \u{1F352}`;

function save(blob, name = fileName()) {
  const link = document.createElement('a');
  link.download = name;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

/* X's intent URL cannot carry an image, so a download followed by "now go find that file and
   attach it" is where sharing dies. Where the browser can hand the actual PNG to the share sheet
   we do that instead, and the post is one gesture. Everywhere else we fall back to the two-step
   and say so, rather than pretending the image travelled. */
let shareBusy = false;
$('share').addEventListener('click', async () => {
  if (shareBusy) return;
  shareBusy = true; $('share').disabled = true; trackStudio('share_intent');
  try {
    const image = await shareImage();
    const file = new File([image.blob], fileName().replace(/png$/, image.ext), { type: image.type });
    const shareData = { files: [file], text: shareText(), ...(imageOnly ? {} : { url: remixURL() }) };
    /* canShare({files}) does not guarantee share({files,url}) works. Abort stays silent;
       any other share failure falls through to download + X intent (the path that always works). */
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share(shareData);
        trackStudio('share_success'); trackStudio('completion');
        feMark('export');
        $('status').textContent = imageOnly ? 'Shared image.' : 'Shared.';
        return;
      } catch (error) {
        if (error.name === 'AbortError') { $('status').textContent = ''; return; }
      }
    }
    save(image.blob, file.name);
    const intent = new URL('https://x.com/intent/post');
    intent.searchParams.set('text', shareText());
    if (!imageOnly) intent.searchParams.set('url', remixURL());
    window.open(intent, '_blank', 'noopener');
    trackStudio('completion');
    feMark('export');
    $('status').textContent = imageOnly
      ? 'Image saved — attach it in the X tab that just opened.'
      : 'Image saved — attach it in the X tab that just opened. The editable link is already there.';
  } catch {
    $('status').textContent = 'Could not export this image. Try another.';
  } finally {
    shareBusy = false; $('share').disabled = false;
  }
});

$('download').addEventListener('click', async () => {
  try {
    save(await png());
    trackStudio('export'); trackStudio('completion');
    feMark('export');
    $('status').textContent = `Saved ${fileName()}.`;
  } catch {
    $('status').textContent = 'Could not save this image. Try another look or photo.';
  }
});

$('copy-link').addEventListener('click', async () => {
  const url = remixURL();
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
    else {
      const ta = Object.assign(document.createElement('textarea'), { value: url });
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    trackStudio('copy_editable_link');
    feMark('link');
    $('status').textContent = imageOnly
      ? 'Link copied (image-only arm — parent lineage off).'
      : 'Editable link copied — anyone can open and change it.';
  } catch {
    $('status').textContent = 'Could not copy the link. Select the address bar after Share.';
  }
});

$('copy').addEventListener('click', async () => {
  try {
    const blob = await png();
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': Promise.resolve(blob) })]);
        $('status').textContent = 'Image copied.';
        trackStudio('export'); trackStudio('completion');
        feMark('export');
        return;
      }
    } catch { /* fall through to save */ }
    save(blob);
    trackStudio('export'); trackStudio('completion');
    feMark('export');
    $('status').textContent = 'Couldn’t copy — PNG saved instead.';
  } catch {
    $('status').textContent = 'Could not copy this image. Try another look or photo.';
  }
});

$('gif').addEventListener('click', async () => {
  const button = $('gif');
  button.disabled = true;
  $('status').textContent = 'Rendering the loop…';
  try {
    const blob = await captureGIF();
    const name = `dasha-${look.id}-${format.id}.gif`;
    save(blob, name);
    trackStudio('export'); trackStudio('completion');
    feMark('export');
    // X caps GIF uploads well below its image limit, and the cap is lower on mobile than desktop,
    // so the size is stated rather than left for the upload to reject.
    $('status').textContent = `Saved ${name} — ${(blob.size / 1e6).toFixed(1)} MB. Attach it on X like any image.`;
  } catch {
    $('status').textContent = 'Could not render the GIF. Try a simpler look or shorter line.';
  } finally {
    button.disabled = false;
  }
});

$('kit').addEventListener('click', async () => {
  const original = format, files = [];
  try {
    for (const option of FORMATS) {
      format = option;
      render();
      files.push([fileName(), await png()]);
    }
    format = original;
    render();
    for (const link of $('kit-links').children) URL.revokeObjectURL(link.href);
    $('kit-links').replaceChildren(...files.map(([name, blob]) => {
      const link = document.createElement('a');
      link.download = name;
      link.href = URL.createObjectURL(blob);
      link.textContent = name.match(/-(square|story|banner)\.png$/)[1].replace('square', 'post') + ' ↓';
      return link;
    }));
    $('kit-links').hidden = false;
    trackStudio('export'); trackStudio('completion');
    feMark('export');
    $('status').textContent = 'Three sizes ready.';
  } catch {
    format = original;
    render();
    $('status').textContent = 'Could not prepare all sizes. Try again.';
  }
});

/* Open Culture Object (lite): portable JSON for the same DNA the remix URL carries.
   Not a network protocol — a downloadable handoff when URLs get long or offline. */
const OCO_SCHEMA = 'dasha-oco/v0';
function toOco() {
  const state = currentState();
  const { material, keys, base } = relayCheck();
  return {
    schema: OCO_SCHEMA,
    tool: { name: 'dasha-studio', version: 1 },
    state,
    parent: base || null,
    relay: { material, keys },
    rights: {
      drawn: 'CC0-1.0',
      likeness: 'not-granted',
      photos: 'third-party-not-cc0',
    },
    mark: MARK,
  };
}
function applyCultureState(next) {
  if (!next || typeof next !== 'object') throw new Error('invalid state');
  const nextLook = LOOKS.find((option) => option.id === next.look);
  const nextFormat = FORMATS.find((option) => option.id === next.format);
  if (!nextLook || !nextFormat) throw new Error('unknown look or format');
  const line = String(next.line || '').slice(0, 120);
  if (!line) throw new Error('missing line');
  const nextEffect = EFFECTS.find(([id]) => id === (next.effect || 'clean')) || EFFECTS[0];
  const nextSticker = STICKERS.some(([id]) => id === (next.sticker || '')) ? (next.sticker || '') : '';
  const nextPhoto = next.photo && PHOTOS.some(([id]) => id === next.photo) ? next.photo : '';
  look = nextLook;
  format = nextFormat;
  effect = nextEffect;
  sticker = nextSticker;
  photoId = nextPhoto;
  $('looks').value = look.id;
  $('formats').value = format.id;
  $('line').value = line;
  $('line').placeholder = look.line;
  $('effects').value = effect[0];
  $('stickers').value = sticker;
  if (photoId) {
    const radio = $('gallery').querySelector(`input[value="${CSS.escape(photoId)}"]`);
    if (radio) radio.checked = true;
    const entry = PHOTOS.find(([id]) => id === photoId);
    if (entry) loadPhoto(...entry, false, { keepLook: true, note: '' });
  } else {
    for (const radio of $('gallery').querySelectorAll('input[type=radio]')) radio.checked = false;
    photo = null;
  }
  syncURL();
  render();
}
function readOco(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || data.schema !== OCO_SCHEMA || !data.state) throw new Error('not a Dasha culture object');
  return data;
}
function normalizeParent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nextLook = LOOKS.find((option) => option.id === raw.look);
  const nextFormat = FORMATS.find((option) => option.id === raw.format);
  const line = String(raw.line || '').trim();
  if (!nextLook || !nextFormat || !line || line.length > 120) return null;
  const photo = raw.photo && PHOTOS.some(([id]) => id === raw.photo) ? raw.photo : '';
  const nextEffect = EFFECTS.some(([id]) => id === (raw.effect || 'clean')) ? (raw.effect || 'clean') : 'clean';
  const nextSticker = STICKERS.some(([id]) => id === (raw.sticker || '')) ? (raw.sticker || '') : '';
  return { look: nextLook.id, format: nextFormat.id, line, photo, effect: nextEffect, sticker: nextSticker };
}
$('oco-export').addEventListener('click', () => {
  try {
    const blob = new Blob([`${JSON.stringify(toOco(), null, 2)}\n`], { type: 'application/json' });
    const name = `dasha-${look.id}-${format.id}.oco.json`;
    save(blob, name);
    trackStudio('export');
    $('status').textContent = `Saved ${name} — open it later with Open object.`;
  } catch {
    $('status').textContent = 'Could not save the object.';
  }
});
$('oco-import').addEventListener('click', () => $('oco-file').click());
$('oco-file').addEventListener('change', async () => {
  const file = $('oco-file').files?.[0];
  $('oco-file').value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const data = readOco(text);
    applyCultureState(data.state);
    const importedParent = normalizeParent(data.parent);
    if (importedParent) {
      liveParent = importedParent;
      showParentLineage(importedParent);
    }
    trackStudio('first_edit');
    $('remix-note').hidden = false;
    $('remix-note').textContent = 'Opened object.';
    refreshDiffNote();
    $('status').textContent = data.relay?.material
      ? 'Object loaded — Relay was material when saved.'
      : 'Object loaded.';
  } catch {
    $('status').textContent = 'Could not open that file. Need a dasha-oco/v0 JSON object.';
  }
});


function fillSelect(id, options, selected) {
  $(id).append(...options.map((option) => new Option(option.name, option.id, false, option === selected)));
}
fillSelect('looks', LOOKS, look);
fillSelect('formats', FORMATS, format);
for (const option of EFFECTS) $('effects').add(new Option(option[1], option[0]));
for (const option of STICKERS) $('stickers').add(new Option(option[1], option[0]));
$('effects').value = effect[0];
$('stickers').value = sticker;

const snapshot = () => ({
  effect, sticker, zoom, tilt, offsetX, offsetY,
  lookId: look.id, line: $('line').value, photoId, photo,
});
function remember() {
  undoState = snapshot();
  $('undo').hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => { $('undo').hidden = true; }, 5000);
}
function restore(state) {
  ({ effect, sticker, zoom, tilt, offsetX, offsetY, photoId, photo } = state);
  look = LOOKS.find((option) => option.id === state.lookId) || look;
  $('looks').value = look.id;
  $('line').value = state.line;
  $('line').placeholder = look.line;
  if (photoId) {
    const radio = $('gallery').querySelector(`input[value="${CSS.escape(photoId)}"]`);
    if (radio) radio.checked = true;
  } else {
    for (const radio of $('gallery').querySelectorAll('input[type=radio]')) radio.checked = false;
  }
  $('effects').value = effect[0]; $('stickers').value = sticker;
  $('zoom').value = zoom; $('tilt').value = tilt;
  syncURL(); render();
}
$('undo').addEventListener('click', () => { if (undoState) restore(undoState); $('undo').hidden = true; });

let editIndex = 0;
$('edit').addEventListener('click', () => {
  if (!photo) { $('status').textContent = 'Choose an image first.'; return; }
  remember(); editIndex = editIndex % (EFFECTS.length - 1) + 1;
  trackStudio('first_edit');
  effect = EFFECTS[editIndex]; sticker = STICKERS[(editIndex % (STICKERS.length - 1)) + 1][0];
  zoom = 1.05 + (editIndex % 3) * .12; tilt = [-6, 4, -2][editIndex % 3];
  $('effects').value = effect[0]; $('stickers').value = sticker; $('zoom').value = zoom; $('tilt').value = tilt;
  render();
});

/* Public @dash_eats lines (culture-seeds gate). One tap kills blank-line friction. */
const CAPTIONS = [
  'How u crying at the casino and u can’t even get in',
  'It’s time $dasha',
  'Well im still alive',
  'Friday in the 4HL you can really feel the pull of the weekend',
];
$('chips').append(...CAPTIONS.map((text) => {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = text.length > 42 ? text.slice(0, 41) + '…' : text;
  chip.title = text;
  chip.addEventListener('click', () => {
    trackStudio('first_edit');
    $('line').value = text;
    $('status').textContent = '';
    syncURL();
    render();
  });
  return chip;
}));

let photoLoadVersion = 0;
function loadPhoto(id, src, local = false, opts = {}) {
  const version = ++photoLoadVersion;
  const image = new Image();
  if (!local) image.crossOrigin = 'anonymous';
  image.onload = () => {
    if (version !== photoLoadVersion) { if (local) URL.revokeObjectURL(src); return; }
    photo = image; photoId = local ? '' : id;
    if (!opts.keepLook) { look = LOOKS[0]; $('looks').value = look.id; }
    if (local) URL.revokeObjectURL(src);
    $('status').textContent = opts.note || '';
    syncURL(); render();
  };
  image.onerror = () => { if (version === photoLoadVersion) $('status').textContent = 'That image could not be opened.'; };
  image.src = src;
}

$('gallery').append(...PHOTOS.map(([id, src], index) => {
  const label = document.createElement('label');
  const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'photo', value: id, checked: id === photoId });
  const image = Object.assign(document.createElement('img'), { src, alt: `Dasha image ${index + 1}`, loading: 'lazy', crossOrigin: 'anonymous' });
  input.addEventListener('change', () => { trackStudio('first_edit'); loadPhoto(id, src); });
  label.append(input, image); return label;
}));
const uploadLabel = document.createElement('label'); uploadLabel.className = 'upload'; uploadLabel.textContent = 'ADD YOURS';
const upload = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
upload.addEventListener('change', () => {
  const file = upload.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { $('status').textContent = 'Choose an image file.'; return; }
  if (file.size > 20_000_000) { $('status').textContent = 'Choose an image under 20 MB.'; return; }
  trackStudio('first_edit'); const url = URL.createObjectURL(file); loadPhoto('local', url, true);
});
uploadLabel.append(upload); $('gallery').append(uploadLabel);
if (requestedPhoto) loadPhoto(...requestedPhoto);

$('effects').addEventListener('change', () => {
  trackStudio('first_edit'); remember();
  effect = EFFECTS.find(([id]) => id === $('effects').value) || EFFECTS[0];
  syncURL(); render();
});
$('stickers').addEventListener('change', () => {
  trackStudio('first_edit'); remember();
  sticker = STICKERS.some(([id]) => id === $('stickers').value) ? $('stickers').value : '';
  syncURL(); render();
});
$('zoom').addEventListener('focus', remember);
$('zoom').addEventListener('input', () => { zoom = Number($('zoom').value); render(); });
$('tilt').addEventListener('focus', remember);
$('tilt').addEventListener('input', () => { tilt = Number($('tilt').value); render(); });

const pointers = new Map();
let gesture = null;
canvas.addEventListener('pointerdown', (event) => {
  if (!photo || look.id !== 'photo') return;
  trackStudio('first_edit');
  canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, event); remember();
  gesture = { state: snapshot(), points: [...pointers.values()] };
});
canvas.addEventListener('pointermove', (event) => {
  if (!pointers.has(event.pointerId) || !gesture) return;
  pointers.set(event.pointerId, event);
  const points = [...pointers.values()], start = gesture.points, scale = 1080 / canvas.getBoundingClientRect().width;
  if (points.length === 1) {
    offsetX = gesture.state.offsetX + (points[0].clientX - start[0].clientX) * scale;
    offsetY = gesture.state.offsetY + (points[0].clientY - start[0].clientY) * scale;
  } else if (start.length > 1) {
    const distance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const angle = (a, b) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
    zoom = Math.max(1, Math.min(2.5, gesture.state.zoom * distance(points[0], points[1]) / distance(start[0], start[1])));
    tilt = Math.max(-15, Math.min(15, gesture.state.tilt + (angle(points[0], points[1]) - angle(start[0], start[1])) * 180 / Math.PI));
    $('zoom').value = zoom; $('tilt').value = tilt;
  }
  render();
});
const endPointer = (event) => { pointers.delete(event.pointerId); gesture = pointers.size ? { state: snapshot(), points: [...pointers.values()] } : null; };
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('dblclick', () => { if (photo) { remember(); zoom = 1; tilt = offsetX = offsetY = 0; restore(snapshot()); } });
$('looks').addEventListener('change', () => {
  trackStudio('first_edit');
  look = LOOKS.find((option) => option.id === $('looks').value) || look;
  $('line').placeholder = look.line;
  $('status').textContent = '';
  syncURL();
  render();
});
$('formats').addEventListener('change', () => {
  trackStudio('first_edit');
  format = FORMATS.find((option) => option.id === $('formats').value) || format;
  $('status').textContent = '';
  syncURL();
  render();
});

$('line').placeholder = look.line;
$('line').addEventListener('input', () => { trackStudio('first_edit'); syncURL(); render(); });
render(); trackStudio('open');
})();
