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

for (const route of ['/', '/studio', '/dasha']) {
  const res = await get(ORIGIN + route);
  fail(res.ok, `${route}: unreachable — ${res.error || 'HTTP ' + res.status}`);
  if (!res.ok) continue;
  const html = await res.text();

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
  if (route === '/' || route === '/dasha') {
    fail(html.includes(MINT), `${route}: the mint is not shown at all`);
  }

  fail(!RETIRED.test(html), `${route}: a retired product is live again`);

  /* The promises. Losing these silently is the specific failure this file was written for. */
  if (route === '/studio') {
    fail(/CC0/.test(html), '/studio: the public-domain dedication is gone — makers have no statement of their rights');
    fail(/name or likeness/i.test(html), '/studio: the likeness carve-out is gone; CC0 alone overstates what we can grant');
    fail(!/not affiliated with dasha/i.test(html), '/studio: claims no affiliation, which is false');
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
  warn(ld.length > 0, `${route}: no structured data — machines get no description of this page`);
  for (const [, raw] of ld) {
    try { JSON.parse(raw); } catch { fail(false, `${route}: structured data is malformed JSON`); }
  }
}

// The second public copy of the Desk. A visitor cannot tell which deployment they landed on.
{
  const res = await get(PAGES);
  fail(res.ok, `pages: unreachable — ${res.error || 'HTTP ' + res.status}`);
  if (res.ok) {
    const html = await res.text();
    fail(html.includes(MINT), 'pages: the mint is not shown');
    fail(!RETIRED.test(html), 'pages: a retired product is live again');
  }
  const studio = await get(PAGES + 'studio/');
  fail(studio.ok, `pages /studio/: unreachable — ${studio.error || 'HTTP ' + studio.status}`);
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
