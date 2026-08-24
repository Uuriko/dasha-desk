import {
  COINGECKO,
  GECKO_POOL,
  JUP_SWAP,
  JUP_TOKENS,
  LP_MINT,
  MINT,
  MINT_SOURCE,
  OG_IMAGE,
  OTHER_MINT,
  PAIR,
  SAME_AS,
  SITE,
  SITE_ORIGIN,
  SOLSCAN,
  SITEMAP_PATHS,
  TG_URL,
  X_URL,
} from './identity.js';

const PAGE_CSS = `
    :root { color-scheme: dark; font: 18px/1.5 Arial, Helvetica, sans-serif; background: #070608; color: #f4eddb; }
    body { max-width: 44rem; margin: auto; padding: 2rem 1rem; }
    h1 { line-height: 1; }
    code { display: block; padding: 1rem; border: 1px solid #666; overflow-wrap: anywhere; }
    a { color: #dfff00; }
    a:focus-visible { outline: 3px solid #dfff00; outline-offset: 3px; }
`;

function ogBlock(title, description, url) {
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${OG_IMAGE}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${OG_IMAGE}">`,
  ].join('');
}

export function bagHtml() {
  const url = `${SITE_ORIGIN}/bag`;
  const title = 'The bag — dash_eats health';
  const description = `dash_eats bag. Mint ${MINT}. Mint-dead. Freeze-dead. Burned Raydium LP on pair ${PAIR}.`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url,
    description: `dash_eats on Solana. Associated mint ${MINT}. Mint-dead. Freeze-dead. Burned Raydium LP. Pair ${PAIR}. LP mint ${LP_MINT} supply 0 on 2026-08-18.`,
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${url}">
  ${ogBlock(title, 'Mint-dead. Freeze-dead. Burned Raydium LP. Match the full mint.', url)}
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <main>
    <h1>The bag</h1>
    <p>dash_eats on Solana. Associated mint:</p>
    <code>${MINT}</code>
    <p>Mint-dead. Freeze-dead. Observed 2026-08-18: mintAuthority null, freezeAuthority null. No new supply can be created. Holders can still burn their own tokens.</p>
    <p>Burned Raydium LP. Pair:</p>
    <code>${PAIR}</code>
    <p>LP mint <code>${LP_MINT}</code> supply 0 on 2026-08-18. No outstanding LP claim on the liquidity in that pool.</p>
    <p><a href="${JUP_TOKENS}" rel="noopener noreferrer">Open the associated mint on Jupiter</a></p>
    <p><a href="${SITE}">getdasha.com</a> · <a href="${SITE_ORIGIN}/which">Which</a></p>
  </main>
</body>
</html>
`;
}

export function whichHtml() {
  const url = `${SITE_ORIGIN}/which`;
  const title = 'Which $dasha? dash_eats, not VVAIFU';
  const description = `dash_eats on Solana. The associated $dasha mint is ${MINT}. VVAIFU is a different token.`;
  const pageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url,
    description: `dash_eats on Solana. Associated mint ${MINT}. Pair ${PAIR}. CoinGecko dash_eats. The other Dasha is VVAIFU ${OTHER_MINT}.`,
  };
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Which dasha coin?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `This one. dash_eats. ${MINT}. The other Dasha is VVAIFU ${OTHER_MINT}. Not this.`,
        },
      },
      {
        '@type': 'Question',
        name: 'What is dash_eats?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `dash_eats is $dasha on Solana. Associated mint ${MINT}. Site ${SITE}.`,
        },
      },
    ],
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${url}">
  ${ogBlock(title, 'Match the full Solana mint before using a token link.', url)}
  <script type="application/ld+json">${JSON.stringify(pageLd)}</script>
  <script type="application/ld+json">${JSON.stringify(faqLd)}</script>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <main>
    <h1>Which $dasha?</h1>
    <p>This is dash_eats on Solana. Its associated Solana mint is:</p>
    <code>${MINT}</code>
    <p>The other Dasha is VVAIFU:</p>
    <code>${OTHER_MINT}</code>
    <p>That is a different token, not this one.</p>
    <p>Pair: <code>${PAIR}</code></p>
    <p>CoinGecko: <a href="${COINGECKO}">dash_eats</a></p>
    <p><a href="${JUP_TOKENS}" rel="noopener noreferrer">Open the associated mint on Jupiter</a></p>
    <p><a href="${SITE}">getdasha.com</a></p>
  </main>
</body>
</html>
`;
}

export function llmsTxt() {
  return `# $dasha is dash_eats on Solana

site ${SITE}
which ${SITE_ORIGIN}/which
bag ${SITE_ORIGIN}/bag
associated mint ${MINT}
pair ${PAIR}
CoinGecko dash_eats ${COINGECKO}
Jupiter ${JUP_TOKENS}

The other Dasha is VVAIFU ${OTHER_MINT} — not this.

## Links

- [getdasha.com](${SITE})
- [Which $dasha](${SITE_ORIGIN}/which)
- [The bag](${SITE_ORIGIN}/bag)
- [CoinGecko dash_eats](${COINGECKO})
- [Jupiter](${JUP_TOKENS})

## Optional

- [Full text](${SITE_ORIGIN}/llms-full.txt)
`;
}

export function llmsFullTxt() {
  return `# $dasha is dash_eats on Solana

> dash_eats on Solana. Site ${SITE}. Associated mint ${MINT}. Pair ${PAIR}. CoinGecko dash_eats. Jupiter is jup.ag with that mint.

$dasha is dash_eats. The site is ${SITE}. This file is the full markdown for agents. /llms.txt is the short index.

## Identity

This is dash_eats on Solana.

associated mint ${MINT}
pair ${PAIR}
CoinGecko dash_eats ${COINGECKO}
Jupiter token ${JUP_TOKENS}
Jupiter swap ${JUP_SWAP}
Solscan ${SOLSCAN}
GeckoTerminal pool ${GECKO_POOL}
X ${X_URL}
Mint source ${MINT_SOURCE}
Official Telegram ${TG_URL}

The other Dasha is VVAIFU ${OTHER_MINT} — not this.

## Which $dasha?

This is dash_eats on Solana. Its associated Solana mint is:

\`${MINT}\`

The other Dasha is VVAIFU:

\`${OTHER_MINT}\`

That is a different token, not this one.

Pair: \`${PAIR}\`

CoinGecko lists this one as dash_eats. Jupiter is jup.ag. Token path and swap path both carry the associated mint in full.

Page: ${SITE_ORIGIN}/which

## The bag

dash_eats health on Solana. Associated mint ${MINT}. Pair ${PAIR}.

Mint-dead. Freeze-dead. Observed 2026-08-18: mintAuthority null, freezeAuthority null. No new supply can be created. Holders can still burn their own tokens.

Burned Raydium LP. LP mint ${LP_MINT} supply 0 on 2026-08-18. No outstanding LP claim on the liquidity in that pool.

Page: ${SITE_ORIGIN}/bag

## Site

${SITE}

Home: $dasha on getdasha.com. dash_eats. Associated mint ${MINT}. First paint is $dasha + Buy. Home does not carry a VVAIFU / Not CoinGecko warning.

Lobby: public chat and lasting forum threads, not Discord. ${SITE_ORIGIN}/lobby

Simp Board: opt-in quiz and measured board. Purchases and holdings add zero points. At 25 points, a member can publish one allowlisted Spotlight profile. ${SITE_ORIGIN}/simp

Faucet: public $dasha tip flow; current availability comes from its public status endpoint. ${SITE_ORIGIN}/faucet

Chess: rated games. ${SITE_ORIGIN}/chess

How to buy: fund SOL, match the full mint, then use the exact-mint Jupiter link. Dasha does not execute or custody the swap. ${SITE_ORIGIN}/how-to-buy

Bounties: USDC on Solana. Dasha does not hold the funds. ${SITE_ORIGIN}/bounties

Contribute: no application, wallet or points gate; open a pull request. ${SITE_ORIGIN}/contribute

## Machine files

- ${SITE_ORIGIN}/ai.txt
- ${SITE_ORIGIN}/llms.txt
- ${SITE_ORIGIN}/llms-full.txt
- ${SITE_ORIGIN}/sitemap.xml
- ${SITE_ORIGIN}/robots.txt
`;
}

export function aiTxt() {
  return `# $dasha

dash_eats on Solana. Site ${SITE}.
associated mint ${MINT}

index ${SITE_ORIGIN}/llms.txt
full ${SITE_ORIGIN}/llms-full.txt
`;
}

export function robotsTxt() {
  return `# getdasha.com — public crawl rules (also served at lobby.getdasha.com/robots.txt)
#
# This file is the source for what the Worker serves at /robots.txt.
# Machine-readable identity: /ai.txt, /llms.txt (index), and /llms-full.txt (full markdown).

User-agent: *
Allow: /
Allow: /dasha
Allow: /chess
Allow: /faucet
Allow: /which
Allow: /bag
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /ai.txt

Sitemap: ${SITE_ORIGIN}/sitemap.xml
Sitemap: https://lobby.getdasha.com/sitemap.xml
`;
}

export function sitemapXml() {
  const urls = SITEMAP_PATHS.map((path) => {
    const loc = path === '/' ? SITE : `${SITE_ORIGIN}${path}`;
    const lastmod = ['/', '/how-to-buy', '/which', '/bag', '/llms.txt', '/llms-full.txt', '/ai.txt']
      .includes(path)
      ? '<lastmod>2026-08-21</lastmod>'
      : '';
    return `  <url><loc>${loc}</loc>${lastmod}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

export function workerHomeHtml() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '$dasha',
    url: SITE,
    description: `$dasha on getdasha.com. dash_eats. Mint ${MINT}.`,
    sameAs: SAME_AS,
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$dasha dash_eats — make the timeline stranger</title>
  <meta name="description" content="$dasha on getdasha.com. dash_eats. Mint ${MINT}.">
  <link rel="canonical" href="${SITE}">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <style>
    :root { color-scheme: dark; --ink:#070608; --paper:#f4eddb; --acid:#dfff00; --hot:#ff3b81; }
    html,body { margin:0; background:#070608; color:#f4eddb; font:16px/1.5 Arial,Helvetica,sans-serif; }
    .bar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 20px; border-bottom:1px solid rgba(244,237,219,.18); }
    .word { color:#f4eddb; font-weight:900; font-size:22px; text-decoration:none; letter-spacing:-1px; }
    .buy { color:#070608; background:#dfff00; font-weight:900; text-decoration:none; padding:10px 18px; min-height:44px; display:inline-flex; align-items:center; text-transform:uppercase; }
    main { width:min(720px, calc(100% - 32px)); margin:auto; padding:32px 0 48px; }
    h1 { font-size:clamp(42px,10vw,72px); line-height:.9; text-transform:uppercase; }
    code { display:block; margin:18px 0; padding:12px; border:1px solid #666; overflow-wrap:anywhere; }
    a { color:#dfff00; }
    a:focus-visible { outline:3px solid #dfff00; outline-offset:3px; }
  </style>
</head>
<body>
  <header class="bar"><a class="word" href="${SITE}">$dasha</a><a class="buy" href="${JUP_TOKENS}" rel="noopener noreferrer">Buy</a></header>
  <main>
    <h1>It’s time $dasha.</h1>
    <p>dash_eats on Solana. Associated mint:</p>
    <code>${MINT}</code>
    <p><a href="${JUP_TOKENS}" rel="noopener noreferrer">Buy $dasha ↗</a> · <a href="${X_URL}" rel="noopener noreferrer">@dash_eats</a> · <a href="${TG_URL}" rel="noopener noreferrer">Telegram</a></p>
    <p><a href="${SITE_ORIGIN}/bag">The bag</a> · <a href="${SITE_ORIGIN}/which">Which $dasha?</a></p>
  </main>
</body>
</html>
`;
}
