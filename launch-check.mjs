#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { resolve4, resolve6, resolveCname } from 'node:dns/promises';
import { connect } from 'node:tls';
import { fileURLToPath } from 'node:url';

export function inspectPage(html) {
  const meta = (name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)`, 'i'))?.[1] ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'))?.[1] ||
      ''
    );
  };
  return {
    title: html.match(/<title>([^<]*)<\/title>/i)?.[1] || '',
    h1: strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || ''),
    canonical:
      html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ||
      '',
    ogTitle: meta('og:title'),
    ogDescription: meta('og:description'),
    ogImage: meta('og:image'),
    twitterImage: meta('twitter:image'),
    ogUrl: meta('og:url'),
    links: [...html.matchAll(/<a\b[^>]*href=["']([^"']+)/gi)].map((match) => match[1]),
    ids: new Set([...html.matchAll(/\bid=["']([^"']+)/gi)].map((match) => match[1])),
  };
}

export function inspectEvidence(html) {
  const problems = [];
  const text = html.match(/<script type="application\/json" id="dd-evidence-json">([^<]+)<\/script>/)?.[1];
  if (!text) return ['evidence.missing'];
  let evidence;
  try {
    evidence = JSON.parse(text);
  } catch {
    return ['evidence.json'];
  }
  const account = evidence.account || {};
  const encoded = account.accountDataBase64 || '';
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== 82 || bytes.toString('base64') !== encoded) problems.push('evidence.bytes');
  if (createHash('sha256').update(bytes).digest('hex') !== account.accountDataSha256) problems.push('evidence.hash');
  if (bytes.length === 82) {
    if (bytes.readBigUInt64LE(36).toString() !== account.supply) problems.push('evidence.supply');
    if (bytes[44] !== account.decimals) problems.push('evidence.decimals');
    if (Boolean(bytes[45]) !== account.initialized) problems.push('evidence.initialized');
    if ((bytes.readUInt32LE(0) === 0) !== (account.mintAuthority === null)) problems.push('evidence.mint-authority');
    if ((bytes.readUInt32LE(46) === 0) !== (account.freezeAuthority === null)) problems.push('evidence.freeze-authority');
  }
  if (evidence.mint !== '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump') problems.push('evidence.mint');
  if (!/digest covers only the embedded account bytes/i.test(strip(html))) problems.push('evidence.boundary-copy');
  return problems.sort();
}

export function redirectsArePermanent(chain, canonical) {
  if (!chain.length || chain.at(-1).url !== canonical || chain.at(-1).status < 200 || chain.at(-1).status >= 300) return false;
  return chain.slice(0, -1).every((hop) => (hop.status === 301 || hop.status === 308) && !(hop.url.startsWith('https:') && hop.location?.startsWith('http:')));
}

export function robotsBlocksRoot(text) {
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (key?.toLowerCase() === 'user-agent') applies = value === '*';
    if (applies && key?.toLowerCase() === 'disallow' && value === '/') return true;
  }
  return false;
}

function strip(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function dns(name) {
  const values = [];
  for (const fn of [resolve4, resolve6, resolveCname]) {
    try {
      values.push(...(await fn(name)));
    } catch {}
  }
  return [...new Set(values)];
}

async function tls(name) {
  return new Promise((resolve) => {
    const socket = connect({ host: name, port: 443, servername: name, rejectUnauthorized: true });
    socket.setTimeout(12000);
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      const days = Math.floor((Date.parse(cert.valid_to) - Date.now()) / 86400000);
      socket.end();
      resolve({ ok: socket.authorized, days, error: socket.authorizationError || null });
    });
    socket.once('timeout', () => socket.destroy(new Error('timeout')));
    socket.once('error', (error) => resolve({ ok: false, days: null, error: String(error.message || error) }));
  });
}

async function probe(start) {
  const chain = [];
  let url = start;
  try {
    for (let i = 0; i < 6; i += 1) {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
      const location = response.headers.get('location');
      const next = location ? new URL(location, url).href : null;
      chain.push({ url, status: response.status, location: next });
      if (next && response.status >= 300 && response.status < 400) {
        url = next;
        continue;
      }
      return { ok: response.ok, status: response.status, finalUrl: url, chain, contentType: response.headers.get('content-type') || '', body: await response.text() };
    }
    return { ok: false, status: 0, finalUrl: url, chain, body: '', contentType: '', error: 'redirect limit' };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: url, chain, body: '', contentType: '', error: String(error.message || error) };
  }
}

export async function checkLaunch({ mode = 'prelaunch', canonical = 'https://www.getdasha.com/', staging = 'https://johns-awesome-project-39b1b5.webflow.io' } = {}) {
  const production = new URL(canonical);
  const apex = production.hostname.replace(/^www\./, '');
  const www = `www.${apex}`;
  const findings = [];
  const infrastructureLevel = mode === 'launch' ? 'fail' : 'warn';
  const add = (level, code, message, evidence = null) => findings.push({ level, code, message, evidence });
  const [apexDns, wwwDns, apexTls, wwwTls, root, labs, robots, sitemap, stageHome, stageLabs, stageLegacy, stageRobots] = await Promise.all([
    dns(apex), dns(www), tls(apex), tls(www), probe(canonical), probe(new URL('/labs', canonical).href),
    probe(new URL('/robots.txt', canonical).href), probe(new URL('/sitemap.xml', canonical).href), probe(`${staging}/`),
    probe(`${staging}/labs`), probe(`${staging}/dasha?dg_probe=1`), probe(`${staging}/robots.txt`),
  ]);

  if (!apexDns.length) add(infrastructureLevel, 'dns.apex', `${apex} did not resolve from this resolver`);
  if (!wwwDns.length) add(infrastructureLevel, 'dns.www', `${www} did not resolve from this resolver`);
  for (const [name, result] of [[apex, apexTls], [www, wwwTls]]) {
    if (!result.ok) add(infrastructureLevel, 'tls.invalid', `${name} TLS handshake failed`, result.error);
    else if (result.days < 30) add('warn', 'tls.expiry', `${name} certificate expires soon`, `${result.days} days`);
  }

  for (const start of [`http://${apex}/`, `https://${apex}/`, `http://${www}/`, canonical]) {
    const result = await probe(start);
    if (!redirectsArePermanent(result.chain, canonical)) add(infrastructureLevel, 'redirect.graph', `${start} does not reach the canonical URL through permanent, non-downgrading redirects`, result.chain);
  }

  const productionPages = [['home', root, canonical], ['labs', labs, new URL('/labs', canonical).href]];
  for (const [name, page, expected] of productionPages) {
    if (!page.ok || !page.contentType.includes('text/html')) {
      add(infrastructureLevel, `${name}.http`, `${expected} is not available as HTML`, page.status || page.error);
      continue;
    }
    const meta = inspectPage(page.body);
    if (!meta.title || !meta.h1) add('fail', `${name}.identity`, `${name} needs a static title and H1`);
    if (meta.canonical !== expected) add('fail', `${name}.canonical`, `${name} canonical must equal its production URL`, meta.canonical);
    if (meta.ogUrl !== expected || !meta.ogTitle || !meta.ogDescription || meta.ogImage || meta.twitterImage) add('fail', `${name}.og`, `${name} needs title, description, exact URL, and no unlicensed social image`);
    if (page.body.includes('johns-awesome-project-39b1b5.webflow.io')) add('fail', `${name}.staging-leak`, `${name} contains the staging hostname`);
    for (const href of meta.links) {
      if (/^javascript:/i.test(href)) add('fail', `${name}.javascript-link`, `${name} contains a javascript: link`, href);
      if (href.startsWith('#') && !meta.ids.has(href.slice(1))) add('fail', `${name}.fragment`, `${name} links to a missing fragment`, href);
      if (/^http:\/\/(?:www\.)?getdasha\.com/i.test(href)) add('fail', `${name}.http-link`, `${name} contains an HTTP production link`, href);
    }
  }
  if (root.ok) for (const code of inspectEvidence(root.body)) add('fail', code, 'production mint evidence fallback is invalid');
  if (root.ok && !inspectPage(root.body).links.some((href) => href === '/labs' || href === new URL('/labs', canonical).href)) add('fail', 'home.labs-link', 'home does not link to Labs');
  if (labs.ok && !inspectPage(labs.body).links.some((href) => href === '/' || href === canonical)) add('fail', 'labs.home-link', 'Labs does not link home');

  if (!robots.ok) add(infrastructureLevel, 'robots.http', 'production robots.txt is unavailable', robots.status);
  else if (robotsBlocksRoot(robots.body)) add('fail', 'robots.blocked', 'production robots.txt blocks required routes');
  const locations = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1]);
  if (!sitemap.ok || !locations.length) add(infrastructureLevel, 'sitemap.missing', 'production sitemap is unavailable or empty');
  else {
    for (const expected of [canonical, new URL('/labs', canonical).href]) if (!locations.includes(expected)) add('fail', 'sitemap.route', 'sitemap lacks a required route', expected);
    for (const location of locations) if (new URL(location).origin !== production.origin || location.includes('webflow.io')) add('fail', 'sitemap.host', 'sitemap contains a noncanonical host', location);
  }

  for (const [name, page] of [['desk', stageHome], ['labs', stageLabs]]) {
    if (!page.ok) {
      add('warn', `staging.${name}.http`, `staging ${name} is not available`, page.status || page.error);
      continue;
    }
    const meta = inspectPage(page.body);
    if (!meta.canonical || !meta.ogUrl) add('warn', `staging.${name}.identity`, `staging ${name} lacks canonical/og:url`);
  }
  if (stageHome.ok && inspectEvidence(stageHome.body).length) add('warn', 'staging.desk-evidence', 'staging root does not contain the current valid evidence bundle');
  if (!redirectsArePermanent(stageLegacy.chain, `${staging}/?dg_probe=1`)) add('warn', 'staging.dasha-redirect', 'staging /dasha must permanently redirect to / and preserve its query string', stageLegacy.chain);
  if (!stageRobots.ok || !robotsBlocksRoot(stageRobots.body)) add('warn', 'staging.robots', 'staging must remain blocked from indexing');

  const hasFailures = findings.some((item) => item.level === 'fail');
  const hasWarnings = findings.some((item) => item.level === 'warn');
  return { at: new Date().toISOString(), mode, status: hasFailures ? 'FAIL' : hasWarnings ? 'WARN' : 'PASS', ready: mode === 'launch' && !hasFailures, canonical, dns: { apex: apexDns, www: wwwDns }, findings: findings.sort((a, b) => `${a.level}:${a.code}:${a.message}`.localeCompare(`${b.level}:${b.code}:${b.message}`)) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv.includes('--launch') ? 'launch' : 'prelaunch';
  const result = await checkLaunch({ mode });
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    for (const item of result.findings) console.log(`${item.level.toUpperCase()} ${item.code}: ${item.message}`);
    console.log(`Dasha ${mode}: ${result.status} · ${result.findings.filter((item) => item.level === 'fail').length} failures · ${result.findings.filter((item) => item.level === 'warn').length} warnings`);
  }
  if (result.status === 'FAIL') process.exitCode = 1;
}
