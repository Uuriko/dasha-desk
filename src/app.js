(function () {
  var CA = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
  var PAIR = 'https://dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7';
  var CASINO = 'How u crying at the casino and u can’t even get in';

  /** Pure share-pack builders — unit-tested via global.DDShare */
  function buildSharePack(kind) {
    kind = kind || 'raid';
    if (kind === 'discord') {
      return (
        '**$dasha** desk pack\n' +
        '`' + CA + '`\n' +
        CASINO + '\n' +
        'Chart: ' + PAIR + '\n' +
        'NFA · can go to zero · association ≠ endorsement'
      );
    }
    if (kind === 'verify') {
      return (
        'Verify this mint yourself:\n' +
        CA + '\n' +
        'Solscan: https://solscan.io/token/' + CA + '\n' +
        'Rugcheck: https://rugcheck.xyz/tokens/' + CA + '\n' +
        'If a DM shows a different string, ignore it.'
      );
    }
    if (kind === 'meme') {
      return CASINO + '\n$dasha\n' + CA + '\n@dash_eats · still optimistic · NFA';
    }
    // raid default
    return (
      CASINO + '\n' +
      '$dasha ' + CA + '\n' +
      '@dash_eats · still holding · ' + PAIR
    );
  }

  function buildQuoteShare(quote) {
    var q = String(quote || '').trim();
    if (!q) return '';
    return q + '\n$dasha · Solana · NFA';
  }

  function buildMiniPack() {
    return CASINO + '\n' + CA;
  }

  function intentTweet(text) {
    return 'https://x.com/intent/tweet?text=' + encodeURIComponent(text);
  }

  var DDShare = {
    CA: CA,
    PAIR: PAIR,
    buildSharePack: buildSharePack,
    buildQuoteShare: buildQuoteShare,
    buildMiniPack: buildMiniPack,
    intentTweet: intentTweet,
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
        $('s-price').textContent = fmtUsd(p.priceUsd);
        $('s-mcap').textContent = fmtUsd(p.marketCap || p.fdv);
        $('s-liq').textContent = fmtUsd(p.liquidity && p.liquidity.usd);
        $('s-vol').textContent = fmtUsd(p.volume && p.volume.h24);
        $('s-5m').textContent = fmtPct(ch.m5);
        $('s-1h').textContent = fmtPct(ch.h1);
        $('s-6h').textContent = fmtPct(ch.h6);
        $('s-24h').textContent = fmtPct(ch.h24);
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
        if (p.url) $('dd-chart').href = p.url;
        var info = p.info || {};
        if (info.imageUrl && $('dd-token-img'))
          $('dd-token-img').src = String(info.imageUrl).split('?')[0];
        asof.textContent = new Date().toLocaleString() + ' · Dex';
        $('dd-live').textContent = 'live';
      })
      .catch(function () {
        asof.textContent = 'Dex offline — use Chart.';
        $('dd-live').textContent = 'offline';
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
  setInterval(loadMarket, 60000);
})();
