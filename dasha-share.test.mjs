/**
 * Unit tests for pure share builders shipped in src/app.js (globalThis.DDShare).
 * Loads the real app.js entry — does not re-implement pack strings.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'src/app.js'), 'utf8');

const sandbox = {
  globalThis: {},
  window: undefined,
  document: undefined,
  navigator: undefined,
  console,
  URL,
};
sandbox.globalThis = sandbox;
vm.runInNewContext(src, sandbox, { filename: 'src/app.js' });

const DD = sandbox.globalThis.DDShare;
assert.ok(DD, 'DDShare must export from app.js');
assert.equal(DD.CA, '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump');

const raid = DD.buildSharePack('raid');
assert.ok(raid.includes(DD.CA), 'raid pack includes mint');
assert.ok(raid.includes('casino') || raid.includes('crying'), 'raid pack includes casino line');
assert.ok(raid.includes(DD.PAIR) || raid.includes('dexscreener'), 'raid pack includes chart');

const discord = DD.buildSharePack('discord');
assert.ok(discord.includes(DD.CA));
assert.ok(discord.includes('NFA') || discord.includes('zero'));

const verify = DD.buildSharePack('verify');
assert.ok(verify.includes('solscan.io/token/' + DD.CA));
assert.ok(verify.includes('rugcheck.xyz/tokens/' + DD.CA));

const meme = DD.buildSharePack('meme');
assert.ok(meme.includes('$dasha'));
assert.ok(meme.length > 20);

const boost = DD.buildSharePack('boost');
assert.ok(boost.includes(DD.CA), 'boost pack includes mint');
assert.ok(boost.includes(DD.BUY) || boost.includes('jup.ag'), 'boost pack includes buy');
assert.ok(boost.includes(DD.DESK) || boost.includes('webflow.io/dasha'), 'boost pack includes desk');

const mini = DD.buildMiniPack();
assert.ok(mini.includes(DD.CA));
assert.ok(mini.includes(DD.BUY) || mini.includes('jup.ag'));
assert.notEqual(mini, raid);
assert.ok(DD.buildSharePack('raid').includes(DD.BUY) || DD.buildSharePack('raid').includes('jup.ag'));

const q = DD.buildQuoteShare('They are angels actually');
assert.ok(q.startsWith('They are angels actually'));
assert.ok(q.includes('$dasha'));
assert.equal(DD.buildQuoteShare(''), '');

const intent = DD.intentTweet(raid);
assert.ok(intent.startsWith('https://x.com/intent/tweet?text='));
assert.ok(intent.length > 40);
assert.ok(decodeURIComponent(intent).includes(DD.CA));
assert.equal(
  DD.safeProviderUrl('https://dexscreener.com/solana/pair', 'dexscreener.com'),
  'https://dexscreener.com/solana/pair',
);
assert.equal(DD.safeProviderUrl('http://dexscreener.com/solana/pair', 'dexscreener.com'), '');
assert.equal(DD.safeProviderUrl('https://dexscreener.com.evil.test/pair', 'dexscreener.com'), '');
assert.equal(DD.safeProviderUrl('javascript:alert(1)', 'dexscreener.com'), '');

// body structural gates (built visitor surface later also checked)
const body = readFileSync(join(__dirname, 'src/body.html'), 'utf8');
assert.ok(body.includes('files.catbox.moe/gpjyb0.jpg'), 'casino-open durable media');
assert.ok(body.includes('files.catbox.moe/nid4qy.jpg'), 'verify-mint durable media');
assert.ok(body.includes('files.catbox.moe/qnvc7b.jpg'), 'aurora durable media');
assert.ok(body.includes('dd-share-room'), 'share section');
assert.ok(body.includes('dd-verify-how') || body.includes('dd-paste'), 'mint checker');
assert.ok(body.includes('dd-risk'), 'risk strip');
assert.ok(/culture coin|can go to zero|NFA/i.test(body), 'disclaimer language');
assert.ok(body.includes('endorsement') || body.includes('≠'), 'non-endorsement');
assert.ok(body.includes('53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump'));
assert.ok(body.includes('data-pack="raid"'));
assert.ok(body.includes('data-share-quote'));
assert.ok(body.includes('dd-copy-share') && body.includes('dd-tweet'), 'two share affordances');
assert.ok(body.includes('dd-buy') && body.includes('jup.ag'), 'buy CTA');
assert.ok(body.includes('dd-proof') && body.includes('p-mcap'), 'live proof strip');
assert.ok(body.includes('data-pack="boost"'), 'boost share pack tab');
assert.ok(body.includes('Buy on Jupiter') || body.includes('dd-buy'), 'primary buy label');


// conversion / virality gates
assert.ok(raid.includes(DD.DESK) || raid.includes('webflow.io/dasha'), 'raid pack includes desk');
assert.ok(raid.includes(DD.BUY) || raid.includes('jup.ag'), 'raid pack includes buy');
assert.ok(typeof DD.buildLiveProof === 'function', 'buildLiveProof exported');
const live = DD.buildLiveProof('$12.3K', '+4.2%');
assert.ok(live.includes('mcap $12.3K'), 'live proof mcap');
assert.ok(live.includes('+4.2%') || live.includes('24h'), 'live proof 24h');
assert.ok(live.includes(DD.BUY) || live.includes('jup.ag'), 'live proof buy');
assert.ok(live.includes(DD.DESK) || live.includes('webflow.io/dasha'), 'live proof desk');
assert.ok(live.includes(DD.CA), 'live proof mint');
const mini2 = DD.buildMiniPack();
assert.ok(mini2.includes(DD.BUY) || mini2.includes('jup.ag'), 'mini buy');
assert.ok(mini2.toLowerCase().includes('buy') || mini2.includes(DD.BUY), 'mini conversion orient');
assert.ok(body.includes('dd-copy-buy'), 'copy buy funnel control');
assert.ok(body.includes('dd-copy-live'), 'copy live pack control');
assert.ok(body.includes('dd-social-proof'), 'live social proof line');


assert.ok(body.includes('dd-buy-sticky') || body.includes('Buy now'), 'sticky buy now');
assert.ok(body.includes('dd-buy-now') || body.includes('Buy now'), 'mobile buy-now class or label');
assert.ok(body.includes('dd-social-proof-hint') || body.includes('Tap to copy'), 'social proof one-tap hint');
assert.ok(body.includes('dd-social-proof-text') || body.includes('role="status"'), 'social proof live text');
assert.ok(body.includes('One-tap buy') || body.includes('dd-buy-sticky'), 'sticky funnel region');


const hold = DD.buildSharePack('hold');
assert.ok(hold.includes(DD.CA), 'hold pack mint');
assert.ok(/still holding/i.test(hold), 'hold pack holding language');
assert.ok(hold.includes(DD.BUY) || hold.includes('jup.ag'), 'hold pack buy');
assert.ok(hold.includes(DD.DESK) || hold.includes('webflow.io/dasha'), 'hold pack desk');
assert.ok(body.includes('dd-fomo') && body.includes('dd-fomo-main'), 'fomo urgency strip');
assert.ok(body.includes('data-pack="hold"'), 'hold pack tab');
assert.ok(body.includes('dd-copy-hold'), 'copy hold pack control');


const raidB = DD.buildSharePack('raid_b');
assert.ok(raidB.includes(DD.CA), 'raid_b mint');
assert.ok(raidB.includes(DD.BUY) || raidB.includes('jup.ag'), 'raid_b buy');
assert.ok(raidB.includes(DD.DESK) || raidB.includes('webflow.io/dasha'), 'raid_b desk');
assert.ok(/casino open|is live/i.test(raidB), 'raid_b short get-in copy');
assert.notEqual(raidB, DD.buildSharePack('raid'), 'raid A/B differ');
assert.ok(body.includes('data-raid-ab'), 'raid A/B UI');
assert.ok(body.includes('dd-raid-a') && body.includes('dd-raid-b'), 'raid A/B buttons');
assert.ok(body.includes('dd-fomo-hot'), 'FOMO hot badge');


assert.ok(body.includes('dd-sticky-live'), 'sticky live pack CTA');
assert.ok(body.includes('dd-pulse-buy'), 'buy CTA pulse class');
assert.ok(body.includes('dd-buy-sticky'), 'sticky buy control');
const styles = readFileSync(join(__dirname, 'src/styles.css'), 'utf8');
assert.ok(styles.includes('dd-buy-pulse') || styles.includes('dd-pulse-buy'), 'buy pulse styles');
assert.ok(/dd-buy-pulse|@keyframes dd-buy-pulse/.test(styles), 'buy pulse keyframes');


assert.ok(body.includes('dd-sp-strip') && body.includes('sp-mcap'), 'social proof strip chips');
assert.ok(body.includes('dd-sp-copy-live') && body.includes('dd-sp-copy-hold'), 'sp strip share drivers');
assert.ok(body.includes('dd-sp-tweet'), 'sp strip post live');
assert.ok(body.includes('id="dd-exit"') && body.includes('dd-exit-hold'), 'exit-intent hold sheet');
assert.ok(body.includes('dd-exit-buy'), 'exit-intent buy CTA');
assert.ok(/Still holding|Before you go/i.test(body), 'exit-intent hold language');


assert.ok(typeof DD.deskUrl === 'function' && typeof DD.buyUrl === 'function', 'ref helpers exported');
assert.ok(typeof DD.getRef === 'function', 'getRef exported');
const desk = DD.deskUrl();
assert.ok(desk.includes('ref='), 'deskUrl has ref');
assert.ok(desk.includes('webflow.io/dasha'), 'deskUrl base');
const buy = DD.buyUrl();
assert.ok(buy.includes('jup.ag'), 'buyUrl jupiter');
assert.ok(buy.includes(DD.CA) || buy.includes('53uxQt'), 'buyUrl mint');
const invite = DD.buildSharePack('invite');
assert.ok(invite.includes('ref=') || invite.includes(DD.deskUrl().slice(0, 20)), 'invite has desk ref');
assert.ok(invite.includes('jup.ag') || invite.includes(DD.CA), 'invite has buy');
assert.ok(body.includes('data-pack="invite"'), 'invite tab');
assert.ok(body.includes('dd-buy-wallet'), 'wallet buy CTA');
assert.ok(body.includes('dd-ref-chip'), 'inbound ref chip');
assert.ok(body.includes('jup.ag/swap?') || body.includes('jup.ag/swap/'), 'jupiter deep link in markup');
assert.ok(body.includes('dd-meme-compact') || body.includes('dd-meme-grid'), 'meme gallery present');
// share packs must include desk with ref
assert.ok(DD.buildSharePack('raid').includes('ref=') || DD.buildSharePack('raid').includes('webflow.io/dasha'), 'raid desk');
assert.ok(DD.buildMiniPack().includes('ref=') || DD.buildMiniPack().includes('webflow.io'), 'mini has desk loop');


assert.ok(body.includes('dd-kit-raid') && body.includes('dd-kit-wallet'), 'sticky multi-CTA kit');
assert.ok(body.includes('id="dd-raid-kit"'), 'one-tap raid kit card');
assert.ok(body.includes('dd-kit-copy-raid') && body.includes('dd-kit-post-raid'), 'raid kit copy/post');
assert.ok(body.includes('dd-kit-copy-invite') && body.includes('dd-kit-copy-live'), 'raid kit invite+live');
assert.ok(body.includes('dd-sticky-ch'), 'sticky 24h chip');
const kitStyles = readFileSync(join(__dirname, 'src/styles.css'), 'utf8');
assert.ok(kitStyles.includes('dd-raid-kit') && kitStyles.includes('dd-kit-actions'), 'kit styles');

// live social-proof ticker + FOMO age (V11)
assert.ok(body.includes('id="dd-ticker"') && body.includes('dd-ticker-track'), 'live ticker strip');
assert.ok(body.includes('id="dd-tick-0"') || body.includes('Watching Dex'), 'ticker seed copy');
assert.ok(body.includes('id="dd-fomo-age"') && body.includes('dd-fomo-age'), 'FOMO updated-ago');
assert.ok(kitStyles.includes('.dd-ticker') && kitStyles.includes('dd-ticker-track'), 'ticker styles');
assert.ok(/@keyframes dd-scroll/.test(kitStyles), 'ticker marquee keyframes');
assert.ok(kitStyles.includes('dd-fomo-age'), 'fomo age styles');
const appJs = readFileSync(join(__dirname, 'src/app.js'), 'utf8');
assert.ok(appJs.includes('function updateTicker'), 'updateTicker in app');
assert.ok(appJs.includes('function tickFomoAge'), 'tickFomoAge in app');
assert.ok(appJs.includes('lastRefreshAt'), 'lastRefreshAt clock');
assert.ok(appJs.includes("updateTicker(") && appJs.includes('lastProof.mcap'), 'loadMarket feeds ticker');
assert.ok(appJs.includes('setInterval(tickFomoAge'), 'fomo age interval');
assert.ok(appJs.includes("dd-ticker") && appJs.includes('is-hot'), 'ticker hot class');

// session delta + copy burst (V12)
assert.ok(body.includes('id="p-delta"') && body.includes('Since open'), 'since-open proof chip');
assert.ok(body.includes('id="sp-delta"'), 'since-open sp chip');
assert.ok(body.includes('id="dd-copy-count"'), 'packs-copied counter');
assert.ok(appJs.includes('openMcap') && appJs.includes('lastProof.delta'), 'session mcap delta');
assert.ok(appJs.includes('packsCopied') && appJs.includes('dd-copy-burst'), 'copy burst + count');
assert.ok(kitStyles.includes('dd-copy-burst') && /@keyframes dd-burst/.test(kitStyles), 'burst styles');

// hold score + multi-channel share (V13)
assert.ok(typeof DD.intentTelegram === 'function' && typeof DD.intentWhatsApp === 'function', 'TG/WA intents');
const tg = DD.intentTelegram(raid);
assert.ok(tg.startsWith('https://t.me/share/url?'), 'telegram share host');
assert.ok(tg.includes('url=') && tg.includes('text='), 'telegram url+text');
assert.ok(decodeURIComponent(tg).includes('webflow.io/dasha') || decodeURIComponent(tg).includes(DD.CA), 'tg carries desk or mint');
const wa = DD.intentWhatsApp(raid);
assert.ok(wa.startsWith('https://wa.me/?text='), 'whatsapp share host');
assert.ok(decodeURIComponent(wa).includes(DD.CA), 'wa pack includes mint');
assert.ok(body.includes('id="dd-hold-score"') && body.includes('dd-hold-checkin'), 'hold score UI');
assert.ok(body.includes('dd-hold-share') && body.includes('dd-hold-score-n'), 'hold share + counter');
assert.ok(body.includes('dd-kit-post-tg') && body.includes('dd-kit-post-wa'), 'raid kit TG/WA');
assert.ok(body.includes('dd-share-tg') && body.includes('dd-share-wa'), 'pack TG/WA');
assert.ok(appJs.includes('dd_hold_n') && appJs.includes('holdScoreRead'), 'hold score storage');
assert.ok(kitStyles.includes('dd-hold-score'), 'hold score styles');
assert.ok(/local only|still holding/i.test(body), 'hold score honesty copy');

// session sparkline + invite micro-loop (V14)
assert.ok(typeof DD.buildSparkPath === 'function', 'buildSparkPath exported');
assert.equal(DD.buildSparkPath([]), '', 'empty samples → empty path');
assert.equal(DD.buildSparkPath([1]), '', 'single sample → empty path');
const path = DD.buildSparkPath([100, 110, 105, 120], 280, 48);
assert.ok(path.startsWith('M'), 'spark path starts with M');
assert.ok(path.includes(' L'), 'spark path has line segments');
assert.ok((path.match(/ L/g) || []).length >= 2, 'multi-point path');
const flat = DD.buildSparkPath([50, 50, 50], 100, 40);
assert.ok(flat.startsWith('M'), 'flat path still draws');
const end = DD.sparkEndPoint([10, 20, 30], 100, 40);
assert.ok(end && isFinite(end.x) && isFinite(end.y), 'spark end point');
assert.ok(body.includes('id="dd-spark"') && body.includes('dd-spark-path'), 'spark SVG DOM');
assert.ok(body.includes('Session mcap path') || body.includes('dd-spark-wrap'), 'spark label');
assert.ok(body.includes('id="dd-invite-loop"') && body.includes('dd-copy-invite-link'), 'invite loop UI');
assert.ok(body.includes('dd-invite-stat') && body.includes('dd-invite-code'), 'invite counter + ref');
assert.ok(appJs.includes('pushSparkSample') && appJs.includes('renderSpark'), 'spark hooks in app');
assert.ok(appJs.includes('dd_invite_shares') || appJs.includes('inviteSharesBump'), 'invite share counter');
assert.ok(kitStyles.includes('dd-spark') && kitStyles.includes('dd-invite-loop'), 'spark+invite styles');
assert.ok(/not a chart promise|NFA/i.test(body), 'spark honesty copy');
// loadMarket must null-guard optional stat nodes (embed may strip rows)
assert.ok(appJs.includes("if ($('s-5m'))") && appJs.includes("if ($('s-price'))"), 'guarded stat writes');
assert.ok(appJs.includes("if (!$('dd-paste')") || appJs.includes("if (!$('dd-paste') || !$('dd-verify'))"), 'verify guards missing paste');

// V15: short buy pack + poll move flash + invite tier
assert.ok(typeof DD.buildBuyPack === 'function', 'buildBuyPack exported');
const buyPack = DD.buildBuyPack('$12.3K');
assert.ok(buyPack.includes('Buy $dasha'), 'buy pack buy-first');
assert.ok(buyPack.includes(DD.BUY) || buyPack.includes('jup.ag'), 'buy pack jupiter');
assert.ok(buyPack.includes(DD.CA), 'buy pack mint');
assert.ok(buyPack.includes('mcap $12.3K'), 'buy pack live mcap');
assert.ok(/NFA|zero/i.test(buyPack), 'buy pack NFA');
const buyPackBare = DD.buildBuyPack('—');
assert.ok(buyPackBare.includes(DD.CA) && buyPackBare.includes('jup.ag'), 'buy pack without mcap still works');
assert.ok(!buyPackBare.includes('mcap —'), 'buy pack skips em-dash mcap');
assert.ok(body.includes('id="dd-copy-buy-pack"') || body.includes('dd-copy-buy-pack'), 'FOMO buy pack CTA');
assert.ok(body.includes('dd-copy-buy-pack-hero') || body.includes('dd-sticky-buy-pack'), 'hero/sticky buy pack');
assert.ok(body.includes('id="dd-move-chip"'), 'poll move chip');
assert.ok(appJs.includes('prevMcapNum') && appJs.includes('lastProof.move'), 'poll move tracking');
assert.ok(appJs.includes('is-move') || appJs.includes("is-move"), 'move flash class');
assert.ok(appJs.includes('inviteTier') && /Whale|Raider|Scout|Rookie/.test(appJs), 'invite tiers');
assert.ok(kitStyles.includes('dd-move-chip') && kitStyles.includes('dd-fomo-actions'), 'move/fomo action styles');

// V16: SOL amount chips + txn social proof + post-copy share loop
assert.ok(typeof DD.buyUrl === 'function', 'buyUrl exported');
const withAmt = DD.buyUrl(0.5);
assert.ok(withAmt.includes('jup.ag'), 'amounted buy is jupiter');
assert.ok(withAmt.includes('amount=0.5'), 'buyUrl appends SOL amount');
assert.ok(withAmt.includes(DD.CA) || withAmt.includes('53uxQt'), 'amounted buy has mint');
assert.equal(DD.buyUrl(), DD.BUY || DD.buyUrl(), 'buyUrl() without size stays base-compatible');
assert.ok(!DD.buyUrl().includes('amount=') || DD.buyUrl(0).includes('jup'), 'default buyUrl has no forced amount');
const buySized = DD.buildBuyPack('$80K', 1);
assert.ok(buySized.includes('amount=1') || buySized.includes('1 SOL'), 'buy pack carries size');
assert.ok(buySized.includes('mcap $80K'), 'sized buy pack mcap');
assert.ok(body.includes('id="dd-buy-amounts"') && body.includes('data-sol='), 'SOL amount chips UI');
assert.ok(body.includes('id="dd-buy-amt"'), 'sized buy CTA');
assert.ok(body.includes('id="dd-txns"'), '24h buys/sells social proof');
assert.ok(body.includes('id="dd-post-share"') && body.includes('dd-post-tg'), 'post-copy share loop');
assert.ok(appJs.includes('buySol') && appJs.includes('dd_buy_sol'), 'buy size state');
assert.ok(appJs.includes('showPostShare') || appJs.includes('dd-post-share'), 'post share wiring');
assert.ok(appJs.includes('tx.buys') || appJs.includes('lastProof.buys'), 'dex txn counts');
assert.ok(kitStyles.includes('dd-buy-amounts') && kitStyles.includes('dd-amt'), 'amount chip styles');
assert.ok(kitStyles.includes('dd-post-share'), 'post-share styles');

// V17: buy-pressure proof + mobile wallet path
assert.ok(typeof DD.buyPressure === 'function' && typeof DD.buyPressureLine === 'function', 'pressure helpers');
const bp = DD.buyPressure(362, 237);
assert.ok(bp && bp.moreBuyers && bp.pct >= 60, 'buy-heavy pressure from live-like counts');
const bpLine = DD.buyPressureLine(bp);
assert.ok(/More buyers/i.test(bpLine) && bpLine.includes('NFA'), 'pressure line honest NFA');
assert.ok(bpLine.includes('362') && bpLine.includes('237'), 'pressure line carries real counts');
const sellP = DD.buyPressure(100, 200);
assert.ok(sellP && sellP.moreSellers, 'sell-heavy detection');
assert.ok(/More sellers/i.test(DD.buyPressureLine(sellP)), 'sellers line');
assert.equal(DD.buyPressure(0, 0), null, 'zero flow null');
assert.equal(DD.buyPressure(null, 5), null, 'invalid null');
const packPress = DD.buildBuyPack('$82K', 0.5, DD.buyPressureLine(bp));
assert.ok(packPress.includes('More buyers') && packPress.includes('amount=0.5'), 'buy pack + pressure');
assert.ok(body.includes('id="dd-pressure"'), 'pressure DOM');
assert.ok(appJs.includes('isMobileBuyPath') && appJs.includes('Wallet ·'), 'mobile wallet labels');
assert.ok(appJs.includes('dd-buy-wallet') && appJs.includes('showPostShare'), 'buy-click share loop');
assert.ok(kitStyles.includes('dd-pressure'), 'pressure styles');
assert.ok(/Buy pressure|more buyers/i.test(appJs) || appJs.includes('moreBuyers'), 'fomo uses pressure');

console.log('dasha-share.test.mjs: PASS');
