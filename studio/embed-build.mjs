#!/usr/bin/env node
/**
 * Generates embed.html — the Meme Studio as a fragment that can be pasted into a
 * Webflow page — from index.html, which stays the one canonical Studio.
 *
 * Never hand-edit the embed. A hand copy is a second Studio and drifts within a day;
 * dasha-studio-embed.test.mjs regenerates and compares, so a stale embed fails the gate.
 *
 * Isolation is a shadow root. The Studio is a whole page — :root palette, global body/h1/label
 * rules, generic ids like #canvas and #line — and all three would fight a Webflow page in both
 * directions. A shadow root gets that guarantee from the platform rather than from a regex over
 * minified CSS, and it makes id collisions impossible.
 *
 * Light-DOM shell (mint + lede) sits inside the host for first paint / no-JS / crawlers; the
 * client clears it when the shadow mounts. The host page may also supply nav; supporting copy
 * live inside <main>, so they travel with the tool and cannot be left behind by an embedder.
 *
 *   node embed-build.mjs           # write embed.html
 *   node embed-build.mjs --check   # exit 1 if the file on disk is stale
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const here = (f) => new URL(`./${f}`, import.meta.url);

const between = (html, open, close, what) => {
  const start = html.indexOf(open);
  const end = html.indexOf(close, start + open.length);
  if (start < 0 || end < 0) throw new Error(`cannot find ${what} in the Studio`);
  return html.slice(start + open.length, end);
};

export function buildStudioEmbed(studio) {
  const style = between(studio, '<style>', '</style>', '<style>');
  const markup = between(studio, '<main class="wrap">', '</main>', '<main class="wrap">');
  const script = between(studio, '<script>', '</script>', '<script>');
  if (!markup.includes('<summary>More options</summary>')) throw new Error('advanced Studio controls are no longer progressively disclosed');
  // Primary ship path + progressive disclosure. Looks/formats use chip strips + hidden selects.
  // Moods/history/variants are painted in script; markup buttons stay intentionally bounded.
  const buttons = (markup.match(/<button\b/g) || []).length;
  if (buttons !== 20) {
    throw new Error(`the Studio action set is no longer intentionally bounded (buttons=${buttons})`);
  }
  if (!markup.includes('id="edit"') || !markup.includes('id="share"') || !markup.includes('id="download"') || !markup.includes('id="copy-link"')) {
    throw new Error('primary Studio actions missing from markup');
  }
  if (!markup.includes('id="oco-export"') || !markup.includes('id="oco-import"')) {
    throw new Error('Open Culture Object save/open controls missing from markup');
  }
  if (!markup.includes('id="surprise"') || !markup.includes('id="surprise-go"') || !markup.includes('id="batch-looks"') || !markup.includes('id="after-share"')) {
    throw new Error('Studio lost surprise, batch cook, or share aftermath tray');
  }
  if (!/<div class="go">[\s\S]*id="surprise-go"[\s\S]*Surprise me/.test(markup)) {
    throw new Error('Surprise me must sit with the other .go actions');
  }
  if (!markup.includes('id="looks"') || !markup.includes('id="formats"') || !markup.includes('id="effects"') || !markup.includes('id="stickers"')) {
    throw new Error('compact Studio controls missing from markup');
  }
  if (!markup.includes('id="look-strip"') || !markup.includes('id="format-strip"') || !markup.includes('ship-bar')) {
    throw new Error('Studio lost look/format strips or sticky ship bar');
  }
  if (!markup.includes('id="effect-strip"') || !markup.includes('id="sticker-strip"')) {
    throw new Error('Studio lost effect or sticker strip');
  }
  if (!markup.includes('id="after-text"')) {
    throw new Error('Studio lost after-share post text copy');
  }
  if (!markup.includes('id="variants"') || !markup.includes('id="relay-seal"') || !markup.includes('id="stage-frame"')) {
    throw new Error('Studio lost variants rail, relay seal, or stage frame');
  }
  if (!/canvas\s*\{[^}]*touch-action:pan-y/.test(style)) {
    throw new Error('Studio canvas must preserve vertical touch scrolling');
  }
  if (!script.includes("type: 'file'") || !script.includes('LOCAL_IMAGE_TYPES')) {
    throw new Error('Studio upload input missing from script');
  }
  if (/claimRemixOnBoard|\/simp\/claims|Claim on Simp Board/.test(markup + script)) {
    throw new Error('unverified Studio evidence claim returned');
  }

  // style and markup are pasted into a template literal below; the script is not.
  for (const [name, text] of [['style', style], ['markup', markup]]) {
    if (/[`]|\$\{|<\/script>/.test(text)) {
      throw new Error(`${name} contains a backtick, \${ or </script> and cannot be inlined safely`);
    }
  }

  // :root and body both style the page itself. Inside a shadow root that is :host.
  const scoped = style
    .replace(/(^|\})\s*:root\s*\{/g, '$1:host{')
    .replace(/(^|\})\s*body\s*\{/g, '$1:host{');
  if (/:root/.test(scoped)) throw new Error(':root survived scoping');

  // A ShadowRoot has no getElementById, and the ids are shadow-local anyway. createElement stays
  // on document: it makes a detached node, so it is unaffected by where the markup lives.
  const rooted = script.replace('document.getElementById(id)', "root.querySelector('#'+id)");
  if (rooted === script) throw new Error('the Studio no longer looks up its fields the expected way');
  if (/\bdocument\.getElementById\b/.test(rooted)) throw new Error('an unscoped getElementById remains');

  return `<!-- Dasha Meme Studio — GENERATED by embed-build.mjs from index.html.
     Do not edit this file; edit the Studio and regenerate, or the gate fails.

     Paste anywhere, including a Webflow embed. Styles cannot leak in or out (shadow root), and the
     ids inside cannot collide with the host page's. The host page supplies its own nav. -->
<div class="dasha-studio-embed"></div>
<script>
(() => {
  const host = document.currentScript.previousElementSibling;
  if (!host || !host.classList.contains('dasha-studio-embed')) return;
  while (host.firstChild) host.removeChild(host.firstChild);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = \`<style>${scoped}
    :host{display:block}
    .wrap{padding-top:0}
  </style>
  <main class="wrap">${markup}</main>\`;

${rooted.trimEnd()}
})();
</script>
`;
}

const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const JUP_BUY =
  'https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=' + MINT;
const PAGES_STUDIO = 'https://uuriko.github.io/dasha-desk/studio/';

export function pagesEmbedPin(script) {
  const sri = `sha384-${createHash('sha384').update(script).digest('base64')}`;
  const hash = createHash('sha256').update(script).digest('hex').slice(0, 12);
  return {
    src: `https://uuriko.github.io/dasha-desk/studio/embed-${hash}.js`,
    sri,
    hash,
  };
}

/** First-paint / no-JS / crawler shell — cleared when the Pages embed mounts shadow.
 *  Light-DOM keeps release-contract markers: Dasha Meme Studio, square/story/banner, CC0, likeness.
 *  H1 is paper on ink with !important so a host page cannot recolor it blue.
 *  The shell fills ink. Acid is the one CTA. */
export function studioLoaderHtml(pin) {
  if (!pin || !pin.src || !pin.sri) throw new Error('studio loader needs a Pages embed pin');
  return (
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Dasha Meme Studio',
      url: 'https://www.getdasha.com/studio',
      description: 'Make a $dasha image in the browser. Six looks, three formats, PNG and animated GIF export. No account, no wallet, no upload — everything is drawn locally.',
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Any modern web browser',
      isAccessibleForFree: true,
    })}</script>\n` +
    `<div class="dasha-studio-embed">` +
    `<div class="dasha-studio-shell" data-studio-shell style="box-sizing:border-box;margin:0;padding:28px 16px 40px;width:100%;min-height:100vh;max-width:none;color:#f4eddb;font:16px/1.45 Arial,Helvetica,sans-serif;background:#070608">` +
    `<p style="margin:0 0 8px;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#dfff00">Dasha Meme Studio</p>` +
    `<h1 style="margin:0 0 14px;font-size:clamp(28px,6vw,42px);line-height:1;font-weight:900;letter-spacing:-.05em;text-transform:uppercase;color:#f4eddb!important;font-family:'Arial Black',Arial,Helvetica,sans-serif">Make one. Pass it on.</h1>` +
    `<p style="margin:0 0 16px;color:#e6dcc4">Six looks · square, story, banner · PNG + GIF · no wallet, no account, nothing uploaded. Runs in your browser.</p>` +
    `<p style="margin:0 0 8px;font-size:13px;word-break:break-all"><span style="font-weight:900;color:#f4eddb">CA</span> ${MINT}</p>` +
    `<p style="margin:0 0 16px">` +
    `<a href="${PAGES_STUDIO}" style="display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 22px;background:#dfff00;border:1px solid #dfff00;color:#070608;font:900 14px/1 'Arial Black',Arial,Helvetica,sans-serif;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;box-shadow:4px 4px 0 #ff3b81">Open studio</a>` +
    `</p>` +
    `<p style="margin:0;font-size:13px">` +
    `<a href="${JUP_BUY}" style="color:#f4eddb;font-weight:800" target="_blank" rel="noopener noreferrer">Buy $dasha ↗</a>` +
    ` · <a href="/" style="color:#f4eddb;font-weight:800">Home</a>` +
    ` · <a href="/dasha#dd-mint" style="color:#f4eddb;font-weight:800">Desk</a>` +
    `</p>` +
    `<p role="status" style="margin:18px 0 0;font-size:13px;color:#e6dcc4">Loading studio…</p>` +
    `<p style="margin:12px 0 0;font-size:12px;color:#e6dcc4;max-width:42ch">CC0 for what you make here, except Dasha's name or likeness which stays hers.</p>` +
    `</div></div>\n` +
    `<script src="${pin.src}" integrity="${pin.sri}" crossorigin="anonymous"></script>\n`
  );
}
export const embedScript = (embed) =>
  embed.slice(embed.indexOf('<script>') + 8, embed.lastIndexOf('</script>')).trim() + '\n';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const embed = buildStudioEmbed(await readFile(here('index.html'), 'utf8'));
  const script = embedScript(embed);
  const pin = pagesEmbedPin(script);
  const loader = studioLoaderHtml(pin);
  const outputs = [
    ['embed.html', embed],
    ['embed.js', script],
    ['loader.html', loader],
    [`embed-${pin.hash}.js`, script],
  ];

  if (process.argv.includes('--check')) {
    let stale = false;
    for (const [name, want] of outputs) {
      if ((await readFile(here(name), 'utf8').catch(() => '')) !== want) {
        console.error(`${name} is STALE — run: node embed-build.mjs`);
        stale = true;
      }
    }
    if (stale) process.exit(1);
    console.log('embed.html, embed.js and loader.html are current');
  } else {
    for (const [name, text] of outputs) {
      await writeFile(here(name), text);
      console.log(`wrote ${name} (${text.length} chars)`);
    }
    console.log('studio embed + script + loader generated');
  }
}
