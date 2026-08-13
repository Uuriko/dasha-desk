#!/usr/bin/env node
/**
 * Inlined bounties fragment for a Webflow HTML embed. Do not iframe the board.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const here = (f) => new URL(`./${f}`, import.meta.url);

export async function buildBountiesEmbed() {
  const html = await readFile(here('index.html'), 'utf8');
  const css = await readFile(here('board.css'), 'utf8');
  const js = await readFile(here('board.js'), 'utf8');
  const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
  const inner = body.replace(
    '<script src="./board.js"></script>',
    `<script>\n${js.trimEnd()}\n</script>`,
  );
  if (inner.includes('<iframe')) throw new Error('bounties embed must not contain an iframe');
  return `<!-- dasha bounties — GENERATED. Paste into Webflow as an HTML embed. Do not iframe. -->\n<style>\n${css.trimEnd()}\n</style>\n${inner.trim()}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const embed = await buildBountiesEmbed();
  if (process.argv.includes('--check')) {
    const onDisk = await readFile(here('app.html'), 'utf8').catch(() => '');
    if (onDisk !== embed) {
      console.error('bounties/app.html is STALE — run: node bounties/embed-build.mjs');
      process.exit(1);
    }
    console.log('bounties/app.html is current');
  } else {
    await writeFile(here('app.html'), embed);
    console.log(`wrote app.html (${embed.length} chars)`);
  }
}
