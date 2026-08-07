import { readFile, writeFile } from 'node:fs/promises';

const read = async (path) => (await readFile(new URL(path, import.meta.url), 'utf8')).trimEnd();
const body = await read('./src/body.html');
const css = await read('./src/styles.css');
const js = await read('./src/app.js');

const TOKEN_IMG = 'https://files.catbox.moe/gpjyb0.jpg';

const meta = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>$dasha desk — buy, chart, share · Solana</title>
<meta name="description" content="$dasha mint desk: copy CA, buy on Jupiter, chart on Dexscreener, share raid packs. Culture coin on Solana. Can go to zero. NFA. Association ≠ endorsement."/>
<meta name="robots" content="noindex,follow"/>
<meta name="theme-color" content="#07060a"/>
<meta property="og:title" content="$dasha — casino open"/>
<meta property="og:description" content="How u crying at the casino and u can’t even get in. Copy the mint. Buy · chart · share. NFA."/>
<meta property="og:image" content="${TOKEN_IMG}"/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="$dasha — casino open"/>
<meta name="twitter:description" content="Copy CA · Buy Jupiter · Chart Dex · Share pack. NFA."/>
<meta name="twitter:image" content="${TOKEN_IMG}"/>`;

const pageEnd = '</body>\n</html>\n';

const files = {
  './src/app.html': `${body}\n<style>\n${css}\n</style>\n<script>\n${js}\n</script>\n`,
  './index.html': `${meta}
<link rel="stylesheet" href="src/styles.css"/>
<style>html,body{margin:0;padding:0;background:#07060a;min-height:100%}</style>
</head>
<body>
${body}
<script src="src/app.js"></script>
${pageEnd}`,
  './dist/index.html': `${meta}
<style>html,body{margin:0;padding:0;background:#07060a;min-height:100%}
${css}
</style>
</head>
<body>
${body}
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
