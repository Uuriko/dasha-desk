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
assert.ok(withAmt.includes('ref='), 'amounted buyUrl carries invite ref (V22)');
assert.ok(DD.buyUrl().includes('jup.ag') && DD.buyUrl().includes('ref='), 'default buyUrl has invite ref');
assert.ok(!DD.buyUrl().includes('amount='), 'default buyUrl has no forced amount');
assert.ok(typeof DD.inviteRef === 'function' && /^[a-z0-9]{4,8}$/i.test(DD.inviteRef()), 'inviteRef shape');
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

// V18: dip-buy signal + USD chip labels + sticky size row
assert.ok(typeof DD.dipBuySignal === 'function', 'dipBuySignal exported');
assert.ok(typeof DD.solUsdEstimate === 'function' && typeof DD.fmtUsdRough === 'function', 'usd helpers');
const dip = DD.dipBuySignal(-4.37, -4.93, 511);
assert.ok(dip && dip.shortLabel === '1h', 'dip prefers 1h when red');
assert.ok(/dip buy zone|NFA/i.test(dip.line), 'dip line honest NFA');
assert.ok(dip.line.includes('511') || dip.line.includes('+511'), 'dip line keeps 24h green');
assert.equal(DD.dipBuySignal(2, 3, 10), null, 'no dip when shorts green');
assert.equal(DD.dipBuySignal(-5, -3, -10), null, 'no dip-buy when 24h also red');
const usd = DD.solUsdEstimate(1, 0.00008223, 0.000001128);
assert.ok(usd && usd > 50 && usd < 200, 'solUsdEstimate in plausible SOL USD range');
assert.ok(DD.fmtUsdRough(72.9).startsWith('~$'), 'fmtUsdRough tilde dollars');
assert.ok(body.includes('id="dd-sticky-amts"') && body.includes('dd-amt-sm'), 'sticky size chips');
assert.ok(body.includes('id="dd-sticky-dip"'), 'sticky dip chip');
assert.ok(body.includes('id="dd-exit-buy-pack"'), 'exit buy pack CTA');
assert.ok(appJs.includes('lastProof.dip') && appJs.includes('is-dip'), 'dip state wiring');
assert.ok(appJs.includes('paintAmtChips') || appJs.includes('solUsd'), 'usd chip paint');
assert.ok(kitStyles.includes('dd-sticky-amts') && kitStyles.includes('dd-sticky-dip'), 'dip/sticky styles');

// V19: dip FOMO buy CTA + dip-raid share pack
assert.ok(typeof DD.buildDipPack === 'function', 'buildDipPack exported');
const dipPack = DD.buildDipPack(dip, '$82K', 1);
assert.ok(/dip buy zone|1h/i.test(dipPack), 'dip pack leads with dip signal');
assert.ok(dipPack.includes('Buy $dasha on the dip') || /on the dip/i.test(dipPack), 'dip pack buy-on-dip');
assert.ok(dipPack.includes('amount=1') || dipPack.includes('1 SOL'), 'dip pack size');
assert.ok(dipPack.includes(DD.CA) && dipPack.includes('jup.ag'), 'dip pack mint+jup');
assert.ok(dipPack.includes('webflow.io/dasha') || dipPack.includes('Desk'), 'dip pack desk loop');
assert.ok(/NFA|zero/i.test(dipPack), 'dip pack NFA');
const noDipPack = DD.buildDipPack(null, '$82K', 0.5);
assert.ok(noDipPack.includes('Buy $dasha now'), 'null dip falls back to buy pack');
assert.ok(body.includes('id="dd-fomo-buy"') && body.includes('id="dd-fomo-raid-dip"'), 'FOMO dip CTAs');
assert.ok(body.includes('Buy the dip') || body.includes('dd-fomo-buy'), 'buy the dip label');
assert.ok(appJs.includes('dd-fomo-raid-dip') && appJs.includes('dipPackNow'), 'raid dip wiring');
assert.ok(appJs.includes('Dip buy') || appJs.includes('dip buy'), 'sticky dip buy label');
assert.ok(kitStyles.includes('dd-fomo-buy') || kitStyles.includes('#dd-fomo-buy'), 'fomo buy styles');

// V20: FOMO A/B + FOMO size chips + net-buys social proof
assert.ok(typeof DD.fomoDipHeadline === 'function', 'fomoDipHeadline exported');
assert.ok(typeof DD.netBuysLine === 'function' && typeof DD.netBuysShort === 'function', 'net buys helpers');
const headA = DD.fomoDipHeadline(dip, '+511.00%', 'a', bp);
const headB = DD.fomoDipHeadline(dip, '+511.00%', 'b', bp);
assert.ok(headA.includes('dip') && headA.includes('24h still'), 'FOMO A is status style');
assert.ok(/^Buy the dip/i.test(headB), 'FOMO B leads with Buy the dip');
assert.ok(headB.includes('% buys') || headB.includes('NFA'), 'FOMO B includes pressure or NFA');
assert.notEqual(headA, headB, 'FOMO A/B headlines differ');
const net = DD.netBuysLine(362, 237);
assert.ok(net && net.startsWith('+') && /more buys/i.test(net) && /NFA/i.test(net), 'net buys line');
assert.equal(DD.netBuysShort(362, 237), '+125', 'net buys short +125');
assert.ok(DD.netBuysLine(100, 200).includes('more sells'), 'net sells line');
assert.equal(DD.netBuysShort(100, 100), '0', 'even net');
assert.ok(body.includes('id="dd-fomo-amts"') && body.includes('id="dd-fomo-ab"'), 'FOMO amts + AB badge');
assert.ok(body.includes('id="p-net"') && body.includes('id="dd-net-line"'), 'net buys proof DOM');
assert.ok(appJs.includes('dd_fomo_ab') && appJs.includes('fomoAb'), 'FOMO A/B persistence');
assert.ok(appJs.includes('dd_dip_size_nudge') || appJs.includes('dip_size'), 'dip size nudge');
assert.ok(kitStyles.includes('dd-fomo-amts') && kitStyles.includes('dd-net-line'), 'v20 styles');

// V21: buy pace + sticky flow proof + Phantom UL helper
assert.ok(typeof DD.buysPaceLine === 'function', 'buysPaceLine exported');
assert.ok(typeof DD.stickyFlowProof === 'function', 'stickyFlowProof exported');
assert.ok(typeof DD.phantomBrowseUrl === 'function', 'phantomBrowseUrl exported');
const pace = DD.buysPaceLine(362);
assert.ok(pace && /buys\/hr/i.test(pace) && /NFA/i.test(pace), 'pace line from Dex buys');
const flow = DD.stickyFlowProof(362, 237);
assert.ok(flow && /\+125\s+net/i.test(flow) && /buys\/hr/i.test(flow), 'sticky flow net+pace');
assert.equal(DD.stickyFlowProof(null, null), null, 'no flow without txns');
const jupAmt =
  'https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump&amount=1';
const ph = DD.phantomBrowseUrl(jupAmt);
assert.ok(
  ph.startsWith('https://phantom.app/ul/browse/') && ph.includes(encodeURIComponent(jupAmt).slice(0, 20)),
  'phantom UL wraps amounted jup',
);
assert.ok(body.includes('id="dd-sticky-flow"'), 'sticky flow DOM');
assert.ok(
  appJs.includes('phantomBrowseUrl') &&
    (appJs.includes('Wallet dip') || appJs.includes('fomoBits') || appJs.includes('phantomHref')),
  'mobile FOMO phantom path',
);
assert.ok(kitStyles.includes('dd-sticky-flow'), 'v21 sticky flow style');
// A headline should not double "24h" when label already has 24h prefix
const headClean = DD.fomoDipHeadline(dip, '24h +511%', 'a', bp);
assert.ok(!/24h still 24h/i.test(headClean), 'no double 24h in FOMO A');

// V22: FOMO/sticky buy path always invite-ref Jupiter links via buyUrl
assert.ok(appJs.includes('inviteRef') && appJs.includes('ref='), 'inviteRef wired into buyUrl');
const buySticky = DD.buyUrl(1);
assert.ok(
  buySticky.includes('jup.ag') &&
    buySticky.includes('amount=1') &&
    buySticky.includes('ref=') &&
    buySticky.includes('53uxQt'),
  'sticky/FOMO buyUrl is jup+amount+ref+mint',
);
// Phantom wrap must preserve ref inside encoded jup
const phRef = DD.phantomBrowseUrl(buySticky);
assert.ok(
  phRef.includes('phantom.app/ul/browse/') &&
    decodeURIComponent(phRef).includes('ref=') &&
    decodeURIComponent(phRef).includes('amount=1'),
  'Phantom UL preserves invite ref + amount',
);

// V23: one-tap copy-CA + open-wallet dual action
assert.ok(typeof DD.dualGoPlan === 'function', 'dualGoPlan exported');
const dualM = DD.dualGoPlan(1, true);
const dualD = DD.dualGoPlan(1, false);
assert.equal(dualM.ca, DD.CA || '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump', 'dual copies full mint');
assert.ok(dualM.href.includes('phantom.app/ul/browse/'), 'mobile dual opens Phantom UL');
assert.ok(decodeURIComponent(dualM.href).includes('amount=1'), 'mobile dual keeps amount');
assert.ok(decodeURIComponent(dualM.href).includes('ref='), 'mobile dual keeps invite ref');
assert.ok(dualD.href.includes('jup.ag') && dualD.href.includes('amount=1') && dualD.href.includes('ref='), 'desktop dual is amounted jup+ref');
// Without solUsd: still SOL size on label; with solUsd: USD rough
assert.ok(/CA/i.test(dualM.label) && /1 SOL/i.test(dualM.label), 'mobile dual label has SOL size');
assert.ok(/CA/i.test(dualD.label) && /1 SOL/i.test(dualD.label), 'desktop dual label has SOL size');
assert.ok(body.includes('id="dd-dual-go"') && body.includes('id="dd-fomo-dual"') && body.includes('id="dd-mint-dual"'), 'dual DOM sticky+fomo+mint');
assert.ok(body.includes('dd-dual-go'), 'dual class');
assert.ok(appJs.includes('runDualGo') && appJs.includes('dualGoPlan'), 'dual runtime wiring');
assert.ok(kitStyles.includes('dd-dual-go'), 'dual styles');

// V24: regime-aware dual + hot window FOMO
assert.ok(typeof DD.buyRegime === 'function' && typeof DD.hotBuyHeadline === 'function', 'regime helpers');
const bpHot = DD.buyPressure(364, 238);
assert.equal(DD.buyRegime(null, { m5: 0.9, h1: 1.4 }, bpHot), 'hot', 'green short + pressure = hot');
assert.equal(DD.buyRegime(dip, { m5: 1, h1: 2 }, bpHot), 'dip', 'dip wins over hot');
assert.equal(DD.buyRegime(null, { m5: -1, h1: -1 }, bpHot), 'neutral', 'red short = not hot');
const hotLine = DD.hotBuyHeadline({ m5: 0.9, h1: 1.4 }, bpHot, '$83.9K');
assert.ok(/Hot window/i.test(hotLine) && /5m/i.test(hotLine) && /NFA/i.test(hotLine), 'hot headline');
const dualDip = DD.dualGoPlan(1, true, 'dip');
const dualHot = DD.dualGoPlan(1, false, 'hot');
assert.ok(/Dip/i.test(dualDip.label) && /1 SOL/i.test(dualDip.label), 'dip dual label');
assert.ok(/Ride/i.test(dualHot.label) && /1 SOL/i.test(dualHot.label), 'hot dual label');
assert.ok(
  appJs.includes('is-hot-win') && (appJs.includes('Wallet ride') || appJs.includes('Ride ·')),
  'hot FOMO buy path',
);
assert.ok(kitStyles.includes('is-hot-dual') || kitStyles.includes('is-hot-win'), 'hot dual styles');

// V25: session open-mcap delta urgency on dual toast + sticky
assert.ok(typeof DD.sessionDelta === 'function', 'sessionDelta exported');
assert.equal(DD.sessionDelta(null, 100), null, 'no open = null');
assert.equal(DD.sessionDelta(100, 100.1), null, 'tiny move ignored');
const sessUp = DD.sessionDelta(80000, 83871);
assert.ok(sessUp && sessUp.up && sessUp.pct > 0 && /Session/.test(sessUp.line) && /NFA/.test(sessUp.line), 'session up line');
assert.ok(/sess \+/.test(sessUp.short), 'session short label');
const sessDn = DD.sessionDelta(90000, 83871);
assert.ok(sessDn && !sessDn.up && sessDn.pct < 0, 'session down');
const dualSess = DD.dualGoPlan(1, true, 'dip', sessUp);
assert.ok(/sess \+/.test(dualSess.label) || /sess \+/.test(dualSess.toast), 'dual carries session short');
assert.ok(
  (/CA copied|CA\+buy|CA ·/i.test(dualSess.toast) || dualSess.toast.includes('CA')) &&
    /sess/.test(dualSess.toast),
  'dual toast session urgency',
);
assert.ok(body.includes('id="dd-session-line"'), 'session line DOM');
assert.ok(appJs.includes('sessionDelta') && appJs.includes('dd-session-line'), 'session wiring');
assert.ok(kitStyles.includes('dd-session-line'), 'session styles');

// V26: USD size on dual + liq trust near sticky
assert.ok(typeof DD.solSizeLabel === 'function' && typeof DD.liqTrustLine === 'function', 'size+liq helpers');
const size1 = DD.solSizeLabel(1, 73);
assert.ok(size1 && /1 SOL/.test(size1.label) && /~\$/.test(size1.label), 'sol size has USD rough');
assert.equal(DD.solSizeLabel(0, 73), null, 'zero sol null');
assert.ok(DD.liqTrustLine(28308) && /Liq/.test(DD.liqTrustLine(28308)) && /NFA/.test(DD.liqTrustLine(28308)), 'liq trust line');
assert.equal(DD.liqTrustLine(100), null, 'tiny liq null');
const dualUsd = DD.dualGoPlan(1, true, 'dip', null, 73);
assert.ok(/1 SOL/.test(dualUsd.label) && /~\$/.test(dualUsd.label), 'dual label has size USD');
assert.ok(dualUsd.hasUsd === true, 'dual hasUsd flag');
assert.ok(/1 SOL/.test(dualUsd.toast) || /~\$/.test(dualUsd.toast), 'dual toast has size');
const dualHotUsd = DD.dualGoPlan(1, false, 'hot', null, 73);
assert.ok(/Ride/.test(dualHotUsd.label) && /1 SOL/.test(dualHotUsd.label), 'hot dual with size');
assert.ok(body.includes('id="dd-liq-trust"'), 'liq trust DOM');
assert.ok(appJs.includes('liqTrustLine') && appJs.includes('solSizeLabel'), 'v26 wiring');
assert.ok(kitStyles.includes('dd-liq-trust'), 'liq trust styles');
// dual should be first sticky action (before buy) for copy-CA conversion
const stickyBlock = body.slice(body.indexOf('dd-sticky-actions'), body.indexOf('dd-sticky-actions') + 800);
assert.ok(
  stickyBlock.indexOf('dd-dual-go') < stickyBlock.indexOf('dd-buy-sticky'),
  'dual before sticky buy',
);

// V27: dual copy payload (CA+buy+desk) + net proof on dual label
assert.ok(typeof DD.dualCopyPayload === 'function', 'dualCopyPayload exported');
const pack = DD.dualCopyPayload(
  DD.CA || '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump',
  DD.buyUrl(1),
  DD.deskUrl(),
  '1 SOL · ~$73',
);
assert.ok(pack.includes('53uxQt') && pack.includes('jup.ag') && pack.includes('amount=1'), 'payload has CA+jup+amount');
assert.ok(pack.includes('ref=') && pack.includes('webflow.io/dasha'), 'payload has invite desk');
assert.ok(/Size 1 SOL/.test(pack) && /NFA/i.test(pack), 'payload size + NFA');
const dualNet = DD.dualGoPlan(1, true, 'dip', null, 73, '+126');
assert.ok(dualNet.hasNet && /\+126 net/.test(dualNet.label), 'dual label shows +net');
assert.ok(dualNet.copyText && dualNet.copyText.includes('53uxQt') && dualNet.copyText.includes('jup.ag'), 'plan has copyText pack');
assert.ok(/CA\+buy/i.test(dualNet.toast) || /CA\+buy/.test(dualNet.toast) || dualNet.toast.includes('CA+buy'), 'toast is CA+buy pack');
const dualNoNet = DD.dualGoPlan(1, true, 'dip', null, 73, '-10');
assert.ok(!dualNoNet.hasNet && !/\-10 net/.test(dualNoNet.label), 'negative net not on dual label');
assert.ok(appJs.includes('dualCopyPayload') && appJs.includes('copyText'), 'v27 dual payload wiring');
assert.ok(kitStyles.includes('has-net') || kitStyles.includes('has-usd'), 'dual net style hook');

// V28: dual pack header + pace on label + post-share uses dual pack + native share
assert.ok(typeof DD.buyPaceShort === 'function', 'buyPaceShort exported');
assert.ok(DD.buyPaceShort(365) && /\/hr/.test(DD.buyPaceShort(365)), 'pace short from buys');
assert.equal(DD.buyPaceShort(0), null, 'zero buys no pace');
const dualPace = DD.dualGoPlan(1, true, 'dip', null, 73, '+127', 365);
assert.ok(dualPace.hasPace && /\/hr/.test(dualPace.label), 'dual label has pace');
assert.ok(dualPace.header && /\$dasha/.test(dualPace.header) && /dip/.test(dualPace.header), 'dual header regime');
assert.ok(
  dualPace.copyText &&
    dualPace.copyText.indexOf(dualPace.header) === 0 &&
    dualPace.copyText.includes('53uxQt') &&
    dualPace.copyText.includes('jup.ag'),
  'copyText starts with header then CA+jup',
);
assert.ok(appJs.includes('buyPaceShort') && appJs.includes('navigator.share'), 'v28 pace + native share');
assert.ok(appJs.includes('showPostShare(pack)') || /showPostShare\(\s*pack\s*\)/.test(appJs), 'post-share dual pack');

// V29: mobile-visible trust bar + FOMO buy net/pace
assert.ok(typeof DD.trustBarLine === 'function', 'trustBarLine exported');
const tbl = DD.trustBarLine(
  '+127 net · ~15 buys/hr · NFA',
  'Liq $28.5K · NFA',
  DD.sessionDelta(80000, 84771),
);
assert.ok(tbl && /127/.test(tbl) && /Liq/.test(tbl) && /NFA/.test(tbl), 'trust bar combines flow+liq');
assert.ok(!/NFA\s+NFA/i.test(tbl), 'trust bar single NFA');
assert.ok(body.includes('id="dd-trust-bar"') && body.includes('id="dd-trust-bar-text"'), 'trust bar DOM');
assert.ok(
  body.indexOf('dd-trust-bar') > body.indexOf('dd-sticky-meta') ||
    body.includes('dd-trust-bar'),
  'trust bar present for mobile',
);
assert.ok(appJs.includes('paintTrustBar') && appJs.includes('trustBarLine'), 'trust bar wiring');
assert.ok(
  appJs.includes('fomoBits') || (appJs.includes('paceBit') && appJs.includes('dd-fomo-buy')),
  'FOMO buy nets pace bits',
);
assert.ok(kitStyles.includes('dd-trust-bar'), 'trust bar styles');

// V30: deep/hard dip urgency + size nudge
assert.ok(typeof DD.dipDepth === 'function' && typeof DD.dipSizeNudgeSol === 'function', 'dip depth helpers');
const softDip = { shortLabel: '1h', shortPct: -4.5, ch24: 200 };
const hardDip = { shortLabel: '6h', shortPct: -15.2, ch24: 200 };
const deepDip = { shortLabel: '6h', shortPct: -29.17, ch24: 204 };
assert.equal(DD.dipDepth(softDip).tier, 'soft', 'soft dip tier');
assert.equal(DD.dipDepth(hardDip).tier, 'hard', 'hard dip tier');
assert.equal(DD.dipDepth(deepDip).tier, 'deep', 'deep dip tier');
assert.equal(DD.dipSizeNudgeSol(deepDip), 2, 'deep dip nudges 2 SOL');
assert.equal(DD.dipSizeNudgeSol(hardDip), 1, 'hard dip nudges 1 SOL');
const headDeepA = DD.fomoDipHeadline(deepDip, '+204%', 'a', bpHot);
const headDeepB = DD.fomoDipHeadline(deepDip, '+204%', 'b', bpHot);
assert.ok(/Deep dip/i.test(headDeepA) && /24h still/i.test(headDeepA), 'FOMO A deep lead');
assert.ok(/Deep dip|buy/i.test(headDeepB), 'FOMO B deep lead');
const dualDeep = DD.dualGoPlan(2, true, 'dip', null, 74, '+101', 358, deepDip);
assert.ok(dualDeep.isDeepDip && /Deep dip/i.test(dualDeep.label), 'dual deep dip label');
assert.ok(dualDeep.header && /deep dip/i.test(dualDeep.header) && /-29/.test(dualDeep.header), 'dual header has depth pct');
assert.ok(appJs.includes('dipDepth') && appJs.includes('is-deep-dip') && appJs.includes('dd_dip_size_nudge'), 'v30 wiring');
assert.ok(kitStyles.includes('is-deep-dip') || kitStyles.includes('is-hard-dip'), 'deep dip styles');

// V31: 24h still green anchor on deep-dip dual/FOMO
assert.ok(typeof DD.stillGreen24 === 'function', 'stillGreen24 exported');
const still = DD.stillGreen24(deepDip);
assert.ok(still && still.pct > 0 && /24h \+/.test(still.short), 'still green short');
assert.equal(DD.stillGreen24({ shortLabel: '1h', shortPct: -5, ch24: -3 }), null, 'red 24h null');
const dualStill = DD.dualGoPlan(2, true, 'dip', null, 74, '+59', 313, deepDip);
assert.ok(dualStill.hasStill24 && /24h \+/.test(dualStill.label), 'dual label has 24h still');
assert.ok(dualStill.header && /24h \+/.test(dualStill.header), 'dual header has 24h still');
assert.ok(dualStill.toast && /24h \+/.test(dualStill.toast), 'dual toast has 24h still');
assert.ok(appJs.includes('stillGreen24') && appJs.includes('has-still24'), 'v31 wiring');

console.log('dasha-share.test.mjs: PASS');
