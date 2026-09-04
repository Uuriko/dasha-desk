#!/usr/bin/env node
/**
 * Structural proof that public OSS entry docs stay contribution-ready.
 * Drives real files on disk (not hardcoded product copy beyond keywords).
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), 'utf8');

assert.ok(existsSync(join(root, 'README.md')), 'README.md missing');
assert.ok(existsSync(join(root, 'CONTRIBUTING.md')), 'CONTRIBUTING.md missing');
assert.ok(existsSync(join(root, 'LICENSE')), 'LICENSE missing');

const readme = read('README.md');
const contrib = read('CONTRIBUTING.md');
const roadmap = read('docs/ROADMAP.md');
const deploy = read('docs/DEPLOY.md');
const archive = read('docs/ARCHIVE.md');
const studio = read('studio/README.md');
const status = read('docs/STATUS.md');
const architecture = read('docs/ARCHITECTURE.md');
const bible = read('docs/DASHA-BIBLE.md');
const bibleOwner = bible.split('\n').find((line) => line.startsWith('**Owner surfaces:**')) || '';
const issueConfig = read('.github/ISSUE_TEMPLATE/config.yml');
const ideaTemplate = read('.github/ISSUE_TEMPLATE/idea.yml');
const bugTemplate = read('.github/ISSUE_TEMPLATE/bug.yml');
const pullTemplate = read('.github/PULL_REQUEST_TEMPLATE.md');
const watch = read('watch.mjs');
const workflows = ['watch.yml', 'verify.yml', 'pages.yml'].map((name) => read(`.github/workflows/${name}`));
const dependabot = read('.github/dependabot.yml');

assert.match(readme, /contribute|community|pull request/i, 'README must invite contribution');
assert.match(readme, /open-source project|project contributor|open a pull request/i, 'README must frame OSS project contribution');
assert.match(readme, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'README must link GitHub /contribute');
assert.match(readme, /\$dasha|dasha/i, 'README must name the product');
assert.match(readme, /src\/body\.html|src\/app\.js|generated/i, 'README should point at sources or generated surfaces');
assert.match(readme, /Worker-first getdasha\.com/, 'README must say this is Worker-first getdasha.com');
assert.match(readme, /same product as the static desk files already here/, 'README must say Worker and static desk are the same product');
assert.match(readme, /Do not invent a Worker here/, 'README must forbid inventing a Worker here');
assert.match(readme, /Do not wrangler-deploy from here/, 'README must forbid wrangler-deploy from here');
assert.match(readme, /getdasha\.com\/compute/, 'README must link live Compute Ask');
assert.match(readme, /getdasha\.com\/compute\/ocm\/provider/, 'README must link the Host guide');
assert.match(readme, /getdasha\.com\/compute\/ocm/, 'README must link the OCM marketplace');
assert.ok(existsSync(join(root, 'ocm')), 'ocm/ must be present on main');
assert.match(readme, /On `main` \(MIT\)/, 'README must say ocm/ is on main (MIT)');
assert.doesNotMatch(readme, /Not on `main` yet/, 'README must not claim ocm/ is absent from main');
assert.match(readme, /#76/, 'README must name #76 as the landed OCM path');
assert.match(readme, /#131/, 'README must name #131 as the landed OCM path');
assert.match(readme, /Do not merge raw \[#44\]/, 'README must forbid merging raw #44');
assert.match(readme, /#44[\s`]*was closed/, 'README must say #44 was closed, not merged');
assert.doesNotMatch(readme, /lands through|lands via/, 'README must not say ocm/ still lands through an open PR');
assert.match(readme, /docs\/COMPUTE\.md/, 'README must link the Ask vs Provide vs Host one-pager');

const computeJobs = read('docs/COMPUTE.md');
assert.match(computeJobs, /\bAsk\b[\s\S]*\bProvide\b[\s\S]*\bHost\b/, 'COMPUTE.md must name Ask, Provide, and Host');
assert.match(computeJobs, /getdasha\.com\/compute/, 'COMPUTE.md must link live Ask');
assert.match(computeJobs, /getdasha\.com\/compute\/ocm\/provider/, 'COMPUTE.md must link the Host guide');
assert.match(computeJobs, /getdasha\.com\/compute\/ocm/, 'COMPUTE.md must link the OCM marketplace');
assert.match(computeJobs, /dasha-compute-open-alpha/, 'COMPUTE.md must name the Provide open-alpha kit');
assert.match(computeJobs, /open-alpha kit/, 'COMPUTE.md must say compute/ is the open-alpha kit');
assert.match(computeJobs, /On `main`/, 'COMPUTE.md must say ocm/ is on main');
assert.match(computeJobs, /#76/, 'COMPUTE.md must name #76 as the landed OCM path');
assert.match(computeJobs, /#131/, 'COMPUTE.md must name #131 as the landed OCM path');
assert.match(computeJobs, /#44[\s`]*was closed/, 'COMPUTE.md must say #44 was closed, not merged');
assert.match(computeJobs, /Do not merge #44/, 'COMPUTE.md must forbid merging #44');
assert.match(computeJobs, /Not cloned/, 'COMPUTE.md must say the Worker is not cloned here');
assert.match(computeJobs, /can read prompts/, 'COMPUTE.md must say providers can read prompts');
assert.match(computeJobs, /not money/, 'COMPUTE.md must say OCM credits are not money');
assert.doesNotMatch(computeJobs, /Not on `main` yet/, 'COMPUTE.md must not claim ocm/ is absent from main');
assert.doesNotMatch(computeJobs, /lands through|lands via/, 'COMPUTE.md must not say ocm/ still lands through an open PR');
assert.ok(computeJobs.trim().split(/\n/).length <= 45, 'COMPUTE.md one-pager must stay short');

const ocmReadme = read('ocm/README.md');
assert.match(ocmReadme, /landed on `main`/, 'ocm/README must say OCM landed on main');
assert.match(ocmReadme, /#44[`\s]*was closed/, 'ocm/README must say #44 was closed, not merged');
assert.doesNotMatch(ocmReadme, /Maintainer undraft and merge of #76/, 'ocm/README must not treat #76 as still open');
assert.doesNotMatch(ocmReadme, /merge go through/, 'ocm/README must not treat #76 as the still-open merge path');
assert.match(readme, /getdasha\.com\/how-to-buy/, 'README must link live how-to-buy');
assert.match(readme, /`\/desk` and `\/dasha` (go|308|redirect)/, 'README must say /desk and /dasha go to /how-to-buy');
assert.doesNotMatch(readme, /\[Use it ↗\]\(https:\/\/www\.getdasha\.com\/studio\)/, 'README must not advertise live /studio');
assert.match(readme, /getdasha\.com\/simp/, 'README must link the Simp Board');
assert.match(readme, /getdasha\.com\/privacy/, 'README must link privacy');
assert.match(readme, /getdasha\.com\/bounties/, 'README must link the bounties board');
assert.doesNotMatch(readme, /getdasha\.com\/#oss/, 'README must not link the retired #oss anchor');
assert.match(readme, /desk-demo\.(gif|png)/, 'README must embed demo visual');
assert.match(readme, /Uploaded or\s+externally sourced images keep their own rights/i, 'README must bound Studio image rights');
assert.match(readme, /docs\/STATUS\.md/, 'README must link docs/STATUS.md (live www vs experimental)');

assert.ok(existsSync(join(root, 'docs/STATUS.md')), 'docs/STATUS.md missing');
assert.match(status, /2026-09-04/, 'STATUS must be dated from the live curl');
assert.match(status, /curl/, 'STATUS must say the routes were curled');
assert.match(status, /Live Worker/, 'STATUS must name live Worker surfaces');
assert.match(status, /Experimental open-alpha kit/, 'STATUS must mark compute/ as the experimental kit, not the Worker');
assert.match(status, /#76/, 'STATUS must say ocm/ landed via #76');
assert.match(status, /#131/, 'STATUS must mention #131 in the ocm landing stack');
assert.match(status, /#44/, 'STATUS must mention raw #44');
assert.match(status, /closed, not merged/, 'STATUS must say raw #44 was closed, not merged');
assert.match(status, /\/compute\/ocm/, 'STATUS must include the live OCM console');
assert.match(status, /\/compute\/ocm\/provider/, 'STATUS must include the live OCM provider page');
assert.match(status, /308/, 'STATUS must record www /studio as 308 home');
assert.match(status, /Local \/ Pages only/, 'STATUS must mark studio/ as local/Pages only');
assert.doesNotMatch(status, /www `\/compute`[^\n]*[Rr]etired/, 'STATUS must not mark live /compute as retired');
assert.doesNotMatch(architecture, /compute retired/, 'ARCHITECTURE must not claim /compute is retired');
assert.match(bibleOwner, /\/compute/, 'BIBLE owner surfaces must list live /compute');
assert.doesNotMatch(bibleOwner, /\/compute` retired/, 'BIBLE owner surfaces must not claim /compute is retired');
for (const match of bible.matchAll(/\/compute` retired/g)) {
  const around = bible.slice(Math.max(0, match.index - 40), match.index + 80);
  assert.match(around, /historical/, 'BIBLE may quote /compute retired only as historical');
}

const noSetup = contrib.split('## No setup needed')[1]?.split('## ')[0] || '';
assert.match(noSetup, /1\. Open the file on GitHub, click the \*\*pencil\*\./, 'CONTRIBUTING No setup needed must keep step 1 (pencil)');
assert.match(noSetup, /2\. Edit it — GitHub forks the repo for you\./, 'CONTRIBUTING No setup needed must keep step 2 (fork in browser)');
assert.match(noSetup, /3\. \*\*Propose changes\*\* → \*\*Create pull request\*\./, 'CONTRIBUTING No setup needed must keep step 3 (Propose changes)');
assert.match(noSetup, /assets\/github-web-edit\.png/, 'CONTRIBUTING No setup needed must link the GitHub web-edit screenshot');
assert.match(noSetup, /compute\/README\.md/, 'CONTRIBUTING web-edit caption must name compute/README.md');
assert.match(noSetup, /[Nn]o clone required/, 'CONTRIBUTING web-edit caption must say no clone required');
assert.doesNotMatch(noSetup, /Closes #8|#8\b/, 'CONTRIBUTING must not close or retarget retired #8');
assert.ok(existsSync(join(root, 'assets/github-web-edit.png')), 'GitHub web-edit screenshot missing (assets/github-web-edit.png)');
const webEditPng = readFileSync(join(root, 'assets/github-web-edit.png'));
assert.deepEqual(
  [...webEditPng.subarray(0, 8)],
  [137, 80, 78, 71, 13, 10, 26, 10],
  'assets/github-web-edit.png must be a PNG',
);
assert.ok(webEditPng.length > 20_000, 'assets/github-web-edit.png looks empty');

assert.match(contrib, /issue|PR|pull request|fork/i, 'CONTRIBUTING must describe how to help');
assert.match(contrib, /open-source project contributor|not a payment/i, 'CONTRIBUTING must disambiguate from payment/bag');
assert.match(contrib, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'CONTRIBUTING must link /contribute');
assert.match(contrib, /getdasha\.com\/compute/, 'CONTRIBUTING must point at live Compute');
assert.match(contrib, /`ocm\/`/, 'CONTRIBUTING must include ocm/ as an in-repo surface');
assert.doesNotMatch(contrib, /getdasha\.com\/#oss/, 'CONTRIBUTING must not link the retired #oss anchor');
assert.match(contrib, /getdasha\.com\/simp/, 'CONTRIBUTING must link the Simp Board reward path');
assert.match(contrib, /not active yet[\s\S]*no current pull request earns Simp Points/i, 'CONTRIBUTING must not promise inactive OSS points');
assert.match(contrib, /maintainer applies[\s\S]*exactly one `impact:` label to the PR/i, 'CONTRIBUTING must match the PR-label scorer input');
assert.match(readme, /inactive today[\s\S]*no current\s+PR earns points/i, 'README must distinguish prepared OSS scoring from live rewards');
assert.doesNotMatch(readme, /Merged pull requests score points/, 'README claims inactive OSS points are live');
assert.match(pullTemplate, /Maintainer only:[\s\S]*exactly one impact: label or simp:no-score/i, 'PR template must leave the scorer label handoff with maintainers');

assert.match(roadmap, /## Resolved/i, 'ROADMAP must have honest Resolved section');
assert.ok(!/shipped from community|external contributors shipped/i.test(roadmap), 'ROADMAP must not invent community PR traction');
assert.match(deploy, /npm ci[\s\S]*npm test/, 'DEPLOY must run the complete public gate');
assert.doesNotMatch(archive, /\.\.\/\.\.\//, 'public docs must not link outside the repository');
assert.match(studio, /gallery fetches registered public images/i, 'Studio docs must disclose gallery networking');
assert.match(studio, /Uploaded and externally sourced photographs keep their own rights/i, 'Studio docs must bound CC0 for sourced images');
assert.ok(existsSync(join(root, 'studio/media.json')), 'Studio media manifest missing');

assert.match(issueConfig, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'issue chooser must link /contribute');
assert.match(issueConfig, /Start contributing/, 'issue chooser Start contributing contact');
assert.match(issueConfig, /name: Live Dasha[\s\S]*url: https:\/\/www\.getdasha\.com\//,
  'issue chooser must link the whole live product, not only the Desk surface');
assert.doesNotMatch(issueConfig, /getdasha\.com\/#oss/, 'issue chooser must not link the retired #oss anchor');
assert.doesNotMatch(issueConfig, /^\s+about: [^"'|>\n][^\n]*: /m,
  'issue chooser descriptions containing a colon must be quoted YAML');
assert.match(ideaTemplate, /Dasha's open-source tools/);
assert.match(ideaTemplate, /Studio \/ creative tools/);
assert.match(ideaTemplate, /Simp \/ community/);
assert.doesNotMatch(ideaTemplate, /improvement to the Desk|The Desk should/,
  'idea form must not reject non-Desk Dasha work by its framing');
assert.match(bugTemplate, /Dasha's open-source tools or docs/);
assert.doesNotMatch(bugTemplate, /on the desk or docs/i,
  'bug form must cover every repository surface');

// Demo asset for strangers (GIF or PNG)
assert.ok(
  existsSync(join(root, 'assets/desk-demo.gif')) || existsSync(join(root, 'assets/desk-demo.png')),
  'README demo visual missing (assets/desk-demo.gif|png)',
);

// Idea template path for community roadmap input
assert.ok(
  existsSync(join(root, '.github/ISSUE_TEMPLATE/idea.yml')) ||
    existsSync(join(root, 'docs/COMMUNITY.md')),
  'community idea path missing (issue template or COMMUNITY.md)',
);
assert.ok(existsSync(join(root, '.github/workflows/verify.yml')) || existsSync(join(root, '.github/workflows/pages.yml')), 'CI workflow missing');
assert.match(watch, /HOME_308/, 'watcher must 308 retired Studio/verse/learn/graph home');
assert.match(watch, /\/privacy: 308 home/, 'watcher must fail privacy 308-as-home');
assert.match(watch, /var API/, 'watcher must require chess var API');
assert.doesNotMatch(watch, /\/studio: the public-domain dedication is gone/, 'watcher must not treat retired Studio as a CC0 product page');

for (const workflow of workflows) {
  for (const line of workflow.match(/^\s*-?\s*uses:\s*.+$/gm) || []) {
    assert.match(line, /@[0-9a-f]{40}\s+#\s+v\d/, `workflow action must use a full commit SHA with a version comment: ${line.trim()}`);
  }
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}[^]*?persist-credentials: false/, 'checkout must not retain credentials');
}
for (const name of ['watch.yml', 'verify.yml']) {
  assert.match(read(`.github/workflows/${name}`), /^permissions:\n  contents: read$/m, `${name} must use a read-only token`);
}
assert.match(workflows[2], /^permissions:\n  contents: read\n  pages: write\n  id-token: write$/m, 'Pages must declare only its required deploy permissions');
for (const workflow of workflows.slice(1)) assert.match(workflow, /npm ci --ignore-scripts/, 'dependency install must disable lifecycle scripts');
assert.match(dependabot, /package-ecosystem: github-actions[\s\S]*interval: monthly/, 'Dependabot must maintain GitHub Actions monthly');
assert.match(dependabot, /package-ecosystem: npm[\s\S]*interval: monthly/, 'Dependabot must maintain npm monthly');

console.log('dasha-oss-docs: PASS');
