import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function read(rel) {
  return readFile(new URL(rel, root), "utf8");
}

test("compute console hop-up is Typeform-first, then a panel", async () => {
  const page = await read("console/app/page.tsx");
  const css = await read("console/app/globals.css");
  const readme = await read("README.md");
  const consoleReadme = await read("console/README.md");
  const sourceMap = await read("SOURCE_MAP.md");
  const index = await read("index.html");

  assert.match(page, /Use or Provide/);
  assert.match(page, />Use</);
  assert.match(page, />Provide</);
  assert.match(page, /"Run"/);
  assert.match(page, /door === null/);
  assert.match(page, /opened &&/);
  assert.match(page, /Night/);
  assert.match(page, /Build/);
  assert.match(page, /providers_online/);

  assert.doesNotMatch(page, /const NAV/);
  assert.doesNotMatch(page, /product-nav/);
  assert.doesNotMatch(page, /four-tab|Request lab|nav-card/);
  assert.doesNotMatch(page, /phase:\s*["']checking["']/);
  assert.doesNotMatch(page, /checking hosted|Checking…|checking chips/i);
  assert.doesNotMatch(css, /checking/i);

  assert.match(page, /Workers AI/);
  assert.match(page, /https:\/\/lobby\.getdasha\.com\/compute\/api/);
  assert.doesNotMatch(page, /compute\.getdasha\.com/);

  assert.match(page, /0600/);
  assert.match(page, /\.dasha-provider-key/);
  assert.doesNotMatch(page, /DASHA_PROVIDER_KEY=/);

  assert.match(readme, /First paint is one step/);
  assert.match(readme, /Use.*Provide/s);
  assert.match(readme, /Workers AI/);
  assert.match(readme, /0600/);
  assert.match(readme, /lobby\.getdasha\.com\/compute\/api/);

  assert.match(consoleReadme, /hop-up/);
  assert.match(consoleReadme, /Worker/);
  assert.doesNotMatch(consoleReadme, /console\.getdasha\.com|compute\.getdasha\.com/);

  assert.match(sourceMap, /hop-up/);
  assert.match(index, /Use or Provide/);
});
