import {
  JUP_TOKENS,
  MINT,
  SAME_AS,
  SITE,
} from './identity.js';

const OTHER_COIN_WARNING = /VVAIFU|Not CoinGecko/i;
const BLOCK = /<(p|div|section|aside|span|li|small|strong|em|h[1-6])(\s[^>]*)?>[\s\S]*?<\/\1>/gi;

function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '$dasha',
    url: SITE,
    description: `$dasha on getdasha.com. dash_eats. Mint ${MINT}.`,
    sameAs: SAME_AS,
  };
}

/**
 * Home must not carry the other-coin / Not CoinGecko warning.
 * That copy belongs on /which, not first paint.
 */
export function stripHomeOtherCoinWarning(html) {
  let out = String(html);
  out = out.replace(/<!--[\s\S]*?-->/g, (comment) => (
    OTHER_COIN_WARNING.test(comment) ? '' : comment
  ));
  out = out.replace(BLOCK, (block) => (
    OTHER_COIN_WARNING.test(block) ? '' : block
  ));
  out = out.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi, (full, raw) => {
    if (!OTHER_COIN_WARNING.test(raw)) return full;
    try {
      const data = JSON.parse(raw);
      const scrub = (value) => {
        if (typeof value === 'string') {
          return value
            .replace(/\bVVAIFU\b/gi, '')
            .replace(/Not CoinGecko/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        }
        if (Array.isArray(value)) return value.map(scrub);
        if (value && typeof value === 'object') {
          const next = {};
          for (const [key, item] of Object.entries(value)) next[key] = scrub(item);
          return next;
        }
        return value;
      };
      return `<script type="application/ld+json">${JSON.stringify(scrub(data))}</script>`;
    } catch {
      return '';
    }
  });
  out = out.replace(/\bVVAIFU\b/gi, '');
  out = out.replace(/Not CoinGecko/gi, '');
  return out;
}

function rewritePluginJupiter(html) {
  return String(html)
    .replace(/https?:\/\/plugin\.jup\.ag\/[^\s"'<>]*/gi, JUP_TOKENS)
    .replace(/plugin\.jup\.ag/gi, 'jup.ag');
}

function rewriteHomeSameAs(html) {
  const script = `<script type="application/ld+json">${JSON.stringify(websiteLd())}</script>`;
  let replaced = false;
  const next = String(html).replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
    (full, raw) => {
      try {
        const data = JSON.parse(raw);
        const types = [].concat(data['@type'] || []);
        if (types.includes('WebSite')) {
          replaced = true;
          data.sameAs = SAME_AS.slice();
          data.url = SITE;
          if (!data.name) data.name = '$dasha';
          if (!data.description) {
            data.description = `$dasha on getdasha.com. dash_eats. Mint ${MINT}.`;
          }
          return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
        }
      } catch {
        return full;
      }
      return full;
    },
  );
  if (replaced) return next;
  if (/<\/head>/i.test(next)) return next.replace(/<\/head>/i, `${script}</head>`);
  return script + next;
}

function ensureFirstPaint(html) {
  const match = String(html).match(/<body[^>]*>([\s\S]{0,2500})/i);
  const head = match ? match[1] : '';
  const hasBrand = /\$dasha/i.test(head) || /\$<b>dasha<\/b>/i.test(head);
  const hasBuy = />\s*Buy(\s+\$dasha)?[^<]*</i.test(head);
  if (hasBrand && hasBuy) return html;
  const bar = `<header class="bar"><a class="word" href="${SITE}">$dasha</a><a class="buy" href="${JUP_TOKENS}" rel="noopener noreferrer">Buy</a></header>`;
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, `<body$1>${bar}`);
  return bar + html;
}

/** Origin HTML → live home contract. */
export function rewriteHome(html) {
  let out = String(html);
  out = rewritePluginJupiter(out);
  out = rewriteHomeSameAs(out);
  out = stripHomeOtherCoinWarning(out);
  out = ensureFirstPaint(out);
  out = rewritePluginJupiter(out);
  return out;
}
