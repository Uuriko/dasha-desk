import { readFile, writeFile } from 'node:fs/promises';

const read = async (path) => (await readFile(new URL(path, import.meta.url), 'utf8')).trimEnd();
const body = await read('./src/body.html');
const css = await read('./src/styles.css');
const js = await read('./src/app.js');

const meta = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>$dasha desk — inspect mint evidence · Solana</title>
<meta name="description" content="Unofficial promotional desk for an associated $dasha mint. Inspect cited sources and exact-pair data. Operator position and compensation not disclosed. Can go to zero."/>
<meta name="robots" content="noindex,follow"/>
<meta name="theme-color" content="#07060a"/>
<meta property="og:title" content="$dasha desk — evidence before action"/>
<meta property="og:description" content="Unofficial promotional desk for an associated mint. Operator position and compensation not disclosed. Inspect cited evidence; association is not endorsement."/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="$dasha desk — evidence before action"/>
<meta name="twitter:description" content="Unofficial promotional desk. Operator position and compensation not disclosed. Association ≠ endorsement; can go to zero."/>`;

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

if (process.argv.includes('--write')) {
  await Promise.all(
    Object.entries(files).map(([path, text]) => writeFile(new URL(path, import.meta.url), text)),
  );
  console.log(
    JSON.stringify({
      ok: true,
      wrote: Object.keys(files),
      bytes: Object.fromEntries(Object.entries(files).map(([p, t]) => [p, t.length])),
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
