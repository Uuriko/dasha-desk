#!/usr/bin/env python3
"""
OCM browser driver.

A long-lived headed Chromium the operator can see and type into, driven in short
commands between which the agent detaches. Chromium runs with a remote-debugging
port and a persistent profile, so a login survives across commands.

The agent never types a password or an MFA code. Those are entered by the operator
in the visible window; the agent resumes afterwards.

  ./driver.py start [url]        launch (or reuse) the browser
  ./driver.py goto <url>
  ./driver.py text [--full]      visible text of the active page
  ./driver.py shot [name]        screenshot -> shots/<name>.png
  ./driver.py links [filter]     visible links and buttons
  ./driver.py click <text|css>
  ./driver.py fill <css> <value>
  ./driver.py press <key>
  ./driver.py eval <js>
  ./driver.py tabs
  ./driver.py tab <n>
  ./driver.py url
  ./driver.py stop
"""
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.request

PORT = int(os.environ.get("OCM_CDP_PORT", "9222"))
STATE = pathlib.Path(os.environ.get("OCM_BROWSER_STATE", pathlib.Path.home() / ".cache" / "ocm-browser"))
PROFILE = STATE / "profile"
SHOTS = STATE / "shots"


def cdp_alive():
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=1) as r:
            return json.load(r)
    except Exception:
        return None


def chromium_binary():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        return p.chromium.executable_path


def start(url=None):
    if cdp_alive():
        print(f"browser already running on :{PORT}")
    else:
        PROFILE.mkdir(parents=True, exist_ok=True)
        SHOTS.mkdir(parents=True, exist_ok=True)
        os.chmod(STATE, 0o700)
        binary = chromium_binary()
        subprocess.Popen(
            [binary,
             f"--remote-debugging-port={PORT}",
             f"--user-data-dir={PROFILE}",
             "--no-first-run", "--no-default-browser-check",
             "--disable-features=Translate,MediaRouter",
             "--window-size=1440,900",
             "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        for _ in range(60):
            if cdp_alive():
                break
            time.sleep(0.5)
        else:
            sys.exit("chromium failed to expose CDP")
        print(f"browser started on :{PORT}  profile={PROFILE}")
    if url:
        goto(url)


class Session:
    def __enter__(self):
        from playwright.sync_api import sync_playwright
        if not cdp_alive():
            sys.exit("browser is not running — ./driver.py start")
        self._pw = sync_playwright().start()
        self.browser = self._pw.chromium.connect_over_cdp(f"http://127.0.0.1:{PORT}")
        self.ctx = self.browser.contexts[0]
        return self

    def __exit__(self, *a):
        try:
            self._pw.stop()
        except Exception:
            pass

    def pages(self):
        return [p for p in self.ctx.pages if not p.url.startswith("devtools://")]

    def page(self):
        ps = self.pages()
        if not ps:
            return self.ctx.new_page()
        # prefer the last page that is not blank
        for p in reversed(ps):
            if p.url not in ("about:blank", ""):
                return p
        return ps[-1]


def goto(url):
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    with Session() as s:
        p = s.page()
        p.goto(url, wait_until="domcontentloaded", timeout=60000)
        settle(p)
        print(f"{p.url}\n{p.title()}")


def settle(p, ms=1200):
    try:
        p.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    p.wait_for_timeout(ms)


def text(full=False):
    with Session() as s:
        p = s.page()
        settle(p, 400)
        try:
            body = p.eval_on_selector("body", "e => e.innerText")
        except Exception:
            body = ""
        lines = [ln.strip() for ln in (body or "").splitlines()]
        out, blank = [], 0
        for ln in lines:
            if not ln:
                blank += 1
                if blank > 1:
                    continue
            else:
                blank = 0
            out.append(ln)
        joined = "\n".join(out)
        limit = 100000 if full else 6000
        print(f"URL   {p.url}\nTITLE {p.title()}\n{'-'*60}")
        print(joined[:limit] + ("\n… (truncated, use --full)" if len(joined) > limit else ""))


def links(filt=None):
    with Session() as s:
        p = s.page()
        items = p.eval_on_selector_all(
            "a, button, [role=button], input[type=submit], summary",
            """els => els.map(e => ({
                 tag: e.tagName.toLowerCase(),
                 text: (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().slice(0,90),
                 href: e.getAttribute('href') || '',
                 id: e.id || '',
                 vis: !!(e.offsetWidth || e.offsetHeight)
               })).filter(x => x.vis && (x.text || x.href))""")
        seen = set()
        for it in items:
            key = (it["text"], it["href"])
            if key in seen:
                continue
            seen.add(key)
            line = f"[{it['tag']}] {it['text']}"
            if it["id"]:
                line += f"  #{it['id']}"
            if it["href"] and not it["href"].startswith("javascript"):
                line += f"  -> {it['href'][:100]}"
            if filt and filt.lower() not in line.lower():
                continue
            print(line)


def shot(name="page"):
    SHOTS.mkdir(parents=True, exist_ok=True)
    path = SHOTS / f"{name}.png"
    with Session() as s:
        p = s.page()
        settle(p, 400)
        p.screenshot(path=str(path), full_page=False)
    print(path)


def click(target):
    with Session() as s:
        p = s.page()
        loc = None
        if target.startswith((".", "#", "[", "css=")) or ("[" in target and " " not in target):
            loc = p.locator(target.replace("css=", "", 1))
        else:
            for mk in (lambda: p.get_by_role("button", name=target, exact=False),
                       lambda: p.get_by_role("link", name=target, exact=False),
                       lambda: p.get_by_text(target, exact=False)):
                cand = mk()
                try:
                    if cand.count():
                        loc = cand.first
                        break
                except Exception:
                    continue
        if loc is None:
            sys.exit(f"no match for {target!r}")
        loc.click(timeout=20000)
        settle(p)
        print(f"clicked {target!r}\n{p.url}")


def fill(sel, value):
    with Session() as s:
        p = s.page()
        p.fill(sel, value, timeout=20000)
        print(f"filled {sel}")



def type_text(sel, value):
    """Click a field and enter text as real key events (React-safe)."""
    with Session() as s:
        p = s.page()
        loc = p.locator(sel).first
        loc.click(timeout=20000)
        loc.press("Meta+a")
        p.keyboard.type(value, delay=25)
        settle(p, 1500)
        print(f"typed into {sel}")


def check(sel):
    """Tick a checkbox/radio, tolerating Cloudscape's hidden real input."""
    with Session() as s:
        p = s.page()
        loc = p.locator(sel).first
        try:
            loc.check(timeout=8000)
        except Exception:
            loc.dispatch_event("click")
        settle(p, 800)
        print(f"checked {sel} -> {loc.is_checked()}")


def press(key):
    with Session() as s:
        p = s.page()
        p.keyboard.press(key)
        settle(p)
        print(f"pressed {key}\n{p.url}")


def do_eval(js):
    with Session() as s:
        print(json.dumps(s.page().evaluate(js), indent=2, default=str)[:8000])


def tabs():
    with Session() as s:
        for i, p in enumerate(s.pages()):
            print(f"{i}  {p.title()[:60]:60} {p.url[:100]}")


def tab(n):
    with Session() as s:
        p = s.pages()[int(n)]
        p.bring_to_front()
        settle(p, 300)
        print(f"{p.url}\n{p.title()}")


def url():
    with Session() as s:
        p = s.page()
        print(p.url)


def stop():
    v = cdp_alive()
    if not v:
        print("not running")
        return
    subprocess.run(["pkill", "-f", f"remote-debugging-port={PORT}"], check=False)
    print("stopped")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd, args = sys.argv[1], sys.argv[2:]
    fns = {"start": start, "goto": goto, "shot": shot, "click": click,
           "fill": fill, "press": press, "eval": do_eval, "tabs": tabs,
           "tab": tab, "url": url, "stop": stop, "links": links,
           "type": type_text, "check": check}
    if cmd == "text":
        text(full="--full" in args)
    elif cmd in fns:
        fns[cmd](*args)
    else:
        sys.exit(__doc__)
