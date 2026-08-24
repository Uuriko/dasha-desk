/**
 * Public $dasha / dash_eats identity. These are on-chain and site URLs, not secrets.
 * Never put faucet signers, treasury dests, or Cloudflare account fields here.
 */
export const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
export const LP_MINT = '8GDvsE3NbiKuo5uUFR9zgRY76mdhXuJfeDsy8hn7h3Aj';
export const OTHER_MINT = 'FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8';

export const SITE = 'https://www.getdasha.com/';
export const SITE_ORIGIN = 'https://www.getdasha.com';
export const X_URL = 'https://x.com/dash_eats';
export const TG_URL = 'https://t.me/+xB7S8mIQaKFiZjRh';
export const JUP_TOKENS = `https://jup.ag/tokens/${MINT}`;
export const JUP_SWAP = `https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}`;
export const COINGECKO = 'https://www.coingecko.com/en/coins/dash_eats';
export const SOLSCAN = `https://solscan.io/token/${MINT}`;
export const GECKO_POOL = `https://www.geckoterminal.com/solana/pools/${PAIR}`;
export const MINT_SOURCE = 'https://x.com/dash_eats/status/2085405228078432279';
export const OG_IMAGE = 'https://lobby.getdasha.com/og/dasha-social-card.png';

export const SAME_AS = [X_URL, SITE, JUP_TOKENS];

export const HOME_308 = Object.freeze([
  '/studio',
  '/privacy',
  '/dasha',
  '/desk',
  '/verse',
  '/learn',
]);

export const SITEMAP_PATHS = Object.freeze([
  '/',
  '/simp',
  '/lobby',
  '/faucet',
  '/bounties',
  '/contribute',
  '/how-to-buy',
  '/chess',
  '/which',
  '/bag',
  '/llms.txt',
  '/llms-full.txt',
  '/ai.txt',
]);
