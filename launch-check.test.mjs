import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inspectEvidence, inspectPage, redirectsArePermanent, robotsBlocksRoot } from './launch-check.mjs';

const page = inspectPage(`<!doctype html><html><head>
  <title>Dasha Labs</title><link href="https://www.getdasha.com/" rel="canonical">
  <meta property="og:title" content="Dasha Labs"><meta content="Evidence desk" property="og:description">
  <meta property="og:url" content="https://www.getdasha.com/">
</head><body><h1>Write the <em>call</em></h1><a href="/labs">Labs</a><div id="tool"></div><a href="#tool">Tool</a></body></html>`);
assert.equal(page.h1, 'Write the call');
assert.equal(page.canonical, 'https://www.getdasha.com/');
assert.equal(page.ogDescription, 'Evidence desk');
assert.equal(page.ogImage || page.twitterImage, '');
assert.deepEqual(page.links, ['/labs', '#tool']);
assert.ok(page.ids.has('tool'));

const canonical = 'https://www.getdasha.com/';
assert.equal(redirectsArePermanent([{ url: 'http://getdasha.com/', status: 301, location: canonical }, { url: canonical, status: 200, location: null }], canonical), true);
assert.equal(redirectsArePermanent([{ url: 'http://getdasha.com/', status: 302, location: canonical }, { url: canonical, status: 200, location: null }], canonical), false);
assert.equal(redirectsArePermanent([{ url: 'https://getdasha.com/', status: 301, location: 'http://www.getdasha.com/' }, { url: 'http://www.getdasha.com/', status: 200, location: null }], canonical), false);
assert.equal(redirectsArePermanent([{ url: 'https://stage.test/dasha?dg_probe=1', status: 301, location: 'https://stage.test/?dg_probe=1' }, { url: 'https://stage.test/?dg_probe=1', status: 200, location: null }], 'https://stage.test/?dg_probe=1'), true);
assert.equal(redirectsArePermanent([{ url: 'https://stage.test/dasha?dg_probe=1', status: 301, location: 'https://stage.test/' }, { url: 'https://stage.test/', status: 200, location: null }], 'https://stage.test/?dg_probe=1'), false);
assert.equal(robotsBlocksRoot('User-agent: Other\nDisallow: /'), false);
assert.equal(robotsBlocksRoot('User-agent: *\nDisallow: /'), true);

const evidence = `<p>The digest covers only the embedded account bytes.</p><script type="application/json" id="dd-evidence-json">{"mint":"53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump","account":{"initialized":true,"decimals":6,"supply":"999831950053985","mintAuthority":null,"freezeAuthority":null,"accountDataBase64":"AAAAAAbFwc5jjSVn0mRosF65UdGijcxuEjSCtcZ1FJdw5ivyYdI3hFeNAwAGAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==","accountDataSha256":"971d6214271d7c502ccea75ded909f2830b426240aa008d2a9a01e9452152cd0"}}</script>`;
assert.deepEqual(inspectEvidence(evidence), []);
assert.ok(inspectEvidence(evidence.replace('971d6214', '071d6214')).includes('evidence.hash'));

const rc = JSON.parse(readFileSync(new URL('docs/WEBFLOW-RC.json', import.meta.url), 'utf8'));
for (const [path, expected] of Object.entries(rc.source.files)) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  assert.equal(bytes.length, expected.bytes, `${path} RC byte count`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, `${path} RC hash`);
}
assert.equal(rc.webflow.labsDraft.draft && rc.webflow.deskCandidate.draft && !rc.published, true, 'RC remains unpublished');

console.log('launch-check.test.mjs: PASS');
