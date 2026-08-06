(function(){
  var CA = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
  var PAIR = 'https://dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7';
  if (!document.getElementById('dd-app')) return;
  function $(id){ return document.getElementById(id); }
  function fmtUsd(n){
    n = Number(n);
    if (!isFinite(n)) return '—';
    if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
    if (n >= 1e3) return '$' + (n/1e3).toFixed(2) + 'K';
    if (n >= 1) return '$' + n.toFixed(2);
    if (n >= 0.0001) return '$' + n.toFixed(6);
    return '$' + n.toExponential(2);
  }
  function fmtPct(n){
    if (n == null || !isFinite(Number(n))) return '—';
    var v = Number(n);
    return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  }
  function copy(text, el){
    function ok(){
      var t = $('dd-toast');
      if (t){ t.hidden = false; setTimeout(function(){ t.hidden = true; }, 1200); }
      if (el){ var o = el.textContent; el.textContent = 'Copied'; setTimeout(function(){ el.textContent = o; }, 900); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(fallback);
    } else fallback();
    function fallback(){
      var a = document.createElement('textarea');
      a.value = text; document.body.appendChild(a); a.select();
      try { document.execCommand('copy'); ok(); } catch(e) {}
      document.body.removeChild(a);
    }
  }
  function drawQr(text){
    var c = $('dd-qr'); if (!c) return;
    var ctx = c.getContext('2d');
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function(){
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,c.width,c.height);
      ctx.drawImage(img, 6, 6, c.width-12, c.height-12);
    };
    img.onerror = function(){
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,c.width,c.height);
      ctx.fillStyle = '#12091c'; ctx.font = '9px monospace';
      (text.match(/.{1,16}/g) || []).forEach(function(line,i){ ctx.fillText(line, 6, 18 + i*11); });
    };
    img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=148x148&data=' + encodeURIComponent(text);
  }
  function setShare(){
    var line = '$dasha · ' + CA + ' · @dash_eats · ' + PAIR;
    if ($('dd-share')) $('dd-share').value = line;
    if ($('dd-tweet')) $('dd-tweet').href = 'https://x.com/intent/tweet?text=' + encodeURIComponent(line);
  }
  function normalizeMint(s){
    return String(s || '').trim().replace(/\s+/g,'').replace(/^["']|["']$/g,'');
  }
  function verify(){
    var raw = normalizeMint($('dd-paste').value);
    var box = $('dd-verify');
    if (!raw){ box.className = 'dd-verify'; box.textContent = 'Waiting…'; return; }
    if (raw === CA){ box.className = 'dd-verify ok'; box.textContent = 'Exact match for the associated mint shown above. Verify the source links.'; return; }
    if (raw.toLowerCase() === CA.toLowerCase()){ box.className = 'dd-verify warn'; box.textContent = 'Close — mints are case-sensitive. Use the string above.'; return; }
    if (raw.length < 32){ box.className = 'dd-verify bad'; box.textContent = 'Too short. Not a mint.'; return; }
    box.className = 'dd-verify bad'; box.textContent = 'Does not match the associated mint shown above.';
  }
  function loadMarket(){
    var asof = $('dd-asof');
    asof.textContent = 'Loading Dex…';
    fetch('https://api.dexscreener.com/latest/dex/tokens/' + CA, { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(data){
        var pairs = data.pairs || [];
        if (!pairs.length) throw new Error('No pairs');
        pairs.sort(function(a,b){ return ((b.liquidity&&b.liquidity.usd)||0) - ((a.liquidity&&a.liquidity.usd)||0); });
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
        if (p.url) $('dd-chart').href = p.url;
        asof.textContent = new Date().toLocaleString() + ' · Dex';
        $('dd-live').textContent = 'live';
      })
      .catch(function(){
        asof.textContent = 'Dex offline — use Chart.';
        $('dd-live').textContent = 'offline';
      });
  }
  $('dd-copy').addEventListener('click', function(){ copy(CA, $('dd-copy')); });
  $('dd-copy-short').addEventListener('click', function(){ copy(CA, $('dd-copy-short')); });
  $('dd-copy-share').addEventListener('click', function(){ copy($('dd-share').value, $('dd-copy-share')); });
  $('dd-paste').addEventListener('input', verify);
  $('dd-paste').addEventListener('paste', function(){ setTimeout(verify, 0); });
  $('dd-refresh').addEventListener('click', loadMarket);
  setShare();
  drawQr(CA);
  loadMarket();
  setInterval(loadMarket, 60000);
})();
