(function () {
  var CA = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
  var PAIR = 'https://dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7';
  var CASINO = 'How u crying at the casino and u can’t even get in';

  var DESK =
    'https://johns-awesome-project-39b1b5.webflow.io/dasha';
  var BUY =
    'https://jup.ag/swap/SOL-53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

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
        'Desk: ' +
        DESK +
        '\n' +
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
    if (kind === 'hold') {
      return (
        "I'm still holding $dasha\n" +
        CA +
        '\n' +
        'Buy → ' +
        BUY +
        '\n' +
        'Desk → ' +
        DESK +
        '\n' +
        'NFA · can go to zero · association ≠ endorsement'
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
        'Desk: ' +
        DESK +
        '\n' +
        'NFA · can go to zero'
      );
    }
    if (kind === 'raid_b') {
      return (
        'Casino open. $dasha is live.\n' +
        'CA ' +
        CA +
        '\n' +
        'Buy → ' +
        BUY +
        '\n' +
        'Desk → ' +
        DESK +
        '\n' +
        'NFA · can go to zero'
      );
    }
    // raid / raid_a default — casino hook + full funnel
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
      'Desk → ' +
      DESK +
      '\n' +
      'Get in · NFA · can go to zero'
    );
  }

  /** Live social-proof pack — unit-tested via DDShare.buildLiveProof */
  function buildLiveProof(mcapLabel, ch24Label) {
    var m = mcapLabel && String(mcapLabel) !== '—' ? String(mcapLabel) : 'live';
    var c = ch24Label && String(ch24Label) !== '—' ? String(ch24Label) : '';
    return (
      '$dasha live · mcap ' +
      m +
      (c ? ' · 24h ' + c : '') +
      '\n' +
      'Buy → ' +
      BUY +
      '\n' +
      'Desk → ' +
      DESK +
      '\n' +
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

  var DDShare = {
    CA: CA,
    PAIR: PAIR,
    DESK: DESK,
    BUY: BUY,
    buildSharePack: buildSharePack,
    buildQuoteShare: buildQuoteShare,
    buildMiniPack: buildMiniPack,
    buildLiveProof: buildLiveProof,
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
  var raidAb = 'a';
  var smartPackPicked = false;
  var lastProof = { mcap: '—', ch24: '—', vol: '—', ch24n: null, m5n: null };
  function resolvePack(kind) {
    kind = kind || currentPack || 'raid';
    if (kind === 'raid' || kind === 'raid_a' || kind === 'raid_b') {
      return raidAb === 'b' ? 'raid_b' : 'raid';
    }
    return kind;
  }
  function setShare(kind) {
    if (kind) currentPack = kind;
    var line = buildSharePack(resolvePack(currentPack));
    if ($('dd-share')) $('dd-share').value = line;
    if ($('dd-tweet')) $('dd-tweet').href = intentTweet(line);
    if ($('dd-tweet-alt')) $('dd-tweet-alt').href = intentTweet(buildSharePack('meme'));
    if ($('dd-sticky-tweet')) {
      var raidLine =
        lastProof.mcap && lastProof.mcap !== '—'
          ? buildLiveProof(lastProof.mcap, lastProof.ch24)
          : buildSharePack('raid');
      $('dd-sticky-tweet').href = intentTweet(raidLine);
    }
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
        if ($('sp-mcap')) $('sp-mcap').textContent = fmtUsd(mcap);
        if ($('sp-liq')) $('sp-liq').textContent = fmtUsd(liq);
        if ($('sp-vol')) $('sp-vol').textContent = fmtUsd(vol);
        if ($('sp-24h')) {
          $('sp-24h').textContent = fmtPct(ch.h24);
          setTone($('sp-24h'), ch.h24);
        }
        setTone($('p-24h'), ch.h24);
        setTone($('s-24h'), ch.h24);
        setTone($('s-5m'), ch.m5);
        setTone($('s-1h'), ch.h1);
        setTone($('s-6h'), ch.h6);
        lastProof.mcap = fmtUsd(mcap);
        lastProof.ch24 = fmtPct(ch.h24);
        lastProof.vol = fmtUsd(vol);
        lastProof.ch24n = Number(ch.h24);
        lastProof.m5n = Number(ch.m5);
        if ($('dd-fomo-main') && $('dd-fomo')) {
          var chN = lastProof.ch24n;
          var m5N = lastProof.m5n;
          var fomo = $('dd-fomo');
          var hot = (isFinite(chN) && Math.abs(chN) >= 5) || (isFinite(m5N) && Math.abs(m5N) >= 2);
          if (isFinite(chN) && chN > 0) {
            $('dd-fomo-main').textContent = 'Moving · 24h ' + lastProof.ch24;
            fomo.classList.add('is-up');
            fomo.classList.remove('is-down');
          } else if (isFinite(chN) && chN < 0) {
            $('dd-fomo-main').textContent = 'Dip · 24h ' + lastProof.ch24;
            fomo.classList.add('is-down');
            fomo.classList.remove('is-up');
          } else {
            $('dd-fomo-main').textContent = 'Live · mcap ' + lastProof.mcap;
            fomo.classList.remove('is-up', 'is-down');
          }
          if (hot) fomo.classList.add('is-hot');
          else fomo.classList.remove('is-hot');
          if ($('dd-fomo-hot')) $('dd-fomo-hot').hidden = !hot;
          if ($('dd-sticky')) {
            if (hot) $('dd-sticky').classList.add('is-hot');
            else $('dd-sticky').classList.remove('is-hot');
          }
          if ($('dd-buy-sticky')) {
            $('dd-buy-sticky').textContent =
              lastProof.mcap && lastProof.mcap !== '—'
                ? 'Buy · ' + lastProof.mcap
                : 'Buy now';
            $('dd-buy-sticky').classList.add('dd-pulse-buy');
          }
          if ($('dd-buy')) $('dd-buy').classList.add('dd-pulse-buy');
          if ($('dd-social-proof-hint')) {
            $('dd-social-proof-hint').textContent = hot
              ? 'HOT · tap to copy live pack'
              : 'Tap · copy share-ready live pack';
          }
        }
        if ($('dd-fomo-sub')) {
          var m5s = isFinite(lastProof.m5n) ? ' · 5m ' + fmtPct(ch.m5) : '';
          $('dd-fomo-sub').textContent =
            'Vol ' + fmtUsd(vol) + ' · liq ' + fmtUsd(liq) + m5s + ' · just now · NFA';
        }
        if (!smartPackPicked && isFinite(lastProof.ch24n)) {
          smartPackPicked = true;
          var smart =
            lastProof.ch24n > 2 ? 'boost' : lastProof.ch24n < -2 ? 'hold' : 'raid';
          currentPack = smart;
          document.querySelectorAll('.dd-pack-tab').forEach(function (b) {
            var on = (b.getAttribute('data-pack') || '') === smart;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          setShare(smart);
        }
        if ($('dd-social-proof-text')) {
          $('dd-social-proof-text').textContent =
            '$dasha live · mcap ' +
            lastProof.mcap +
            ' · 24h ' +
            lastProof.ch24 +
            ' · NFA';
        } else if ($('dd-social-proof')) {
          $('dd-social-proof').textContent =
            '$dasha live · mcap ' +
            lastProof.mcap +
            ' · 24h ' +
            lastProof.ch24 +
            ' · NFA';
        }
        if ($('dd-social-proof')) {
          $('dd-social-proof').classList.remove('is-flash');
          void $('dd-social-proof').offsetWidth;
          $('dd-social-proof').classList.add('is-flash');
        }
        // Keep Raid X intent fresh with live numbers when available
        if ($('dd-sticky-tweet')) {
          $('dd-sticky-tweet').href = intentTweet(
            lastProof.mcap && lastProof.mcap !== '—'
              ? buildLiveProof(lastProof.mcap, lastProof.ch24)
              : buildSharePack('raid'),
          );
        }
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
        if (window.__ddRefreshSpTweet) window.__ddRefreshSpTweet();
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
  if ($('dd-sticky-live'))
    $('dd-sticky-live').addEventListener('click', function () {
      copy(buildLiveProof(lastProof.mcap, lastProof.ch24), $('dd-sticky-live'));
    });
  if ($('dd-copy-buy'))
    $('dd-copy-buy').addEventListener('click', function () {
      copy(BUY, $('dd-copy-buy'));
    });
  if ($('dd-copy-live'))
    $('dd-copy-live').addEventListener('click', function () {
      copy(buildLiveProof(lastProof.mcap, lastProof.ch24), $('dd-copy-live'));
    });
  if ($('dd-copy-hold'))
    $('dd-copy-hold').addEventListener('click', function () {
      copy(buildSharePack('hold'), $('dd-copy-hold'));
    });

  if ($('dd-social-proof'))
    $('dd-social-proof').addEventListener('click', function () {
      copy(buildLiveProof(lastProof.mcap, lastProof.ch24), $('dd-social-proof-hint') || $('dd-social-proof'));
    });

  if ($('dd-copy-share'))
    $('dd-copy-share').addEventListener('click', function () {
      copy($('dd-share').value, $('dd-copy-share'));
    });
  if ($('dd-copy-oneliners') && $('dd-oneliners'))
    $('dd-copy-oneliners').addEventListener('click', function () {
      copy($('dd-oneliners').textContent, $('dd-copy-oneliners'));
    });
  if ($('dd-native-share'))
    $('dd-native-share').addEventListener('click', function () {
      var text = ($('dd-share') && $('dd-share').value) || buildSharePack('boost');
      if (navigator.share) {
        navigator
          .share({ title: '$dasha', text: text, url: DESK })
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


  try {
    var savedAb = localStorage.getItem('dd_raid_ab');
    if (savedAb === 'a' || savedAb === 'b') raidAb = savedAb;
  } catch (e) {}
  document.querySelectorAll('[data-raid-ab]').forEach(function (btn) {
    if ((btn.getAttribute('data-raid-ab') || '') === raidAb) {
      btn.classList.add('is-on');
    } else {
      btn.classList.remove('is-on');
    }
    btn.addEventListener('click', function () {
      raidAb = btn.getAttribute('data-raid-ab') === 'b' ? 'b' : 'a';
      document.querySelectorAll('[data-raid-ab]').forEach(function (b) {
        b.classList.toggle('is-on', (b.getAttribute('data-raid-ab') || '') === raidAb);
      });
      try {
        localStorage.setItem('dd_raid_ab', raidAb);
      } catch (e2) {}
      if ($('dd-ab-note')) {
        $('dd-ab-note').textContent =
          raidAb === 'b' ? 'B = short get-in · active' : 'A = casino hook · active';
      }
      // switch to raid pack surface when A/B changes
      currentPack = 'raid';
      document.querySelectorAll('.dd-pack-tab').forEach(function (b) {
        var on = (b.getAttribute('data-pack') || '') === 'raid';
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      setShare('raid');
    });
  });


  function openExit() {
    if (!$('dd-exit') || $('dd-exit').hidden === false) return;
    try {
      if (sessionStorage.getItem('dd_exit_shown') === '1') return;
      sessionStorage.setItem('dd_exit_shown', '1');
    } catch (e) {}
    $('dd-exit').hidden = false;
    if ($('dd-exit-copy') && lastProof.mcap && lastProof.mcap !== '—') {
      $('dd-exit-copy').textContent =
        'Live mcap ' +
        lastProof.mcap +
        ' · 24h ' +
        lastProof.ch24 +
        '. Copy hold pack or buy. NFA · can go to zero.';
    }
  }
  function closeExit() {
    if ($('dd-exit')) $('dd-exit').hidden = true;
  }
  if ($('dd-sp-copy-live'))
    $('dd-sp-copy-live').addEventListener('click', function () {
      copy(buildLiveProof(lastProof.mcap, lastProof.ch24), $('dd-sp-copy-live'));
    });
  if ($('dd-sp-copy-hold'))
    $('dd-sp-copy-hold').addEventListener('click', function () {
      copy(buildSharePack('hold'), $('dd-sp-copy-hold'));
    });
  if ($('dd-sp-tweet')) {
    function refreshSpTweet() {
      var line =
        lastProof.mcap && lastProof.mcap !== '—'
          ? buildLiveProof(lastProof.mcap, lastProof.ch24)
          : buildSharePack('boost');
      $('dd-sp-tweet').href = intentTweet(line);
    }
    refreshSpTweet();
    // refresh after markets too via setShare path - also call in loadMarket via sticky update
    window.__ddRefreshSpTweet = refreshSpTweet;
  }
  if ($('dd-exit-close')) $('dd-exit-close').addEventListener('click', closeExit);
  if ($('dd-exit-hold'))
    $('dd-exit-hold').addEventListener('click', function () {
      copy(buildSharePack('hold'), $('dd-exit-hold'));
    });
  if ($('dd-exit'))
    $('dd-exit').addEventListener('click', function (e) {
      if (e.target === $('dd-exit')) closeExit();
    });
  // desktop exit-intent: mouse leaves top of viewport once per session
  document.addEventListener('mouseout', function (e) {
    if (!e) return;
    if (e.clientY > 0) return;
    if (e.relatedTarget || e.toElement) return;
    openExit();
  });
  // mobile soft exit: tab hidden after engagement
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      // do not open while hidden; mark for next show
      try {
        sessionStorage.setItem('dd_exit_pending', '1');
      } catch (e2) {}
    } else {
      try {
        if (sessionStorage.getItem('dd_exit_pending') === '1') {
          sessionStorage.removeItem('dd_exit_pending');
          // only if user returned quickly? skip auto-open on return — too spammy
        }
      } catch (e3) {}
    }
  });

  setShare('raid');
  bindQuoteTaps();
  hardenImages();
  drawQr(CA);
  loadMarket();
  setInterval(loadMarket, 30000);
})();
