'use strict';
/**
 * dasha bounties — anybody lists a project and writes their own rules.
 * Public inbox: GitHub issues. This-device: localStorage. Share: #l= JSON.
 * GitHub contributor counts are optional and best-effort. Nothing here invents numbers.
 */
(function (global) {
  var LISTING_REPO = 'Uuriko/dasha-desk';
  var ISSUE_LABEL = 'bounty-project';
  var TITLE_PREFIX = '[bounty]';
  var STORAGE_KEY = 'dasha-bounties-listings-v1';
  var REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
  var GH_ACCEPT = 'application/vnd.github+json';
  var GH_VERSION = '2022-11-28';

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

  function listingId(listing) {
    if (listing && listing.repo) return listing.repo.toLowerCase();
    return 'name:' + slugify(listing && listing.name);
  }

  function num(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizePool(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(raw, 'amount')) return null;
    var amount = Number(raw.amount);
    if (!Number.isFinite(amount)) return null;
    var currency = String(raw.currency || '').trim();
    return { amount: amount, currency: currency || null };
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

  function normalizeListing(raw, meta) {
    if (!raw || typeof raw !== 'object') return null;
    var repo = normalizeRepo(raw.repo || raw.github || raw.repository || '');
    var name = String(raw.name || raw.project || raw.title || '').trim();
    if (!name && repo) name = repo.replace(/^.*\//, '');
    if (!name) return null;
    var pool = normalizePool(raw.pool);
    var payout = '';
    if (typeof raw.payout === 'string') payout = raw.payout.trim();
    else if (raw.payout && typeof raw.payout === 'object') {
      payout = String(raw.payout.note || raw.payout.url || raw.payout.solana || '').trim();
    }
    var listing = {
      name: name,
      repo: repo,
      url: String(raw.url || '').trim(),
      blurb: String(raw.blurb || '').trim(),
      pool: pool,
      pays: String(raw.pays || '').trim(),
      eligibility: String(raw.eligibility || '').trim(),
      payout: payout,
      rules: String(raw.rules || '').trim(),
      wantScores: raw.wantScores === false ? false : true,
      origin: (meta && meta.origin) || 'unknown',
    };
    if (meta) {
      if (meta.issueNumber != null) listing.issueNumber = meta.issueNumber;
      if (meta.issueUrl) listing.issueUrl = meta.issueUrl;
    }
    listing.id = listingId(listing);
    if (!listing.repo) listing.wantScores = false;
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

  function listingsFromSeed(seed) {
    var rows = seed && Array.isArray(seed.listings) ? seed.listings : Array.isArray(seed) ? seed : [];
    var out = [];
    rows.forEach(function (raw) {
      var listing = normalizeListing(raw, { origin: 'seed' });
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

  function formatPool(pool) {
    if (!pool || !Number.isFinite(pool.amount)) return 'undeclared';
    var currency = pool.currency;
    if (!currency) return String(pool.amount) + ' (currency undeclared)';
    if (/^usd$/i.test(currency) || currency === '$') return '$' + String(pool.amount);
    return String(pool.amount) + ' ' + currency;
  }

  function rulesBlocks(listing) {
    var blocks = [];
    if (listing.pays) blocks.push({ label: 'What pays', text: listing.pays });
    if (listing.eligibility) blocks.push({ label: "Who's eligible", text: listing.eligibility });
    if (listing.payout) blocks.push({ label: 'How they pay', text: listing.payout });
    if (listing.rules) blocks.push({ label: 'Rules', text: listing.rules });
    return blocks;
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
      return rows.map(function (raw) {
        return normalizeListing(raw, { origin: 'local' });
      }).filter(Boolean);
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
      name: listing.name,
      repo: listing.repo || undefined,
      url: listing.url || undefined,
      blurb: listing.blurb || undefined,
      pool: listing.pool || undefined,
      pays: listing.pays || undefined,
      eligibility: listing.eligibility || undefined,
      payout: listing.payout || undefined,
      rules: listing.rules || undefined,
      wantScores: listing.wantScores !== false,
    };
    Object.keys(out).forEach(function (key) {
      if (out[key] === undefined) delete out[key];
    });
    return out;
  }

  function buildIssueUrl(fields) {
    var repo = fields && fields.repo ? normalizeRepo(fields.repo) : '';
    var name = String((fields && fields.name) || '').trim() || repo;
    if (!name) {
      return { ok: false, error: 'Give the project a name — GitHub repo is optional.' };
    }
    if (fields && fields.repo && String(fields.repo).trim() && !repo) {
      return { ok: false, error: 'Repo must look like owner/name, or be left blank.' };
    }
    var amountRaw = fields && fields.amount;
    var pool = null;
    if (amountRaw !== '' && amountRaw != null) {
      var amount = Number(amountRaw);
      if (!Number.isFinite(amount)) {
        return { ok: false, error: 'Pool amount must be a number, or left blank.' };
      }
      pool = { amount: amount, currency: String((fields && fields.currency) || '').trim() || 'USD' };
    }
    var listing = normalizeListing(
      {
        name: name,
        repo: repo,
        url: fields && fields.url,
        blurb: fields && fields.blurb,
        pool: pool,
        pays: fields && fields.pays,
        eligibility: fields && fields.eligibility,
        payout: fields && fields.payout,
        rules: fields && fields.rules,
        wantScores: fields && fields.wantScores,
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

  async function fetchContributors(repo, ctx) {
    if (!isValidRepo(repo)) {
      return { contributors: null, error: 'unavailable' };
    }
    try {
      var encoded = repo
        .split('/')
        .map(function (part) {
          return encodeURIComponent(part);
        })
        .join('/');
      var rows = await githubGet(
        'https://api.github.com/repos/' + encoded + '/contributors?per_page=20',
        ctx,
      );
      var contributors = (Array.isArray(rows) ? rows : [])
        .filter(function (row) {
          var login = row && row.login;
          return login && row.type !== 'Bot' && !/\[bot\]$/i.test(login);
        })
        .map(function (row, i) {
          return {
            login: row.login,
            htmlUrl: 'https://github.com/' + row.login,
            contributions: Number.isFinite(Number(row.contributions)) ? Number(row.contributions) : null,
            rank: i + 1,
          };
        });
      return { contributors: contributors, error: null };
    } catch (e) {
      return {
        contributors: null,
        error: e && e.code === 'rate-limited' ? 'rate-limited' : 'unavailable',
      };
    }
  }

  function aggregateGlobal(projectResults) {
    var byLogin = {};
    (projectResults || []).forEach(function (project) {
      if (!project || !project.contributors) return;
      project.contributors.forEach(function (row) {
        if (row.contributions == null) return;
        if (!byLogin[row.login]) {
          byLogin[row.login] = {
            login: row.login,
            htmlUrl: row.htmlUrl,
            contributions: 0,
            projects: [],
          };
        }
        byLogin[row.login].contributions += row.contributions;
        if (byLogin[row.login].projects.indexOf(project.repo) === -1) {
          byLogin[row.login].projects.push(project.repo);
        }
      });
    });
    return Object.keys(byLogin)
      .map(function (login) {
        return byLogin[login];
      })
      .sort(function (a, b) {
        if (b.contributions !== a.contributions) return b.contributions - a.contributions;
        return String(a.login).localeCompare(String(b.login));
      })
      .map(function (row, i) {
        return Object.assign({}, row, { rank: i + 1 });
      });
  }

  function avatarHtml(login) {
    return (
      '<img class="bb-avatar" src="https://github.com/' +
      esc(login) +
      '.png?size=80" alt="" width="36" height="36" loading="lazy"/>'
    );
  }

  function renderGlobalBoard(state) {
    if (state && state.boardError) {
      return (
        '<p class="bb-empty" role="status">' +
        esc(state.boardError) +
        ' Projects still list. No ranks are invented.</p>'
      );
    }
    var rows = ((state && state.global) || []).slice(0, 20);
    if (!rows.length) {
      return '<p class="bb-empty" role="status">No public GitHub contributor data loaded. Projects still list — nothing here is invented.</p>';
    }
    var body = rows
      .map(function (row) {
        return (
          '<tr><td class="bb-rank">#' +
          esc(row.rank) +
          '</td><td><div class="bb-who">' +
          avatarHtml(row.login) +
          '<div><a class="bb-name" href="' +
          esc(row.htmlUrl) +
          '" target="_blank" rel="noopener noreferrer">@' +
          esc(row.login) +
          '</a><span class="bb-sub">' +
          esc((row.projects || []).join(', ')) +
          '</span></div></div></td><td>' +
          (row.contributions == null ? '—' : esc(row.contributions)) +
          '</td></tr>'
        );
      })
      .join('');
    return (
      '<div class="bb-table-wrap"><table class="bb-table">' +
      '<thead><tr><th scope="col">Rank</th><th scope="col">Contributor</th><th scope="col">GitHub contributions</th></tr></thead>' +
      '<tbody>' +
      body +
      '</tbody></table></div>'
    );
  }

  function originLabel(listing) {
    if (listing.origin === 'seed') return 'seed listing';
    if (listing.origin === 'issue') return 'live issue';
    if (listing.origin === 'local') return 'on this device';
    if (listing.origin === 'share') return 'shared link';
    return listing.origin || '';
  }

  function renderProjectCard(listing) {
    var originClass = listing.origin === 'issue' ? 'live' : '';
    return (
      '<a class="bb-card" data-repo="' +
      esc(listing.repo || listing.id) +
      '" data-origin="' +
      esc(listing.origin) +
      '" href="#project/' +
      encodeURIComponent(listing.id) +
      '">' +
      '<div class="bb-proj-top"><p class="bb-eyebrow" style="margin:0">Bounty</p><span class="bb-origin ' +
      originClass +
      '">' +
      esc(originLabel(listing)) +
      '</span></div>' +
      '<h3>' +
      esc(listing.name) +
      '</h3>' +
      (listing.repo ? '<p class="bb-meta" style="margin-top:4px">' + esc(listing.repo) + '</p>' : '') +
      (listing.blurb ? '<p class="bb-blurb">' + esc(listing.blurb) + '</p>' : '') +
      '<p class="bb-pool-amount">' +
      esc(formatPool(listing.pool)) +
      '</p>' +
      renderRules(listing) +
      '</a>'
    );
  }

  function renderContributorTable(listing, activity) {
    if (!listing.repo || listing.wantScores === false) return '';
    if (activity && activity.error) {
      return (
        '<p class="bb-empty" role="status">GitHub contributors unavailable (' +
        esc(activity.error) +
        '). Bounty copy still shown — no fake leaderboard.</p>'
      );
    }
    if (!activity || !activity.contributors) {
      return '<p class="bb-empty" role="status">Contributor list not loaded.</p>';
    }
    if (!activity.contributors.length) {
      return '<p class="bb-empty" role="status">No public GitHub contributors returned for this repo.</p>';
    }
    return (
      '<p class="bb-eyebrow">Public GitHub contributors</p>' +
      '<p class="bb-meta">Best-effort from GitHub’s contributor API. These are not payout ranks.</p>' +
      '<div class="bb-table-wrap"><table class="bb-table"><thead><tr><th scope="col">Rank</th><th scope="col">Contributor</th><th scope="col">GitHub contributions</th></tr></thead><tbody>' +
      activity.contributors
        .map(function (row) {
          return (
            '<tr><td class="bb-rank">#' +
            esc(row.rank) +
            '</td><td><div class="bb-who">' +
            avatarHtml(row.login) +
            '<a class="bb-name" href="' +
            esc(row.htmlUrl) +
            '" target="_blank" rel="noopener noreferrer">@' +
            esc(row.login) +
            '</a></div></td><td>' +
            (row.contributions == null ? '—' : esc(row.contributions)) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>'
    );
  }

  function renderProjectPage(listing, activity, meta) {
    if (!listing) return '<p class="bb-empty" role="status">No listing for that id.</p>';
    var originClass = listing.origin === 'issue' ? 'live' : '';
    var stamp = meta && meta.asOf;
    var issueBit = listing.issueUrl
      ? ' · <a href="' + esc(listing.issueUrl) + '" target="_blank" rel="noopener noreferrer">listing issue</a>'
      : '';
    var link = listing.url && /^https?:\/\//i.test(listing.url) ? listing.url : listing.repo ? 'https://github.com/' + listing.repo : '';
    return (
      '<a class="bb-back" href="#projects">← Projects</a>' +
      '<p class="bb-stamp"><span class="bb-pill">' +
      esc(stamp ? 'as of ' + stamp + ' from GitHub' : 'owner-written listing') +
      '</span> <span class="bb-origin ' +
      originClass +
      '">' +
      esc(originLabel(listing)) +
      '</span></p>' +
      '<p class="bb-eyebrow">Bounty</p>' +
      '<h2 style="margin:0 0 8px;font-size:clamp(36px,5vw,68px);letter-spacing:-.06em;text-transform:uppercase;font-weight:800">' +
      esc(listing.name) +
      '</h2>' +
      '<p class="bb-meta">' +
      (link
        ? '<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + esc(listing.repo || listing.url || listing.name) + '</a>'
        : esc(listing.repo || '')) +
      issueBit +
      '</p>' +
      (listing.blurb ? '<p class="bb-blurb">' + esc(listing.blurb) + '</p>' : '') +
      '<div class="bb-panel">' +
      '<p class="bb-eyebrow">Pool</p>' +
      '<p class="bb-pool-amount">' +
      esc(formatPool(listing.pool)) +
      '</p>' +
      '<p>Whatever the owner wrote. This board does not hold funds or pay anyone.</p>' +
      '</div>' +
      renderRules(listing) +
      renderContributorTable(listing, activity)
    );
  }

  function renderProjects(listings) {
    if (!listings || !listings.length) {
      return '<p class="bb-empty" role="status">No listings yet. Use the form — it saves on this device immediately.</p>';
    }
    return listings.map(renderProjectCard).join('');
  }

  function $(id) {
    return document.getElementById(id);
  }

  function readForm() {
    var scoresEl = $('bb-want-scores');
    return {
      name: $('bb-name') && $('bb-name').value,
      repo: $('bb-repo') && $('bb-repo').value,
      amount: $('bb-amount') && $('bb-amount').value,
      currency: $('bb-currency') && $('bb-currency').value,
      blurb: $('bb-blurb') && $('bb-blurb').value,
      pays: $('bb-pays') && $('bb-pays').value,
      eligibility: $('bb-eligibility') && $('bb-eligibility').value,
      payout: $('bb-payout') && $('bb-payout').value,
      rules: $('bb-rules') && $('bb-rules').value,
      url: $('bb-url') && $('bb-url').value,
      wantScores: scoresEl ? scoresEl.checked : true,
    };
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

    if (localBtn) {
      localBtn.addEventListener('click', function () {
        var result = built();
        if (!result.ok) return showErr(result.error);
        var current = loadLocal();
        var next = mergeListings(current, [Object.assign({}, result.listing, { origin: 'local' })]);
        if (!saveLocal(next)) return showErr('Could not write localStorage in this browser.');
        clearErr();
        live.listings = mergeListings(live.seed, live.issues, live.shared, next);
        var projectsEl = $('bb-projects');
        if (projectsEl) projectsEl.innerHTML = renderProjects(live.listings);
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

  var live = { listings: [], seed: [], issues: [], shared: [], activity: {}, asOf: '', global: [], boardError: null };
  var routingBound = false;

  function parseHash() {
    var raw = '';
    try {
      raw = String(location.hash || '').replace(/^#/, '');
    } catch (e) {}
    if (raw.indexOf('l=') === 0) return { view: 'share', token: raw.slice(2) };
    if (raw.indexOf('project/') === 0) return { view: 'project', id: decodeURIComponent(raw.slice('project/'.length)) };
    return { view: 'home', id: raw };
  }

  function paintView() {
    var home = $('bb-home');
    var detail = $('bb-project-page');
    if (!home || !detail) return;
    var route = parseHash();
    if (route.view === 'project') {
      home.hidden = true;
      detail.hidden = false;
      var listing = (live.listings || []).filter(function (row) {
        return row.id === route.id || (row.repo && row.repo.toLowerCase() === String(route.id || '').toLowerCase());
      })[0];
      detail.innerHTML = renderProjectPage(listing, listing && live.activity[listing.repo], { asOf: live.asOf });
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
    var issuesError = null;
    try {
      var fetchImpl = ctx.fetchImpl || fetch;
      var seedUrls = (options && options.seedUrl)
        ? [options.seedUrl]
        : ['./listings.json', '../config/bounties.seed.json'];
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
    live.listings = mergeListings(seedListings, issueListings, shared, local);

    var banner = $('bb-banner');
    if (banner) {
      if (issuesError) {
        banner.hidden = false;
        banner.className = 'bb-banner ' + (issuesError === 'rate-limited' ? 'warn' : 'bad');
        banner.innerHTML =
          (issuesError === 'rate-limited'
            ? 'GitHub rate-limited this browser. Public issues paused.'
            : 'Public GitHub listings are unavailable.') +
          ' Listings saved on this device still show. <a href="/dasha">Desk</a>';
      } else {
        banner.hidden = true;
        banner.textContent = '';
      }
    }

    var projectsEl = $('bb-projects');
    if (projectsEl) projectsEl.innerHTML = renderProjects(live.listings);

    var activity = {};
    var anyError = null;
    for (var i = 0; i < live.listings.length; i++) {
      var listing = live.listings[i];
      if (!listing.repo || listing.wantScores === false) continue;
      var scored = await fetchContributors(listing.repo, ctx);
      activity[listing.repo] = scored;
      if (scored.error) anyError = scored.error;
    }
    live.activity = activity;
    live.asOf = ctx.asOf || '';
    live.global = aggregateGlobal(
      live.listings
        .filter(function (row) {
          return row.repo && row.wantScores !== false;
        })
        .map(function (row) {
          return Object.assign({ repo: row.repo }, activity[row.repo] || {});
        }),
    );
    live.boardError = anyError && !live.global.length
      ? anyError === 'rate-limited'
        ? 'GitHub rate-limited contributor fetch.'
        : 'GitHub contributor fetch failed.'
      : null;

    var boardEl = $('bb-global');
    if (boardEl) boardEl.innerHTML = renderGlobalBoard({ global: live.global, boardError: live.boardError });
    var asof = $('bb-asof');
    if (asof) {
      asof.textContent = live.asOf
        ? 'GitHub contributors as of ' + live.asOf + (anyError ? ' · ' + anyError : '')
        : 'Contributor counts are optional and only load when a listing links a public repo.';
    }
    paintView();
  }

  var api = {
    LISTING_REPO: LISTING_REPO,
    ISSUE_LABEL: ISSUE_LABEL,
    TITLE_PREFIX: TITLE_PREFIX,
    STORAGE_KEY: STORAGE_KEY,
    isValidRepo: isValidRepo,
    normalizeRepo: normalizeRepo,
    normalizeListing: normalizeListing,
    extractJsonObject: extractJsonObject,
    isBountyIssue: isBountyIssue,
    listingFromIssue: listingFromIssue,
    listingsFromIssues: listingsFromIssues,
    listingsFromSeed: listingsFromSeed,
    mergeListings: mergeListings,
    formatPool: formatPool,
    encodeShare: encodeShare,
    decodeShare: decodeShare,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    buildIssueUrl: buildIssueUrl,
    fetchContributors: fetchContributors,
    aggregateGlobal: aggregateGlobal,
    renderGlobalBoard: renderGlobalBoard,
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
