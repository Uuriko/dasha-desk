import { readFile, writeFile } from 'node:fs/promises';

const read = async (path) => (await readFile(new URL(path, import.meta.url), 'utf8')).trimEnd();
const body = await read('./src/body.html');
const css = await read('./src/styles.css');
const js = await read('./src/app.js');
const standaloneBody = body
  .replaceAll('href="/studio"', 'href="https://www.getdasha.com/studio"')
  .replaceAll('href="/dasha"', 'href="https://www.getdasha.com/dasha"')
  .replaceAll('href="/"', 'href="https://www.getdasha.com/"');

const meta = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>$dasha desk — verify, chart, buy</title>
<meta name="description" content="Verify the associated $dasha mint, inspect independent sources and open the single Jupiter buy route."/>
<link rel="canonical" href="https://www.getdasha.com/dasha"/>
<link rel="icon" type="image/png" sizes="32x32" href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/6a767a48e1dd29d210f01235_dasha-icon-32.png"/>
<link rel="apple-touch-icon" sizes="180x180" href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/6a767a48cdcf3c87b29fc830_dasha-icon-180.png"/>
<meta name="theme-color" content="#07060a"/>
<meta property="og:title" content="$dasha desk — verify, chart, buy"/>
<meta property="og:description" content="Check the mint. Inspect sources."/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://www.getdasha.com/dasha"/>
<meta property="og:image" content="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/6a773b5a0a2303b170ea67c0_dasha-social-card-v3.png"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="Dasha remix Studio card with three colorful editable artifact previews."/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="$dasha desk — verify, chart, buy"/>
<meta name="twitter:description" content="Check the mint. Inspect sources."/>
<meta name="twitter:image" content="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/6a773b5a0a2303b170ea67c0_dasha-social-card-v3.png"/>`;

const pageEnd = '</body>\n</html>\n';

const files = {
  './src/app.html': `${body}\n<style>\n${css}\n</style>\n<script>\n${js}\n</script>\n`,
  './index.html': `${meta}
<link rel="stylesheet" href="src/styles.css"/>
<style>html,body{margin:0;padding:0;background:#07060a;min-height:100%}</style>
</head>
<body>
${standaloneBody}
<script src="src/app.js"></script>
${pageEnd}`,
  './dist/index.html': `${meta}
<style>html,body{margin:0;padding:0;background:#07060a;min-height:100%}
${css}
</style>
</head>
<body>
${standaloneBody}
<script>
${js}
</script>
${pageEnd}`,
};

const shell =
  '<div style="min-height:100vh;background:radial-gradient(1200px 700px at 50% -10%,#2a1840 0%,#0b0a10 50%,#07060a 100%);padding:8px 0 28px">' +
  files['./src/app.html'] +
  '</div>';

if (process.argv.includes('--write')) {
  await Promise.all(
    Object.entries(files).map(([path, text]) => writeFile(new URL(path, import.meta.url), text)),
  );
  await writeFile('/tmp/dasha-webflow-embed.html', shell);
  console.log(
    JSON.stringify({
      ok: true,
      wrote: Object.keys(files),
      embed: '/tmp/dasha-webflow-embed.html',
      bytes: Object.fromEntries(
        Object.entries(files).map(([p, t]) => [p, t.length]).concat([['embed', shell.length]]),
      ),
    }),
  );
} else {
  const stale = [];
  for (const [path, expected] of Object.entries(files)) {
    const onDisk = await read(path);
    if (onDisk !== expected.trimEnd()) stale.push(path);
  }
  if (stale.length) {
    console.error('stale generated files:', stale.join(', '), '— run: node build.mjs --write');
    process.exit(1);
  }
  console.log('Dasha builds: PASS');
}
