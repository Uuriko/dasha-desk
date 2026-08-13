# Changelog

## v0.1.1 — unreleased (main)

- **Leftover QA:** empty `payTo` hides Pay (em dash, not a dead button). Studio loader H1 is paper (`#f4eddb!important`) and pins the GitHub Pages embed (lobby `studio.js` SRI was stale, which hung on “Loading studio…”). Board empty state no longer grows a 100vh canyon. Desk body/mute is paper on ink. README notes `/desk` 404s — desk is `/dasha`.
- **dasha bounties / the board** at `/bounties`: sparse USDC-on-Solana board. GitHub required to list/claim/pay; X optional via lobby.getdasha.com (same popup as Simp Board). Feed `schema: dasha-bounties-feed/v1`. We don't hold it.
- **Honest GitHub CTA:** the board labels GitHub connect "GitHub soon" unless lobby `/oauth/github/status` reports `configured: true`. The crawlable link still hits the real start URL (which says the worker secrets are missing). Nav in the GitHub Pages iframe uses canonical getdasha.com URLs so Home/Studio are not 404s on uuriko.github.io.
- **Last-visit stamp** on the mint card: this browser only records when you last checked the associated mint and warns if the mint string differs from your previous visit (no server).
- **Desk market age:** relative age of the last *successful* Dex fetch, still counting if a later refresh fails.
- **Studio Surprise me** in `.go`: random look + format, caption from that look's line, never the look already selected.
- Contributor guide: claim good first issues; expanded verify commands.
- Home site (getdasha monorepo): mint paste-check on the token panel (shipped with site publish).

## v0.1.0 — 2026-08-08

- Community-ready desk: demo GIF, CI verify workflow, mint consistency test, OSS docs test.
- Good first issues + pinned Ideas welcome.
- Aria-labels on copy controls.
