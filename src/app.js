(function () {
  var CA = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
  var PAIR = 'https://dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7';
  var CASINO = 'How u crying at the casino and u can’t even get in';

  var DESK_FALLBACK = 'https://www.getdasha.com/';
  var DESK_DEPLOYMENTS = [
    DESK_FALLBACK,
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
    var canonicals = [];
    try {
      canonicals = Array.from(doc && doc.querySelectorAll ? doc.querySelectorAll('link[rel]') : []).filter(function (link) {
        return String(link.getAttribute('rel') || '').toLowerCase().split(/\s+/).includes('canonical');
      });
    } catch (_) {}
    if (canonicals.length === 1 && clean(canonicals[0].getAttribute('href')) === DESK_FALLBACK)
      return DESK_FALLBACK;
    return DESK_DEPLOYMENTS.includes(current) ? current : '';
  }

  var DESK = resolveDeskUrl(
    typeof document === 'undefined' ? null : document,
    typeof location === 'undefined' ? null : location,
    DESK_FALLBACK,
  );

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
        'Still early on $dasha\n' +
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
    // raid default — short, postable, conversion-oriented
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
      '@dash_eats · still holding · NFA'
    );
  }

  function buildQuoteShare(quote) {
    var q = String(quote || '').trim();
    if (!q) return '';
    return q + '\n$dasha · ' + CA + '\nBuy ' + BUY + ' · NFA';
  }

  function buildMiniPack() {
    return CASINO + '\n' + CA + '\n' + BUY;
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

  var DDShare = {
    CA: CA,
    PAIR: PAIR,
    DESK: DESK,
    BUY: BUY,
    resolveDeskUrl: resolveDeskUrl,
    buildSharePack: buildSharePack,
    buildQuoteShare: buildQuoteShare,
    buildMiniPack: buildMiniPack,
    intentTweet: intentTweet,
    safeProviderUrl: safeProviderUrl,
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
        document.execCommand('copy');
        ok();
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
  function setShare(kind) {
    if (kind) currentPack = kind;
    var line = buildSharePack(currentPack);
    if ($('dd-share')) $('dd-share').value = line;
    if ($('dd-tweet')) $('dd-tweet').href = intentTweet(line);
    if ($('dd-tweet-alt')) $('dd-tweet-alt').href = intentTweet(buildSharePack('meme'));
    if ($('dd-sticky-tweet')) $('dd-sticky-tweet').href = intentTweet(buildSharePack('raid'));
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
    asof.textContent = 'Loading Dex…';
    fetch('https://api.dexscreener.com/latest/dex/tokens/' + CA, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var pairs = data.pairs || [];
        if (!pairs.length) throw new Error('No pairs');
        pairs.sort(function (a, b) {
          return (
            ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0)
          );
        });
        var p = pairs[0];
        var ch = p.priceChange || {};
        var mcap = p.marketCap || p.fdv;
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
        if ($('dd-px')) {
          var el = $('dd-px');
          var next = fmtUsd(p.priceUsd);
          if (el.textContent !== next) {
            el.textContent = next;
            el.classList.remove('dd-flash');
            void el.offsetWidth;
            el.classList.add('dd-flash');
          } else el.textContent = next;
        }
        if ($('dd-sticky-px')) $('dd-sticky-px').textContent = fmtUsd(p.priceUsd);
        var chartUrl = safeProviderUrl(p.url, 'dexscreener.com');
        if (chartUrl && $('dd-chart')) $('dd-chart').href = chartUrl;
        var info = p.info || {};
        var imageUrl = safeProviderUrl(info.imageUrl, 'cdn.dexscreener.com');
        if (imageUrl && $('dd-token-img')) $('dd-token-img').src = imageUrl;
        asof.textContent = new Date().toLocaleString() + ' · Dex';
        if ($('dd-live')) $('dd-live').textContent = 'live';
      })
      .catch(function () {
        if (asof) asof.textContent = 'Dex offline — use Chart.';
        if ($('dd-live')) $('dd-live').textContent = 'offline';
        if ($('dd-px')) $('dd-px').textContent = 'offline';
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
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fire();
        }
      });
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
  if ($('dd-copy-short'))
    $('dd-copy-short').addEventListener('click', function () {
      copy(CA.slice(0, 4) + '…' + CA.slice(-4), $('dd-copy-short'));
    });
  if ($('dd-copy-pack-mini'))
    $('dd-copy-pack-mini').addEventListener('click', function () {
      copy(buildMiniPack(), $('dd-copy-pack-mini'));
    });
  if ($('dd-sticky-copy'))
    $('dd-sticky-copy').addEventListener('click', function () {
      copy(CA, $('dd-sticky-copy'));
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
    if (DESK) $('dd-desk-url').href = DESK;
    else $('dd-desk-link').hidden = true;
  }
  if ($('dd-copy-evidence') && $('dd-evidence-json'))
    $('dd-copy-evidence').addEventListener('click', function () {
      copy($('dd-evidence-json').textContent, $('dd-copy-evidence'));
    });
  if ($('dd-native-share'))
    $('dd-native-share').addEventListener('click', function () {
      var text = ($('dd-share') && $('dd-share').value) || buildSharePack('raid');
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
