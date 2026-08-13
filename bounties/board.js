'use strict';
/**
 * dasha bounties — anybody lists a project or a GitHub issue/PR and writes their own rules.
 * Static feed: /bounties/feed.json (same file the page loads). Inbox: GitHub issues.
 * This-device: localStorage. Share: #l= JSON. Also merges Demigod's public feed (GitHub raw / jsDelivr).
 * Outcomes need a GitHub proof URL. Nothing invents numbers. Declared, not escrow.
 */
(function (global) {
  var LISTING_REPO = 'Uuriko/dasha-desk';
  var ISSUE_LABEL = 'bounty-project';
  var TITLE_PREFIX = '[bounty]';
  var STORAGE_KEY = 'dasha-bounties-listings-v1';
  var EXTRA_SEED_URLS = [
    'https://raw.githubusercontent.com/Uuriko/demigod-site-cdn/main/bounties-feed.json',
    'https://cdn.jsdelivr.net/gh/Uuriko/demigod-site-cdn@main/bounties-feed.json',
  ];
  var DEMIGOD_BOARD_NOTE = 'also on trydemigod.com/bounties';
  var REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
  var GH_ACCEPT = 'application/vnd.github+json';
  var GH_VERSION = '2022-11-28';
  var EMPTY_OUTCOMES = 'No accepted outcomes in this cycle yet.';
  var PROOF_RE =
    /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/(issues|pull)\/(\d+)(?:#(?:issuecomment-\d+|pullrequestreview-\d+|discussion_r\d+))?$/i;
  var ITEM_RE =
    /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/(issues|pull)\/(\d+)/i;

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isValidRepo(value) {
    var s = String(value || '').trim();
    if (!REPO_RE.test(s)) return false;
    var parts = s.split('/');
    return parts.length === 2 && parts[0] !== '.' && parts[1] !== '.' && parts[0] !== '..' && parts[1] !== '..';
  }

  function normalizeRepo(value) {
    var s = String(value || '').trim();
    if (!s) return '';
    var fromUrl = s.match(/github\.com\/([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)/i);
    if (fromUrl) s = fromUrl[1];
    s = s.replace(/\.git$/i, '').replace(/^\/+/, '');
    return isValidRepo(s) ? s : '';
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function num(value) {
    if (value == null || value === '') return null;
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function parseGithubItem(value) {
    var s = String(value || '').trim();
    if (!s) return null;
    var fromUrl = s.match(ITEM_RE);
    if (fromUrl) {
      var repo = fromUrl[1] + '/' + fromUrl[2];
      if (!isValidRepo(repo)) return null;
      var type = fromUrl[3].toLowerCase() === 'pull' ? 'pull' : 'issues';
      var number = Number(fromUrl[4]);
      return {
        repo: repo,
        type: type,
        number: number,
        url: 'https://github.com/' + repo + '/' + type + '/' + number,
      };
    }
    var short = s.match(/^([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)#(\d+)$/);
    if (short && isValidRepo(short[1])) {
      return {
        repo: short[1],
        type: 'issues',
        number: Number(short[2]),
        url: 'https://github.com/' + short[1] + '/issues/' + short[2],
      };
    }
    return null;
  }

  function parseGithubProof(value) {
    var s = String(value || '').trim().split('?')[0];
    var m = s.match(PROOF_RE);
    if (!m) return null;
    var repo = m[1] + '/' + m[2];
    if (!isValidRepo(repo)) return null;
    return {
      url: s,
      repo: repo,
      type: m[3].toLowerCase() === 'pull' ? 'pull' : 'issues',
      number: Number(m[4]),
    };
  }

  function listingId(listing) {
    if (listing && listing.kind === 'item' && listing.item) {
      return ('item:' + listing.item.repo + '/' + listing.item.type + '/' + listing.item.number).toLowerCase();
    }
    if (listing && listing.repo) return listing.repo.toLowerCase();
    return 'name:' + slugify(listing && listing.name);
  }

  function normalizePool(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(raw, 'amount')) return null;
    var amount = Number(raw.amount);
    if (!Number.isFinite(amount)) return null;
    var currency = String(raw.currency || '').trim();
    return { amount: amount, currency: currency || null };
  }

  function normalizeCreatedAt(value) {
    var s = String(value || '').trim();
    if (!s) return null;
    var d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function normalizeOutcomes(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.forEach(function (row) {
      if (!row || typeof row !== 'object') return;
      var proof = parseGithubProof(row.url || row.htmlUrl || row.proof || row.pr || row.issue);
      if (!proof) return;
      out.push({
        login: String(row.login || row.user || '').trim() || null,
        url: proof.url,
        note: String(row.note || row.title || '').trim() || null,
        amount: num(row.amount),
      });
    });
    return out;
  }

  function extractJsonObject(text) {
    var src = String(text || '');
    var fence = src.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) src = fence[1];
    var start = src.indexOf('{');
    if (start < 0) return null;
    var depth = 0;
    var inStr = false;
    var escChar = false;
    for (var i = start; i < src.length; i++) {
      var c = src[i];
      if (inStr) {
        if (escChar) escChar = false;
        else if (c === '\\') escChar = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(src.slice(start, i + 1));
          } catch (e) {
            return null;
          }
        }
      }
    }
    return null;
  }

  function normalizePayout(raw) {
    if (typeof raw === 'string') return raw.trim();
    if (raw && typeof raw === 'object') {
      return String(raw.note || raw.url || raw.solana || '').trim();
    }
    return '';
  }

  function normalizeListing(raw, meta) {
    if (!raw || typeof raw !== 'object') return null;
    var item = parseGithubItem(raw.itemUrl || raw.item || raw.issueUrl || raw.issue || raw.pr);
    var kindHint = String(raw.kind || raw.type || '').toLowerCase();
    var kind = kindHint === 'item' || item ? 'item' : 'project';
    if (kind === 'item' && !item) return null;
    var repo = item ? item.repo : normalizeRepo(raw.repo || raw.github || raw.repository || '');
    var name = String(raw.name || raw.project || raw.title || '').trim();
    if (!name && item) name = repo + '#' + item.number;
    if (!name && repo) name = repo.replace(/^.*\//, '');
    if (!name) return null;
    var pool = kind === 'project' ? normalizePool(raw.pool) : null;
    var amount = num(raw.amount);
    var currency = String(raw.currency || '').trim() || null;
    if (amount == null && pool) {
      amount = pool.amount;
      currency = currency || pool.currency;
    }
    if (kind === 'project' && !pool && amount != null) {
      pool = { amount: amount, currency: currency };
    }
    var listing = {
      kind: kind,
      name: name,
      repo: repo,
      item: item,
      itemUrl: item ? item.url : '',
      url: String(raw.url || '').trim(),
      blurb: String(raw.blurb || '').trim(),
      amount: amount,
      currency: currency,
      pool: pool,
      pays: String(raw.pays || '').trim(),
      eligibility: String(raw.eligibility || '').trim(),
      payout: normalizePayout(raw.payout),
      rules: String(raw.rules || '').trim(),
      createdAt: normalizeCreatedAt(raw.createdAt || raw.created_at || (meta && meta.createdAt)),
      outcomes: normalizeOutcomes(raw.outcomes || raw.accepted),
      origin: (meta && meta.origin) || 'unknown',
    };
    if (meta) {
      if (meta.issueNumber != null) listing.issueNumber = meta.issueNumber;
      if (meta.issueUrl) listing.issueUrl = meta.issueUrl;
    }
    listing.id = listingId(listing);
    return listing;
  }

  function isBountyIssue(issue) {
    if (!issue || issue.pull_request) return false;
    var labels = (issue.labels || []).map(function (l) {
      return String(l && l.name != null ? l.name : l).toLowerCase();
    });
    if (labels.indexOf(ISSUE_LABEL) !== -1) return true;
    return String(issue.title || '').trim().toLowerCase().indexOf(TITLE_PREFIX) === 0;
  }

  function listingFromIssue(issue) {
    if (!isBountyIssue(issue)) return null;
    var parsed = extractJsonObject(issue.body);
    if (!parsed) return null;
    return normalizeListing(parsed, {
      origin: 'issue',
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      createdAt: issue.created_at,
    });
  }

  function listingsFromIssues(issues) {
    var out = [];
    (issues || []).forEach(function (issue) {
      var listing = listingFromIssue(issue);
      if (listing) out.push(listing);
    });
    return out;
  }

  function listingsFromSeed(seed, origin) {
    var rows = seed && Array.isArray(seed.listings) ? seed.listings : Array.isArray(seed) ? seed : [];
    var out = [];
    rows.forEach(function (raw) {
      var listing = normalizeListing(raw, { origin: origin || 'seed' });
      if (listing) out.push(listing);
    });
    return out;
  }

  function mergeListings() {
    var byId = {};
    var order = [];
    Array.prototype.slice.call(arguments).forEach(function (group) {
      (group || []).forEach(function (listing) {
        var key = listing.id;
        if (!byId[key]) order.push(key);
        byId[key] = listing;
      });
    });
    return order.map(function (key) {
      return byId[key];
    });
  }

  async function listingsFromExtraUrls(fetchImpl, urls, origin) {
    var extraUrls = Array.isArray(urls) ? urls : [];
    var extraRes = null;
    for (var x = 0; x < extraUrls.length; x++) {
      try {
        var extraOpts = { mode: 'cors', headers: { Accept: 'application/json' } };
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
          extraOpts.signal = AbortSignal.timeout(4000);
        }
        extraRes = await fetchImpl(extraUrls[x], extraOpts);
        if (extraRes && extraRes.ok) break;
      } catch (err) {
        extraRes = null;
      }
    }
    if (!extraRes || !extraRes.ok) return [];
    return listingsFromSeed(await extraRes.json(), origin || 'demigod');
  }

  function formatPool(pool) {
    if (!pool || !Number.isFinite(pool.amount)) return 'undeclared';
    return formatMoney(pool.amount, pool.currency);
  }

  function formatMoney(amount, currency) {
    if (!Number.isFinite(amount)) return 'undeclared';
    if (!currency) return String(amount) + ' (currency undeclared)';
    if (/^usd$/i.test(currency) || currency === '$') return '$' + String(amount);
    return String(amount) + ' ' + currency;
  }

  function formatAmount(listing) {
    if (!listing || !Number.isFinite(listing.amount)) return listing && listing.kind === 'project' ? null : 'undeclared';
    return formatMoney(listing.amount, listing.currency);
  }

  function rulesBlocks(listing) {
    var blocks = [];
    if (listing.pays) blocks.push({ label: 'What pays', text: listing.pays });
    if (listing.eligibility) blocks.push({ label: "Who's eligible", text: listing.eligibility });
    if (listing.payout) blocks.push({ label: 'How they pay', text: listing.payout });
    if (listing.rules) blocks.push({ label: 'Rules', text: listing.rules });
    return blocks;
  }

  function rulesText(listing) {
    return rulesBlocks(listing)
      .map(function (block) {
        return block.label + ': ' + block.text;
      })
      .join('\n\n');
  }

  function renderRules(listing) {
    var blocks = rulesBlocks(listing);
    if (!blocks.length) return '<p class="bb-empty">No bounty rules written yet.</p>';
    return blocks
      .map(function (block) {
        return (
          '<div class="bb-rule"><p class="bb-eyebrow">' +
          esc(block.label) +
          '</p><p class="bb-rules">' +
          esc(block.text) +
          '</p></div>'
        );
      })
      .join('');
  }

  function toFeedEntry(listing) {
    return {
      id: listing.id,
      kind: listing.kind,
      name: listing.name,
      repo: listing.repo || null,
      itemUrl: listing.itemUrl || null,
      amount: Number.isFinite(listing.amount) ? listing.amount : null,
      currency: listing.currency || null,
      rules: rulesText(listing) || null,
      payout: listing.payout || null,
      createdAt: listing.createdAt || null,
      pays: listing.pays || null,
      eligibility: listing.eligibility || null,
      blurb: listing.blurb || null,
      outcomes: listing.outcomes || [],
    };
  }

  function toFeed(listings, extra) {
    return Object.assign(
      {
        name: 'dasha bounties',
        note: 'Declared bounties, not escrow. Static snapshot; the HTML page may also merge live GitHub issues and this-device saves.',
        url: 'https://www.getdasha.com/bounties/',
        listings: (listings || []).map(toFeedEntry),
      },
      extra || {},
    );
  }

  function encodeShare(listing) {
    var json = JSON.stringify(listing);
    if (typeof Buffer !== 'undefined') return Buffer.from(json, 'utf8').toString('base64url');
    var b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeShare(token) {
    try {
      var s = String(token || '');
      var json;
      if (typeof Buffer !== 'undefined') {
        json = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      } else {
        s = s.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        json = decodeURIComponent(escape(atob(s)));
      }
      return normalizeListing(JSON.parse(json), { origin: 'share' });
    } catch (e) {
      return null;
    }
  }

  function loadLocal(storage) {
    var store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return [];
    try {
      var rows = JSON.parse(store.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(rows)) return [];
      return rows
        .map(function (raw) {
          return normalizeListing(raw, { origin: 'local' });
        })
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function saveLocal(listings, storage) {
    var store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return false;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(listings || []));
      return true;
    } catch (e) {
      return false;
    }
  }

  function listingPayload(listing) {
    var out = {
      kind: listing.kind,
      name: listing.name,
      repo: listing.repo || undefined,
      itemUrl: listing.itemUrl || undefined,
      url: listing.url || undefined,
      blurb: listing.blurb || undefined,
      amount: Number.isFinite(listing.amount) ? listing.amount : undefined,
      currency: listing.currency || undefined,
      pool: listing.kind === 'project' ? listing.pool || undefined : undefined,
      pays: listing.pays || undefined,
      eligibility: listing.eligibility || undefined,
      payout: listing.payout || undefined,
      rules: listing.rules || undefined,
      createdAt: listing.createdAt || undefined,
      outcomes: listing.outcomes && listing.outcomes.length ? listing.outcomes : undefined,
    };
    Object.keys(out).forEach(function (key) {
      if (out[key] === undefined) delete out[key];
    });
    return out;
  }

  function buildIssueUrl(fields) {
    var kindHint = String((fields && fields.kind) || '').toLowerCase();
    var item = parseGithubItem(fields && (fields.itemUrl || fields.item));
    if (kindHint === 'item' && !item) {
      return { ok: false, error: 'Paste a GitHub issue or PR URL to list an item bounty.' };
    }
    var repo = item ? item.repo : fields && fields.repo ? normalizeRepo(fields.repo) : '';
    var name = String((fields && fields.name) || '').trim();
    if (!name && item) name = repo + '#' + item.number;
    if (!name && repo) name = repo.replace(/^.*\//, '');
    if (!name) {
      return { ok: false, error: 'Give it a name, or paste a GitHub issue/PR URL.' };
    }
    if (!item && fields && fields.repo && String(fields.repo).trim() && !repo) {
      return { ok: false, error: 'Repo must look like owner/name, or be left blank.' };
    }
    var amountRaw = fields && fields.amount;
    var amount = null;
    var currency = String((fields && fields.currency) || '').trim() || null;
    var pool = null;
    if (amountRaw !== '' && amountRaw != null) {
      amount = Number(amountRaw);
      if (!Number.isFinite(amount)) {
        return { ok: false, error: 'Amount must be a number, or left blank.' };
      }
      if (!item) pool = { amount: amount, currency: currency || 'USD' };
      if (!currency) currency = 'USD';
    }
    var listing = normalizeListing(
      {
        kind: item ? 'item' : 'project',
        name: name,
        repo: repo,
        itemUrl: item && item.url,
        url: fields && fields.url,
        blurb: fields && fields.blurb,
        amount: amount,
        currency: currency,
        pool: pool,
        pays: fields && fields.pays,
        eligibility: fields && fields.eligibility,
        payout: fields && fields.payout,
        rules: fields && fields.rules,
        createdAt: fields && fields.createdAt,
        outcomes: fields && fields.outcomes,
      },
      { origin: 'form' },
    );
    if (!listing) return { ok: false, error: 'Could not build a listing from that form.' };
    var params = new URLSearchParams();
    params.set('template', 'bounty-project.yml');
    params.set('title', TITLE_PREFIX + ' ' + name);
    params.set('labels', ISSUE_LABEL);
    params.set('listing', JSON.stringify(listingPayload(listing), null, 2));
    return {
      ok: true,
      url: 'https://github.com/' + LISTING_REPO + '/issues/new?' + params.toString(),
      listing: listing,
    };
  }

  function headerDate(headers) {
    if (!headers) return null;
    var get = typeof headers.get === 'function' ? headers.get.bind(headers) : null;
    return get ? get('date') : headers.date || null;
  }

  function isRateLimited(res, bodyText) {
    if (!res) return false;
    if (res.status === 429) return true;
    var get = res.headers && typeof res.headers.get === 'function' ? res.headers.get.bind(res.headers) : null;
    var remaining = get ? get('x-ratelimit-remaining') : res.headers && res.headers['x-ratelimit-remaining'];
    if (String(remaining) === '0') return true;
    return res.status === 403 && /rate limit/i.test(bodyText || '');
  }

  async function githubGet(url, ctx) {
    ctx = ctx || {};
    var fetchImpl = ctx.fetchImpl || fetch;
    var res = await fetchImpl(url, {
      headers: { Accept: GH_ACCEPT, 'X-GitHub-Api-Version': GH_VERSION },
    });
    var dated = headerDate(res.headers);
    if (dated) ctx.asOf = dated;
    var text = await res.text();
    if (!res.ok) {
      var err = new Error(isRateLimited(res, text) ? 'rate-limited' : 'unavailable');
      err.code = err.message;
      err.status = res.status;
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      var parseErr = new Error('unavailable');
      parseErr.code = 'unavailable';
      throw parseErr;
    }
  }

  function avatarHtml(login) {
    if (!login) return '';
    return (
      '<img class="bb-avatar" src="https://github.com/' +
      esc(login) +
      '.png?size=80" alt="" width="36" height="36" loading="lazy"/>'
    );
  }

  function proofLabel(url) {
    var proof = parseGithubProof(url);
    if (!proof) return url;
    var bit = (proof.type === 'pull' ? 'PR' : 'issue') + ' #' + proof.number;
    if (/#issuecomment-/i.test(url)) return bit + ' comment';
    if (/#pullrequestreview-|#discussion_r/i.test(url)) return bit + ' review';
    return bit;
  }

  function collectOutcomes(listings) {
    var rows = [];
    (listings || []).forEach(function (listing) {
      (listing.outcomes || []).forEach(function (row) {
        if (!row || !parseGithubProof(row.url)) return;
        rows.push(
          Object.assign({}, row, {
            listingId: listing.id,
            listingName: listing.name,
            repo: listing.repo,
          }),
        );
      });
    });
    return rows;
  }

  function renderOutcomes(rows) {
    var list = (rows || []).filter(function (row) {
      return row && parseGithubProof(row.url);
    });
    if (!list.length) {
      return '<p class="bb-empty" role="status">' + EMPTY_OUTCOMES + '</p>';
    }
    var body = list
      .map(function (row) {
        var who = row.login
          ? avatarHtml(row.login) +
            '<div><a class="bb-name" href="https://github.com/' +
            esc(row.login) +
            '" target="_blank" rel="noopener noreferrer">@' +
            esc(row.login) +
            '</a>' +
            (row.listingName ? '<span class="bb-sub">' + esc(row.listingName) + '</span>' : '') +
            '</div>'
          : '<span class="bb-sub">' + esc(row.listingName || 'declared') + '</span>';
        return (
          '<tr><td><div class="bb-who">' +
          who +
          '</div></td><td><a class="bb-proof" href="' +
          esc(row.url) +
          '" target="_blank" rel="noopener noreferrer">' +
          esc(proofLabel(row.url)) +
          '</a></td><td>' +
          esc(row.note || '—') +
          '</td></tr>'
        );
      })
      .join('');
    return (
      '<div class="bb-table-wrap"><table class="bb-table">' +
      '<thead><tr><th scope="col">Contributor</th><th scope="col">Proof</th><th scope="col">Note</th></tr></thead>' +
      '<tbody>' +
      body +
      '</tbody></table></div>'
    );
  }

  function renderGlobalBoard(state) {
    var rows = [];
    if (Array.isArray(state)) rows = state;
    else if (state && Array.isArray(state.outcomes)) rows = state.outcomes;
    if (state && state.boardError && !rows.length) {
      return (
        '<p class="bb-empty" role="status">' +
        esc(state.boardError) +
        ' Listings still show. No ranks are invented.</p>'
      );
    }
    return renderOutcomes(rows);
  }

  function originLabel(listing) {
    if (listing.origin === 'seed') return 'seed listing';
    if (listing.origin === 'issue') return 'live issue';
    if (listing.origin === 'local') return 'on this device';
    if (listing.origin === 'share') return 'shared link';
    if (listing.origin === 'demigod') return DEMIGOD_BOARD_NOTE;
    return listing.origin || '';
  }

  function originNoteHtml(listing) {
    if (!listing || listing.origin !== 'demigod') return '';
    return (
      '<span class="bb-sub">' +
      esc(DEMIGOD_BOARD_NOTE) +
      ' — declared, not escrow. Not a Dasha mint or Studio listing.</span>'
    );
  }

  function renderHunt(listings) {
    var items = (listings || []).filter(function (row) {
      return row.kind === 'item';
    });
    if (!items.length) {
      return '<p class="bb-empty" role="status">No open item bounties yet. List a GitHub issue or PR — it saves on this device immediately.</p>';
    }
    var body = items
      .map(function (listing) {
        var amt = formatAmount(listing);
        var href = '#bounty/' + encodeURIComponent(listing.id);
        return (
          '<tr>' +
          '<td class="bb-hunt-amt">' +
          esc(amt) +
          '</td>' +
          '<td><a class="bb-name" href="' +
          href +
          '">' +
          esc(listing.name) +
          '</a>' +
          (listing.blurb ? '<span class="bb-sub">' + esc(listing.blurb) + '</span>' : '') +
          originNoteHtml(listing) +
          '</td>' +
          '<td class="bb-mono">' +
          esc(listing.repo || '') +
          (listing.item ? ' #' + listing.item.number : '') +
          '</td>' +
          '<td><a class="bb-proof" href="' +
          esc(listing.itemUrl) +
          '" target="_blank" rel="noopener noreferrer">Open on GitHub</a></td>' +
          '</tr>'
        );
      })
      .join('');
    return (
      '<div class="bb-table-wrap"><table class="bb-table bb-hunt">' +
      '<thead><tr><th scope="col">Bounty</th><th scope="col">Issue / PR</th><th scope="col">Repo</th><th scope="col">Proof</th></tr></thead>' +
      '<tbody>' +
      body +
      '</tbody></table></div>'
    );
  }

  function renderProjectCard(listing) {
    var originClass = listing.origin === 'issue' ? 'live' : '';
    var amt = formatAmount(listing);
    var kindLabel = listing.kind === 'item' ? 'Issue bounty' : 'Project';
    return (
      '<a class="bb-card" data-kind="' +
      esc(listing.kind) +
      '" data-repo="' +
      esc(listing.repo || listing.id) +
      '" data-origin="' +
      esc(listing.origin) +
      '" href="#bounty/' +
      encodeURIComponent(listing.id) +
      '">' +
      '<div class="bb-proj-top"><p class="bb-eyebrow" style="margin:0">' +
      esc(kindLabel) +
      '</p><span class="bb-origin ' +
      originClass +
      '">' +
      esc(originLabel(listing)) +
      '</span></div>' +
      '<h3>' +
      esc(listing.name) +
      '</h3>' +
      (listing.repo ? '<p class="bb-meta" style="margin-top:4px">' + esc(listing.repo) + (listing.item ? ' #' + listing.item.number : '') + '</p>' : '') +
      (listing.itemUrl
        ? '<p class="bb-meta"><span class="bb-proof">GitHub item</span></p>'
        : '') +
      (listing.blurb ? '<p class="bb-blurb">' + esc(listing.blurb) + '</p>' : '') +
      originNoteHtml(listing) +
      (amt ? '<p class="bb-pool-amount">' + esc(amt) + '</p>' : '<p class="bb-meta">No pool declared</p>') +
      renderRules(listing) +
      '</a>'
    );
  }

  function renderProjects(listings) {
    var projects = (listings || []).filter(function (row) {
      return row.kind !== 'item';
    });
    if (!projects.length) {
      return '<p class="bb-empty" role="status">No project listings yet. A monthly pool is optional — you can list a single issue instead.</p>';
    }
    return projects.map(renderProjectCard).join('');
  }

  function itemsForRepo(listings, repo) {
    if (!repo) return [];
    var key = String(repo).toLowerCase();
    return (listings || []).filter(function (row) {
      return row.kind === 'item' && row.repo && row.repo.toLowerCase() === key;
    });
  }

  function renderProjectPage(listing, allListings) {
    if (!listing) return '<p class="bb-empty" role="status">No listing for that id.</p>';
    var originClass = listing.origin === 'issue' ? 'live' : '';
    var issueBit = listing.issueUrl
      ? ' · <a href="' + esc(listing.issueUrl) + '" target="_blank" rel="noopener noreferrer">listing issue</a>'
      : '';
    var demigodBit =
      listing.origin === 'demigod'
        ? ' · <a href="https://trydemigod.com/bounties" target="_blank" rel="noopener noreferrer">' +
          esc(DEMIGOD_BOARD_NOTE) +
          '</a>'
        : '';
    var itemLink = listing.itemUrl || '';
    var link =
      itemLink ||
      (listing.url && /^https?:\/\//i.test(listing.url) ? listing.url : listing.repo ? 'https://github.com/' + listing.repo : '');
    var amt = formatAmount(listing);
    var related = listing.kind === 'project' ? itemsForRepo(allListings, listing.repo) : [];
    var relatedHtml = related.length
      ? '<p class="bb-eyebrow">Open item bounties on this repo</p>' + renderHunt(related)
      : '';
    return (
      '<a class="bb-back" href="' +
      (listing.kind === 'item' ? '#items' : '#projects') +
      '">← ' +
      (listing.kind === 'item' ? 'Open bounties' : 'Projects') +
      '</a>' +
      '<p class="bb-stamp"><span class="bb-pill">' +
      esc(listing.createdAt ? 'listed ' + listing.createdAt : 'owner-written listing') +
      '</span> <span class="bb-origin ' +
      originClass +
      '">' +
      esc(originLabel(listing)) +
      '</span></p>' +
      '<p class="bb-eyebrow">' +
      esc(listing.kind === 'item' ? 'Issue bounty' : 'Project') +
      '</p>' +
      '<h2 style="margin:0 0 8px;font-size:clamp(36px,5vw,68px);letter-spacing:-.06em;text-transform:uppercase;font-weight:800">' +
      esc(listing.name) +
      '</h2>' +
      '<p class="bb-meta">' +
      (link
        ? '<a href="' +
          esc(link) +
          '" target="_blank" rel="noopener noreferrer">' +
          esc(listing.itemUrl ? proofLabel(listing.itemUrl) : listing.repo || listing.url || listing.name) +
          '</a>'
        : esc(listing.repo || '')) +
      issueBit +
      demigodBit +
      '</p>' +
      (listing.blurb ? '<p class="bb-blurb">' + esc(listing.blurb) + '</p>' : '') +
      (listing.origin === 'demigod' ? '<p class="bb-meta">' + originNoteHtml(listing) + '</p>' : '') +
      '<div class="bb-panel">' +
      '<p class="bb-eyebrow">' +
      esc(listing.kind === 'item' ? 'Bounty' : 'Pool') +
      '</p>' +
      '<p class="bb-pool-amount">' +
      esc(amt || 'No pool declared') +
      '</p>' +
      '<p>Whatever the owner wrote. This board does not hold funds or pay anyone.</p>' +
      (itemLink
        ? '<p><a class="bb-cta" href="' +
          esc(itemLink) +
          '" target="_blank" rel="noopener noreferrer">Open on GitHub</a></p>'
        : '') +
      '</div>' +
      renderRules(listing) +
      relatedHtml +
      '<p class="bb-eyebrow" style="margin-top:28px">Accepted outcomes</p>' +
      renderOutcomes(listing.outcomes)
    );
  }

  function $(id) {
    if (typeof document === 'undefined' || !document || typeof document.getElementById !== 'function') return null;
    return document.getElementById(id);
  }

  function readForm() {
    var kindEl = document.querySelector('#bb-form input[name="kind"]:checked');
    return {
      kind: kindEl ? kindEl.value : 'item',
      name: $('bb-name') && $('bb-name').value,
      repo: $('bb-repo') && $('bb-repo').value,
      itemUrl: $('bb-item') && $('bb-item').value,
      amount: $('bb-amount') && $('bb-amount').value,
      currency: $('bb-currency') && $('bb-currency').value,
      blurb: $('bb-blurb') && $('bb-blurb').value,
      pays: $('bb-pays') && $('bb-pays').value,
      eligibility: $('bb-eligibility') && $('bb-eligibility').value,
      payout: $('bb-payout') && $('bb-payout').value,
      rules: $('bb-rules') && $('bb-rules').value,
      url: $('bb-url') && $('bb-url').value,
    };
  }

  function syncKindFields() {
    var kindEl = document.querySelector('#bb-form input[name="kind"]:checked');
    var kind = kindEl ? kindEl.value : 'item';
    document.querySelectorAll('[data-for-kind]').forEach(function (el) {
      var want = el.getAttribute('data-for-kind');
      el.hidden = want !== 'any' && want !== kind;
    });
    var amountLabel = $('bb-amount-label');
    if (amountLabel) amountLabel.textContent = kind === 'item' ? 'Bounty amount' : 'Optional pool';
  }

  var formBound = false;
  function bindForm() {
    var form = $('bb-form');
    if (!form || formBound) return;
    formBound = true;
    var err = $('bb-form-error');
    var preview = $('bb-issue-preview');
    var shareBtn = $('bb-share');
    var localBtn = $('bb-save-local');
    var shareOut = $('bb-share-out');

    function built() {
      return buildIssueUrl(readForm());
    }

    function showErr(msg) {
      err.hidden = false;
      err.textContent = msg;
    }

    function clearErr() {
      err.hidden = true;
      err.textContent = '';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var result = built();
      if (!result.ok) return showErr(result.error);
      clearErr();
      var opened = window.open(result.url, '_blank', 'noopener,noreferrer');
      if (!opened && preview) {
        preview.hidden = false;
        preview.href = result.url;
        preview.textContent = 'Popup blocked — open the listing issue here';
        preview.focus();
      }
    });

    form.addEventListener('input', function () {
      syncKindFields();
      var result = built();
      if (preview) {
        if (result.ok) {
          preview.hidden = false;
          preview.href = result.url;
          preview.textContent = 'Preview GitHub issue';
        } else {
          preview.hidden = true;
        }
      }
    });
    form.addEventListener('change', syncKindFields);
    syncKindFields();

    if (localBtn) {
      localBtn.addEventListener('click', function () {
        var result = built();
        if (!result.ok) return showErr(result.error);
        var current = loadLocal();
        var saved = Object.assign({}, result.listing, {
          origin: 'local',
          createdAt: result.listing.createdAt || new Date().toISOString(),
        });
        var next = mergeListings(current, [saved]);
        if (!saveLocal(next)) return showErr('Could not write localStorage in this browser.');
        clearErr();
        live.listings = mergeListings(live.seed, live.demigod, live.issues, live.shared, next);
        paintListings();
        localBtn.textContent = 'Saved on this device';
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        var result = built();
        if (!result.ok) return showErr(result.error);
        var url = location.origin + location.pathname + '#l=' + encodeShare(listingPayload(result.listing));
        if (shareOut) {
          shareOut.hidden = false;
          shareOut.value = url;
          shareOut.focus();
          shareOut.select();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).catch(function () {});
        }
        clearErr();
      });
    }
  }

  var rotatorBound = false;
  function bindRotator() {
    var el = $('bb-rotator');
    if (!el || rotatorBound) return;
    rotatorBound = true;
    var phrases = String(el.getAttribute('data-phrases') || '')
      .split('|')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    if (phrases.length < 2) return;
    var reduce = false;
    try {
      reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    if (reduce) return;
    var i = 0;
    setInterval(function () {
      i = (i + 1) % phrases.length;
      el.textContent = phrases[i];
    }, 2400);
  }

  var live = { listings: [], seed: [], issues: [], shared: [], demigod: [] };
  var routingBound = false;

  function parseHash() {
    var raw = '';
    try {
      raw = String(location.hash || '').replace(/^#/, '');
    } catch (e) {}
    if (raw.indexOf('l=') === 0) return { view: 'share', token: raw.slice(2) };
    if (raw.indexOf('bounty/') === 0) return { view: 'detail', id: decodeURIComponent(raw.slice('bounty/'.length)) };
    if (raw.indexOf('project/') === 0) return { view: 'detail', id: decodeURIComponent(raw.slice('project/'.length)) };
    if (raw.indexOf('item/') === 0) return { view: 'detail', id: decodeURIComponent(raw.slice('item/'.length)) };
    return { view: 'home', id: raw };
  }

  function findListing(id) {
    var rows = live.listings || [];
    var exact = rows.filter(function (row) {
      return row.id === id;
    })[0];
    if (exact) return exact;
    var lower = String(id || '').toLowerCase();
    return rows.filter(function (row) {
      return row.kind === 'project' && row.repo && row.repo.toLowerCase() === lower;
    })[0];
  }

  function paintListings() {
    var huntEl = $('bb-hunt');
    if (huntEl) huntEl.innerHTML = renderHunt(live.listings);
    var projectsEl = $('bb-projects');
    if (projectsEl) projectsEl.innerHTML = renderProjects(live.listings);
    var boardEl = $('bb-global');
    if (boardEl) boardEl.innerHTML = renderOutcomes(collectOutcomes(live.listings));
  }

  function paintView() {
    var home = $('bb-home');
    var detail = $('bb-project-page');
    if (!home || !detail) return;
    var route = parseHash();
    if (route.view === 'detail') {
      home.hidden = true;
      detail.hidden = false;
      var listing = findListing(route.id);
      detail.innerHTML = renderProjectPage(listing, live.listings);
      try {
        window.scrollTo(0, 0);
      } catch (e) {}
      return;
    }
    home.hidden = false;
    detail.hidden = true;
    if (route.id && document.getElementById(route.id)) {
      try {
        document.getElementById(route.id).scrollIntoView({ block: 'start' });
      } catch (e) {}
    }
  }

  function bindRouting() {
    if (routingBound) return;
    routingBound = true;
    try {
      window.addEventListener('hashchange', paintView);
    } catch (e) {}
  }

  async function boot(options) {
    options = options || {};
    var ctx = { fetchImpl: options.fetchImpl || fetch, storage: options.storage };
    bindForm();
    bindRotator();
    bindRouting();

    var seedListings = [];
    var issueListings = [];
    var demigodListings = [];
    var issuesError = null;
    var fetchImpl = ctx.fetchImpl || fetch;
    try {
      var seedUrls = (options && options.seedUrl)
        ? [options.seedUrl]
        : ['./feed.json', '../bounties.json', './listings.json', '../config/bounties.seed.json'];
      var seedRes = null;
      for (var s = 0; s < seedUrls.length; s++) {
        try {
          seedRes = await fetchImpl(seedUrls[s], { headers: { Accept: 'application/json' } });
          if (seedRes && seedRes.ok) break;
        } catch (e) {
          seedRes = null;
        }
      }
      if (!seedRes || !seedRes.ok) throw new Error('unavailable');
      seedListings = listingsFromSeed(await seedRes.json());
    } catch (e) {}
    try {
      var extraUrls = Array.isArray(options.extraSeedUrls) ? options.extraSeedUrls : EXTRA_SEED_URLS;
      demigodListings = await listingsFromExtraUrls(fetchImpl, extraUrls, 'demigod');
    } catch (e) {
      demigodListings = [];
    }
    try {
      issueListings = listingsFromIssues(
        await githubGet('https://api.github.com/repos/' + LISTING_REPO + '/issues?state=open&per_page=100', ctx),
      );
    } catch (e) {
      issuesError = e && e.code === 'rate-limited' ? 'rate-limited' : 'unavailable';
    }

    var shared = [];
    var route = parseHash();
    if (route.view === 'share') {
      var decoded = decodeShare(route.token);
      if (decoded) shared = [decoded];
    }

    var local = loadLocal(ctx.storage);
    live.seed = seedListings;
    live.issues = issueListings;
    live.shared = shared;
    live.demigod = demigodListings;
    live.listings = mergeListings(seedListings, demigodListings, issueListings, shared, local);

    var banner = $('bb-banner');
    if (banner) {
      if (issuesError) {
        banner.hidden = false;
        banner.className = 'bb-banner ' + (issuesError === 'rate-limited' ? 'warn' : 'bad');
        banner.innerHTML =
          (issuesError === 'rate-limited'
            ? 'GitHub rate-limited this browser. Public issues paused.'
            : 'Public GitHub listings are unavailable.') +
          ' The static feed and listings saved on this device still show. <a href="/dasha">Desk</a>';
      } else {
        banner.hidden = true;
        banner.textContent = '';
      }
    }

    paintListings();
    var asof = $('bb-asof');
    if (asof) {
      asof.textContent =
        'Outcomes are owner-declared. Every row needs a GitHub PR, issue, or comment URL — no score without a link.';
    }
    paintView();
    return live;
  }

  var api = {
    LISTING_REPO: LISTING_REPO,
    ISSUE_LABEL: ISSUE_LABEL,
    TITLE_PREFIX: TITLE_PREFIX,
    STORAGE_KEY: STORAGE_KEY,
    EXTRA_SEED_URLS: EXTRA_SEED_URLS,
    DEMIGOD_BOARD_NOTE: DEMIGOD_BOARD_NOTE,
    EMPTY_OUTCOMES: EMPTY_OUTCOMES,
    isValidRepo: isValidRepo,
    normalizeRepo: normalizeRepo,
    parseGithubItem: parseGithubItem,
    parseGithubProof: parseGithubProof,
    normalizeListing: normalizeListing,
    normalizeOutcomes: normalizeOutcomes,
    extractJsonObject: extractJsonObject,
    isBountyIssue: isBountyIssue,
    listingFromIssue: listingFromIssue,
    listingsFromIssues: listingsFromIssues,
    listingsFromSeed: listingsFromSeed,
    listingsFromExtraUrls: listingsFromExtraUrls,
    mergeListings: mergeListings,
    formatPool: formatPool,
    formatAmount: formatAmount,
    rulesText: rulesText,
    toFeed: toFeed,
    toFeedEntry: toFeedEntry,
    encodeShare: encodeShare,
    decodeShare: decodeShare,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    listingPayload: listingPayload,
    buildIssueUrl: buildIssueUrl,
    collectOutcomes: collectOutcomes,
    renderOutcomes: renderOutcomes,
    renderGlobalBoard: renderGlobalBoard,
    renderHunt: renderHunt,
    renderProjectCard: renderProjectCard,
    renderProjectPage: renderProjectPage,
    renderProjects: renderProjects,
    renderRules: renderRules,
    boot: boot,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  global.DashaBounties = api;
  if (typeof document !== 'undefined') {
    var start = function () {
      if (document.getElementById('bb-app')) api.boot();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
