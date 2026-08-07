(function () {
  var CA = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
  var PAIR = 'https://dexscreener.com/solana/9kkdpvuqrqxjiuymfcy1cwqrxlwdcggur2cap2qt7bu7';
  var CASINO = 'How u crying at the casino and u can’t even get in';

  var DESK_BASE =
    'https://johns-awesome-project-39b1b5.webflow.io/dasha';
  // Explicit Jupiter deep-link (SOL → $dasha mint)
  var BUY_BASE =
    'https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=' + CA;

  function getRef() {
    try {
      var r = localStorage.getItem('dd_ref');
      if (r && /^[a-z0-9]{4,8}$/i.test(r)) return r;
      r = Math.random().toString(36).slice(2, 8);
      localStorage.setItem('dd_ref', r);
      return r;
    } catch (e) {
      return 'desk';
    }
  }

  /**
   * Invite ref for share/buy URLs: prefer inbound dd_from (who sent you)
   * so FOMO/sticky Jupiter links attribute the inviter; else own getRef().
   */
  function inviteRef() {
    try {
      var from = localStorage.getItem('dd_from');
      if (from && /^[a-z0-9]{4,8}$/i.test(from)) return from;
    } catch (eFrom) {}
    return getRef();
  }

  function deskUrl() {
    var base = DESK_BASE;
    var ref = getRef();
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'ref=' + encodeURIComponent(ref);
  }

  /** Jupiter deep-link; optional SOL amount; always carries invite ?ref= */
  function buyUrl(sol) {
    var base = BUY_BASE;
    if (sol != null && sol !== '') {
      var n = Number(sol);
      if (isFinite(n) && n > 0) {
        // jup.ag accepts amount as the sell-side (SOL) quantity
        base =
          base +
          (base.indexOf('?') >= 0 ? '&' : '?') +
          'amount=' +
          encodeURIComponent(String(n));
      }
    }
    var ref = inviteRef();
    return (
      base +
      (base.indexOf('?') >= 0 ? '&' : '?') +
      'ref=' +
      encodeURIComponent(ref)
    );
  }

  // Compat aliases used throughout
  var DESK = DESK_BASE;
  var BUY = BUY_BASE;

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
        buyUrl() +
        '\n' +
        'Chart: ' +
        PAIR +
        '\n' +
        'Desk: ' +
        deskUrl() +
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
        buyUrl() +
        '\n' +
        'Desk → ' +
        deskUrl() +
        '\n' +
        'NFA · can go to zero · association ≠ endorsement'
      );
    }
    if (kind === 'invite') {
      return (
        'Open $dasha desk → ' +
        deskUrl() +
        '\n' +
        'Buy → ' +
        buyUrl() +
        '\n' +
        CASINO +
        '\nNFA · can go to zero'
      );
    }
    if (kind === 'meme') {
      return CASINO + '\n$dasha\n' + CA + '\n' + deskUrl() + '\n@dash_eats · still optimistic · NFA';
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
        buyUrl() +
        '\n' +
        'Desk: ' +
        deskUrl() +
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
        buyUrl() +
        '\n' +
        'Desk → ' +
        deskUrl() +
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
      buyUrl() +
      '\n' +
      'Chart → ' +
      PAIR +
      '\n' +
      'Desk → ' +
      deskUrl() +
      '\n' +
      'Get in · NFA · can go to zero'
    );
  }

  /** Live social-proof pack — unit-tested via DDShare.buildLiveProof */
  /**
   * Live social-proof pack — pure, unit-tested via DDShare.buildLiveProof.
   * V38: hard/deep dip + 24h still → recovery header for viral paste.
   */
  function buildLiveProof(mcapLabel, ch24Label, dip, netShort) {
    var m = mcapLabel && String(mcapLabel) !== '—' ? String(mcapLabel) : 'live';
    var c = ch24Label && String(ch24Label) !== '—' ? String(ch24Label) : '';
    var depth = dip ? dipDepth(dip) : null;
    var still = dip ? stillGreen24(dip) : null;
    var head;
    // V42: dump-aware viral live pack (honest 24h red context)
    if (dip && dip.kind === 'dump' && depth && depth.tier !== 'soft') {
      head =
        '$dasha · ' +
        depth.word.toLowerCase() +
        ' · ' +
        depth.shortLabel +
        ' ' +
        (depth.shortPct > 0 ? '+' : '') +
        depth.shortPct.toFixed(1) +
        '%';
      if (dip.ch24 != null && isFinite(Number(dip.ch24))) {
        head =
          head +
          ' · 24h ' +
          (Number(dip.ch24) > 0 ? '+' : '') +
          Number(dip.ch24).toFixed(1) +
          '%';
      }
      if (netShort && String(netShort).charAt(0) === '+') {
        head = head + ' · ' + String(netShort) + ' net';
      }
      head = head + ' · mcap ' + m;
    } else if (depth && depth.tier !== 'soft' && still && still.short) {
      head =
        '$dasha · ' +
        depth.tag.toLowerCase() +
        ' dip · ' +
        still.short +
        ' still';
      if (netShort && String(netShort).charAt(0) === '+') {
        head = head + ' · ' + String(netShort) + ' net';
      }
      head = head + ' · mcap ' + m;
    } else {
      head =
        '$dasha live · mcap ' + m + (c ? ' · 24h ' + c : '');
    }
    return (
      head +
      '\n' +
      'Buy → ' +
      buyUrl() +
      '\n' +
      'Desk → ' +
      deskUrl() +
      '\n' +
      CA +
      '\nNFA · can go to zero'
    );
  }

  /**
   * Recommended size chip during dip — pure (V38).
   * Marks the depth-nudge SOL on FOMO/sticky chips for conversion.
   */
  function sizeChipHint(sol, dip) {
    if (sol == null || sol === '' || !dip) return null;
    var nudge = dipSizeNudgeSol(dip);
    if (nudge == null || Number(sol) !== Number(nudge)) return null;
    var depth = dipDepth(dip);
    // V41: dump chips say Dump (not Deep) so size≠deep-2 SOL
    var tag =
      dip.kind === 'dump'
        ? 'Dump'
        : depth && depth.tier !== 'soft'
          ? depth.tag
          : 'Dip';
    return {
      recommended: true,
      nudgeSol: nudge,
      tag: tag,
      tier: depth ? depth.tier : 'soft',
    };
  }

  /**
   * Dump/deep size autofocus — pure V48.
   * While dump watch is active (and user has not manually overridden),
   * snap buy size to dump-safe SOL (1). Deep dip still uses depth nudge.
   */
  function dumpSizeAutofocus(sol, dip, manual) {
    if (manual) {
      return {
        sol: sol,
        changed: false,
        manual: true,
        nudgeSol: dip ? dipSizeNudgeSol(dip) : null,
      };
    }
    if (!dip) {
      return { sol: sol, changed: false, manual: false, nudgeSol: null };
    }
    var nudge = dipSizeNudgeSol(dip);
    if (nudge == null) {
      return { sol: sol, changed: false, manual: false, nudgeSol: null };
    }
    // Always autofocus during dump; deep/hard dip only when unset soft default
    var force =
      dip.kind === 'dump' ||
      (dipDepth(dip) &&
        (dipDepth(dip).tier === 'deep' || dipDepth(dip).tier === 'hard'));
    if (!force) {
      return { sol: sol, changed: false, manual: false, nudgeSol: nudge };
    }
    var next = Number(nudge);
    var cur = Number(sol);
    return {
      sol: next,
      changed: !isFinite(cur) || cur !== next,
      manual: false,
      nudgeSol: next,
      isDump: dip.kind === 'dump',
    };
  }

  function buildQuoteShare(quote) {
    var q = String(quote || '').trim();
    if (!q) return '';
    return q + '\n$dasha · ' + CA + '\nBuy ' + buyUrl() + '\n' + deskUrl() + ' · NFA';
  }

  function buildMiniPack() {
    return 'Buy $dasha → ' + buyUrl() + '\n' + CA + '\n' + deskUrl() + '\n' + CASINO;
  }

  /** Ultra-short conversion pack — buy-first, optional live mcap + SOL size */
  function buildBuyPack(mcapLabel, sol, pressureNote) {
    var m =
      mcapLabel && String(mcapLabel) !== '—' ? ' · mcap ' + String(mcapLabel) : '';
    var size =
      sol != null && isFinite(Number(sol)) && Number(sol) > 0
        ? ' · ' + String(Number(sol)) + ' SOL'
        : '';
    var extra =
      pressureNote && String(pressureNote).trim()
        ? '\n' + String(pressureNote).trim()
        : '';
    return (
      'Buy $dasha now → ' +
      buyUrl(sol) +
      '\n' +
      CA +
      m +
      size +
      extra +
      '\nNFA · can go to zero · association ≠ endorsement'
    );
  }

  /**
   * Dip-raid share pack — virality on short-TF red + 24h green.
   * dip = dipBuySignal(...) result; pure, unit-tested via DDShare.buildDipPack
   * V36: depth + 24h still + net/pace for stronger X/raid paste.
   */
  function buildDipPack(dip, mcapLabel, sol, netShort, buys) {
    // Accept dipBuySignal / dumpWatch shape (line optional — V36 builds header)
    if (!dip || dip.shortPct == null || !dip.shortLabel) {
      return buildBuyPack(mcapLabel, sol);
    }
    var depth = dipDepth(dip);
    var still = stillGreen24(dip);
    var pace = buyPaceShort(buys);
    var isDump = dip.kind === 'dump';
    var headBits = [];
    if (depth && depth.tier !== 'soft') {
      headBits.push(depth.word);
      // V42 dump/deep: lead with deepest TF pct for honest dump/depth proof
      var pctLab = dip.depthLabel || dip.shortLabel;
      var pctVal =
        dip.depthPct != null ? Number(dip.depthPct) : Number(dip.shortPct);
      headBits.push(
        pctLab +
          ' ' +
          (pctVal > 0 ? '+' : '') +
          pctVal.toFixed(1) +
          '%',
      );
    } else {
      headBits.push(
        dip.shortLabel +
          ' dip ' +
          (Number(dip.shortPct) > 0 ? '+' : '') +
          Number(dip.shortPct).toFixed(2) +
          '%',
      );
    }
    if (still && still.short) headBits.push(still.short + ' still');
    else if (isDump && dip.ch24 != null && isFinite(Number(dip.ch24))) {
      headBits.push(
        '24h ' +
          (Number(dip.ch24) > 0 ? '+' : '') +
          Number(dip.ch24).toFixed(1) +
          '%',
      );
    } else if (dip.ch24 != null && Number(dip.ch24) > 0) {
      headBits.push(
        '24h still +' +
          (Math.abs(Number(dip.ch24)) >= 10
            ? Number(dip.ch24).toFixed(0)
            : Number(dip.ch24).toFixed(1)) +
          '%',
      );
    }
    if (netShort && String(netShort).charAt(0) === '+') {
      headBits.push(String(netShort) + ' net');
    }
    if (pace) headBits.push(pace);
    if (mcapLabel && String(mcapLabel) !== '—') {
      headBits.push('mcap ' + String(mcapLabel));
    }
    headBits.push('NFA');
    var header = headBits.join(' · ');
    var size =
      sol != null && isFinite(Number(sol)) && Number(sol) > 0
        ? ' · ' + String(Number(sol)) + ' SOL'
        : '';
    var buyLine = isDump
      ? 'Buy $dasha into the dump → '
      : 'Buy $dasha on the dip → ';
    return (
      header +
      '\n' +
      buyLine +
      buyUrl(sol) +
      '\n' +
      CA +
      size +
      '\nDesk → ' +
      deskUrl() +
      '\nNFA · can go to zero'
    );
  }

  /** Pure Dex buy-pressure stats — unit-tested via DDShare.buyPressure */
  function buyPressure(buys, sells) {
    if (buys == null || sells == null || buys === '' || sells === '') return null;
    var b = Number(buys);
    var s = Number(sells);
    if (!isFinite(b) || !isFinite(s) || b < 0 || s < 0 || b + s <= 0) return null;
    var tot = b + s;
    var pct = Math.round((b / tot) * 100);
    return { buys: b, sells: s, pct: pct, moreBuyers: b > s, moreSellers: s > b };
  }
  function buyPressureLine(bp) {
    if (!bp) return '';
    if (bp.moreBuyers) {
      return (
        'More buyers · ' +
        bp.pct +
        '% of 24h txns were buys (' +
        bp.buys +
        'b/' +
        bp.sells +
        's) · NFA'
      );
    }
    if (bp.moreSellers) {
      return (
        'More sellers · ' +
        (100 - bp.pct) +
        '% of 24h txns were sells (' +
        bp.buys +
        'b/' +
        bp.sells +
        's) · NFA'
      );
    }
    return 'Even flow · ' + bp.pct + '% buys 24h · NFA';
  }

  /** SOL spend → rough USD using token priceUsd / priceNative (SOL quote) */
  function solUsdEstimate(sol, priceUsd, priceNative) {
    var n = Number(sol);
    var pu = Number(priceUsd);
    var pn = Number(priceNative);
    if (!isFinite(n) || n <= 0 || !isFinite(pu) || pu <= 0 || !isFinite(pn) || pn <= 0) {
      return null;
    }
    return n * (pu / pn);
  }
  function fmtUsdRough(n) {
    n = Number(n);
    if (!isFinite(n) || n <= 0) return '';
    if (n >= 100) return '~$' + Math.round(n);
    if (n >= 10) return '~$' + n.toFixed(0);
    if (n >= 1) return '~$' + n.toFixed(1);
    return '~$' + n.toFixed(2);
  }
  /**
   * Dip-buy signal from real TF changes: short red + 24h still green.
   * Honest NFA copy only — never invents green short TFs.
   * V39: short* = freshest red TF for headlines; depth* = deepest red for tier/nudge.
   */
  function dipBuySignal(ch1, ch6, ch24) {
    var h1 = Number(ch1);
    var h6 = Number(ch6);
    var h24 = Number(ch24);
    var reds = [];
    if (isFinite(h1) && h1 < -0.5) reds.push({ label: '1h', pct: h1 });
    if (isFinite(h6) && h6 < -0.5) reds.push({ label: '6h', pct: h6 });
    if (!reds.length) return null;
    if (!isFinite(h24) || h24 <= 0) return null;
    // Freshest: prefer 1h when red, else 6h (reds already ordered 1h then 6h)
    var display = reds[0];
    // Deepest: most negative short TF (drives Deep/Hard tier + size nudge)
    var deepest = reds[0];
    var ri;
    for (ri = 1; ri < reds.length; ri++) {
      if (reds[ri].pct < deepest.pct) deepest = reds[ri];
    }
    return {
      shortLabel: display.label,
      shortPct: display.pct,
      depthLabel: deepest.label,
      depthPct: deepest.pct,
      ch24: h24,
      ch1: isFinite(h1) ? h1 : null,
      ch6: isFinite(h6) ? h6 : null,
      line:
        display.label +
        ' ' +
        (display.pct > 0 ? '+' : '') +
        display.pct.toFixed(2) +
        '% · 24h still ' +
        (h24 > 0 ? '+' : '') +
        h24.toFixed(2) +
        '% · dip buy zone · NFA',
    };
  }

  /**
   * Deep-dip tier from honest short TF % — pure.
   * hard: ≤ -10%, deep: ≤ -20%. null if not a meaningful dip depth.
   * V39: prefers depthPct (deepest red TF) when present.
   * V40: dip.kind==='dump' → Deep/Hard dump words (not "dip buy zone").
   */
  function dipDepth(dip) {
    if (!dip) return null;
    var pct =
      dip.depthPct != null ? Number(dip.depthPct) : Number(dip.shortPct);
    if (!isFinite(pct) || pct >= -0.5) return null;
    var label =
      dip.depthLabel || dip.shortLabel || (pct <= -20 || pct <= -10 ? '6h' : '1h');
    var dump = dip.kind === 'dump';
    if (pct <= -20) {
      return {
        tier: 'deep',
        shortLabel: label,
        shortPct: pct,
        word: dump ? 'Deep dump' : 'Deep dip',
        tag: 'Deep',
        dump: dump,
      };
    }
    if (pct <= -10) {
      return {
        tier: 'hard',
        shortLabel: label,
        shortPct: pct,
        word: dump ? 'Hard dump' : 'Hard dip',
        tag: 'Hard',
        dump: dump,
      };
    }
    return {
      tier: 'soft',
      shortLabel: dip.shortLabel || label,
      shortPct: Number(dip.shortPct) || pct,
      word: dump ? 'Dump' : 'Dip',
      tag: dump ? 'Dump' : 'Dip',
      dump: dump,
    };
  }

  /**
   * Multi-hour hard/deep dump when classic dip-buy (24h green) is off — pure V40.
   * Honest dump watch only; never invents green 24h.
   */
  function dumpWatchSignal(ch1, ch6, ch24) {
    var h1 = Number(ch1);
    var h6 = Number(ch6);
    var h24 = Number(ch24);
    // Classic dip-buy covers green 24h
    if (isFinite(h24) && h24 > 0) return null;
    var reds = [];
    if (isFinite(h1) && h1 < -0.5) reds.push({ label: '1h', pct: h1 });
    if (isFinite(h6) && h6 < -0.5) reds.push({ label: '6h', pct: h6 });
    if (!reds.length) return null;
    var display = reds[0];
    var deepest = reds[0];
    var ri;
    for (ri = 1; ri < reds.length; ri++) {
      if (reds[ri].pct < deepest.pct) deepest = reds[ri];
    }
    // Only hard/deep dumps (soft short + red 24h is noise)
    if (deepest.pct > -10) return null;
    var h24n = isFinite(h24) ? h24 : null;
    return {
      kind: 'dump',
      shortLabel: display.label,
      shortPct: display.pct,
      depthLabel: deepest.label,
      depthPct: deepest.pct,
      ch24: h24n,
      ch1: isFinite(h1) ? h1 : null,
      ch6: isFinite(h6) ? h6 : null,
      line:
        deepest.label +
        ' ' +
        deepest.pct.toFixed(1) +
        '%' +
        (h24n != null
          ? ' · 24h ' + (h24n > 0 ? '+' : '') + h24n.toFixed(1) + '%'
          : '') +
        ' · dump · NFA',
    };
  }

  /**
   * FOMO dump headline — pure V40/V45.
   * V45: positive net buys prove demand into the dump (honest Dex).
   */
  function fomoDumpHeadline(dump, bp, netShort) {
    if (!dump) return '';
    var depth = dipDepth(dump);
    var lead = depth && depth.word ? depth.word : 'Dump';
    var bits = [
      lead,
      (dump.depthLabel || dump.shortLabel) +
        ' ' +
        Number(dump.depthPct != null ? dump.depthPct : dump.shortPct).toFixed(1) +
        '%',
    ];
    if (netShort && String(netShort).charAt(0) === '+') {
      bits.push(String(netShort) + ' net');
    } else if (bp && bp.moreBuyers) {
      bits.push(bp.pct + '% buys');
    }
    bits.push('NFA');
    return bits.join(' · ');
  }

  /**
   * FOMO-sub / trust dump proof line — pure V41/V43.
   * e.g. "Deep dump · 6h -29.4% · 24h -23.1% · NFA"
   * V43: optional 1h micro-green (ch1 ≥0.2%) as honest bounce-into-dump.
   */
  function dumpWatchLine(dump, ch1) {
    if (!dump || dump.kind !== 'dump') return null;
    var depth = dipDepth(dump);
    var bits = [depth && depth.word ? depth.word : 'Dump'];
    bits.push(
      (dump.depthLabel || dump.shortLabel) +
        ' ' +
        Number(dump.depthPct != null ? dump.depthPct : dump.shortPct).toFixed(
          1,
        ) +
        '%',
    );
    if (dump.ch24 != null && isFinite(Number(dump.ch24))) {
      var h24 = Number(dump.ch24);
      bits.push('24h ' + (h24 > 0 ? '+' : '') + h24.toFixed(1) + '%');
    }
    var c1 =
      dump.ch1 != null
        ? Number(dump.ch1)
        : ch1 != null
          ? Number(ch1)
          : NaN;
    if (isFinite(c1) && c1 >= 0.2) {
      bits.push(
        '1h +' + (Math.abs(c1) >= 10 ? c1.toFixed(0) : c1.toFixed(1)) + '%',
      );
    }
    return bits.join(' · ') + ' · NFA';
  }

  /** Soft size nudge SOL for dip depth — pure (session applies once) */
  function dipSizeNudgeSol(dip) {
    var d = dipDepth(dip);
    if (!d) return null;
    // V40: dump watch stays 1 SOL (24h not green — cautious size)
    if (dip && dip.kind === 'dump') return 1;
    if (d.tier === 'deep') return 2;
    if (d.tier === 'hard') return 1;
    return 1;
  }

  /**
   * 24h still-green anchor during a short-TF dip — pure, honest Dex.
   * Returns short label like "24h +51%" or null if 24h not green.
   */
  function stillGreen24(dip, ch24) {
    var n =
      dip && dip.ch24 != null
        ? Number(dip.ch24)
        : ch24 != null
          ? Number(ch24)
          : NaN;
    if (!isFinite(n) || n <= 0) return null;
    var label = '24h +' + (Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(1)) + '%';
    return { pct: n, label: label, short: label };
  }

  /**
   * 1h reclaim during a multi-hour dip — pure, honest Dex.
   * When short TF is 6h (not 1h) and 1h is green ≥0.2%, surface early bounce (V37).
   */
  function dipReclaim(dip, ch1) {
    if (!dip || dip.shortLabel === '1h') return null;
    var n =
      dip.ch1 != null
        ? Number(dip.ch1)
        : ch1 != null
          ? Number(ch1)
          : NaN;
    if (!isFinite(n) || n < 0.2) return null;
    var label = '1h +' + (Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(1)) + '%';
    return { pct: n, label: label, short: label };
  }

  /**
   * 5m micro-bounce during multi-hour dip — pure, honest Dex (V37).
   * Surfaces when m5 ≥0.15% and 1h reclaim is not already firing.
   */
  function dipMicroBounce(dip, m5, reclaim) {
    if (!dip || dip.shortLabel === '1h') return null;
    if (reclaim) return null;
    var n = m5 != null ? Number(m5) : dip.m5 != null ? Number(dip.m5) : NaN;
    if (!isFinite(n) || n < 0.15) return null;
    var label = '5m +' + (Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(1)) + '%';
    return { pct: n, label: label, short: label };
  }

  /**
   * FOMO raid CTA label during dip/dump — pure (V37/V41/V47).
   * Dip: "Deep raid · 24h +27% still"
   * Dump: "Deep dump raid · 6h -29%"
   * V47: optional · X suffix for one-tap tweet CTA.
   */
  function dipRaidLabel(dip, still, withX) {
    if (!dip) return 'Raid this dip';
    var depth = dipDepth(dip);
    var label;
    if (dip.kind === 'dump') {
      var dLead =
        depth && depth.tier !== 'soft' ? depth.tag + ' dump raid' : 'Dump raid';
      if (depth) {
        dLead =
          dLead +
          ' · ' +
          depth.shortLabel +
          ' ' +
          (depth.shortPct > 0 ? '+' : '') +
          depth.shortPct.toFixed(0) +
          '%';
      }
      label = dLead;
    } else {
      var lead =
        depth && depth.tier !== 'soft' ? depth.tag + ' raid' : 'Raid dip';
      label =
        still && still.short ? lead + ' · ' + still.short + ' still' : lead;
    }
    return withX ? label + ' · X' : label;
  }

  /**
   * One-tap dump/dip raid → X intent with viral pack — pure V47.
   * Returns { pack, label, href, isDump, hasIntoDump }.
   */
  function dumpRaidPlan(dip, mcapLabel, sol, netShort, buys) {
    if (!dip) return null;
    var pack = buildDipPack(dip, mcapLabel, sol, netShort, buys);
    var still = dip.kind === 'dump' ? null : stillGreen24(dip);
    var label = dipRaidLabel(dip, still, true);
    var href = intentTweet(pack);
    return {
      pack: pack,
      label: label,
      href: href,
      isDump: dip.kind === 'dump',
      hasIntoDump: /into the dump/i.test(pack),
      hasBuyUrl: /jup\.ag|amount=/.test(pack),
      hasCA: pack.indexOf(CA) >= 0,
    };
  }

  /**
   * FOMO-sub / trust line for reclaim during multi-hour dip — pure.
   * e.g. "1h +1.3% reclaiming · 6h deep · NFA"
   */
  function dipReclaimLine(reclaim, dip) {
    if (!reclaim || !reclaim.short) return null;
    var bits = [reclaim.short + ' reclaiming'];
    var depth = dipDepth(dip);
    if (depth && depth.tier !== 'soft') {
      bits.push(depth.shortLabel + ' ' + depth.tag.toLowerCase());
    } else if (dip && dip.shortLabel) {
      bits.push(dip.shortLabel + ' dip');
    }
    return bits.join(' · ') + ' · NFA';
  }

  /**
   * FOMO-sub line when 24h still green during a dip — pure.
   * Hard/deep: "24h +2.1% still · after 6h deep · NFA"
   * V39 soft: "24h +2.1% still · 1h dip · NFA"
   */
  function dipStillLine(still, dip) {
    if (!still || !still.short) return null;
    var depth = dipDepth(dip);
    if (!depth) return null;
    if (depth.tier === 'soft') {
      return (
        still.short +
        ' still · ' +
        (depth.shortLabel || 'short') +
        ' dip · NFA'
      );
    }
    return (
      still.short +
      ' still · after ' +
      depth.shortLabel +
      ' ' +
      depth.tag.toLowerCase() +
      ' · NFA'
    );
  }

  /** FOMO A/B dip headlines — pure, unit-tested via DDShare.fomoDipHeadline */
  function fomoDipHeadline(dip, ch24Label, ab, bp) {
    if (!dip) return '';
    var short =
      (dip.shortPct > 0 ? '+' : '') + Number(dip.shortPct).toFixed(2) + '%';
    var depth = dipDepth(dip);
    var still = '';
    if (ch24Label && String(ch24Label) !== '—') {
      still = String(ch24Label).replace(/^24h\s+/i, '');
    } else {
      still =
        (dip.ch24 > 0 ? '+' : '') + Number(dip.ch24).toFixed(2) + '%';
    }
    if (ab === 'b') {
      var press =
        bp && bp.moreBuyers ? ' · ' + bp.pct + '% buys' : '';
      var lead =
        depth && depth.tier !== 'soft'
          ? depth.word + ' · buy'
          : 'Buy the dip';
      return (
        lead +
        ' · ' +
        dip.shortLabel +
        ' ' +
        short +
        press +
        ' · NFA'
      );
    }
    // A = status style (default). Deep/hard lead with depth word.
    if (depth && depth.tier !== 'soft') {
      return (
        depth.word +
        ' ' +
        dip.shortLabel +
        ' ' +
        short +
        ' · 24h still ' +
        still +
        ' · NFA'
      );
    }
    return dip.shortLabel + ' dip ' + short + ' · 24h still ' + still;
  }

  /** Net buys social proof from real Dex txn counts */
  function netBuysLine(buys, sells) {
    if (buys == null || sells == null) return null;
    var b = Number(buys);
    var s = Number(sells);
    if (!isFinite(b) || !isFinite(s)) return null;
    var net = Math.round(b - s);
    if (net > 0) return '+' + net + ' more buys than sells 24h · NFA';
    if (net < 0) return Math.abs(net) + ' more sells than buys 24h · NFA';
    return 'Even buys/sells 24h · NFA';
  }
  function netBuysShort(buys, sells) {
    if (buys == null || sells == null) return '—';
    var b = Number(buys);
    var s = Number(sells);
    if (!isFinite(b) || !isFinite(s)) return '—';
    var net = Math.round(b - s);
    if (net > 0) return '+' + net;
    if (net < 0) return String(net);
    return '0';
  }

  /** Honest 24h buy pace from Dex buys count (not real-time) */
  function buysPaceLine(buys) {
    var b = Number(buys);
    if (!isFinite(b) || b <= 0) return null;
    var perH = b / 24;
    if (perH >= 10) return '~' + Math.round(perH) + ' buys/hr 24h · NFA';
    return '~' + (Math.round(perH * 10) / 10) + ' buys/hr · NFA';
  }

  /** Compact sticky/FOMO proof: net + pace when meaningful */
  function stickyFlowProof(buys, sells) {
    var net = netBuysShort(buys, sells);
    var pace = buysPaceLine(buys);
    var parts = [];
    if (net && net !== '—' && net !== '0') parts.push(net + ' net');
    if (pace) parts.push(pace.replace(/\s*·\s*NFA\s*$/i, ''));
    if (!parts.length) return null;
    return parts.join(' · ') + ' · NFA';
  }

  /** Phantom universal-link browse wrapper for mobile one-tap (amounted jup inside) */
  function phantomBrowseUrl(jupHref) {
    if (!jupHref) return jupHref;
    try {
      return (
        'https://phantom.app/ul/browse/' +
        encodeURIComponent(jupHref) +
        '?ref=https://phantom.app'
      );
    } catch (eP) {
      return jupHref;
    }
  }

  /**
   * Buy regime from honest Dex signals — pure, unit-tested.
   * dip: short-TF red with 24h green (dipBuySignal)
   * dump: hard/deep short dump when 24h not green (dumpWatchSignal V40)
   * hot: short green + buy pressure (pump window)
   * neutral: otherwise
   */
  function buyRegime(dip, ch, bp) {
    if (dip && dip.kind === 'dump') return 'dump';
    if (dip) return 'dip';
    var m5 = ch && ch.m5 != null ? Number(ch.m5) : NaN;
    var h1 = ch && ch.h1 != null ? Number(ch.h1) : NaN;
    var shortGreen =
      (isFinite(m5) && m5 > 0) || (isFinite(h1) && h1 > 0.5);
    if (shortGreen && bp && bp.moreBuyers && bp.pct >= 55) return 'hot';
    return 'neutral';
  }

  /** Regime FOMO headline (hot window) — pure */
  function hotBuyHeadline(ch, bp, mcapLabel) {
    var bits = ['Hot window'];
    var m5 = ch && ch.m5 != null ? Number(ch.m5) : NaN;
    var h1 = ch && ch.h1 != null ? Number(ch.h1) : NaN;
    if (isFinite(m5) && m5 > 0) bits.push('5m +' + m5.toFixed(2) + '%');
    else if (isFinite(h1) && h1 > 0) bits.push('1h +' + h1.toFixed(2) + '%');
    if (bp && bp.moreBuyers) bits.push(bp.pct + '% buys');
    if (mcapLabel && mcapLabel !== '—') bits.push('mcap ' + mcapLabel);
    bits.push('NFA');
    return bits.join(' · ');
  }

  /**
   * Session mcap delta vs first Dex read this visit — pure, unit-tested.
   * Honest local anchor only (not a prediction). null if tiny/unknown.
   */
  function sessionDelta(openMcap, nowMcap) {
    var o = Number(openMcap);
    var n = Number(nowMcap);
    if (!isFinite(o) || !isFinite(n) || o <= 0 || n <= 0) return null;
    var pct = ((n - o) / o) * 100;
    if (!isFinite(pct) || Math.abs(pct) < 0.25) return null;
    var label = (pct > 0 ? '+' : '') + pct.toFixed(2) + '%';
    return {
      pct: pct,
      label: label,
      short: 'sess ' + label,
      line: 'Session ' + label + ' since open · NFA',
      up: pct > 0,
    };
  }

  /** Honest SOL size label with rough USD from Dex solUsd — pure */
  function solSizeLabel(sol, solUsd) {
    var n = Number(sol);
    if (!isFinite(n) || n <= 0) return null;
    var bit = n + ' SOL';
    var usd = null;
    if (solUsd != null && isFinite(Number(solUsd)) && Number(solUsd) > 0) {
      usd = n * Number(solUsd);
      var rough = fmtUsdRough(usd);
      if (rough) bit = bit + ' · ' + rough;
    }
    return { sol: n, usd: usd, label: bit };
  }

  /**
   * Liq trust near buy CTA — pure. Only when real Dex liq is meaningful.
   */
  function liqTrustLine(liq) {
    var n = Number(liq);
    if (!isFinite(n) || n < 5000) return null;
    var label;
    if (n >= 1e6) label = '$' + (n / 1e6).toFixed(2) + 'M';
    else if (n >= 1000) label = '$' + (n / 1000).toFixed(1) + 'K';
    else label = '$' + Math.round(n);
    return 'Liq ' + label + ' · NFA';
  }

  /** Compact buys/hr from Dex 24h buys — pure (honest average, not live stream) */
  function buyPaceShort(buys) {
    var b = Number(buys);
    if (!isFinite(b) || b <= 0) return null;
    var perH = b / 24;
    if (perH >= 10) return '~' + Math.round(perH) + '/hr';
    return '~' + (Math.round(perH * 10) / 10) + '/hr';
  }

  /**
   * Buy size as % of pool liq — pure, honest Dex.
   * Helps convert deep 2 SOL nudge (shows low impact when true).
   */
  function solLiqImpact(sol, solUsd, liq) {
    var s = Number(sol);
    var u = Number(solUsd);
    var L = Number(liq);
    if (!isFinite(s) || s <= 0 || !isFinite(u) || u <= 0 || !isFinite(L) || L < 1000) {
      return null;
    }
    var pct = ((s * u) / L) * 100;
    if (!isFinite(pct) || pct <= 0) return null;
    var short =
      '~' +
      (pct < 1 ? pct.toFixed(2) : pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)) +
      '% liq';
    return { pct: pct, short: short, label: short };
  }

  /**
   * Mobile-visible trust strip near sticky dual — pure.
   * Combines flow + liq + session shorts (each already NFA-tagged).
   */
  function trustBarLine(flow, liqLine, session, reclaimLine, stillLine, dumpLine) {
    function stripNfa(s) {
      return String(s || '')
        .replace(/\s*·?\s*NFA\s*/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[·\s]+|[·\s]+$/g, '');
    }
    var parts = [];
    // V43: dump first (never hide dump under 1h reclaim); else reclaim > still
    if (dumpLine) {
      var du = stripNfa(dumpLine);
      if (du) parts.push(du);
    } else if (reclaimLine) {
      var r = stripNfa(reclaimLine);
      if (r) parts.push(r);
    } else if (stillLine) {
      var st = stripNfa(stillLine);
      if (st) parts.push(st);
    }
    if (flow) {
      var f = stripNfa(flow);
      if (f) parts.push(f);
    }
    if (liqLine) {
      var l = stripNfa(liqLine);
      if (l) parts.push(l);
    }
    if (session && session.short && Math.abs(Number(session.pct)) >= 0.5) {
      parts.push(session.short);
    }
    if (!parts.length) return null;
    return parts.join(' · ') + ' · NFA';
  }

  /**
   * One-tap dual action plan: copy CA+buy+desk then open wallet/buy.
   * Pure — unit-tested; runtime copies payload and navigates to href.
   * regime: 'dip' | 'hot' | 'neutral' shapes the label.
   * session: optional sessionDelta() for toast urgency.
   * solUsd: optional SOL→USD rate for size proof on label.
   * netShort: optional netBuysShort() for social proof on label.
   * buys: optional Dex 24h buys for pace short on label/header.
   */
  function dualGoPlan(sol, mobile, regime, session, solUsd, netShort, buys, dip, liq) {
    var jup = buyUrl(sol);
    var href = mobile ? phantomBrowseUrl(jup) : jup;
    var isDump = !!(dip && dip.kind === 'dump');
    var r = regime || (isDump ? 'dump' : 'neutral');
    if (isDump && r !== 'hot') r = 'dump';
    var size = solSizeLabel(sol, solUsd);
    var pace = buyPaceShort(buys);
    var depth =
      r === 'dip' || r === 'dump' || isDump ? dipDepth(dip) : null;
    var still = r === 'dip' && !isDump ? stillGreen24(dip) : null;
    var reclaim = r === 'dip' && !isDump ? dipReclaim(dip) : null;
    // V37: 5m micro-bounce when multi-hour dip and no 1h reclaim yet
    var micro =
      r === 'dip' && !isDump
        ? dipMicroBounce(dip, dip && dip.m5, reclaim)
        : null;
    // V35: size vs liq impact (toast; hard/deep dip or dump)
    var impact =
      depth && depth.tier !== 'soft'
        ? solLiqImpact(sol, solUsd, liq)
        : null;
    var label;
    if (r === 'dump' || isDump) {
      label =
        depth && depth.tier !== 'soft'
          ? 'CA · ' + depth.tag + ' dump'
          : 'CA · Dump';
    } else if (r === 'dip') {
      label =
        depth && depth.tier !== 'soft'
          ? 'CA · ' + depth.tag + ' dip'
          : 'CA · Dip';
    } else if (r === 'hot') label = 'CA · Ride';
    else label = 'CA';
    // Size proof (SOL + rough USD) when known; else wallet/buy verb
    if (size && size.label) label = label + ' · ' + size.label;
    else label = label + (mobile ? ' · Wallet' : ' · Buy');
    // V42: liq impact near size on dump/deep dual (de-risks bag size)
    if (impact && impact.short && (isDump || (depth && depth.tier === 'deep'))) {
      label = label + ' · ' + impact.short;
    }
    // V31: 24h still green during dip (honest recovery anchor near buy)
    if (still && still.short) label = label + ' · ' + still.short;
    // V32/V37: 1h reclaim or 5m micro-bounce near buy
    if (reclaim && reclaim.short) label = label + ' · ' + reclaim.short;
    else if (micro && micro.short) label = label + ' · ' + micro.short;
    // Positive net buys social proof (honest Dex)
    if (netShort && String(netShort).charAt(0) === '+') {
      label = label + ' · ' + netShort + ' net';
    }
    if (pace) label = label + ' · ' + pace;
    if (session && session.short && Math.abs(session.pct) >= 0.5) {
      label = label + ' · ' + session.short;
    }
    // Share header: regime + depth + still + reclaim + net + pace for viral paste
    var headerBits = ['$dasha'];
    if (r === 'dump' || isDump) {
      headerBits.push(
        depth && depth.tier !== 'soft'
          ? depth.tag.toLowerCase() + ' dump'
          : 'dump',
      );
      if (depth) {
        headerBits.push(
          depth.shortLabel +
            ' ' +
            (depth.shortPct > 0 ? '+' : '') +
            depth.shortPct.toFixed(1) +
            '%',
        );
      }
    } else if (r === 'dip') {
      headerBits.push(
        depth && depth.tier !== 'soft'
          ? depth.tag.toLowerCase() + ' dip'
          : 'dip',
      );
      if (depth) {
        headerBits.push(
          depth.shortLabel +
            ' ' +
            (depth.shortPct > 0 ? '+' : '') +
            depth.shortPct.toFixed(1) +
            '%',
        );
      }
      if (still && still.short) headerBits.push(still.short);
      if (reclaim && reclaim.short) headerBits.push(reclaim.short);
      else if (micro && micro.short) headerBits.push(micro.short);
    } else if (r === 'hot') headerBits.push('hot');
    if (netShort && String(netShort).charAt(0) === '+') {
      headerBits.push(netShort + ' net');
    }
    if (pace) headerBits.push(pace);
    headerBits.push('NFA');
    var header = headerBits.join(' · ');
    // One-paste payload: header + CA + amounted jup (w/ invite ref) + desk loop
    // V46: dump/deep dual copy uses viral into-the-dump / dip pack
    var copyText;
    if (dip && (isDump || (depth && depth.tier === 'deep'))) {
      copyText = buildDipPack(
        dip,
        null,
        sol,
        netShort && String(netShort).charAt(0) === '+' ? netShort : null,
        buys,
      );
    } else {
      copyText = dualCopyPayload(
        CA,
        jup,
        deskUrl(),
        size && size.label,
        header,
      );
    }
    var toast = 'CA+buy copied · open';
    if (size && size.label) toast = 'CA+buy · ' + size.label;
    if (still && still.short) toast = toast + ' · ' + still.short;
    if (reclaim && reclaim.short) toast = toast + ' · ' + reclaim.short;
    else if (micro && micro.short) toast = toast + ' · ' + micro.short;
    if (impact && impact.short) toast = toast + ' · ' + impact.short;
    if (netShort && String(netShort).charAt(0) === '+') {
      toast = toast + ' · ' + netShort + ' net';
    }
    if (pace) toast = toast + ' · ' + pace;
    if (session && session.short) {
      toast = toast + ' · ' + session.short;
    }
    return {
      ca: CA,
      href: href,
      jup: jup,
      regime: r,
      label: label,
      toast: toast,
      copyText: copyText,
      header: header,
      size: size,
      pace: pace,
      still: still,
      reclaim: reclaim,
      micro: micro,
      impact: impact,
      session: session || null,
      netShort: netShort || null,
      hasRef: /[?&]ref=/.test(jup),
      hasAmount:
        sol != null &&
        sol !== '' &&
        isFinite(Number(sol)) &&
        Number(sol) > 0 &&
        /amount=/.test(jup),
      hasUsd: !!(size && size.usd != null && size.usd > 0),
      hasNet: !!(netShort && String(netShort).charAt(0) === '+'),
      hasPace: !!pace,
      hasStill24: !!still,
      hasReclaim: !!reclaim,
      hasMicro: !!micro,
      hasImpact: !!impact,
      depth: depth,
      isDeepDip: !!(depth && depth.tier === 'deep'),
      isHardDip: !!(depth && (depth.tier === 'deep' || depth.tier === 'hard')),
    };
  }

  /** Multi-line paste pack for dual-go (header + CA + Jupiter + desk) — pure */
  function dualCopyPayload(ca, jup, desk, sizeLabel, header) {
    var lines = [];
    if (header) lines.push(String(header));
    lines.push(String(ca || CA), String(jup || ''));
    if (desk) lines.push(String(desk));
    if (sizeLabel) lines.push('Size ' + sizeLabel);
    lines.push('NFA · can go to zero');
    return lines.join('\n');
  }

  function intentTweet(text) {
    return 'https://x.com/intent/tweet?text=' + encodeURIComponent(text);
  }

  function intentTelegram(text) {
    // t.me share: url = desk loop, text = pack body
    return (
      'https://t.me/share/url?url=' +
      encodeURIComponent(deskUrl()) +
      '&text=' +
      encodeURIComponent(String(text || ''))
    );
  }

  function intentWhatsApp(text) {
    return 'https://wa.me/?text=' + encodeURIComponent(String(text || ''));
  }

  /** Pure SVG polyline path from session samples — unit-tested via DDShare.buildSparkPath */
  function buildSparkPath(samples, w, h) {
    w = w || 280;
    h = h || 48;
    if (!samples || samples.length < 2) return '';
    var nums = [];
    for (var i = 0; i < samples.length; i++) {
      var n = Number(samples[i]);
      if (isFinite(n)) nums.push(n);
    }
    if (nums.length < 2) return '';
    var min = nums[0];
    var max = nums[0];
    for (var j = 1; j < nums.length; j++) {
      if (nums[j] < min) min = nums[j];
      if (nums[j] > max) max = nums[j];
    }
    var span = max - min || 1;
    var parts = [];
    for (var k = 0; k < nums.length; k++) {
      var x = (k / (nums.length - 1)) * w;
      var y = h - ((nums[k] - min) / span) * (h - 6) - 3;
      parts.push(x.toFixed(1) + ',' + y.toFixed(1));
    }
    return 'M' + parts.join(' L');
  }

  function sparkEndPoint(samples, w, h) {
    w = w || 280;
    h = h || 48;
    if (!samples || samples.length < 2) return null;
    var path = buildSparkPath(samples, w, h);
    if (!path) return null;
    var last = path.split(' ').pop().replace(/^[ML]/, '');
    var xy = last.split(',');
    var x = Number(xy[0]);
    var y = Number(xy[1]);
    if (!isFinite(x) || !isFinite(y)) return null;
    return { x: x, y: y };
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
    deskUrl: deskUrl,
    buyUrl: buyUrl,
    getRef: getRef,
    inviteRef: inviteRef,
    buildSharePack: buildSharePack,
    buildQuoteShare: buildQuoteShare,
    buildMiniPack: buildMiniPack,
    buildLiveProof: buildLiveProof,
    sizeChipHint: sizeChipHint,
    dumpSizeAutofocus: dumpSizeAutofocus,
    buildBuyPack: buildBuyPack,
    buildDipPack: buildDipPack,
    buyPressure: buyPressure,
    buyPressureLine: buyPressureLine,
    solUsdEstimate: solUsdEstimate,
    fmtUsdRough: fmtUsdRough,
    dipBuySignal: dipBuySignal,
    dumpWatchSignal: dumpWatchSignal,
    fomoDumpHeadline: fomoDumpHeadline,
    dumpWatchLine: dumpWatchLine,
    fomoDipHeadline: fomoDipHeadline,
    dipDepth: dipDepth,
    dipSizeNudgeSol: dipSizeNudgeSol,
    stillGreen24: stillGreen24,
    dipReclaim: dipReclaim,
    dipMicroBounce: dipMicroBounce,
    dipRaidLabel: dipRaidLabel,
    dumpRaidPlan: dumpRaidPlan,
    dipReclaimLine: dipReclaimLine,
    dipStillLine: dipStillLine,
    solLiqImpact: solLiqImpact,
    netBuysLine: netBuysLine,
    netBuysShort: netBuysShort,
    buysPaceLine: buysPaceLine,
    stickyFlowProof: stickyFlowProof,
    phantomBrowseUrl: phantomBrowseUrl,
    dualGoPlan: dualGoPlan,
    dualCopyPayload: dualCopyPayload,
    buyPaceShort: buyPaceShort,
    trustBarLine: trustBarLine,
    buyRegime: buyRegime,
    hotBuyHeadline: hotBuyHeadline,
    sessionDelta: sessionDelta,
    solSizeLabel: solSizeLabel,
    liqTrustLine: liqTrustLine,
    intentTweet: intentTweet,
    intentTelegram: intentTelegram,
    intentWhatsApp: intentWhatsApp,
    buildSparkPath: buildSparkPath,
    sparkEndPoint: sparkEndPoint,
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
  var packsCopied = 0;
  var lastCopiedText = '';
  function showPostShare(text) {
    if (!$('dd-post-share')) return;
    lastCopiedText = String(text || '');
    $('dd-post-share').hidden = false;
    if ($('dd-post-x')) $('dd-post-x').href = intentTweet(lastCopiedText);
    if ($('dd-post-tg')) $('dd-post-tg').href = intentTelegram(lastCopiedText);
    if ($('dd-post-wa')) $('dd-post-wa').href = intentWhatsApp(lastCopiedText);
  }
  function copy(text, el) {
    function ok() {
      packsCopied += 1;
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
      var cc = $('dd-copy-count');
      if (cc) {
        cc.hidden = false;
        cc.textContent =
          packsCopied + (packsCopied === 1 ? ' pack copied · share it' : ' packs copied · keep going');
      }
      var app = $('dd-app');
      if (app) {
        app.classList.remove('dd-copy-burst');
        void app.offsetWidth;
        app.classList.add('dd-copy-burst');
      }
      // Virality loop: after buy/raid/live packs, surface X/TG/WA one-tap
      if (
        /Buy \$dasha|still holding|mcap |casino|Get in/i.test(String(text || '')) ||
        (el && el.id && /buy-pack|kit-raid|sticky-live|copy-live|copy-hold|social-proof/i.test(el.id))
      ) {
        showPostShare(text);
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
  var lastProof = {
    mcap: '—',
    ch24: '—',
    vol: '—',
    ch24n: null,
    m5n: null,
    ch1n: null,
    ch6n: null,
    delta: '—',
    move: '—',
    buys: null,
    sells: null,
    pressure: null,
    dip: null,
    solUsd: null,
    priceUsd: null,
  };
  var lastRefreshAt = 0;
  var openMcap = null;
  var prevMcapNum = null;
  var sparkSamples = [];
  var SPARK_MAX = 48;
  var buySol = 0.5;
  var fomoAb = 'a';
  try {
    var savedSol = localStorage.getItem('dd_buy_sol');
    if (savedSol && isFinite(Number(savedSol)) && Number(savedSol) > 0) buySol = Number(savedSol);
  } catch (eSol) {}
  try {
    var savedAb = localStorage.getItem('dd_fomo_ab');
    if (savedAb === 'a' || savedAb === 'b') fomoAb = savedAb;
    else {
      fomoAb = Math.random() < 0.5 ? 'a' : 'b';
      localStorage.setItem('dd_fomo_ab', fomoAb);
    }
  } catch (eAb) {
    fomoAb = 'a';
  }

  function pushSparkSample(mcapNum) {
    mcapNum = Number(mcapNum);
    if (!isFinite(mcapNum) || mcapNum <= 0) return;
    if (!sparkSamples.length) {
      // flat baseline so the path draws on first Dex hit
      sparkSamples.push(mcapNum, mcapNum);
      renderSpark();
      return;
    }
    // de-dupe consecutive identical values after baseline
    if (sparkSamples[sparkSamples.length - 1] === mcapNum) return;
    sparkSamples.push(mcapNum);
    if (sparkSamples.length > SPARK_MAX) sparkSamples = sparkSamples.slice(-SPARK_MAX);
    renderSpark();
  }

  function renderSpark() {
    var pathEl = $('dd-spark-path');
    var dot = $('dd-spark-dot');
    var note = $('dd-spark-note');
    var wrap = $('dd-spark-wrap');
    if (!pathEl) return;
    var d = buildSparkPath(sparkSamples, 280, 48);
    pathEl.setAttribute('d', d || '');
    var end = sparkEndPoint(sparkSamples, 280, 48);
    if (dot) {
      if (end) {
        dot.setAttribute('cx', end.x);
        dot.setAttribute('cy', end.y);
        dot.setAttribute('opacity', '1');
      } else {
        dot.setAttribute('opacity', '0');
      }
    }
    if (wrap) {
      wrap.classList.toggle('is-up', sparkSamples.length >= 2 && sparkSamples[sparkSamples.length - 1] >= sparkSamples[0]);
      wrap.classList.toggle(
        'is-down',
        sparkSamples.length >= 2 && sparkSamples[sparkSamples.length - 1] < sparkSamples[0],
      );
    }
    if (note) {
      if (sparkSamples.length < 2) {
        note.textContent = 'fills as Dex polls · NFA · not a chart promise';
      } else {
        var first = sparkSamples[0];
        var last = sparkSamples[sparkSamples.length - 1];
        var pct = ((last - first) / first) * 100;
        note.textContent =
          sparkSamples.length +
          ' samples · session ' +
          (pct > 0 ? '+' : '') +
          pct.toFixed(2) +
          '% · NFA';
      }
    }
  }

  function updateTicker(mcap, liq, vol, ch24, delta, buys, sells) {
    var track = $('dd-ticker-track');
    if (!track) return;
    var bits = [
      'Live mcap ' + mcap,
      '24h ' + ch24,
      'Vol ' + vol,
      'Liq ' + liq,
    ];
    if (delta && delta !== '—') bits.push('Since open ' + delta);
    if (buys != null && sells != null) {
      bits.push(buys + ' buys · ' + sells + ' sells 24h');
    }
    if (lastProof.dip && lastProof.dip.shortLabel) {
      bits.push(
        lastProof.dip.shortLabel +
          ' dip · 24h still ' +
          (lastProof.ch24 || '') +
          ' · buy the dip',
      );
    }
    bits.push(
      CASINO,
      (lastProof.dip ? 'Dip buy ' : 'Buy ') + buySol + ' SOL → Jupiter',
      'Desk + ref · share the pack',
      'NFA · can go to zero',
    );
    // duplicate for seamless loop
    var html = bits.concat(bits).map(function (t) {
      return '<span>' + t + '</span>';
    }).join('');
    track.innerHTML = html;
  }
  function tickFomoAge() {
    var el = $('dd-fomo-age');
    if (!el || !lastRefreshAt) return;
    var s = Math.max(0, Math.floor((Date.now() - lastRefreshAt) / 1000));
    el.textContent = s < 4 ? 'updated just now' : 'updated ' + s + 's ago';
  }

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
    if ($('dd-share-tg')) $('dd-share-tg').href = intentTelegram(line);
    if ($('dd-share-wa')) $('dd-share-wa').href = intentWhatsApp(line);
    if ($('dd-tweet-alt')) $('dd-tweet-alt').href = intentTweet(buildSharePack('meme'));
    if ($('dd-sticky-tweet')) {
      var raidLine =
        lastProof.mcap && lastProof.mcap !== '—'
          ? liveProofNow()
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
    if (!$('dd-paste') || !$('dd-verify')) return;
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
    if (asof) asof.textContent = 'Loading Dex…';
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
        // Guard every DOM write — embed minify may strip optional rows
        if ($('s-price')) $('s-price').textContent = fmtUsd(p.priceUsd);
        if ($('s-mcap')) $('s-mcap').textContent = fmtUsd(mcap);
        if ($('s-liq')) $('s-liq').textContent = fmtUsd(liq);
        if ($('s-vol')) $('s-vol').textContent = fmtUsd(vol);
        if ($('s-5m')) $('s-5m').textContent = fmtPct(ch.m5);
        if ($('s-1h')) $('s-1h').textContent = fmtPct(ch.h1);
        if ($('s-6h')) $('s-6h').textContent = fmtPct(ch.h6);
        if ($('s-24h')) $('s-24h').textContent = fmtPct(ch.h24);
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
        lastProof.liq = isFinite(Number(liq)) ? Number(liq) : null;
        lastProof.ch24n = Number(ch.h24);
        lastProof.m5n = Number(ch.m5);
        lastProof.ch1n = Number(ch.h1);
        lastProof.ch6n = Number(ch.h6);
        lastProof.priceUsd = Number(p.priceUsd);
        lastProof.solUsd = solUsdEstimate(1, p.priceUsd, p.priceNative);
        // V26: liq trust near sticky dual
        var liqLine = liqTrustLine(lastProof.liq);
        lastProof.liqLine = liqLine;
        if ($('dd-liq-trust')) {
          if (liqLine) {
            $('dd-liq-trust').hidden = false;
            $('dd-liq-trust').textContent = liqLine;
          } else {
            $('dd-liq-trust').hidden = true;
          }
        }
        lastProof.dip = dipBuySignal(ch.h1, ch.h6, ch.h24);
        // V40: hard/deep dump watch when 24h not green (classic dip off)
        if (!lastProof.dip) {
          lastProof.dip = dumpWatchSignal(ch.h1, ch.h6, ch.h24);
        }
        // V37: carry m5 on dip for micro-bounce (pure helpers read dip.m5)
        if (lastProof.dip) lastProof.dip.m5 = lastProof.m5n;
        var tx = (p.txns && p.txns.h24) || {};
        lastProof.buys = isFinite(Number(tx.buys)) ? Number(tx.buys) : null;
        lastProof.sells = isFinite(Number(tx.sells)) ? Number(tx.sells) : null;
        if ($('dd-txns')) {
          if (lastProof.buys != null && lastProof.sells != null) {
            $('dd-txns').textContent =
              lastProof.buys +
              ' buys · ' +
              lastProof.sells +
              ' sells 24h · Dex · NFA';
          } else {
            $('dd-txns').textContent = 'Live Dex · txn counts when available · NFA';
          }
        }
        var netLine = netBuysLine(lastProof.buys, lastProof.sells);
        if ($('p-net')) {
          $('p-net').textContent = netBuysShort(lastProof.buys, lastProof.sells);
          setTone(
            $('p-net'),
            lastProof.buys != null && lastProof.sells != null
              ? lastProof.buys - lastProof.sells
              : null,
          );
        }
        if ($('dd-net-line')) {
          if (netLine) {
            $('dd-net-line').hidden = false;
            $('dd-net-line').textContent = netLine;
            $('dd-net-line').classList.toggle(
              'is-sell',
              lastProof.buys != null &&
                lastProof.sells != null &&
                lastProof.sells > lastProof.buys,
            );
          } else {
            $('dd-net-line').hidden = true;
          }
        }
        // Sticky + FOMO flow proof (net + pace) — honest Dex, near buy CTA
        var flow = stickyFlowProof(lastProof.buys, lastProof.sells);
        lastProof.flow = flow;
        if ($('dd-sticky-flow')) {
          if (flow) {
            $('dd-sticky-flow').hidden = false;
            $('dd-sticky-flow').textContent = flow;
          } else {
            $('dd-sticky-flow').hidden = true;
          }
        }
        // V33/V34/V41/V43: FOMO sub — dump first, else reclaim > still > flow
        var reclaimNow =
          lastProof.dip && lastProof.dip.kind !== 'dump'
            ? dipReclaim(lastProof.dip, lastProof.ch1n)
            : null;
        var reclaimLineNow = reclaimNow
          ? dipReclaimLine(reclaimNow, lastProof.dip)
          : null;
        var stillNow =
          lastProof.dip && lastProof.dip.kind !== 'dump'
            ? stillGreen24(lastProof.dip, lastProof.ch24n)
            : null;
        var stillLineNow = stillNow
          ? dipStillLine(stillNow, lastProof.dip)
          : null;
        var dumpLineNow =
          lastProof.dip && lastProof.dip.kind === 'dump'
            ? dumpWatchLine(lastProof.dip, lastProof.ch1n)
            : null;
        lastProof.reclaim = reclaimNow;
        lastProof.reclaimLine = reclaimLineNow;
        lastProof.stillLine = stillLineNow;
        lastProof.dumpLine = dumpLineNow;
        if ($('dd-fomo-sub')) {
          if (dumpLineNow) $('dd-fomo-sub').textContent = dumpLineNow;
          else if (reclaimLineNow) $('dd-fomo-sub').textContent = reclaimLineNow;
          else if (stillLineNow) $('dd-fomo-sub').textContent = stillLineNow;
          else if (flow) $('dd-fomo-sub').textContent = flow;
        }
        if ($('dd-fomo')) {
          $('dd-fomo').classList.toggle('is-reclaim', !!reclaimNow);
          $('dd-fomo').classList.toggle(
            'is-still-deep',
            !reclaimNow && !!stillLineNow,
          );
        }
        // V29: paint mobile-visible trust bar (outside sticky-meta)
        paintTrustBar();
        var bp = buyPressure(lastProof.buys, lastProof.sells);
        lastProof.pressure = bp;
        if ($('dd-pressure')) {
          if (bp) {
            $('dd-pressure').hidden = false;
            $('dd-pressure').textContent = buyPressureLine(bp);
            $('dd-pressure').classList.toggle('is-sell', !!bp.moreSellers);
            $('dd-pressure').classList.toggle('is-even', !bp.moreBuyers && !bp.moreSellers);
          } else {
            $('dd-pressure').hidden = true;
          }
        }
        // Session delta vs first Dex read this visit (honest, local only)
        if (openMcap == null && isFinite(Number(mcap)) && Number(mcap) > 0) {
          openMcap = Number(mcap);
        }
        if (openMcap != null && isFinite(Number(mcap)) && openMcap > 0) {
          var dPct = ((Number(mcap) - openMcap) / openMcap) * 100;
          lastProof.delta = (dPct > 0 ? '+' : '') + dPct.toFixed(2) + '%';
          lastProof.session = sessionDelta(openMcap, mcap);
          lastProof.openMcap = openMcap;
          lastProof.nowMcap = Number(mcap);
          if ($('p-delta')) {
            $('p-delta').textContent = lastProof.delta;
            setTone($('p-delta'), dPct);
          }
          if ($('sp-delta')) {
            $('sp-delta').textContent = lastProof.delta;
            setTone($('sp-delta'), dPct);
          }
          if ($('dd-session-line')) {
            if (lastProof.session) {
              $('dd-session-line').hidden = false;
              $('dd-session-line').textContent = lastProof.session.line;
              $('dd-session-line').classList.toggle('is-up', !!lastProof.session.up);
              $('dd-session-line').classList.toggle('is-down', !lastProof.session.up);
            } else {
              $('dd-session-line').hidden = true;
            }
          }
          // FOMO sub: dump first (V43), else reclaim > still > session > flow
          if ($('dd-fomo-sub')) {
            if (lastProof.dumpLine) {
              $('dd-fomo-sub').textContent = lastProof.dumpLine;
            } else if (lastProof.reclaimLine) {
              $('dd-fomo-sub').textContent = lastProof.reclaimLine;
            } else if (lastProof.stillLine) {
              $('dd-fomo-sub').textContent = lastProof.stillLine;
            } else if (
              lastProof.session &&
              Math.abs(lastProof.session.pct) >= 0.5
            ) {
              $('dd-fomo-sub').textContent = lastProof.session.line;
            }
          }
          paintTrustBar();
        }
        // Poll-to-poll move flash (real Dex only)
        var movePct = null;
        if (prevMcapNum != null && isFinite(Number(mcap)) && prevMcapNum > 0) {
          movePct = ((Number(mcap) - prevMcapNum) / prevMcapNum) * 100;
          if (isFinite(movePct) && Math.abs(movePct) >= 0.01) {
            lastProof.move = (movePct > 0 ? '+' : '') + movePct.toFixed(2) + '%';
          } else {
            lastProof.move = '0.00%';
            movePct = 0;
          }
        }
        if (isFinite(Number(mcap)) && Number(mcap) > 0) prevMcapNum = Number(mcap);
        pushSparkSample(mcap);
        if ($('dd-fomo-main') && $('dd-fomo')) {
          var chN = lastProof.ch24n;
          var m5N = lastProof.m5n;
          var fomo = $('dd-fomo');
          var hot =
            (isFinite(chN) && Math.abs(chN) >= 5) ||
            (isFinite(m5N) && Math.abs(m5N) >= 2) ||
            (isFinite(movePct) && Math.abs(movePct) >= 0.5);
          var usedMove =
            isFinite(movePct) && Math.abs(movePct) >= 0.05 && lastProof.move !== '—';
          if (usedMove) {
            $('dd-fomo-main').textContent =
              (movePct > 0 ? '↑ mcap ' : movePct < 0 ? '↓ mcap ' : 'Flat mcap ') +
              lastProof.move +
              ' just now';
            if (movePct > 0) {
              fomo.classList.add('is-up');
              fomo.classList.remove('is-down');
            } else if (movePct < 0) {
              fomo.classList.add('is-down');
              fomo.classList.remove('is-up');
            }
            fomo.classList.remove('is-move');
            void fomo.offsetWidth;
            fomo.classList.add('is-move');
          } else if (lastProof.dip && lastProof.dip.kind === 'dump') {
            // V40: hard/deep dump when 24h not green — honest dump watch CTAs
            lastProof.regime = 'dump';
            var netDump =
              lastProof.buys != null && lastProof.sells != null
                ? netBuysShort(lastProof.buys, lastProof.sells)
                : null;
            $('dd-fomo-main').textContent = fomoDumpHeadline(
              lastProof.dip,
              bp,
              netDump,
            );
            fomo.classList.add('is-dip', 'is-dump');
            fomo.classList.remove('is-up', 'is-down', 'is-hot-win');
            var depthDump = dipDepth(lastProof.dip);
            fomo.classList.toggle(
              'is-deep',
              !!(depthDump && depthDump.tier === 'deep'),
            );
            fomo.classList.toggle(
              'is-hard',
              !!(depthDump && depthDump.tier === 'hard'),
            );
            if ($('dd-fomo-ab')) $('dd-fomo-ab').hidden = true;
            // V48: dump size autofocus every paint until user overrides chip
            try {
              var dumpManual =
                sessionStorage.getItem('dd_dump_manual') === '1';
              var autoDump = dumpSizeAutofocus(
                buySol,
                lastProof.dip,
                dumpManual,
              );
              if (autoDump && autoDump.changed) {
                buySol = autoDump.sol;
                try {
                  localStorage.setItem('dd_buy_sol', String(buySol));
                } catch (eLs) {}
              }
            } catch (eDumpN) {}
          } else if (lastProof.dip) {
            // Short-TF dip with 24h still green — A/B FOMO headlines
            lastProof.regime = 'dip';
            $('dd-fomo-main').textContent = fomoDipHeadline(
              lastProof.dip,
              lastProof.ch24,
              fomoAb,
              bp,
            );
            fomo.classList.add('is-dip');
            fomo.classList.remove('is-up', 'is-down', 'is-hot-win', 'is-dump');
            var depthNow = dipDepth(lastProof.dip);
            fomo.classList.toggle('is-deep', !!(depthNow && depthNow.tier === 'deep'));
            fomo.classList.toggle('is-hard', !!(depthNow && depthNow.tier === 'hard'));
            if ($('dd-fomo-ab')) {
              $('dd-fomo-ab').hidden = false;
              $('dd-fomo-ab').textContent = String(fomoAb).toUpperCase();
            }
            // Size nudge by dip depth: soft/hard→1 SOL, deep→2 SOL (once, if unset)
            try {
              var nudgeSol = dipSizeNudgeSol(lastProof.dip);
              if (
                nudgeSol &&
                sessionStorage.getItem('dd_dip_size_nudge') !== '1' &&
                localStorage.getItem('dd_buy_sol') == null
              ) {
                buySol = nudgeSol;
                sessionStorage.setItem('dd_dip_size_nudge', '1');
              }
            } catch (eNudge) {}
          } else if (
            buyRegime(null, { m5: lastProof.m5n, h1: lastProof.ch1n }, bp) === 'hot'
          ) {
            // V24: hot window — short green + buy pressure (not only dips convert)
            lastProof.regime = 'hot';
            $('dd-fomo-main').textContent = hotBuyHeadline(
              { m5: lastProof.m5n, h1: lastProof.ch1n },
              bp,
              lastProof.mcap,
            );
            fomo.classList.add('is-up', 'is-hot-win');
            fomo.classList.remove('is-down', 'is-dip');
            if ($('dd-fomo-ab')) $('dd-fomo-ab').hidden = true;
            try {
              if (
                buySol === 0.5 &&
                sessionStorage.getItem('dd_hot_size_nudge') !== '1' &&
                localStorage.getItem('dd_buy_sol') == null
              ) {
                buySol = 1;
                sessionStorage.setItem('dd_hot_size_nudge', '1');
              }
            } catch (eHot) {}
          } else if (bp && bp.moreBuyers && bp.pct >= 55) {
            $('dd-fomo-main').textContent =
              'Buy pressure · ' + bp.pct + '% buys 24h · mcap ' + lastProof.mcap;
            fomo.classList.add('is-up');
            fomo.classList.remove('is-down', 'is-dip');
          } else if (isFinite(chN) && chN > 0) {
            $('dd-fomo-main').textContent = 'Moving · 24h ' + lastProof.ch24;
            fomo.classList.add('is-up');
            fomo.classList.remove('is-down', 'is-dip');
          } else if (isFinite(chN) && chN < 0) {
            $('dd-fomo-main').textContent = 'Dip · 24h ' + lastProof.ch24;
            fomo.classList.add('is-down');
            fomo.classList.remove('is-up', 'is-dip');
          } else {
            $('dd-fomo-main').textContent = 'Live · mcap ' + lastProof.mcap;
            fomo.classList.remove('is-up', 'is-down', 'is-dip');
          }
          if (usedMove) fomo.classList.remove('is-dip');
          if (hot || lastProof.dip) fomo.classList.add('is-hot');
          else fomo.classList.remove('is-hot');
          if ($('dd-fomo-hot')) $('dd-fomo-hot').hidden = !(hot || lastProof.dip);
          if ($('dd-move-chip')) {
            if (lastProof.move && lastProof.move !== '—') {
              $('dd-move-chip').hidden = false;
              $('dd-move-chip').textContent = 'Poll ' + lastProof.move;
              setTone($('dd-move-chip'), movePct);
            }
          }
          if ($('dd-sticky')) {
            if (hot || lastProof.dip) $('dd-sticky').classList.add('is-hot');
            else $('dd-sticky').classList.remove('is-hot');
            if (lastProof.dip) $('dd-sticky').classList.add('is-dip');
            else $('dd-sticky').classList.remove('is-dip');
          }
          if ($('dd-sticky-dip')) {
            if (lastProof.dip) {
              $('dd-sticky-dip').hidden = false;
              $('dd-sticky-dip').textContent =
                lastProof.dip.shortLabel + ' ' + fmtPct(lastProof.dip.shortPct);
            } else {
              $('dd-sticky-dip').hidden = true;
            }
          }
          // Exit sheet: buy-first when dip, amount-aware
          if ($('dd-exit-title') && $('dd-exit-copy')) {
            if (lastProof.dip) {
              if ($('dd-exit-kicker')) $('dd-exit-kicker').textContent = 'Dip window';
              $('dd-exit-title').textContent = 'Dip buy?';
              $('dd-exit-copy').textContent =
                lastProof.dip.line +
                ' · Buy ' +
                buySol +
                ' SOL or copy the pack. Can go to zero.';
            } else {
              if ($('dd-exit-kicker')) $('dd-exit-kicker').textContent = 'Before you go';
              $('dd-exit-title').textContent = 'Still holding?';
              $('dd-exit-copy').textContent =
                'Buy ' +
                buySol +
                ' SOL on Jupiter or copy a hold pack. Culture coin · NFA · can go to zero.';
            }
          }
          if ($('dd-buy-sticky')) $('dd-buy-sticky').classList.add('dd-pulse-buy');
          if ($('dd-buy')) $('dd-buy').classList.add('dd-pulse-buy');
          if ($('dd-buy-amt')) $('dd-buy-amt').classList.add('dd-pulse-buy');
          wireBuyHrefs();
          if ($('dd-social-proof-hint')) {
            $('dd-social-proof-hint').textContent = hot
              ? 'HOT · tap to copy live pack'
              : 'Tap · copy share-ready live pack';
          }
        }
        if ($('dd-fomo-sub')) {
          // V43: dump first, else reclaim > still > session > flow > vol fallback
          if (lastProof.dumpLine) {
            $('dd-fomo-sub').textContent = lastProof.dumpLine;
          } else if (lastProof.reclaimLine) {
            $('dd-fomo-sub').textContent = lastProof.reclaimLine;
          } else if (lastProof.stillLine) {
            $('dd-fomo-sub').textContent = lastProof.stillLine;
          } else if (
            lastProof.session &&
            Math.abs(lastProof.session.pct) >= 0.5 &&
            lastProof.session.line
          ) {
            $('dd-fomo-sub').textContent = lastProof.session.line;
          } else if (lastProof.flow) {
            $('dd-fomo-sub').textContent = lastProof.flow;
          } else {
            var m5s = isFinite(lastProof.m5n) ? ' · 5m ' + fmtPct(ch.m5) : '';
            var moveS =
              lastProof.move && lastProof.move !== '—' ? ' · poll ' + lastProof.move : '';
            var txS =
              lastProof.buys != null && lastProof.sells != null
                ? ' · ' + lastProof.buys + 'b/' + lastProof.sells + 's'
                : '';
            $('dd-fomo-sub').textContent =
              'Vol ' +
              fmtUsd(vol) +
              ' · liq ' +
              fmtUsd(liq) +
              m5s +
              moveS +
              txS +
              ' · just now · NFA';
          }
        }

        lastRefreshAt = Date.now();
        tickFomoAge();
        updateTicker(
          lastProof.mcap,
          fmtUsd(liq),
          fmtUsd(vol),
          lastProof.ch24,
          lastProof.delta,
          lastProof.buys,
          lastProof.sells,
        );
        if ($('dd-ticker')) {
          var hotT =
            (isFinite(lastProof.ch24n) && Math.abs(lastProof.ch24n) >= 5) ||
            (isFinite(lastProof.m5n) && Math.abs(lastProof.m5n) >= 2);
          if (hotT) $('dd-ticker').classList.add('is-hot');
          else $('dd-ticker').classList.remove('is-hot');
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
              ? liveProofNow()
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
        if ($('dd-sticky-ch')) {
          $('dd-sticky-ch').textContent = '24h ' + fmtPct(ch.h24);
          setTone($('dd-sticky-ch'), ch.h24);
        }
        var chartUrl = safeProviderUrl(p.url, 'dexscreener.com');
        if (chartUrl && $('dd-chart')) $('dd-chart').href = chartUrl;
        var info = p.info || {};
        var imageUrl = safeProviderUrl(info.imageUrl, 'cdn.dexscreener.com');
        if (imageUrl && $('dd-token-img')) $('dd-token-img').src = imageUrl;
        if (asof) asof.textContent = new Date().toLocaleString() + ' · Dex';
        if ($('dd-live')) $('dd-live').textContent = 'live';
        if (window.__ddRefreshSpTweet) window.__ddRefreshSpTweet();
        if (window.__ddRefreshRaidKit) window.__ddRefreshRaidKit();
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
  // V23: one-tap copy CA + open wallet/buy (sticky, FOMO, mint)
  function runDualGo(el) {
    var sess =
      lastProof.session ||
      (lastProof.openMcap != null && lastProof.nowMcap != null
        ? sessionDelta(lastProof.openMcap, lastProof.nowMcap)
        : null);
    var netBit =
      lastProof.buys != null && lastProof.sells != null
        ? netBuysShort(lastProof.buys, lastProof.sells)
        : null;
    var mobile = isMobileBuyPath();
    var plan = dualGoPlan(
      buySol,
      mobile,
      lastProof.regime ||
        buyRegime(lastProof.dip, { m5: lastProof.m5n, h1: lastProof.ch1n }, lastProof.pressure),
      sess,
      lastProof.solUsd,
      netBit,
      lastProof.buys,
      lastProof.dip,
      lastProof.liq,
    );
    // V27/V28: copy pack (header+CA+buy+desk), open wallet, share dual pack
    var pack = plan.copyText || plan.ca;
    copy(pack, el || null);
    try {
      if (el) el.textContent = plan.toast;
      setTimeout(function () {
        if (el) el.textContent = plan.label;
      }, 1400);
    } catch (eLbl) {}
    try {
      window.open(plan.href, '_blank', 'noopener,noreferrer');
    } catch (eOpen) {
      try {
        location.href = plan.href;
      } catch (eLoc) {}
    }
    // Post-share X/TG/WA use dual pack (viral loop), not only dip pack
    showPostShare(pack);
    // Mobile native share sheet with dual pack (best-effort, non-blocking)
    if (mobile && typeof navigator !== 'undefined' && navigator.share) {
      try {
        navigator.share({ title: '$dasha', text: pack }).catch(function () {});
      } catch (eShare) {}
    }
  }
  document.querySelectorAll('.dd-dual-go, #dd-dual-go, #dd-fomo-dual, #dd-mint-dual').forEach(
    function (btn) {
      btn.addEventListener('click', function () {
        runDualGo(btn);
      });
    },
  );
  function paintTrustBar() {
    var bar = $('dd-trust-bar');
    var textEl = $('dd-trust-bar-text');
    // V43: never compute reclaim during dump — dumpWatchLine owns 1h bounce
    var isDump = !!(lastProof.dip && lastProof.dip.kind === 'dump');
    var reclaim =
      lastProof.dip != null && !isDump
        ? dipReclaim(lastProof.dip, lastProof.ch1n)
        : null;
    var reclaimLine = reclaim ? dipReclaimLine(reclaim, lastProof.dip) : null;
    lastProof.reclaim = reclaim;
    lastProof.reclaimLine = reclaimLine;
    // Ensure stillLine / dumpLine available for trust bar (same pure path as FOMO sub)
    if (!lastProof.stillLine && lastProof.dip && !isDump) {
      var stillForBar = stillGreen24(lastProof.dip, lastProof.ch24n);
      lastProof.stillLine = stillForBar
        ? dipStillLine(stillForBar, lastProof.dip)
        : null;
    }
    if (isDump) {
      lastProof.stillLine = null;
      lastProof.dumpLine = dumpWatchLine(lastProof.dip, lastProof.ch1n);
    } else if (
      !lastProof.dumpLine &&
      lastProof.dip &&
      lastProof.dip.kind === 'dump'
    ) {
      lastProof.dumpLine = dumpWatchLine(lastProof.dip, lastProof.ch1n);
    }
    var line = trustBarLine(
      lastProof.flow,
      lastProof.liqLine,
      lastProof.session,
      reclaimLine,
      lastProof.stillLine,
      lastProof.dumpLine,
    );
    lastProof.trustBar = line;
    if (bar) {
      bar.hidden = !line;
    }
    if (textEl) {
      if (line) {
        textEl.hidden = false;
        textEl.textContent = line;
      } else {
        textEl.hidden = true;
      }
    }
  }
  function paintDualLabels() {
    var regime =
      lastProof.regime ||
      buyRegime(lastProof.dip, { m5: lastProof.m5n, h1: lastProof.ch1n }, lastProof.pressure);
    lastProof.regime = regime;
    var sess =
      lastProof.session ||
      (lastProof.openMcap != null && lastProof.nowMcap != null
        ? sessionDelta(lastProof.openMcap, lastProof.nowMcap)
        : null);
    var netBit =
      lastProof.buys != null && lastProof.sells != null
        ? netBuysShort(lastProof.buys, lastProof.sells)
        : null;
    var plan = dualGoPlan(
      buySol,
      isMobileBuyPath(),
      regime,
      sess,
      lastProof.solUsd,
      netBit,
      lastProof.buys,
      lastProof.dip,
      lastProof.liq,
    );
    document.querySelectorAll('.dd-dual-go').forEach(function (b) {
      if (b.textContent && /copied/i.test(b.textContent)) return;
      b.textContent = plan.label;
      b.classList.toggle(
        'dd-pulse-buy',
        regime === 'dip' || regime === 'hot' || regime === 'dump',
      );
      b.classList.toggle('is-dip-dual', regime === 'dip' || regime === 'dump');
      b.classList.toggle('is-hot-dual', regime === 'hot');
      b.classList.toggle('is-dump-dual', regime === 'dump');
      b.classList.toggle('is-deep-dip', !!plan.isDeepDip);
      b.classList.toggle('is-hard-dip', !!plan.isHardDip);
      b.classList.toggle('has-usd', !!plan.hasUsd);
      b.classList.toggle('has-net', !!plan.hasNet);
      b.classList.toggle('has-pace', !!plan.hasPace);
      b.classList.toggle('has-still24', !!plan.hasStill24);
      b.classList.toggle('has-reclaim', !!plan.hasReclaim);
      b.classList.toggle('has-micro', !!plan.hasMicro);
      b.classList.toggle(
        'is-sess-up',
        !!(sess && sess.up && Math.abs(sess.pct) >= 0.5),
      );
      b.classList.toggle(
        'is-sess-down',
        !!(sess && !sess.up && Math.abs(sess.pct) >= 0.5),
      );
    });
    if ($('dd-sticky')) {
      $('dd-sticky').classList.toggle('is-hot', regime === 'hot');
      $('dd-sticky').classList.toggle(
        'is-dip',
        regime === 'dip' || regime === 'dump',
      );
      $('dd-sticky').classList.toggle('is-dump', regime === 'dump');
    }
  }
  if ($('dd-sticky-live'))
    $('dd-sticky-live').addEventListener('click', function () {
      copy(liveProofNow(), $('dd-sticky-live'));
    });
  if ($('dd-copy-buy'))
    $('dd-copy-buy').addEventListener('click', function () {
      copy(buyUrl(), $('dd-copy-buy'));
    });
  function pressureNoteNow() {
    if (lastProof.dip && lastProof.dip.line) return lastProof.dip.line;
    var bp = lastProof.pressure || buyPressure(lastProof.buys, lastProof.sells);
    return bp && bp.moreBuyers ? buyPressureLine(bp) : '';
  }
  function dipPackNow() {
    var netBit =
      lastProof.buys != null && lastProof.sells != null
        ? netBuysShort(lastProof.buys, lastProof.sells)
        : null;
    return lastProof.dip
      ? buildDipPack(
          lastProof.dip,
          lastProof.mcap,
          buySol,
          netBit,
          lastProof.buys,
        )
      : buildBuyPack(lastProof.mcap, buySol, pressureNoteNow());
  }
  function copyBuyPack(el) {
    copy(
      lastProof.dip
        ? dipPackNow()
        : buildBuyPack(lastProof.mcap, buySol, pressureNoteNow()),
      el,
    );
  }
  // Buy-click share loop: surface pack share without blocking navigation
  ['dd-buy', 'dd-buy-amt', 'dd-buy-sticky', 'dd-buy-wallet', 'dd-kit-wallet', 'dd-exit-buy', 'dd-fomo-buy'].forEach(
    function (id) {
      if (!$(id)) return;
      $(id).addEventListener('click', function () {
        showPostShare(dipPackNow());
      });
    },
  );
  if ($('dd-fomo-raid-dip'))
    $('dd-fomo-raid-dip').addEventListener('click', function () {
      // V47: one-tap X — pack already on href; also copy for clipboard/share loop
      var pack = dipPackNow();
      var xUrl = intentTweet(pack);
      copy(pack, $('dd-fomo-raid-dip'));
      showPostShare(pack);
      if ($('dd-fomo-raid-dip').tagName === 'A') {
        $('dd-fomo-raid-dip').href = xUrl;
      }
      if ($('dd-sticky-tweet')) $('dd-sticky-tweet').href = xUrl;
      if ($('dd-post-x')) $('dd-post-x').href = xUrl;
      if ($('dd-post-tg')) $('dd-post-tg').href = intentTelegram(pack);
      if ($('dd-post-wa')) $('dd-post-wa').href = intentWhatsApp(pack);
      // Button fallback (legacy): open X if not an anchor
      if ($('dd-fomo-raid-dip').tagName !== 'A') {
        try {
          window.open(xUrl, '_blank', 'noopener,noreferrer');
        } catch (eRaid) {}
      }
    });
  if ($('dd-copy-buy-pack'))
    $('dd-copy-buy-pack').addEventListener('click', function () {
      copyBuyPack($('dd-copy-buy-pack'));
    });
  if ($('dd-copy-buy-pack-hero'))
    $('dd-copy-buy-pack-hero').addEventListener('click', function () {
      copyBuyPack($('dd-copy-buy-pack-hero'));
    });
  if ($('dd-sticky-buy-pack'))
    $('dd-sticky-buy-pack').addEventListener('click', function () {
      copyBuyPack($('dd-sticky-buy-pack'));
    });
  if ($('dd-copy-live'))
    $('dd-copy-live').addEventListener('click', function () {
      copy(liveProofNow(), $('dd-copy-live'));
    });
  if ($('dd-copy-hold'))
    $('dd-copy-hold').addEventListener('click', function () {
      copy(buildSharePack('hold'), $('dd-copy-hold'));
    });

  if ($('dd-social-proof'))
    $('dd-social-proof').addEventListener('click', function () {
      copy(liveProofNow(), $('dd-social-proof-hint') || $('dd-social-proof'));
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
          .share({ title: '$dasha', text: text, url: deskUrl() })
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
      if (window.__ddRefreshRaidKit) window.__ddRefreshRaidKit();
    });
  });


  function openExit() {
    if (!$('dd-exit') || $('dd-exit').hidden === false) return;
    try {
      if (sessionStorage.getItem('dd_exit_shown') === '1') return;
      sessionStorage.setItem('dd_exit_shown', '1');
    } catch (e) {}
    $('dd-exit').hidden = false;
    wireBuyHrefs();
    if ($('dd-exit-copy')) {
      if (lastProof.dip) {
        if ($('dd-exit-kicker')) $('dd-exit-kicker').textContent = 'Dip window';
        if ($('dd-exit-title')) $('dd-exit-title').textContent = 'Dip buy?';
        $('dd-exit-copy').textContent =
          lastProof.dip.line +
          (lastProof.mcap && lastProof.mcap !== '—'
            ? ' · mcap ' + lastProof.mcap
            : '') +
          ' · Buy ' +
          buySol +
          ' SOL or copy pack. Can go to zero.';
      } else if (lastProof.mcap && lastProof.mcap !== '—') {
        if ($('dd-exit-kicker')) $('dd-exit-kicker').textContent = 'Before you go';
        if ($('dd-exit-title')) $('dd-exit-title').textContent = 'Still holding?';
        $('dd-exit-copy').textContent =
          'Live mcap ' +
          lastProof.mcap +
          ' · 24h ' +
          lastProof.ch24 +
          ' · Buy ' +
          buySol +
          ' SOL or copy hold. NFA · can go to zero.';
      }
    }
  }
  function closeExit() {
    if ($('dd-exit')) $('dd-exit').hidden = true;
  }
  if ($('dd-sp-copy-live'))
    $('dd-sp-copy-live').addEventListener('click', function () {
      copy(liveProofNow(), $('dd-sp-copy-live'));
    });
  if ($('dd-sp-copy-hold'))
    $('dd-sp-copy-hold').addEventListener('click', function () {
      copy(buildSharePack('hold'), $('dd-sp-copy-hold'));
    });
  if ($('dd-sp-tweet')) {
    function refreshSpTweet() {
      var line =
        lastProof.mcap && lastProof.mcap !== '—'
          ? liveProofNow()
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


  // Referral capture: inbound ?ref= and live href wiring
  try {
    var _u = new URL(location.href);
    var _from = _u.searchParams.get('ref');
    if (_from && /^[a-z0-9]{4,8}$/i.test(_from) && _from !== getRef()) {
      localStorage.setItem('dd_from', _from);
      if ($('dd-ref-chip')) {
        $('dd-ref-chip').hidden = false;
        $('dd-ref-chip').textContent = 'via ' + _from;
      }
    }
  } catch (eRef) {}
  function isMobileBuyPath() {
    try {
      return (
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
        (window.matchMedia && window.matchMedia('(max-width:560px)').matches)
      );
    } catch (eM) {
      return false;
    }
  }
  function paintAmtChips() {
    document.querySelectorAll('.dd-amt, .dd-amt-sm').forEach(function (b) {
      var sol = b.getAttribute('data-sol');
      var on = String(sol) === String(buySol);
      b.classList.toggle('is-on', on);
      // V38: highlight depth-recommended size chip (deep→2, hard→1)
      var hint = sizeChipHint(sol, lastProof.dip);
      b.classList.toggle('is-nudge', !!(hint && hint.recommended));
      if (hint && hint.tier === 'deep') b.classList.add('is-nudge-deep');
      else b.classList.remove('is-nudge-deep');
      // V48: dump autofocus chip pulse
      b.classList.toggle(
        'is-dump-focus',
        !!(
          hint &&
          hint.recommended &&
          lastProof.dip &&
          lastProof.dip.kind === 'dump' &&
          on
        ),
      );
      var usd = null;
      if (lastProof.solUsd != null && isFinite(lastProof.solUsd)) {
        usd = Number(sol) * lastProof.solUsd;
      }
      var rough = fmtUsdRough(usd);
      if (rough && hint && hint.recommended) {
        b.innerHTML =
          sol + '<small>' + rough + ' · ' + hint.tag + '</small>';
      } else if (rough) {
        b.innerHTML = sol + '<small>' + rough + '</small>';
      } else if (hint && hint.recommended) {
        b.innerHTML = sol + '<small>' + hint.tag + '</small>';
      } else {
        b.textContent = sol;
      }
    });
  }

  /** Runtime live pack with dip still/net when available (V38) */
  function liveProofNow() {
    var netBit =
      lastProof.buys != null && lastProof.sells != null
        ? netBuysShort(lastProof.buys, lastProof.sells)
        : null;
    return buildLiveProof(
      lastProof.mcap,
      lastProof.ch24,
      lastProof.dip,
      netBit,
    );
  }
  function wireBuyHrefs() {
    var href = buyUrl(buySol);
    var mobile = isMobileBuyPath();
    var phantomHref = mobile ? phantomBrowseUrl(href) : href;
    ['dd-buy', 'dd-buy-sticky', 'dd-exit-buy', 'dd-buy-wallet', 'dd-kit-wallet', 'dd-buy-amt', 'dd-fomo-buy'].forEach(
      function (id) {
        if ($(id)) $(id).href = href;
      },
    );
    var usd1 =
      lastProof.solUsd != null && isFinite(lastProof.solUsd)
        ? fmtUsdRough(buySol * lastProof.solUsd)
        : '';
    var netBit =
      lastProof.buys != null && lastProof.sells != null
        ? netBuysShort(lastProof.buys, lastProof.sells)
        : '';
    if ($('dd-buy-amt')) {
      $('dd-buy-amt').textContent =
        'Buy ' + buySol + ' SOL' + (usd1 ? ' · ' + usd1 : '');
    }
    if ($('dd-buy')) {
      $('dd-buy').textContent =
        'Buy ' + buySol + ' SOL on Jupiter' + (usd1 ? ' · ' + usd1 : '');
    }
    if ($('dd-buy-sticky')) {
      var stickyRegime =
        lastProof.regime ||
        buyRegime(lastProof.dip, { m5: lastProof.m5n, h1: lastProof.ch1n }, lastProof.pressure);
      if (stickyRegime === 'dip' || stickyRegime === 'dump') {
        var sd = dipDepth(lastProof.dip);
        var isDumpSticky = stickyRegime === 'dump' || (lastProof.dip && lastProof.dip.kind === 'dump');
        var stillSticky = !isDumpSticky
          ? stillGreen24(lastProof.dip, lastProof.ch24n)
          : null;
        var reclaimSticky = !isDumpSticky
          ? dipReclaim(lastProof.dip, lastProof.ch1n)
          : null;
        var microSticky = !isDumpSticky
          ? dipMicroBounce(lastProof.dip, lastProof.m5n, reclaimSticky)
          : null;
        var bounceSticky =
          reclaimSticky && reclaimSticky.short
            ? reclaimSticky.short
            : microSticky && microSticky.short
              ? microSticky.short
              : '';
        var dumpVerb =
          sd && sd.tier !== 'soft'
            ? sd.tag + (isDumpSticky ? ' dump' : ' dip')
            : isDumpSticky
              ? 'Dump'
              : 'Dip';
        // V44: %liq impact on sticky dump/deep (matches dual/FOMO de-risk)
        var impactSticky =
          isDumpSticky || (sd && sd.tier === 'deep')
            ? solLiqImpact(buySol, lastProof.solUsd, lastProof.liq)
            : null;
        $('dd-buy-sticky').textContent =
          dumpVerb +
          ' · ' +
          buySol +
          ' SOL' +
          (usd1 ? ' · ' + usd1 : '') +
          (impactSticky && impactSticky.short
            ? ' · ' + impactSticky.short
            : '') +
          (stillSticky && stillSticky.short ? ' · ' + stillSticky.short : '') +
          (bounceSticky ? ' · ' + bounceSticky : '') +
          (netBit && netBit !== '—' && netBit !== '0' ? ' · ' + netBit + ' net' : '') +
          (lastProof.mcap && lastProof.mcap !== '—' ? ' · ' + lastProof.mcap : '');
      } else if (stickyRegime === 'hot') {
        $('dd-buy-sticky').textContent =
          'Ride · ' +
          buySol +
          ' SOL' +
          (netBit && netBit !== '—' && netBit !== '0' ? ' · ' + netBit + ' net' : '') +
          (lastProof.mcap && lastProof.mcap !== '—' ? ' · ' + lastProof.mcap : '');
      } else {
        $('dd-buy-sticky').textContent =
          lastProof.mcap && lastProof.mcap !== '—'
            ? 'Buy ' +
              buySol +
              (netBit && netBit !== '—' && netBit !== '0' ? ' · ' + netBit + ' net' : '') +
              ' · ' +
              lastProof.mcap
            : 'Buy ' + buySol + ' SOL';
      }
    }
    // FOMO CTAs — dip or hot-window buy (Phantom UL on mobile)
    var regime =
      lastProof.regime ||
      buyRegime(lastProof.dip, { m5: lastProof.m5n, h1: lastProof.ch1n }, lastProof.pressure);
    lastProof.regime = regime;
    var paceBit = buyPaceShort(lastProof.buys);
    if ($('dd-fomo-buy')) {
      var showFomoBuy =
        regime === 'dip' || regime === 'hot' || regime === 'dump';
      $('dd-fomo-buy').href = showFomoBuy && mobile ? phantomHref : href;
      if (showFomoBuy) {
        $('dd-fomo-buy').hidden = false;
        var fomoBits = [];
        if (regime === 'dump') {
          var fdDump = dipDepth(lastProof.dip);
          fomoBits.push(
            fdDump && fdDump.tier !== 'soft'
              ? fdDump.tag + ' dump'
              : 'Dump',
          );
        } else if (regime === 'dip') {
          var fd = dipDepth(lastProof.dip);
          fomoBits.push(
            fd && fd.tier !== 'soft'
              ? fd.tag + ' dip'
              : mobile
                ? 'Dip'
                : 'Dip buy',
          );
        } else fomoBits.push('Ride');
        fomoBits.push(buySol + ' SOL' + (usd1 ? ' · ' + usd1 : ''));
        // V42: liq impact on FOMO buy during dump/deep dip (de-risks size)
        var impactBuy =
          regime === 'dump' || regime === 'dip'
            ? solLiqImpact(buySol, lastProof.solUsd, lastProof.liq)
            : null;
        if (
          impactBuy &&
          impactBuy.short &&
          (regime === 'dump' ||
            (lastProof.dip &&
              dipDepth(lastProof.dip) &&
              dipDepth(lastProof.dip).tier === 'deep'))
        ) {
          fomoBits.push(impactBuy.short);
        }
        // V31: 24h still green during dip on FOMO buy CTA
        var stillBit =
          regime === 'dip' ? stillGreen24(lastProof.dip, lastProof.ch24n) : null;
        if (stillBit && stillBit.short) fomoBits.push(stillBit.short);
        // V32/V37: 1h reclaim or 5m micro-bounce during multi-hour dip
        var reclaimBit =
          regime === 'dip' ? dipReclaim(lastProof.dip, lastProof.ch1n) : null;
        if (reclaimBit && reclaimBit.short) fomoBits.push(reclaimBit.short);
        else if (regime === 'dip') {
          var microBit = dipMicroBounce(
            lastProof.dip,
            lastProof.m5n,
            reclaimBit,
          );
          if (microBit && microBit.short) fomoBits.push(microBit.short);
        }
        if (netBit && netBit !== '—' && String(netBit).charAt(0) === '+') {
          fomoBits.push(netBit + ' net');
        }
        if (paceBit) fomoBits.push(paceBit);
        $('dd-fomo-buy').textContent = fomoBits.join(' · ');
      } else {
        $('dd-fomo-buy').hidden = true;
      }
    }
    if ($('dd-fomo-raid-dip')) {
      $('dd-fomo-raid-dip').hidden = !lastProof.dip;
      // V37/V47: raid CTA — dump/deep one-tap X with viral pack on href
      if (lastProof.dip) {
        var netRaid =
          lastProof.buys != null && lastProof.sells != null
            ? netBuysShort(lastProof.buys, lastProof.sells)
            : null;
        var raidPlan = dumpRaidPlan(
          lastProof.dip,
          lastProof.mcap,
          buySol,
          netRaid,
          lastProof.buys,
        );
        var depthRaid = dipDepth(lastProof.dip);
        if (raidPlan) {
          $('dd-fomo-raid-dip').textContent = raidPlan.label;
          if ($('dd-fomo-raid-dip').tagName === 'A') {
            $('dd-fomo-raid-dip').href = raidPlan.href;
          }
          $('dd-fomo-raid-dip').classList.toggle('is-dump-raid', !!raidPlan.isDump);
        } else {
          var stillRaid = stillGreen24(lastProof.dip, lastProof.ch24n);
          $('dd-fomo-raid-dip').textContent = dipRaidLabel(
            lastProof.dip,
            stillRaid,
            true,
          );
        }
        $('dd-fomo-raid-dip').classList.toggle(
          'is-deep-raid',
          !!(depthRaid && depthRaid.tier === 'deep'),
        );
      }
    }
    if ($('dd-fomo-amts')) {
      $('dd-fomo-amts').hidden = !lastProof.dip;
    }
    if ($('dd-fomo-ab') && !lastProof.dip) {
      $('dd-fomo-ab').hidden = true;
    }
    if ($('dd-exit-buy')) {
      $('dd-exit-buy').textContent =
        'Buy ' + buySol + ' SOL' + (usd1 ? ' · ' + usd1 : '');
    }
    if ($('dd-buy-amounts-note')) {
      $('dd-buy-amounts-note').textContent =
        buySol +
        ' SOL' +
        (usd1 ? ' (' + usd1 + ')' : '') +
        ' → $dasha on Jupiter · NFA';
    }
    paintAmtChips();
    if (typeof paintDualLabels === 'function') paintDualLabels();
    // Phantom universal-link browse for mobile wallet one-tap (amounted jup URL inside)
    ['dd-buy-wallet', 'dd-kit-wallet'].forEach(function (wid) {
      if (!$(wid)) return;
      $(wid).href = phantomBrowseUrl(href);
      $(wid).textContent = mobile
        ? 'Wallet · ' + buySol + ' SOL'
        : 'Open wallet · ' + buySol + ' SOL';
    });
    // On mobile sticky: primary stays Jupiter; wallet is Phantom UL with same amount
    if (mobile && $('dd-buy-sticky')) {
      $('dd-buy-sticky').setAttribute('title', 'Buy ' + buySol + ' SOL on Jupiter');
    }
    if ($('dd-kit-wallet')) {
      $('dd-kit-wallet').setAttribute(
        'title',
        'Open ' + buySol + ' SOL buy in Phantom / wallet',
      );
    }
  }
  wireBuyHrefs();
  document.querySelectorAll('.dd-amt, .dd-amt-sm').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var n = Number(btn.getAttribute('data-sol'));
      if (!isFinite(n) || n <= 0) return;
      buySol = n;
      try {
        localStorage.setItem('dd_buy_sol', String(buySol));
        // V48: user overrode dump autofocus for this session
        if (lastProof.dip && lastProof.dip.kind === 'dump') {
          sessionStorage.setItem('dd_dump_manual', '1');
        }
      } catch (eAmt) {}
      wireBuyHrefs();
      if (lastProof.mcap && lastProof.mcap !== '—') {
        updateTicker(
          lastProof.mcap,
          '—',
          lastProof.vol,
          lastProof.ch24,
          lastProof.delta,
          lastProof.buys,
          lastProof.sells,
        );
      }
    });
  });
  if ($('dd-exit-buy-pack'))
    $('dd-exit-buy-pack').addEventListener('click', function () {
      copyBuyPack($('dd-exit-buy-pack'));
    });


  function raidLineNow() {
    return lastProof.mcap && lastProof.mcap !== '—'
      ? liveProofNow()
      : buildSharePack(resolvePack('raid'));
  }
  function refreshRaidKit() {
    var line = raidLineNow();
    if ($('dd-kit-post-raid')) $('dd-kit-post-raid').href = intentTweet(line);
    if ($('dd-kit-post-tg')) $('dd-kit-post-tg').href = intentTelegram(line);
    if ($('dd-kit-post-wa')) $('dd-kit-post-wa').href = intentWhatsApp(line);
    if ($('dd-sticky-tweet')) $('dd-sticky-tweet').href = intentTweet(line);
    if ($('dd-raid-kit-note')) {
      $('dd-raid-kit-note').textContent =
        (raidAb === 'b' ? 'Raid B' : 'Raid A') +
        (lastProof.mcap && lastProof.mcap !== '—' ? ' · live mcap ' + lastProof.mcap : '') +
        ' · X · TG · WA · ref on desk';
    }
  }

  // Hold score — local check-ins only (not on-chain, not a claim)
  function holdScoreRead() {
    try {
      var n = parseInt(localStorage.getItem('dd_hold_n') || '0', 10);
      return isFinite(n) && n > 0 ? n : 0;
    } catch (eH) {
      return 0;
    }
  }
  function holdScoreWrite(n) {
    try {
      localStorage.setItem('dd_hold_n', String(n));
      localStorage.setItem('dd_hold_last', String(Date.now()));
    } catch (eW) {}
  }
  function refreshHoldScore() {
    var n = holdScoreRead();
    if ($('dd-hold-score-n')) $('dd-hold-score-n').textContent = String(n);
    if ($('dd-hold-score-note')) {
      $('dd-hold-score-note').textContent =
        n > 0
          ? n + ' local check-in' + (n === 1 ? '' : 's') + ' · still holding · NFA'
          : 'Local only · tap if still in · NFA · not a promise';
    }
  }
  refreshHoldScore();
  if ($('dd-hold-checkin'))
    $('dd-hold-checkin').addEventListener('click', function () {
      var n = holdScoreRead() + 1;
      holdScoreWrite(n);
      refreshHoldScore();
      copy(buildSharePack('hold'), $('dd-hold-checkin'));
      if ($('dd-hold-score')) {
        $('dd-hold-score').classList.remove('is-pop');
        void $('dd-hold-score').offsetWidth;
        $('dd-hold-score').classList.add('is-pop');
      }
    });
  if ($('dd-hold-share'))
    $('dd-hold-share').addEventListener('click', function () {
      var line = buildSharePack('hold');
      if (holdScoreRead() > 0) {
        line =
          "I'm still holding $dasha · hold score " +
          holdScoreRead() +
          ' (local)\n' +
          CA +
          '\nBuy → ' +
          buyUrl() +
          '\nDesk → ' +
          deskUrl() +
          '\nNFA · can go to zero · association ≠ endorsement';
      }
      copy(line, $('dd-hold-share'));
    });

  // Invite micro-loop: show ref, copy desk URL, local share counter
  function inviteSharesRead() {
    try {
      var n = parseInt(localStorage.getItem('dd_invite_shares') || '0', 10);
      return isFinite(n) && n > 0 ? n : 0;
    } catch (eI) {
      return 0;
    }
  }
  function inviteSharesBump() {
    var n = inviteSharesRead() + 1;
    try {
      localStorage.setItem('dd_invite_shares', String(n));
    } catch (eB) {}
    return n;
  }
  function inviteTier(n) {
    if (n >= 10) return 'Whale';
    if (n >= 3) return 'Raider';
    if (n >= 1) return 'Scout';
    return 'Rookie';
  }
  function refreshInviteLoop() {
    if ($('dd-invite-code')) $('dd-invite-code').textContent = 'ref=' + getRef();
    if ($('dd-invite-stat')) $('dd-invite-stat').textContent = String(inviteSharesRead());
    if ($('dd-invite-note')) {
      var n = inviteSharesRead();
      var tier = inviteTier(n);
      $('dd-invite-note').textContent =
        n > 0
          ? tier +
            ' · ' +
            n +
            ' invite copies · local only · desk links carry your ref · NFA'
          : 'Rookie · copy your invite link · local share count only · NFA';
    }
  }
  refreshInviteLoop();
  if ($('dd-copy-invite-link'))
    $('dd-copy-invite-link').addEventListener('click', function () {
      inviteSharesBump();
      refreshInviteLoop();
      copy(deskUrl(), $('dd-copy-invite-link'));
    });
  if ($('dd-kit-raid'))
    $('dd-kit-raid').addEventListener('click', function () {
      copy(raidLineNow(), $('dd-kit-raid'));
      refreshRaidKit();
    });
  if ($('dd-kit-copy-raid'))
    $('dd-kit-copy-raid').addEventListener('click', function () {
      copy(buildSharePack(resolvePack('raid')), $('dd-kit-copy-raid'));
      refreshRaidKit();
    });
  if ($('dd-kit-copy-invite'))
    $('dd-kit-copy-invite').addEventListener('click', function () {
      copy(buildSharePack('invite'), $('dd-kit-copy-invite'));
    });
  if ($('dd-kit-copy-live'))
    $('dd-kit-copy-live').addEventListener('click', function () {
      copy(liveProofNow(), $('dd-kit-copy-live'));
    });
  window.__ddRefreshRaidKit = refreshRaidKit;
  refreshRaidKit();


  if ($('dd-ticker'))
    $('dd-ticker').addEventListener('click', function () {
      copy(liveProofNow(), $('dd-ticker'));
    });
  setInterval(tickFomoAge, 1000);

  setShare('raid');
  bindQuoteTaps();
  hardenImages();
  drawQr(CA);
  loadMarket();
  setInterval(loadMarket, 30000);
})();
