(function () {
  var CA = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
  var PAIR = 'https://dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7';
  var BUY =
    'https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=' + CA;
  var SOLSCAN = 'https://solscan.io/token/' + CA;
  var RUG = 'https://rugcheck.xyz/tokens/' + CA;
  var DESK = 'https://www.getdasha.com/dasha';
  var CASINO = 'How u crying at the casino and u can’t even get in';
  var DEX =
    'https://api.dexscreener.com/latest/dex/tokens/' + CA;

  function $(id) {
    return document.getElementById(id);
  }

  function buildSharePack(kind) {
    kind = kind || 'share';
    if (kind === 'verify') {
      return (
        '$dasha mint (verify before buy)\n' +
        CA +
        '\n' +
        SOLSCAN +
        '\n' +
        RUG +
        '\nCulture coin. Can go to zero. NFA.'
      );
    }
    // Neutral fact pack for every other kind (share/default). No FOMO, raid, or referral.
    return (
      '$dasha · Solana culture coin\n' +
      CASINO +
      '\n\nMint:\n' +
      CA +
      '\n\nChart:\n' +
      PAIR +
      '\n\nDesk:\n' +
      DESK +
      '\n\nCulture coin. Can go to zero. Not financial advice. Association is not endorsement.'
    );
  }

  function normalizeMint(raw) {
    var s = String(raw || '')
      .trim()
      /* zero-width / BOM that break exact match when pasting */
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, '');
    /* paste of explorer / jupiter / phantom URL → extract base58 mint */
    var m = s.match(/[1-9A-HJ-NP-Za-km-z]{32,50}/);
    if (m) {
      /* prefer segment after /token/ or buy= when present */
      var u = s.match(/(?:token\/|buy=|mint=)([1-9A-HJ-NP-Za-km-z]{32,50})/i);
      return (u && u[1]) || m[0];
    }
    return s;
  }

  // Pure export for unit tests / reuse (no FOMO builders).
  globalThis.DDShare = {
    CA: CA,
    PAIR: PAIR,
    BUY: BUY,
    DESK: DESK,
    buildSharePack: buildSharePack,
    normalizeMint: normalizeMint,
  };

  if (typeof document === 'undefined') return;

  function toast(el, label) {
    if (!el) return;
    var prev = el.textContent;
    el.textContent = label || 'Copied';
    setTimeout(function () {
      el.textContent = prev;
    }, 1400);
  }

  function copy(text, btn) {
    var done = function () {
      toast(btn, 'Copied');
      var t = $('dd-toast');
      if (t) {
        t.hidden = false;
        setTimeout(function () {
          t.hidden = true;
        }, 1400);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(ta);
  }


  function verify() {
    var box = $('dd-verify');
    var paste = $('dd-paste');
    if (!box || !paste) return;
    var raw = normalizeMint(paste.value);
    if (!raw) {
      box.className = 'dd-verify';
      box.textContent = 'Waiting…';
      return;
    }
    if (raw === CA) {
      box.className = 'dd-verify ok';
      box.textContent = 'Exact match — this is the associated mint.';
      return;
    }
    if (raw.length >= 32 && raw.length <= 50 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(raw)) {
      box.className = 'dd-verify bad';
      box.textContent = 'Does not match the associated mint.';
      return;
    }
    box.className = 'dd-verify warn';
    box.textContent = 'Not a Solana mint format.';
  }

  function money(n) {
    if (n == null || !isFinite(n)) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    if (n >= 1) return '$' + n.toFixed(2);
    return '$' + n.toPrecision(3);
  }

  function pct(n) {
    if (n == null || !isFinite(n)) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    return s;
  }

  function setShare() {
    var line = buildSharePack('share');
    if ($('dd-share')) $('dd-share').value = line;
    if ($('dd-tweet')) {
      $('dd-tweet').href =
        'https://x.com/intent/post?text=' + encodeURIComponent(line);
    }
  }

  function paintPair(pair) {
    if (!pair) return;
    var price = Number(pair.priceUsd);
    var mcap = Number(pair.marketCap || pair.fdv);
    var liq = pair.liquidity && Number(pair.liquidity.usd);
    var ch = pair.priceChange && Number(pair.priceChange.h24);
    if ($('s-price')) $('s-price').textContent = money(price);
    if ($('s-mcap')) $('s-mcap').textContent = money(mcap);
    if ($('s-liq')) $('s-liq').textContent = money(liq);
    if ($('s-24h')) {
      $('s-24h').textContent = pct(ch);
      $('s-24h').style.color =
        ch > 0 ? 'var(--ok)' : ch < 0 ? 'var(--bad)' : 'var(--text)';
    }
    if ($('dd-px')) $('dd-px').textContent = money(price);
    if ($('dd-asof')) {
      $('dd-asof').textContent =
        'Dexscreener · ' +
        (pair.dexId || 'pool') +
        ' · ' +
        new Date().toLocaleTimeString();
    }
    if ($('dd-live')) $('dd-live').textContent = 'live';
  }

  function refresh() {
    if ($('dd-asof')) $('dd-asof').textContent = 'Refreshing…';
    if ($('dd-live')) $('dd-live').textContent = '…';
    fetch(DEX, { cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var pairs = (data && data.pairs) || [];
        if (!pairs.length) {
          if ($('dd-asof')) $('dd-asof').textContent = 'Dex: no pools returned';
          if ($('dd-live')) $('dd-live').textContent = 'no pool';
          return;
        }
        var best = pairs[0];
        for (var i = 1; i < pairs.length; i++) {
          var a = pairs[i].liquidity && pairs[i].liquidity.usd;
          var b = best.liquidity && best.liquidity.usd;
          if ((a || 0) > (b || 0)) best = pairs[i];
        }
        paintPair(best);
      })
      .catch(function () {
        if ($('dd-asof')) $('dd-asof').textContent = 'Dex unreachable · try Refresh';
        if ($('dd-live')) $('dd-live').textContent = 'offline';
      });
  }

  if ($('dd-copy')) {
    $('dd-copy').addEventListener('click', function () {
      copy(CA, $('dd-copy'));
    });
  }
  if ($('dd-copy-share')) {
    $('dd-copy-share').addEventListener('click', function () {
      copy(($('dd-share') && $('dd-share').value) || buildSharePack('share'), $('dd-copy-share'));
    });
  }
  if ($('dd-paste')) {
    $('dd-paste').addEventListener('input', verify);
    $('dd-paste').addEventListener('paste', function () {
      setTimeout(verify, 0);
    });
  }
  if ($('dd-refresh')) {
    $('dd-refresh').addEventListener('click', refresh);
  }

  setShare();
  refresh();
  setInterval(refresh, 60000);
})();
