/**
 * Server-rendered consoles (PDF §05: "Consoles — two static pages").
 *
 * Served on the console hostname by Host header, so it shares the gateway's ALB
 * target group and needs no extra infrastructure.
 *
 * There are no accounts yet, so this shows network-wide state and says so. Showing
 * a per-provider earnings figure before providers can log in would be theatre.
 */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const dur = (s) => {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600);
  return `${h}h ${Math.floor((s % 3600) / 60)}m`;
};

const num = (n) => n.toLocaleString('en-US');

export async function stats(registry, ledger) {
  const led = await ledger.summary();
  const hosts = registry.online().map((h) => ({
    id: h.id,
    chip: h.caps.chip || '—',
    memory_gb: h.caps.memory_gb || 0,
    region: h.caps.region || '—',
    accountId: h.caps.accountId || null,
    runtime: h.caps.runtime || '—',
    models: [...h.models],
    inflight: h.inflight.size,
    uptime_s: Math.round((Date.now() - h.connectedAt) / 1000),
    credited: led.creditedByHost[h.id] || 0,
  }));

  return {
    hosts,
    consumers: led.consumers,
    totals: led.totals,
    recent: led.recent,
  };
}

const STYLE = `
:root{--bg:#fbfbfa;--fg:#1a1a19;--dim:#6b6b66;--line:#e4e3df;--card:#fff;--ok:#1a7f47;--idle:#9a9a94;--warn:#b45309;--accent:#1a1a19}
@media (prefers-color-scheme:dark){:root{--bg:#131312;--fg:#eeede9;--dim:#9a9a94;--line:#2b2b29;--card:#1c1c1a;--ok:#4ade80;--idle:#6b6b66;--warn:#fbbf24;--accent:#eeede9}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:40px 24px 72px}
a{color:var(--fg)}
h1{font-size:22px;margin:0 0 4px;letter-spacing:-.01em}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.09em;color:var(--dim);margin:34px 0 12px;font-weight:600}
h3{font-size:15px;margin:0 0 8px}
.sub{color:var(--dim);margin:0 0 8px}
.note{border:1px solid var(--line);border-left:3px solid var(--dim);background:var(--card);padding:11px 14px;border-radius:6px;color:var(--dim);font-size:13px;margin:14px 0}
.warn{border-left-color:var(--warn)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px}
.k{font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em}
.v{font-size:23px;font-variant-numeric:tabular-nums;margin-top:4px;letter-spacing:-.02em}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:14px;min-width:480px}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--dim);padding:10px 14px;border-bottom:1px solid var(--line);font-weight:600}
td{padding:11px 14px;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;vertical-align:middle}
.on{background:var(--ok)} .off{background:var(--idle)}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
code{font-size:13px;background:var(--bg);border:1px solid var(--line);padding:1px 5px;border-radius:4px}
pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px;overflow-x:auto;font-size:13px;line-height:1.5;margin:10px 0}
.empty{padding:22px 14px;color:var(--dim);font-size:14px}
form{margin:0}
label{display:block;font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 5px}
input[type=text],input[type=email],input[type=password]{width:100%;padding:9px 11px;font:14px ui-sans-serif,system-ui,sans-serif;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px}
button{margin-top:14px;padding:9px 16px;font:14px/1 ui-sans-serif,system-ui,sans-serif;background:var(--accent);color:var(--bg);border:0;border-radius:6px;cursor:pointer}
button.ghost{background:transparent;color:var(--dim);border:1px solid var(--line)}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}
.row>*{flex:1 1 280px}
.secret{background:var(--card);border:1px solid var(--warn);border-radius:8px;padding:14px;margin:12px 0}
.secret code{display:block;word-break:break-all;padding:9px 11px;font-size:13px;background:var(--bg)}
.muted{color:var(--dim);font-size:13px}
nav{display:flex;gap:16px;margin:0 0 18px;font-size:14px;align-items:center}
nav .spacer{flex:1}
footer{margin-top:44px;color:var(--dim);font-size:12px;border-top:1px solid var(--line);padding-top:14px}
`;

const page = (title, body) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title><style>${STYLE}</style></head><body><div class="wrap">${body}
<footer>Tokens are counted at the gateway, never taken from a host's own report.
Prompts are visible in plaintext to whoever runs a provider — no confidentiality is
claimed that the architecture cannot enforce.</footer></div></body></html>`;

const nav = (email) => `<nav><strong>OCM</strong>
  <a href="/">Overview</a><a href="/provider">Run a provider</a>
  <span class="spacer"></span><span class="muted">${esc(email)}</span>
  <form method="post" action="/signout"><button class="ghost" style="margin:0;padding:6px 12px">Sign out</button></form></nav>`;

/** Shown exactly once — the plaintext is not recoverable afterwards. */
export function renderSecret({ title, secret, whatNext }) {
  return page(title, `<h1>${esc(title)}</h1>
<div class="secret"><strong>Copy this now — it is shown once and cannot be retrieved again.</strong>
<code>${esc(secret)}</code></div>
${whatNext || ''}
<p><a href="/">Back to the console</a></p>`);
}

export function renderLanding({ inviteRequired, error }) {
  return page('OCM console', `<h1>Open-Compute Marketplace</h1>
<p class="sub">Alpha.</p>
${error ? `<div class="note warn">${esc(error)}</div>` : ''}
<div class="row">
  <div class="card"><h3>Sign in</h3>
    <p class="muted">With a developer key you already hold.</p>
    <form method="post" action="/signin">
      <label for="k">Developer key</label>
      <input id="k" type="password" name="key" placeholder="ocm_live_…" autocomplete="off" required>
      <button type="submit">Sign in</button>
    </form>
  </div>
  <div class="card"><h3>Create an account</h3>
    <p class="muted">Anyone can sign up. An invite code is what gives you tokens.</p>
    <form method="post" action="/signup">
      <label for="e">Email</label>
      <input id="e" type="email" name="email" required>
      ${inviteRequired ? `<label for="i">Invite code <span style="text-transform:none;letter-spacing:0">(optional)</span></label>
      <input id="i" type="text" name="invite" autocomplete="off" placeholder="leave blank to start with zero">` : ''}
      <button type="submit">Create account</button>
    </form>
  </div>
</div>
<div class="note">Without a code your account starts at zero tokens and requests will
be refused — you can redeem one from the console later. Credits are not money; there
is no billing.</div>`);
}

export async function renderDashboard({ registry, ledger, accounts, account, apiHost, notice, error, redeemed, inviteRequired }) {
  const s = await stats(registry, ledger);
  const mine = s.consumers.find((c) => c.consumer === account.id)
    || { granted: 0, used: 0, balance: 0, requests: 0 };
  const creds = await accounts.listCredentials(account.id);
  const myHosts = s.hosts.filter((h) => h.accountId === account.id);

  const credRows = creds.length ? creds.map((c) => `<tr>
    <td>${c.kind === 'developer_key' ? 'Developer key' : 'Provider token'}</td>
    <td>${esc(c.label || '—')}</td>
    <td>${new Date(c.created_at).toISOString().slice(0, 10)}</td>
    <td>${c.last_used_at ? new Date(c.last_used_at).toISOString().slice(0, 10) : 'never'}</td>
    <td>${c.revoked_at ? '<span class="muted">revoked</span>'
      : `<form method="post" action="/keys/revoke"><input type="hidden" name="credential_id" value="${esc(c.id)}">
         <button class="ghost" style="margin:0;padding:5px 10px">Revoke</button></form>`}</td>
  </tr>`).join('') : '';

  const hostRows = myHosts.length ? myHosts.map((h) => `<tr>
    <td><span class="dot ${h.inflight ? 'on' : 'off'}"></span><code>${esc(h.id)}</code></td>
    <td>${esc(h.chip)}</td><td>${h.memory_gb} GiB</td>
    <td>${dur(h.uptime_s)}</td><td>${num(h.credited)}</td>
  </tr>`).join('') : '';

  const redeemBlock = redeemed ? '' : `
<div class="note warn"><strong>This account has no tokens yet.</strong> Requests are
refused until an invite code is redeemed. One redemption per account.</div>
<form class="card" method="post" action="/redeem" style="margin-bottom:8px">
  <h3>Redeem an invite code</h3>
  <label for="rc">Invite code</label>
  <input id="rc" type="text" name="invite" autocomplete="off" required>
  <button type="submit">Redeem</button>
</form>`;

  return page('OCM console', `${nav(account.email)}
${notice ? `<div class="note">${esc(notice)}</div>` : ''}
${error ? `<div class="note warn">${esc(error)}</div>` : ''}
${redeemBlock}
<h2>Your balance</h2>
<div class="grid">
  <div class="card"><div class="k">Balance</div><div class="v">${num(mine.balance)}</div></div>
  <div class="card"><div class="k">Used</div><div class="v">${num(mine.used)}</div></div>
  <div class="card"><div class="k">Requests</div><div class="v">${num(mine.requests)}</div></div>
  <div class="card"><div class="k">Providers online</div><div class="v">${s.hosts.length}</div></div>
</div>

<h2>Your providers</h2>
<div class="tablewrap">${hostRows ? `<table>
<thead><tr><th>Host</th><th>Chip</th><th>Memory</th><th>Uptime</th><th>Tokens credited</th></tr></thead>
<tbody>${hostRows}</tbody></table>`
  : '<div class="empty">None connected. <a href="/provider">Run a provider</a> to contribute a Mac.</div>'}</div>

<h2>Credentials</h2>
<div class="tablewrap">${credRows ? `<table>
<thead><tr><th>Kind</th><th>Label</th><th>Created</th><th>Last used</th><th></th></tr></thead>
<tbody>${credRows}</tbody></table>` : '<div class="empty">No credentials yet.</div>'}</div>
<div class="row" style="margin-top:12px">
  <form class="card" method="post" action="/keys/new">
    <input type="hidden" name="kind" value="developer_key">
    <h3>New developer key</h3><p class="muted">For calling the API.</p>
    <label for="l1">Label</label><input id="l1" type="text" name="label" placeholder="laptop">
    <button type="submit">Issue key</button></form>
  <form class="card" method="post" action="/keys/new">
    <input type="hidden" name="kind" value="provider_token">
    <h3>New provider token</h3><p class="muted">For connecting a Mac.</p>
    <label for="l2">Label</label><input id="l2" type="text" name="label" placeholder="mac mini">
    <button type="submit">Issue token</button></form>
</div>

<h2>Using the API</h2>
<pre>export OPENAI_BASE_URL="https://${esc(apiHost)}/v1"
export OPENAI_API_KEY="ocm_live_…"</pre>
<p class="muted">Anything that speaks the OpenAI API works unmodified — no SDK of ours to install.</p>`);
}

export function renderProviderGuide({ account, apiHost, models }) {
  return page('Run a provider', `${nav(account.email)}
<h1>Run a provider</h1>
<p class="sub">Contribute an Apple Silicon Mac and earn credits for the tokens it serves.</p>

<div class="note">Requires Apple Silicon (M1 or later) and macOS 14+. An Intel Mac
cannot run MLX and will not work. The agent holds one <em>outbound</em> connection —
no inbound ports, no router configuration.</div>

<h2>1 · Issue a provider token</h2>
<p class="muted">On the <a href="/">console</a>, issue a provider token and copy it.</p>

<h2>2 · Install the agent</h2>
<pre>curl -fsSL https://${esc(apiHost)}/install.sh -o install.sh
less install.sh          # read it before running it
sudo OCM_HOST_TOKEN="ocm_host_…" sh install.sh</pre>
<p class="muted">The installer refuses to run on an Intel Mac, sets up an isolated
runtime with <code>uv</code>, stores your token root-only rather than in the plist,
runs a preflight check before connecting, and installs a <code>launchd</code> daemon
so the agent survives reboot. It prints the uninstall command when it finishes.</p>
<p class="muted">Piping an unread script into a shell is a bad habit — the
<code>less</code> line is there because it is worth the thirty seconds.</p>

<h2>3 · Confirm it connected</h2>
<pre>launchctl print system/com.ocm.agent   # status
tail -f /var/log/ocm-agent.log        # logs
curl https://${esc(apiHost)}/v1/network</pre>
<p class="muted">Your Mac should appear within a few seconds, and on the console under
<strong>Your providers</strong>. The agent reconnects on its own — dropped sockets are
expected, not exceptional.</p>

<h2>What it will run</h2>
<p class="muted">${models.length ? models.map(esc).join(', ') : 'No models are currently served.'}</p>

<h2>What it costs you</h2>
<p class="muted">The agent yields when you need the GPU yourself, and the model stays
resident in unified memory — about 4.5 GB for a 7B model. Expect the fans under
sustained load.</p>

<div class="note warn"><strong>Be clear-eyed about privacy.</strong> As a provider you
can see every prompt routed to your machine in plaintext. The same is true of every
other provider, which is why prompts should not carry secrets.</div>`);
}
