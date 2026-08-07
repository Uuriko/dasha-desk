(function () {
  var CA = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
  var PAIR = 'https://dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7';
  var PAIR_ID = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
  var QUOTE = 'So11111111111111111111111111111111111111112';
  var CASINO = 'How u crying at the casino and u can’t even get in';

  var DESK_FALLBACK = 'https://www.getdasha.com/';
  var DESK_DEPLOYMENTS = [
    DESK_FALLBACK,
    'https://johns-awesome-project-39b1b5.webflow.io/',
    'https://johns-awesome-project-39b1b5.webflow.io/dasha',
    'https://files.catbox.moe/sm5mo0.html',
  ];
  var BUY =
    'https://jup.ag/swap/SOL-53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

  function resolveDeskUrl(doc, loc, fallback) {
    function clean(raw) {
      try {
        var url = new URL(String(raw || ''));
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
        url.search = '';
        url.hash = '';
        return url.href;
      } catch (_) {
        return '';
      }
    }
    if (!loc) return clean(fallback);
    var current = clean(loc.href);
    return DESK_DEPLOYMENTS.includes(current) ? current : '';
  }

  var DESK = resolveDeskUrl(
    typeof document === 'undefined' ? null : document,
    typeof location === 'undefined' ? null : location,
    DESK_FALLBACK,
  );
  var LABS = DESK && !DESK.includes('files.catbox.moe') ? new URL('/labs', DESK).href : '';
  var LABS_MINT = LABS ? LABS + '?mint=' + encodeURIComponent(CA) : '';

  /** Pure share-pack builders — unit-tested via global.DDShare */
  function buildSharePack(kind) {
    kind = kind || 'raid';
    if (kind === 'discord') {
      return (
        '**$dasha** desk pack\n' +
        '`' +
        CA +
        '`\n' +
        CASINO +
        '\n' +
        'Buy: ' +
        BUY +
        '\n' +
        'Chart: ' +
        PAIR +
        '\n' +
        (DESK ? 'Desk: ' + DESK + '\n' : '') +
        'NFA · can go to zero · association ≠ endorsement'
      );
    }
    if (kind === 'verify') {
      return (
        'Verify this mint yourself:\n' +
        CA +
        '\n' +
        'Solscan: https://solscan.io/token/' +
        CA +
        '\n' +
        'Rugcheck: https://rugcheck.xyz/tokens/' +
        CA +
        '\n' +
        'If a DM shows a different string, ignore it.'
      );
    }
    if (kind === 'meme') {
      return CASINO + '\n$dasha\n' + CA + '\n@dash_eats · still optimistic · NFA';
    }
    if (kind === 'boost') {
      return (
        '$dasha source pack\n' +
        CASINO +
        '\n' +
        'CA: ' +
        CA +
        '\n' +
        'Chart: ' +
        PAIR +
        '\n' +
        'Buy: ' +
        BUY +
        '\n' +
        (DESK ? 'Desk: ' + DESK + '\n' : '') +
        'NFA · can go to zero'
      );
    }
    // raid default — casino hook + full funnel
    return (
      CASINO +
      '\n' +
      '$dasha ' +
      CA +
      '\n' +
      'Buy → ' +
      BUY +
      '\n' +
      'Chart → ' +
      PAIR +
      '\n' +
      (DESK ? 'Desk → ' + DESK + '\n' : '') +
      'NFA · can go to zero'
    );
  }

  /** Market snapshot pack — unit-tested via DDShare.buildLiveProof */
  function buildLiveProof(mcapLabel, ch24Label, observedAt) {
    var m = mcapLabel && String(mcapLabel) !== '—' ? String(mcapLabel) : 'unavailable';
    var c = ch24Label && String(ch24Label) !== '—' ? String(ch24Label) : '';
    return (
      '$dasha · Dexscreener-reported snapshot\nMcap ' +
      m +
      (c ? ' · 24h ' + c : '') +
      '\n' +
      (observedAt ? 'Fetched ' + observedAt + '\n' : '') +
      'Chart → ' +
      PAIR +
      '\n' +
      'Buy → ' +
      BUY +
      '\n' +
      (DESK ? 'Desk → ' + DESK + '\n' : '') +
      CA +
      '\nNFA · can go to zero'
    );
  }

  function buildQuoteShare(quote) {
    var q = String(quote || '').trim();
    if (!q) return '';
    return q + '\n$dasha · ' + CA + '\nBuy ' + BUY + ' · NFA';
  }

  function buildMiniPack() {
    return 'Buy $dasha → ' + BUY + '\n' + CA + '\n' + CASINO;
  }

  function intentTweet(text) {
    return 'https://x.com/intent/tweet?text=' + encodeURIComponent(text);
  }

  function safeProviderUrl(raw, host) {
    try {
      var url = new URL(String(raw || ''));
      return url.protocol === 'https:' && url.hostname === host ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function selectMarketPair(pairs, pairUrl, mint) {
    try {
      var expected = new URL(pairUrl);
      function optionalNumber(value, nonnegative) {
        return value == null || (typeof value === 'number' && isFinite(value) && (!nonnegative || value >= 0));
      }
      function price(value) {
        return value == null || (typeof value === 'string' && /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) && Number(value) > 0 && isFinite(Number(value)));
      }
      function change(value) {
        return value == null || (typeof value === 'number' && isFinite(value) && value >= -100);
      }
      var matches = (Array.isArray(pairs) ? pairs : []).filter(function (pair) {
        if (
          !pair ||
          pair.chainId !== 'solana' ||
          pair.dexId !== 'raydium' ||
          pair.pairAddress !== PAIR_ID ||
          !pair.baseToken ||
          pair.baseToken.address !== mint ||
          !pair.quoteToken ||
          pair.quoteToken.address !== QUOTE ||
          !price(pair.priceUsd) ||
          !optionalNumber(pair.marketCap, true) ||
          !optionalNumber(pair.liquidity && pair.liquidity.usd, true) ||
          !optionalNumber(pair.volume && pair.volume.h24, true) ||
          !['m5', 'h1', 'h6', 'h24'].every(function (key) { return change(pair.priceChange && pair.priceChange[key]); })
        ) return false;
        var raw = safeProviderUrl(pair.url, 'dexscreener.com');
        if (!raw) return false;
        var url = new URL(raw);
        url.search = '';
        url.hash = '';
        return url.href === expected.href;
      });
      return matches.length === 1 ? matches[0] : null;
    } catch (_) {
      return null;
    }
  }

  function buildObservationReceipt(evidence, pair, fetchedAt) {
    if (!evidence || evidence.schema !== 'dasha.mint-evidence/1' || evidence.mint !== CA ||
        !evidence.account || !/^[0-9a-f]{64}$/.test(evidence.account.accountDataSha256 || ''))
      throw new Error('Mint evidence unavailable');
    var selected = pair && selectMarketPair([pair], PAIR, CA);
    var observedAt = new Date(fetchedAt || NaN);
    return {
      schema: 'dasha.observation-receipt/1',
      mintEvidence: evidence,
      marketObservation: selected && !isNaN(observedAt.getTime()) ? {
        provider: 'Dexscreener',
        fetchedAt: observedAt.toISOString(),
        pairUrl: PAIR,
        pairAddress: selected.pairAddress,
        mint: CA,
        priceUsd: selected.priceUsd,
        marketCap: selected.marketCap == null ? null : selected.marketCap,
        liquidityUsd: selected.liquidity && selected.liquidity.usd != null ? selected.liquidity.usd : null,
        volume24h: selected.volume && selected.volume.h24 != null ? selected.volume.h24 : null,
        change: Object.fromEntries(['m5', 'h1', 'h6', 'h24'].map(function (key) {
          var value = selected.priceChange && selected.priceChange[key];
          return [key, value == null ? null : value];
        })),
      } : null,
      limitations: [
        'The RPC snapshot is not a cryptographic inclusion proof or token assessment.',
        'Market values are provider-reported observations, not independent corroboration.',
        'Association evidence is not an endorsement.',
      ],
    };
  }

  var DDShare = {
    CA: CA,
    PAIR: PAIR,
    DESK: DESK,
    LABS: LABS,
    LABS_MINT: LABS_MINT,
    BUY: BUY,
    resolveDeskUrl: resolveDeskUrl,
    buildSharePack: buildSharePack,
    buildQuoteShare: buildQuoteShare,
    buildMiniPack: buildMiniPack,
    buildLiveProof: buildLiveProof,
    intentTweet: intentTweet,
    safeProviderUrl: safeProviderUrl,
    selectMarketPair: selectMarketPair,
    buildObservationReceipt: buildObservationReceipt,
  };
  if (typeof globalThis !== 'undefined') globalThis.DDShare = DDShare;
  if (typeof window !== 'undefined') window.DDShare = DDShare;

  if (typeof document === 'undefined' || !document.getElementById || !document.getElementById('dd-app')) {
    return;
  }

  function $(id) {
    return document.getElementById(id);
  }
  function fmtUsd(n) {
    if (n == null || n === '') return '—';
    n = Number(n);
    if (!isFinite(n)) return '—';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
    if (n >= 1) return '$' + n.toFixed(2);
    if (n >= 0.0001) return '$' + n.toFixed(6);
    return '$' + n.toExponential(2);
  }
  function fmtPct(n) {
    if (n == null || !isFinite(Number(n))) return '—';
    var v = Number(n);
    return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  }
  function setTone(el, n) {
    if (!el) return;
    el.classList.remove('dd-up', 'dd-down');
    if (n == null || !isFinite(Number(n))) return;
    var v = Number(n);
    if (v > 0) el.classList.add('dd-up');
    else if (v < 0) el.classList.add('dd-down');
  }
  function copy(text, el) {
    function ok() {
      var t = $('dd-toast');
      if (t) {
        t.hidden = false;
        setTimeout(function () {
          t.hidden = true;
        }, 1200);
      }
      if (el && el.textContent != null) {
        var o = el.textContent;
        el.textContent = 'Copied';
        setTimeout(function () {
          el.textContent = o;
        }, 900);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(fallback);
    } else fallback();
    function fallback() {
      var a = document.createElement('textarea');
      a.value = text;
      document.body.appendChild(a);
      a.select();
      try {
        if (document.execCommand('copy')) ok();
      } catch (e) {}
      document.body.removeChild(a);
    }
  }
  function drawQr(text) {
    var c = $('dd-qr');
    if (!c) return;
    var ctx = c.getContext('2d');
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 6, 6, c.width - 12, c.height - 12);
    };
    img.onerror = function () {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#12091c';
      ctx.font = '9px monospace';
      (text.match(/.{1,16}/g) || []).forEach(function (line, i) {
        ctx.fillText(line, 6, 18 + i * 11);
      });
    };
    img.src =
      'https://api.qrserver.com/v1/create-qr-code/?size=148x148&data=' +
      encodeURIComponent(text);
  }

  var currentPack = 'raid';
  var lastProof = { mcap: '—', ch24: '—', at: '' };
  var lastPair = null;
  function setShare(kind) {
    if (kind) currentPack = kind;
    var line = buildSharePack(currentPack);
    if ($('dd-share')) $('dd-share').value = line;
    if ($('dd-tweet')) $('dd-tweet').href = intentTweet(line);
    if ($('dd-tweet-alt')) $('dd-tweet-alt').href = intentTweet(buildSharePack('meme'));
    if ($('dd-hero-tweet')) $('dd-hero-tweet').href = intentTweet(buildSharePack('boost'));
  }

  function normalizeMint(s) {
    return String(s || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/^["']|["']$/g, '');
  }
  function verify() {
    var raw = normalizeMint($('dd-paste').value);
    var box = $('dd-verify');
    if (!raw) {
      box.className = 'dd-verify';
      box.textContent = 'Waiting…';
      return;
    }
    if (raw === CA) {
      box.className = 'dd-verify ok';
      box.textContent = 'Exact match for the associated mint shown above. Verify the source links.';
      return;
    }
    if (raw.toLowerCase() === CA.toLowerCase()) {
      box.className = 'dd-verify warn';
      box.textContent = 'Close — mints are case-sensitive. Use the string above.';
      return;
    }
    if (raw.length < 32) {
      box.className = 'dd-verify bad';
      box.textContent = 'Too short. Not a mint.';
      return;
    }
    box.className = 'dd-verify bad';
    box.textContent = 'Does not match the associated mint shown above.';
  }
  function loadMarket() {
    var asof = $('dd-asof');
    asof.textContent = 'Dexscreener · exact Raydium pair · loading…';
    fetch('https://api.dexscreener.com/latest/dex/pairs/solana/' + PAIR_ID, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var p = selectMarketPair(data.pairs, PAIR, CA);
        if (!p) throw new Error('Configured pair unavailable');
        var ch = p.priceChange || {};
        var mcap = p.marketCap;
        var liq = p.liquidity && p.liquidity.usd;
        var vol = p.volume && p.volume.h24;
        $('s-price').textContent = fmtUsd(p.priceUsd);
        $('s-mcap').textContent = fmtUsd(mcap);
        $('s-liq').textContent = fmtUsd(liq);
        $('s-vol').textContent = fmtUsd(vol);
        $('s-5m').textContent = fmtPct(ch.m5);
        $('s-1h').textContent = fmtPct(ch.h1);
        $('s-6h').textContent = fmtPct(ch.h6);
        $('s-24h').textContent = fmtPct(ch.h24);
        if ($('p-mcap')) $('p-mcap').textContent = fmtUsd(mcap);
        if ($('p-liq')) $('p-liq').textContent = fmtUsd(liq);
        if ($('p-vol')) $('p-vol').textContent = fmtUsd(vol);
        if ($('p-24h')) $('p-24h').textContent = fmtPct(ch.h24);
        setTone($('p-24h'), ch.h24);
        setTone($('s-24h'), ch.h24);
        setTone($('s-5m'), ch.m5);
        setTone($('s-1h'), ch.h1);
        setTone($('s-6h'), ch.h6);
        lastProof.mcap = fmtUsd(mcap);
        lastProof.ch24 = fmtPct(ch.h24);
        var fetchedAt = new Date();
        lastPair = p;
        lastProof.at = fetchedAt.toISOString();
        if ($('dd-px')) {
          var el = $('dd-px');
          var next = fmtUsd(p.priceUsd);
          el.hidden = false;
          if (el.textContent !== next) {
            el.textContent = next;
            el.classList.remove('dd-flash');
            void el.offsetWidth;
            el.classList.add('dd-flash');
          } else el.textContent = next;
        }
        var info = p.info || {};
        var imageUrl = safeProviderUrl(info.imageUrl, 'cdn.dexscreener.com');
        if (imageUrl && $('dd-token-img')) $('dd-token-img').src = imageUrl;
        asof.textContent = fetchedAt.toISOString() + ' · Dexscreener · Raydium ' + PAIR_ID.slice(0, 4) + '…' + PAIR_ID.slice(-4) + ' · promotion status not checked';
        if ($('dd-live')) {
          $('dd-live').textContent = 'live';
          $('dd-live').classList.add('dd-pill-ok');
        }
      })
      .catch(function () {
        if (asof) asof.textContent = 'Exact-pair market data unavailable — open chart · promotion status not checked.';
        ['s-price', 's-mcap', 's-liq', 's-vol', 's-5m', 's-1h', 's-6h', 's-24h', 'p-mcap', 'p-liq', 'p-vol', 'p-24h'].forEach(function (id) {
          if ($(id)) {
            $(id).textContent = '—';
            $(id).classList.remove('dd-up', 'dd-down');
          }
        });
        lastProof = { mcap: '—', ch24: '—', at: '' };
        lastPair = null;
        if ($('dd-live')) {
          $('dd-live').textContent = 'unavailable';
          $('dd-live').classList.remove('dd-pill-ok');
        }
        if ($('dd-px')) $('dd-px').hidden = true;
      });
  }
  function hardenImages() {
    var root = document.getElementById('dd-app');
    if (!root) return;
    root.querySelectorAll('img').forEach(function (img) {
      img.addEventListener(
        'error',
        function () {
          if (img.dataset.fallback === '1') return;
          img.dataset.fallback = '1';
          img.removeAttribute('src');
          img.alt = img.alt || 'image unavailable';
          img.classList.add('dd-img-broken');
          img.style.minHeight = img.height ? img.height + 'px' : '88px';
        },
        { once: true },
      );
    });
  }

  function bindQuoteTaps() {
    document.querySelectorAll('[data-share-quote]').forEach(function (el) {
      function fire() {
        var q = el.getAttribute('data-share-quote') || '';
        copy(buildQuoteShare(q), el.querySelector('small') || el);
      }
      el.addEventListener('click', fire);
    });
  }

  document.querySelectorAll('.dd-pack-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.dd-pack-tab').forEach(function (b) {
        b.classList.remove('is-on');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-on');
      btn.setAttribute('aria-selected', 'true');
      setShare(btn.getAttribute('data-pack') || 'raid');
    });
  });

  document.querySelectorAll('[data-copy-line]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copy(btn.getAttribute('data-copy-line') || '', btn);
    });
  });

  if ($('dd-copy'))
    $('dd-copy').addEventListener('click', function () {
      copy(CA, $('dd-copy'));
    });
  if ($('dd-copy-pack-mini'))
    $('dd-copy-pack-mini').addEventListener('click', function () {
      copy(buildMiniPack(), $('dd-copy-pack-mini'));
    });
  if ($('dd-copy-buy'))
    $('dd-copy-buy').addEventListener('click', function () {
      copy(BUY, $('dd-copy-buy'));
    });
  if ($('dd-copy-live'))
    $('dd-copy-live').addEventListener('click', function () {
      copy(buildLiveProof(lastProof.mcap, lastProof.ch24, lastProof.at), $('dd-copy-live'));
    });

  if ($('dd-copy-share'))
    $('dd-copy-share').addEventListener('click', function () {
      copy($('dd-share').value, $('dd-copy-share'));
    });
  if ($('dd-copy-oneliners') && $('dd-oneliners'))
    $('dd-copy-oneliners').addEventListener('click', function () {
      copy($('dd-oneliners').textContent, $('dd-copy-oneliners'));
    });
  if ($('dd-desk-link')) {
    $('dd-desk-link').hidden = !DESK;
    if (DESK) $('dd-desk-url').href = DESK;
  }
  if ($('dd-labs-link')) {
    if (LABS) fetch(LABS, { method: 'HEAD', cache: 'no-store' }).then(function (response) {
      if (!response.ok) return;
      $('dd-labs-link').href = LABS_MINT;
      $('dd-labs-link').hidden = false;
    }).catch(function () {});
  }
  if ($('dd-copy-evidence') && $('dd-evidence-json'))
    $('dd-copy-evidence').addEventListener('click', function () {
      try {
        var evidence = JSON.parse($('dd-evidence-json').textContent);
        copy(JSON.stringify(buildObservationReceipt(evidence, lastPair, lastProof.at), null, 2), $('dd-copy-evidence'));
      } catch (_) {
        $('dd-copy-evidence').textContent = 'Evidence unavailable';
      }
    });
  if ($('dd-native-share'))
    $('dd-native-share').addEventListener('click', function () {
      var text = ($('dd-share') && $('dd-share').value) || buildSharePack('boost');
      if (navigator.share) {
        var payload = { title: '$dasha', text: text };
        if (DESK) payload.url = DESK;
        navigator
          .share(payload)
          .catch(function () {
            copy(text, $('dd-native-share'));
          });
      } else {
        copy(text, $('dd-native-share'));
      }
    });
  if ($('dd-paste')) {
    $('dd-paste').addEventListener('input', verify);
    $('dd-paste').addEventListener('paste', function () {
      setTimeout(verify, 0);
    });
  }
  if ($('dd-refresh')) $('dd-refresh').addEventListener('click', loadMarket);


  setShare('raid');
  bindQuoteTaps();
  hardenImages();
  drawQr(CA);
  loadMarket();
  setInterval(loadMarket, 30000);
})();
