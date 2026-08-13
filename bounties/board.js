'use strict';
/**
 * dasha bounties — static ranked board.
 * Listings come from a seed file plus open GitHub issues. Scores come from public GitHub
 * activity in the current UTC month. Nothing here holds funds or invents ranks.
 */
(function (global) {
  var LISTING_REPO = 'Uuriko/dasha-desk';
  var ISSUE_LABEL = 'bounty-project';
  var TITLE_PREFIX = '[bounty]';
  var DEFAULT_SCORING = {
    merge: 10,
    issue_close: 4,
    review: 2,
    merge_cap: 5,
    review_cap: 10,
  };
  var REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
  var FIXES_RE = /\b(?:fixes|closes|resolves)\s+#(\d+)/gi;
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
    var fromUrl = s.match(/github\.com\/([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)/i);
    if (fromUrl) s = fromUrl[1];
    s = s.replace(/\.git$/i, '').replace(/^\/+/, '');
    return isValidRepo(s) ? s : '';
  }

  function num(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeScoring(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    return {
      merge: num(src.merge, DEFAULT_SCORING.merge),
      issue_close: num(src.issue_close, DEFAULT_SCORING.issue_close),
      review: num(src.review, DEFAULT_SCORING.review),
      merge_cap: num(src.merge_cap, DEFAULT_SCORING.merge_cap),
      review_cap: num(src.review_cap, DEFAULT_SCORING.review_cap),
    };
  }

  function normalizePool(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(raw, 'amount')) return null;
    var amount = Number(raw.amount);
    if (!Number.isFinite(amount)) return null;
    var currency = String(raw.currency || '').trim();
    var period = String(raw.period || 'monthly').trim() || 'monthly';
    return { amount: amount, currency: currency || null, period: period };
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
    var repo = normalizeRepo(raw.repo);
    if (!repo) return null;
    var payout = raw.payout && typeof raw.payout === 'object' ? raw.payout : {};
    var listing = {
      repo: repo,
      blurb: String(raw.blurb || '').trim(),
      pool: normalizePool(raw.pool),
      payout: {
        solana: String(payout.solana || '').trim(),
        url: String(payout.url || '').trim(),
      },
      scoring: normalizeScoring(raw.scoring),
      period: String((raw.pool && raw.pool.period) || raw.period || 'monthly').trim() || 'monthly',
      origin: (meta && meta.origin) || 'unknown',
    };
    if (meta) {
      if (meta.issueNumber != null) listing.issueNumber = meta.issueNumber;
      if (meta.issueUrl) listing.issueUrl = meta.issueUrl;
      if (meta.htmlUrl) listing.htmlUrl = meta.htmlUrl;
    }
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
      htmlUrl: issue.html_url,
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

  function mergeListings(seedListings, issueListings) {
    var byRepo = {};
    var order = [];
    function put(listing) {
      var key = listing.repo.toLowerCase();
      if (!byRepo[key]) order.push(key);
      byRepo[key] = listing;
    }
    (seedListings || []).forEach(put);
    (issueListings || []).forEach(put);
    return order.map(function (key) {
      return byRepo[key];
    });
  }

  function formatPool(pool) {
    if (!pool || !Number.isFinite(pool.amount)) return 'undeclared';
    var period = pool.period || 'monthly';
    var amount = pool.amount;
    var currency = pool.currency;
    var head;
    if (!currency) head = String(amount) + ' (currency undeclared)';
    else if (/^usd$/i.test(currency) || currency === '$') head = '$' + String(amount);
    else head = String(amount) + ' ' + currency;
    var periodLabel = /^month/i.test(period) ? 'MONTH' : String(period).toUpperCase();
    return head + ' / ' + periodLabel;
  }

  function formatMoney(amount, currency) {
    if (!Number.isFinite(amount)) return 'undeclared';
    var rounded = Math.round(amount * 100) / 100;
    if (!currency) return String(rounded);
    if (/^usd$/i.test(currency) || currency === '$') return '$' + String(rounded);
    return String(rounded) + ' ' + currency;
  }

  function declaredShare(score, total, pool) {
    if (!pool || !Number.isFinite(pool.amount) || !Number.isFinite(score) || !Number.isFinite(total) || total <= 0) {
      return null;
    }
    return pool.amount * (score / total);
  }

  function utcMonthRange(now) {
    var d = now instanceof Date ? now : new Date(now || Date.now());
    var year = d.getUTCFullYear();
    var month = d.getUTCMonth();
    var start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    var end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
    var yyyy = String(year);
    var mm = String(month + 1);
    if (mm.length < 2) mm = '0' + mm;
    return {
      start: start,
      end: end,
      startIso: start.toISOString(),
      label: yyyy + '-' + mm + ' UTC',
      searchRange: yyyy + '-' + mm + '-01..' + yyyy + '-' + mm + '-' + String(new Date(Date.UTC(year, month + 1, 0)).getUTCDate()).padStart(2, '0'),
    };
  }

  function inRange(iso, range) {
    if (!iso) return false;
    var t = Date.parse(iso);
    return Number.isFinite(t) && t >= range.start.getTime() && t < range.end.getTime();
  }

  function scoreEvents(events, scoring) {
    var weights = normalizeScoring(scoring);
    var merges = Math.max(0, num(events && events.merges, 0));
    var issueCloses = Math.max(0, num(events && events.issue_closes, 0));
    var reviews = Math.max(0, num(events && events.reviews, 0));
    var mergeCounted = Math.min(merges, weights.merge_cap);
    var reviewCounted = Math.min(reviews, weights.review_cap);
    return {
      score: mergeCounted * weights.merge + issueCloses * weights.issue_close + reviewCounted * weights.review,
      merges: merges,
      issue_closes: issueCloses,
      reviews: reviews,
      merge_counted: mergeCounted,
      review_counted: reviewCounted,
      scoring: weights,
    };
  }

  function formulaText(scoring) {
    var w = normalizeScoring(scoring);
    return (
      'score = min(merged PRs, ' +
      w.merge_cap +
      ') × ' +
      w.merge +
      '\n     + issue closes (closer, or Fixes/Closes/Resolves in a merged PR) × ' +
      w.issue_close +
      '\n     + min(submitted reviews, ' +
      w.review_cap +
      ') × ' +
      w.review +
      '\nCurrent UTC month. Weights come from the listing JSON.'
    );
  }

  function buildIssueUrl(fields) {
    var repo = normalizeRepo(fields && fields.repo);
    if (!repo) {
      return { ok: false, error: 'Repo must look like owner/name.' };
    }
    var amountRaw = fields.amount;
    var pool = null;
    if (amountRaw !== '' && amountRaw != null) {
      var amount = Number(amountRaw);
      if (!Number.isFinite(amount)) {
        return { ok: false, error: 'Pool amount must be a number, or left blank for undeclared.' };
      }
      pool = {
        amount: amount,
        currency: String(fields.currency || '').trim() || 'USD',
        period: String(fields.period || 'monthly').trim() || 'monthly',
      };
    }
    var listing = {
      repo: repo,
      blurb: String((fields && fields.blurb) || '').trim(),
      pool: pool,
      payout: {
        solana: String((fields && fields.solana) || '').trim(),
        url: String((fields && fields.url) || '').trim(),
      },
      scoring: normalizeScoring(fields && fields.scoring),
    };
    if (!pool) delete listing.pool;
    var params = new URLSearchParams();
    params.set('template', 'bounty-project.yml');
    params.set('title', TITLE_PREFIX + ' ' + repo);
    params.set('labels', ISSUE_LABEL);
    params.set('listing', JSON.stringify(listing, null, 2));
    return {
      ok: true,
      url: 'https://github.com/' + LISTING_REPO + '/issues/new?' + params.toString(),
      listing: listing,
    };
  }

  function rankContributors(rows) {
    var sorted = (rows || [])
      .filter(function (row) {
        return row && row.login && !/\[bot\]$/i.test(row.login);
      })
      .slice()
      .sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.login).localeCompare(String(b.login));
    });
    var rank = 0;
    var lastScore = null;
    return sorted.map(function (row, i) {
      if (lastScore === null || row.score !== lastScore) {
        rank = i + 1;
        lastScore = row.score;
      }
      return Object.assign({}, row, { rank: rank });
    });
  }

  function aggregateGlobal(projectResults) {
    var byLogin = {};
    (projectResults || []).forEach(function (project) {
      if (!project || !project.contributors) return;
      var total = project.contributors.reduce(function (sum, row) {
        return sum + row.score;
      }, 0);
      project.contributors.forEach(function (row) {
        var login = row.login;
        if (!byLogin[login]) {
          byLogin[login] = {
            login: login,
            htmlUrl: row.htmlUrl,
            score: 0,
            projects: [],
            shares: [],
          };
        }
        byLogin[login].score += row.score;
        byLogin[login].projects.push(project.repo);
        var share = declaredShare(row.score, total, project.pool);
        byLogin[login].shares.push({
          repo: project.repo,
          share: share,
          pool: project.pool,
          score: row.score,
        });
      });
    });
    return rankContributors(
      Object.keys(byLogin).map(function (login) {
        return byLogin[login];
      }),
    );
  }

  function headerDate(headers) {
    if (!headers) return null;
    var get = typeof headers.get === 'function' ? headers.get.bind(headers) : null;
    var raw = get ? get('date') : headers.date;
    return raw || null;
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
      headers: {
        Accept: GH_ACCEPT,
        'X-GitHub-Api-Version': GH_VERSION,
      },
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

  async function githubList(url, ctx, pageCap, olderThanIso) {
    var out = [];
    var next = url;
    var pages = 0;
    var cap = pageCap || 3;
    var cutoff = olderThanIso ? Date.parse(olderThanIso) : NaN;
    while (next && pages < cap) {
      var fetchImpl = ctx.fetchImpl || fetch;
      var res = await fetchImpl(next, {
        headers: {
          Accept: GH_ACCEPT,
          'X-GitHub-Api-Version': GH_VERSION,
        },
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
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        var parseErr = new Error('unavailable');
        parseErr.code = 'unavailable';
        throw parseErr;
      }
      if (!Array.isArray(data)) return data;
      out = out.concat(data);
      pages++;
      var last = data[data.length - 1];
      var stamp = last ? Date.parse(last.updated_at || last.created_at || 0) : NaN;
      if (Number.isFinite(cutoff) && Number.isFinite(stamp) && stamp < cutoff) break;
      var link = res.headers && typeof res.headers.get === 'function' ? res.headers.get('link') : '';
      var match = String(link || '').match(/<([^>]+)>;\s*rel="next"/);
      next = match ? match[1] : null;
    }
    return out;
  }

  function bump(map, login, key) {
    if (!login || /\[bot\]$/i.test(login)) return;
    if (!map[login]) map[login] = { login: login, merges: 0, issue_closes: 0, reviews: 0 };
    map[login][key] += 1;
  }

  function uniqueIssueCredit(credits, issueNumber, login) {
    var key = String(issueNumber);
    if (credits[key] || !login) return;
    credits[key] = login;
  }

  async function fetchRepoActivity(repo, ctx, range) {
    var encoded = repo
      .split('/')
      .map(function (part) {
        return encodeURIComponent(part);
      })
      .join('/');
    var base = 'https://api.github.com/repos/' + encoded;
    var allPulls = await githubList(
      base + '/pulls?state=all&sort=updated&direction=desc&per_page=100',
      ctx,
      2,
      range.startIso,
    );
    if (!Array.isArray(allPulls)) allPulls = [];
    var events = await githubList(base + '/issues/events?per_page=100', ctx, 2, range.startIso);

    var byLogin = {};
    var issueCredits = {};
    var reviewLogins = {};

    allPulls.forEach(function (pr) {
      var login = pr.user && pr.user.login;
      if (inRange(pr.merged_at, range) && login) {
        bump(byLogin, login, 'merges');
        var body = String(pr.body || '');
        var match;
        FIXES_RE.lastIndex = 0;
        while ((match = FIXES_RE.exec(body))) uniqueIssueCredit(issueCredits, match[1], login);
      }
    });

    (Array.isArray(events) ? events : []).forEach(function (ev) {
      if (!ev || ev.event !== 'closed' || !inRange(ev.created_at, range)) return;
      if (ev.issue && ev.issue.pull_request) return;
      var closer = ev.actor && ev.actor.login;
      var numIssue = ev.issue && ev.issue.number;
      if (numIssue) uniqueIssueCredit(issueCredits, numIssue, closer);
    });

    Object.keys(issueCredits).forEach(function (numIssue) {
      bump(byLogin, issueCredits[numIssue], 'issue_closes');
    });

    var reviewTargets = [];
    var seenPr = {};
    allPulls.forEach(function (pr) {
      if (!pr || !pr.number || seenPr[pr.number]) return;
      if (inRange(pr.updated_at, range) || inRange(pr.merged_at, range)) {
        seenPr[pr.number] = true;
        reviewTargets.push(pr.number);
      }
    });
    reviewTargets = reviewTargets.slice(0, 12);
    for (var i = 0; i < reviewTargets.length; i++) {
      var reviews = await githubGet(base + '/pulls/' + reviewTargets[i] + '/reviews?per_page=100', ctx);
      (Array.isArray(reviews) ? reviews : []).forEach(function (review) {
        if (!review || review.state === 'PENDING') return;
        if (!inRange(review.submitted_at, range)) return;
        var login = review.user && review.user.login;
        if (!login) return;
        var key = login + ':' + reviewTargets[i] + ':' + review.id;
        if (reviewLogins[key]) return;
        reviewLogins[key] = true;
        bump(byLogin, login, 'reviews');
      });
    }

    return Object.keys(byLogin).map(function (login) {
      return Object.assign({ login: login, htmlUrl: 'https://github.com/' + login }, byLogin[login]);
    });
  }

  async function scoreRepo(listing, ctx, range) {
    try {
      var activity = await fetchRepoActivity(listing.repo, ctx, range);
      var contributors = activity
        .map(function (row) {
          var scored = scoreEvents(row, listing.scoring);
          return {
            login: row.login,
            htmlUrl: row.htmlUrl,
            score: scored.score,
            merges: scored.merges,
            issue_closes: scored.issue_closes,
            reviews: scored.reviews,
          };
        })
        .filter(function (row) {
          return row.score > 0;
        });
      return {
        repo: listing.repo,
        pool: listing.pool,
        scoring: listing.scoring,
        contributors: rankContributors(contributors),
        error: null,
      };
    } catch (e) {
      return {
        repo: listing.repo,
        pool: listing.pool,
        scoring: listing.scoring,
        contributors: null,
        error: e && e.code === 'rate-limited' ? 'rate-limited' : 'unavailable',
      };
    }
  }

  function paidCell() {
    return '<span class="bb-na" title="This board does not record payouts">—</span>';
  }

  function avatarHtml(login) {
    return (
      '<img class="bb-avatar" src="https://github.com/' +
      esc(login) +
      '.png?size=80" alt="" width="36" height="36" loading="lazy"/>'
    );
  }

  function contributorCell(row) {
    var n = (row.projects && row.projects.length) || 1;
    var sub = n + ' project' + (n === 1 ? '' : 's') + ' · 1 scored cycle';
    return (
      '<div class="bb-who">' +
      avatarHtml(row.login) +
      '<div><a class="bb-name" href="' +
      esc(row.htmlUrl) +
      '" target="_blank" rel="noopener noreferrer">@' +
      esc(row.login) +
      '</a><span class="bb-sub">' +
      esc(sub) +
      '</span></div></div>'
    );
  }

  function shareTotal(shares) {
    if (!shares || !shares.length) return null;
    var currency = null;
    var sum = 0;
    var any = false;
    for (var i = 0; i < shares.length; i++) {
      if (shares[i].share == null || !shares[i].pool) continue;
      any = true;
      sum += shares[i].share;
      currency = (shares[i].pool && shares[i].pool.currency) || currency;
    }
    if (!any) return null;
    return { amount: sum, currency: currency };
  }

  function renderShareCell(shares) {
    var total = shareTotal(shares);
    if (!total) return 'undeclared';
    return esc(formatMoney(total.amount, total.currency));
  }

  function renderGlobalBoard(state) {
    if (state && state.boardError) {
      return (
        '<p class="bb-empty" role="status">' +
        esc(state.boardError) +
        ' No ranks or payouts are shown. The mint desk still works.</p>'
      );
    }
    var rows = ((state && state.global) || []).slice(0, 20);
    if (!rows.length) {
      return '<p class="bb-empty" role="status">No accepted outcomes in this cycle yet. Nothing here is invented to fill the table.</p>';
    }
    var body = rows
      .map(function (row) {
        var share = shareTotal(row.shares);
        var projected =
          share == null
            ? 'undeclared'
            : esc(formatMoney(share.amount, share.currency)) + ' <span class="bb-na">est.</span>';
        return (
          '<tr>' +
          '<td class="bb-rank">#' +
          esc(row.rank) +
          '</td>' +
          '<td>' +
          contributorCell(row) +
          '</td>' +
          '<td>' +
          esc(row.score) +
          '</td>' +
          '<td>' +
          (share == null ? 'undeclared' : esc(formatMoney(share.amount, share.currency))) +
          '</td>' +
          '<td>' +
          projected +
          '</td>' +
          '<td>' +
          paidCell() +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
    return (
      '<div class="bb-table-wrap"><table class="bb-table">' +
      '<thead><tr>' +
      '<th scope="col">Rank</th>' +
      '<th scope="col">Contributor</th>' +
      '<th scope="col">Score</th>' +
      '<th scope="col">Declared share</th>' +
      '<th scope="col">Projected</th>' +
      '<th scope="col">Total paid</th>' +
      '</tr></thead>' +
      '<tbody>' +
      body +
      '</tbody></table></div>'
    );
  }

  function payoutHtml(payout) {
    if (!payout) return 'undeclared';
    var bits = [];
    if (payout.solana) bits.push('<span class="bb-mono">' + esc(payout.solana) + '</span>');
    if (payout.url && /^https?:\/\//i.test(payout.url)) {
      bits.push(
        '<a href="' + esc(payout.url) + '" target="_blank" rel="noopener noreferrer">' + esc(payout.url) + '</a>',
      );
    } else if (payout.url) {
      bits.push(esc(payout.url));
    }
    return bits.length ? bits.join(' · ') : 'undeclared';
  }

  function repoShortName(repo) {
    var parts = String(repo || '').split('/');
    return parts[1] || repo;
  }

  function renderProjectCard(listing, scored) {
    var origin = listing.origin === 'seed' ? 'seed listing' : listing.origin === 'issue' ? 'live issue' : listing.origin;
    var originClass = listing.origin === 'issue' ? 'live' : '';
    var emptyNote = '';
    if (scored && scored.error) {
      emptyNote = '';
    } else if (scored && scored.contributors && !scored.contributors.length) {
      emptyNote = '<p class="bb-empty">No accepted outcomes in this cycle yet.</p>';
    }
    return (
      '<a class="bb-card" data-repo="' +
      esc(listing.repo) +
      '" data-origin="' +
      esc(listing.origin) +
      '" href="#project/' +
      esc(listing.repo) +
      '">' +
      '<div class="bb-proj-top">' +
      '<p class="bb-eyebrow" style="margin:0">Open-source agents</p>' +
      '<span class="bb-origin ' +
      originClass +
      '">' +
      esc(origin) +
      '</span></div>' +
      '<h3>' +
      esc(repoShortName(listing.repo)) +
      '</h3>' +
      '<p class="bb-meta" style="margin-top:4px">' +
      esc(listing.repo) +
      '</p>' +
      (listing.blurb ? '<p class="bb-blurb">' + esc(listing.blurb) + '</p>' : '') +
      '<p class="bb-pool-amount">' +
      esc(formatPool(listing.pool)) +
      '<small>Maximum principal allocated each UTC month</small></p>' +
      emptyNote +
      '</a>'
    );
  }

  function statDash(value, ok) {
    if (!ok) return '—';
    return String(value);
  }

  function renderCycleBoard(listing, scored) {
    if (scored && scored.error) {
      return (
        '<p class="bb-empty" role="status">Contributor scores unavailable (' +
        esc(scored.error) +
        '). Project listing still shown — no fake leaderboard.</p>'
      );
    }
    if (!scored || !scored.contributors) {
      return '<p class="bb-empty" role="status">No contributor table until GitHub activity loads.</p>';
    }
    if (!scored.contributors.length) {
      return '<p class="bb-empty" role="status">No accepted outcomes in this cycle yet.</p>';
    }
    var total = scored.contributors.reduce(function (sum, item) {
      return sum + item.score;
    }, 0);
    return (
      '<div class="bb-table-wrap"><table class="bb-table"><thead><tr>' +
      '<th scope="col">Rank</th><th scope="col">Contributor</th><th scope="col">Score</th>' +
      '<th scope="col">Declared share</th><th scope="col">Projected</th><th scope="col">Total paid</th>' +
      '</tr></thead><tbody>' +
      scored.contributors
        .map(function (row) {
          var share = declaredShare(row.score, total, listing.pool);
          var money = share == null ? 'undeclared' : esc(formatMoney(share, listing.pool && listing.pool.currency));
          return (
            '<tr><td class="bb-rank">#' +
            esc(row.rank) +
            '</td><td>' +
            contributorCell({ login: row.login, htmlUrl: row.htmlUrl, projects: [listing.repo] }) +
            '</td><td>' +
            esc(row.score) +
            '</td><td>' +
            money +
            '</td><td>' +
            (share == null ? 'undeclared' : money + ' <span class="bb-na">est.</span>') +
            '</td><td>' +
            paidCell() +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>'
    );
  }

  function renderProjectPage(listing, scored, meta) {
    if (!listing) {
      return '<p class="bb-empty" role="status">No listing for that repo.</p>';
    }
    var origin = listing.origin === 'seed' ? 'seed listing' : listing.origin === 'issue' ? 'live issue' : listing.origin;
    var originClass = listing.origin === 'issue' ? 'live' : '';
    var fetched = !!(scored && scored.contributors);
    var contributors = fetched ? scored.contributors : [];
    var totals = contributors.reduce(
      function (acc, row) {
        acc.score += row.score || 0;
        acc.merges += row.merges || 0;
        acc.reviews += row.reviews || 0;
        return acc;
      },
      { score: 0, merges: 0, reviews: 0 },
    );
    var stamp = (meta && meta.asOf) || '';
    var issueBit = listing.issueUrl
      ? '<a href="' + esc(listing.issueUrl) + '" target="_blank" rel="noopener noreferrer">listing issue</a>'
      : '';
    return (
      '<a class="bb-back" href="#projects">← Projects</a>' +
      '<p class="bb-stamp"><span class="bb-pill">' +
      esc(stamp ? 'as of ' + stamp + ' from GitHub' : 'snapshot pending') +
      '</span> <span class="bb-origin ' +
      originClass +
      '">' +
      esc(origin) +
      '</span></p>' +
      '<p class="bb-eyebrow">Open-source agents</p>' +
      '<h2 style="margin:0 0 8px;font-size:clamp(36px,5vw,68px);letter-spacing:-.06em;text-transform:uppercase;font-weight:800">' +
      esc(repoShortName(listing.repo)) +
      '</h2>' +
      '<p class="bb-meta"><a href="https://github.com/' +
      esc(listing.repo) +
      '" target="_blank" rel="noopener noreferrer">' +
      esc(listing.repo) +
      '</a>' +
      (issueBit ? ' · ' + issueBit : '') +
      '</p>' +
      (listing.blurb ? '<p class="bb-blurb">' + esc(listing.blurb) + '</p>' : '') +
      '<div class="bb-panel">' +
      '<p class="bb-eyebrow">Monthly pool</p>' +
      '<h3>Maximum principal allocated each UTC month.</h3>' +
      '<p class="bb-pool-amount">' +
      esc(formatPool(listing.pool)) +
      '</p>' +
      '<p><strong style="color:#fff">Declared bounties, not escrow.</strong> Dasha desk does not hold funds. Project owners approve rewards. Owners pay however they said (wallet / gitarmy / link).</p>' +
      '<p>Payout pointer: ' +
      payoutHtml(listing.payout) +
      '</p>' +
      '</div>' +
      '<div class="bb-stats" aria-label="Cycle snapshot">' +
      '<div class="bb-stat"><span>Contributors</span><strong>' +
      esc(statDash(contributors.length, fetched)) +
      '</strong></div>' +
      '<div class="bb-stat"><span>Cycle score</span><strong>' +
      esc(statDash(totals.score, fetched)) +
      '</strong></div>' +
      '<div class="bb-stat"><span>Merges</span><strong>' +
      esc(statDash(totals.merges, fetched)) +
      '</strong></div>' +
      '<div class="bb-stat"><span>Reviews</span><strong>' +
      esc(statDash(totals.reviews, fetched)) +
      '</strong></div>' +
      '</div>' +
      '<p class="bb-eyebrow">Cycle leaderboard</p>' +
      renderCycleBoard(listing, scored) +
      '<p class="bb-meta" style="margin-top:16px">merge ' +
      esc(listing.scoring.merge) +
      ' · issue_close ' +
      esc(listing.scoring.issue_close) +
      ' · review ' +
      esc(listing.scoring.review) +
      ' · caps merge ' +
      esc(listing.scoring.merge_cap) +
      ' / review ' +
      esc(listing.scoring.review_cap) +
      '</p>'
    );
  }

  function renderProjects(listings, scoresByRepo) {
    if (!listings || !listings.length) {
      return '<p class="bb-empty" role="status">No listings yet. Use the form below — or wait for the seed file to load.</p>';
    }
    return listings
      .map(function (listing) {
        return renderProjectCard(listing, scoresByRepo && scoresByRepo[listing.repo]);
      })
      .join('');
  }

  function $(id) {
    return document.getElementById(id);
  }

  function readForm() {
    var scoring = {
      merge: num($('bb-merge').value, DEFAULT_SCORING.merge),
      issue_close: num($('bb-issue-close').value, DEFAULT_SCORING.issue_close),
      review: num($('bb-review').value, DEFAULT_SCORING.review),
      merge_cap: num($('bb-merge-cap').value, DEFAULT_SCORING.merge_cap),
      review_cap: num($('bb-review-cap').value, DEFAULT_SCORING.review_cap),
    };
    return {
      repo: $('bb-repo').value,
      amount: $('bb-amount').value,
      currency: $('bb-currency').value,
      period: $('bb-period').value,
      blurb: $('bb-blurb').value,
      solana: $('bb-solana').value,
      url: $('bb-payout-url').value,
      scoring: scoring,
    };
  }

  var formBound = false;
  function bindForm() {
    var form = $('bb-form');
    var err = $('bb-form-error');
    var preview = $('bb-issue-preview');
    if (!form || formBound) return;
    formBound = true;
    function updatePreview() {
      var built = buildIssueUrl(readForm());
      if (preview) {
        if (built.ok) {
          preview.hidden = false;
          preview.href = built.url;
          preview.textContent = 'Preview GitHub issue URL';
        } else {
          preview.hidden = true;
          preview.removeAttribute('href');
        }
      }
    }
    form.addEventListener('input', updatePreview);
    form.addEventListener('change', updatePreview);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var built = buildIssueUrl(readForm());
      if (!built.ok) {
        err.hidden = false;
        err.textContent = built.error;
        return;
      }
      err.hidden = true;
      err.textContent = '';
      var opened = window.open(built.url, '_blank', 'noopener,noreferrer');
      if (!opened && preview) {
        preview.hidden = false;
        preview.href = built.url;
        preview.textContent = 'Popup blocked — open the listing issue here';
        preview.focus();
      }
    });
    updatePreview();
  }

  async function loadSeed(ctx) {
    var fetchImpl = (ctx && ctx.fetchImpl) || fetch;
    var url = (ctx && ctx.seedUrl) || '../config/bounties.seed.json';
    var res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('unavailable');
    return res.json();
  }

  async function loadIssues(ctx) {
    var url =
      'https://api.github.com/repos/' +
      LISTING_REPO +
      '/issues?state=open&per_page=100';
    return githubList(url, ctx, 3);
  }

  var live = {
    listings: [],
    scoresByRepo: {},
    range: null,
    asOf: '',
    boardError: null,
    global: [],
  };
  var rotatorBound = false;
  var routingBound = false;

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

  function parseHash() {
    var raw = '';
    try {
      raw = String(location.hash || '').replace(/^#/, '');
    } catch (e) {
      raw = '';
    }
    if (raw.indexOf('project/') === 0) {
      return { view: 'project', repo: raw.slice('project/'.length) };
    }
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
        return row.repo.toLowerCase() === String(route.repo || '').toLowerCase();
      })[0];
      detail.innerHTML = renderProjectPage(listing, listing && live.scoresByRepo[listing.repo], {
        asOf: live.asOf,
      });
      try {
        window.scrollTo(0, 0);
      } catch (e) {}
      return;
    }
    home.hidden = false;
    detail.hidden = true;
    detail.innerHTML = '';
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
    var ctx = { fetchImpl: options.fetchImpl || fetch };
    var range = utcMonthRange(options.now || Date.now());
    var asof = $('bb-asof');
    var banner = $('bb-banner');
    var boardEl = $('bb-global');
    var projectsEl = $('bb-projects');
    var formulaEl = $('bb-formula');
    var periodEl = $('bb-period-pill');
    if (periodEl) periodEl.textContent = range.label;
    if (formulaEl) formulaEl.textContent = formulaText(DEFAULT_SCORING);
    bindForm();
    bindRotator();
    bindRouting();

    var seedListings = [];
    var issueListings = [];
    var issuesError = null;
    var seedError = null;

    try {
      seedListings = listingsFromSeed(await loadSeed(ctx));
    } catch (e) {
      seedError = 'unavailable';
    }
    try {
      issueListings = listingsFromIssues(await loadIssues(ctx));
    } catch (e) {
      issuesError = e && e.code === 'rate-limited' ? 'rate-limited' : 'unavailable';
    }

    var listings = mergeListings(seedListings, issueListings);
    live.listings = listings;
    live.range = range;
    live.scoresByRepo = {};
    if (projectsEl) projectsEl.innerHTML = renderProjects(listings, {});

    var messages = [];
    if (issuesError === 'rate-limited') {
      messages.push('GitHub rate-limited this browser. Live issues and scores paused.');
    } else if (issuesError) {
      messages.push('GitHub listings are unavailable. The mint desk still works.');
    }
    if (seedError && !listings.length) {
      messages.push('Seed listing did not load.');
    }
    if (banner) {
      if (messages.length) {
        banner.hidden = false;
        banner.className = 'bb-banner ' + (issuesError === 'rate-limited' ? 'warn' : 'bad');
        banner.innerHTML =
          messages.join(' ') +
          ' <a href="/dasha">Open the desk</a> · <a href="/">Home</a>';
      } else {
        banner.hidden = true;
        banner.textContent = '';
      }
    }

    if (!listings.length) {
      live.boardError = issuesError ? 'The board is unavailable (' + issuesError + ').' : null;
      live.global = [];
      if (boardEl) {
        boardEl.innerHTML = renderGlobalBoard({
          boardError: live.boardError,
          global: [],
        });
      }
      if (asof) asof.textContent = 'No listings loaded.';
      paintView();
      return;
    }

    var scoresByRepo = {};
    var anyScoreError = null;
    for (var i = 0; i < listings.length; i++) {
      var scored = await scoreRepo(listings[i], ctx, range);
      scoresByRepo[listings[i].repo] = scored;
      if (scored.error) anyScoreError = scored.error;
    }
    live.scoresByRepo = scoresByRepo;
    live.asOf = ctx.asOf || '';
    if (projectsEl) projectsEl.innerHTML = renderProjects(listings, scoresByRepo);
    var global = aggregateGlobal(
      listings.map(function (listing) {
        return scoresByRepo[listing.repo];
      }),
    );
    var boardError = null;
    if (issuesError && !seedListings.length) {
      boardError = 'The board is unavailable (' + issuesError + ').';
    } else if (anyScoreError && global.length === 0) {
      boardError =
        anyScoreError === 'rate-limited'
          ? 'GitHub rate-limited scoring. No ranks are shown.'
          : 'Contributor fetch failed. No ranks are shown.';
    }
    live.global = global;
    live.boardError = boardError;
    if (boardEl) boardEl.innerHTML = renderGlobalBoard({ global: global, boardError: boardError });
    if (asof) {
      var stamp = ctx.asOf || new Date().toISOString();
      asof.textContent = 'as of ' + stamp + ' from GitHub' + (anyScoreError ? ' · scoring ' + anyScoreError : '');
    }
    if (anyScoreError && banner && banner.hidden) {
      banner.hidden = false;
      banner.className = 'bb-banner ' + (anyScoreError === 'rate-limited' ? 'warn' : 'bad');
      banner.innerHTML =
        (anyScoreError === 'rate-limited'
          ? 'GitHub rate-limited scoring.'
          : 'GitHub contributor fetch failed.') +
        ' Project cards stay up. No fake leaderboard. <a href="/dasha">The mint desk still works</a>.';
    }
    paintView();
  }

  var api = {
    LISTING_REPO: LISTING_REPO,
    ISSUE_LABEL: ISSUE_LABEL,
    TITLE_PREFIX: TITLE_PREFIX,
    DEFAULT_SCORING: DEFAULT_SCORING,
    isValidRepo: isValidRepo,
    normalizeRepo: normalizeRepo,
    normalizeListing: normalizeListing,
    normalizePool: normalizePool,
    extractJsonObject: extractJsonObject,
    isBountyIssue: isBountyIssue,
    listingFromIssue: listingFromIssue,
    listingsFromIssues: listingsFromIssues,
    listingsFromSeed: listingsFromSeed,
    mergeListings: mergeListings,
    formatPool: formatPool,
    formatMoney: formatMoney,
    declaredShare: declaredShare,
    utcMonthRange: utcMonthRange,
    scoreEvents: scoreEvents,
    formulaText: formulaText,
    buildIssueUrl: buildIssueUrl,
    rankContributors: rankContributors,
    aggregateGlobal: aggregateGlobal,
    scoreRepo: scoreRepo,
    renderGlobalBoard: renderGlobalBoard,
    renderProjectCard: renderProjectCard,
    renderProjectPage: renderProjectPage,
    renderProjects: renderProjects,
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
