#!/usr/bin/env node
/**
 * Watches the live site. Runs on a schedule in GitHub Actions, so it does not depend on anyone's
 * laptop being open.
 *
 * Why this exists: the Studio's public-domain dedication has disappeared from production four
 * times. Every time it stayed gone for hours, and every time it was found by accident. Every gate
 * in this project passed throughout, because gates read files in a repo and the failure was between
 * the repo and the site — a stale draft published over the good one, an asset that rotted on a CDN,
 * a republish that dropped a block. Nothing was looking at what visitors actually got.
 *
 * The split matters. FAILURES are things that mislead someone or cost them money, and they should
 * wake somebody up. WARNINGS are things that are merely worse than they should be. A monitor that
 * is permanently amber gets muted within a week, and a muted monitor is worse than none, because it
 * looks like coverage.
 *
 *   node watch.mjs            # check production
 *   node watch.mjs --json     # machine-readable
 */
const ORIGIN = 'https://www.getdasha.com';
const PAGES = 'https://uuriko.github.io/dasha-desk/';
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
/* Scrapped products. If one is live again, something republished an archived source — the same
   class of accident that took out the CC0 dedication. */
const RETIRED = /\b(thesis card|conviction receipt|forecasting)\b/i;

const json = process.argv.includes('--json');
const failures = [];
const warnings = [];
const fail = (ok, msg) => { if (!ok) failures.push(msg); };
const warn = (ok, msg) => { if (!ok) warnings.push(msg); };

/* Retry before reporting. A single dropped connection is not a regression, and a monitor that cries
   wolf at transient network noise is one nobody reads. */
async function get(url, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'dasha-watch' } });
      if (res.ok) return res;
      last = `HTTP ${res.status}`;
      if (res.status < 500 && res.status !== 429) return res;
    } catch (e) { last = e.message; }
    if (i < tries) await new Promise((r) => setTimeout(r, i * 3000));
  }
  return { ok: false, status: 0, error: last, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
}

/* /how-to-buy is served by a Cloudflare edge worker (it answers with x-dasha-edge: howto), not by
   Webflow — it is absent from the Webflow page list entirely, and staging 404s it. That is why every
   sweep missed it: it is a live public page that no publish path here touches and no gate knew
   about. It was still serving copy the operator removed hours after every other surface was clean.
   A surface nobody watches is a surface that drifts, so it is watched here now. */
for (const route of ['/', '/studio', '/dasha', '/how-to-buy', '/bounties']) {
  const res = await get(ORIGIN + route);
  fail(res.ok, `${route}: unreachable — ${res.error || 'HTTP ' + res.status}`);
  if (!res.ok) continue;
  const html = await res.text();
  const searchable = html + '\n' + html.replace(
    /%([0-9a-f]{2})/gi,
    (_, hex) => String.fromCharCode(parseInt(hex, 16)),
  );

  /* The mint. Any pump-suffixed address on our own pages must be ours; this is the single string
     where being wrong takes money from someone who trusted the page. */
  /* endsWith, not equality. This scans raw HTML rather than rendered text, so the character before
     an address can be anything: `%0AMint%3A%0A<mint>` in a share URL put an "A" (from "%0A")
     immediately before ours, and since "0" is not a base58 character no amount of boundary-guarding
     excludes it — the over-match is a legitimate read of the bytes. Two 44-character addresses
     cannot contain one another, so ending with our mint is proof it IS our mint. Getting this wrong
     means the watcher shouts its loudest alarm about a page whose mint is perfectly correct, and
     the second time that happens nobody reads it again. */
  for (const found of html.match(/[1-9A-HJ-NP-Za-km-z]{32,44}pump/g) || []) {
    fail(found.endsWith(MINT), `${route}: shows an address that is not our mint — ${found}`);
  }
  if (route === '/' || route === '/dasha' || route === '/how-to-buy') {
    fail(html.includes(MINT), `${route}: the mint is not shown at all`);
  }

  /* A page that answers 404 to HEAD and 200 to GET is a page many crawlers and link unfurlers treat
     as missing — they ask HEAD first. /how-to-buy does exactly this today. */
  if (route === '/how-to-buy') {
    try {
      const head = await fetch(ORIGIN + route, { method: 'HEAD', redirect: 'follow' });
      warn(head.ok, `${route}: HEAD says ${head.status} while GET says 200 — crawlers that HEAD first will treat it as missing`);
    } catch { /* a failed HEAD is not worth waking anyone for */ }
  }

  fail(!RETIRED.test(html), `${route}: a retired product is live again`);

  /* Copy the operator removed. On 2026-08-08 the instruction was "no disclaimers anywhere"; it was
     taken out of every source, gated, and published verified on all nine surfaces — and by the
     evening it was back on two live pages, because a publish landed from a tree that still had it.
     A decision is only as durable as the thing watching for its reversal, so this watches. */
  for (const gone of [/can go to zero/i, /not financial advice/i, /association is not endorsement/i,
                      /not affiliated with dasha/i]) {
    fail(!gone.test(searchable), `${route}: copy the operator removed is live again — ${gone.source}`);
  }
  fail(!/\bNFA\b/i.test(searchable), `${route}: copy the operator removed is live again — NFA`);

  /* The promises. Losing these silently is the specific failure this file was written for. */
  if (route === '/studio') {
    fail(/CC0/.test(html), '/studio: the public-domain dedication is gone — makers have no statement of their rights');
    fail(/name or likeness/i.test(html), '/studio: the likeness carve-out is gone; CC0 alone overstates what we can grant');
    fail(!/not affiliated with dasha/i.test(html), '/studio: claims no affiliation, which is false');
  }
  if (route === '/bounties') {
    fail(/we don't hold it|declared bounties, not escrow/i.test(html), '/bounties: lost the no-custody line');
  }

  /* The share card is a separate binary on a CDN. It can rot with nothing in any repo changing,
     and the only place anyone would notice is someone else's timeline. */
  const image = html.match(/<meta[^>]*og:image[^>]*>/)?.[0]?.match(/content="([^"]+)"/)?.[1];
  if (!image) {
    warn(false, `${route}: no og:image — shared links unfurl bare`);
  } else {
    const card = await get(image);
    fail(card.ok, `${route}: the share card is ${card.error || 'HTTP ' + card.status} — every shared link unfurls broken`);
    if (card.ok) {
      const bytes = Buffer.from(await card.arrayBuffer());
      const isPng = bytes.subarray(1, 4).toString() === 'PNG';
      fail(isPng, `${route}: the share card is not a PNG`);
      if (isPng) {
        const [w, h] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
        warn(w === 1200 && h === 630, `${route}: share card is ${w}x${h}, not 1200x630`);
      }
    }
  }

  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  warn(canonical?.startsWith(ORIGIN), `${route}: canonical is ${canonical || 'missing'}`);

  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (route === '/') warn(ld.length > 0, `${route}: no identity structured data`);
  for (const [, raw] of ld) {
    try { JSON.parse(raw); } catch { fail(false, `${route}: structured data is malformed JSON`); }
  }
}

/* The second public deployment. A visitor cannot tell which one they landed on, so it gets the same
   standard rather than a shallower one — Codex's review pointed out that this was checking the mint
   and then merely confirming the Studio answered at all, which left the alternate public copy
   materially less watched than the primary. Same invariants, both copies. */
for (const [label, url] of [['pages', PAGES], ['pages /studio/', PAGES + 'studio/'], ['pages /bounties/', PAGES + 'bounties/']]) {
  const res = await get(url);
  fail(res.ok, `${label}: unreachable — ${res.error || 'HTTP ' + res.status}`);
  if (!res.ok) continue;
  const html = await res.text();

  for (const found of html.match(/[1-9A-HJ-NP-Za-km-z]{32,44}pump/g) || []) {
    fail(found.endsWith(MINT), `${label}: shows an address that is not our mint — ${found}`);
  }
  fail(!RETIRED.test(html), `${label}: a retired product is live again`);
  for (const gone of [/can go to zero/i, /not financial advice/i, /association is not endorsement/i,
                      /not affiliated with dasha/i]) {
    fail(!gone.test(html), `${label}: copy the operator removed is live again — ${gone.source}`);
  }
  if (label.includes('studio')) {
    fail(/CC0/.test(html), `${label}: the public-domain dedication is gone`);
    fail(/name or likeness/i.test(html), `${label}: the likeness carve-out is gone`);
  } else if (label.includes('bounties')) {
    fail(/we don't hold it|declared bounties, not escrow/i.test(html), `${label}: lost the no-custody line`);
  } else {
    fail(html.includes(MINT), `${label}: the mint is not shown`);
  }
}

/* ---- freshness ------------------------------------------------------------------
   Everything above asks "is it reachable and does it say the right things". None of it can see the
   failure that actually happened: the GitHub Pages deploy workflow broke, Pages froze, and for
   weeks it served a 65 KB embed against a 114 KB source. It was reachable throughout. It showed the
   right mint throughout. This monitor ran green every six hours throughout, and nobody found it
   until someone went looking for something else.

   Staleness is invisible to a reachability check by construction, so it needs its own questions.
   All three below are answerable from public URLs alone, which is what lets them run here. */

/* 1. Every page pin must match the bytes the Worker serves.
      An integrity attribute naming bytes that are no longer there does not degrade — the browser
      refuses the script outright, so the surface is simply blank, with no console error anyone sees
      and no failing gate. Checked live because that is the only place the two can disagree. */
for (const [label, url] of [['home', ORIGIN + '/'], ['lobby', ORIGIN + '/lobby'], ['studio', ORIGIN + '/studio']]) {
  const res = await get(url);
  if (!res.ok) continue;
  const html = await res.text();
  for (const script of new Set(html.match(/https:\/\/lobby\.getdasha\.com\/[^"'\s)]+\.js/g) || [])) {
    /* Nearest pin in either direction. The loaders spell it `integrity=` or bind it to a const, so
       keying on a keyword picks up the wrong hash — and the pin sits AFTER its own URL, so scanning
       only backwards finds nothing and reads as "no pin, nothing to check". */
    const at = html.indexOf(script);
    let pin = null, nearest = Infinity;
    for (const m of html.matchAll(/sha384-[A-Za-z0-9+/=]+/g)) {
      const d = Math.abs(m.index - at);
      if (d < nearest) { nearest = d; pin = m[0]; }
    }
    if (!pin || nearest > 2000) continue;
    const asset = await get(script);
    if (!asset.ok) { fail(false, `${label}: ${script} is unreachable but the page pins it`); continue; }
    const bytes = new Uint8Array(await asset.arrayBuffer());
    const digest = await crypto.subtle.digest('SHA-384', bytes);
    const served = 'sha384-' + Buffer.from(digest).toString('base64');
    fail(served === pin,
      `${label}: pins ${pin.slice(0, 20)}… but ${script} serves ${served.slice(0, 20)}… — the browser is refusing that script`);
  }
}

/* 2. The pasteable embed must be the bytes its own snippet pins.
      This is the check that would have caught Pages freezing. Both halves are public: the README
      carries the snippet other people paste, and the file it names is served next to it. */
{
  const readme = await get(PAGES + 'studio/README.md');
  if (readme.ok) {
    const doc = await readme.text();
    const src = (doc.match(/src="(https:\/\/uuriko\.github\.io\/dasha-desk\/studio\/embed-[a-f0-9]+\.js)"/) || [])[1];
    const pin = (doc.match(/integrity="(sha384-[A-Za-z0-9+/=]+)"/) || [])[1];
    if (src && pin) {
      const hosted = await get(src);
      if (!hosted.ok) fail(false, `pages: the snippet points at ${src}, which is unreachable — every site that pasted it is broken`);
      else {
        const digest = await crypto.subtle.digest('SHA-384', new Uint8Array(await hosted.arrayBuffer()));
        fail('sha384-' + Buffer.from(digest).toString('base64') === pin,
          `pages: ${src} does not match the integrity its own README publishes — adopters are loading a script their browser will refuse`);
      }
    } else {
      warn(false, 'pages: the README snippet no longer carries a fingerprinted src and an integrity pin');
    }
  }
}

/* 3. The price must be current.
      A 200 from /price says the endpoint answers, not that the number is real. It reports how long
      it has been serving a last-good reading, so ask that instead. Thirty minutes is generous —
      the TTL is thirty seconds — because the upstream rate-limits our egress and brief staleness is
      normal; half an hour means it has genuinely stopped refreshing. */
{
  const res = await get('https://lobby.getdasha.com/price');
  if (!res.ok) warn(false, 'price: /price is unreachable — the homepage chart will be missing');
  else {
    const price = await res.json().catch(() => null);
    warn(price && price.priceUsd > 0, 'price: /price returned no usable number');
    if (price) {
      /* The age field has to exist for the age check to mean anything. If /price stops reporting it,
         Number(undefined) is NaN, every comparison against it is false, and this check passes
         forever while seeing nothing — the exact shape of the failure this whole section was added
         to catch. So a stale reading with no age is itself a finding. */
      const age = Number(price.staleForMs);
      if (price.stale) {
        fail(Number.isFinite(age),
          'price: reports itself stale but gives no age — the freshness check cannot see how bad it is');
        fail(!(age > 30 * 60_000),
          `price: serving a reading ${Math.round(age / 60000)} minutes old — the chart is showing a stale number as current`);
      }
    }
  }
}

const robots = await get(`${ORIGIN}/robots.txt`);
warn(robots.ok && (await robots.text()).trim().length > 0, 'robots.txt is empty — no rules and no Sitemap line');
warn((await get(`${ORIGIN}/sitemap.xml`)).ok, 'sitemap.xml is missing — search engines have no route list');

if (json) {
  console.log(JSON.stringify({ ok: failures.length === 0, failures, warnings }, null, 2));
} else {
  for (const w of warnings) console.log('  warn  ' + w);
  for (const f of failures) console.error('  FAIL  ' + f);
  console.log(`\n${failures.length} failure(s), ${warnings.length} warning(s) on ${ORIGIN}`);
}
process.exit(failures.length ? 1 : 0);
