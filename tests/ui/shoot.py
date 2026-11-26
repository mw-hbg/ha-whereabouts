"""Screenshots of the Whereabouts sidebar page in a fake Home Assistant (Playwright, sync API).

    python tests/ui/shoot.py [--out DIR] [--chrome PATH] [--lang de|en] [--only NAME]

Every view (live, history, settings) x device (pc, phone, phone-landscape) x theme
(light, dark), plus the settings page with everything opened ("settings-open").
Writes <view>[-open]_<device>_<theme>.png and errors.json into --out. Exit code 1 if
a JavaScript error, an error in the console or a failed local request occurred.
"""

from __future__ import annotations

import argparse
import json
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
VIEWS = ["live", "history", "settings"]
DEVICES = {
    "pc": {"viewport": {"width": 1440, "height": 900}, "is_mobile": False, "has_touch": False},
    "phone": {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True},
    "phone-landscape": {"viewport": {"width": 844, "height": 390}, "is_mobile": True, "has_touch": True},
}
THEMES = ["light", "dark"]
FIXED_TIME = "2026-11-15T12:00:00+01:00"
TIMEZONE = "Europe/Berlin"
MAX_OPEN_HEIGHT = 16000  # px, cap for the "all open" screenshot

# what must be on screen before the screenshot
READY = {
    "live": "whereabouts-live-card .leaflet-container",
    "history": "whereabouts-history-card .leaflet-container",
    "settings": "whereabouts-settings .kat",
}

NO_MOTION_CSS = """
*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }
"""

LOCAL_HOSTS = {"localhost", "127.0.0.1"}


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_server(port: int) -> subprocess.Popen:
    proc = subprocess.Popen([sys.executable, str(HERE / "serve.py"), str(port)], stdout=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}/tests/ui/index.html"
    for _ in range(100):
        try:
            with urllib.request.urlopen(url, timeout=1):
                return proc
        except OSError:
            time.sleep(0.1)
    proc.kill()
    raise SystemExit("serve.py did not start")


def is_local(url: str) -> bool:
    parts = urlsplit(url)
    return parts.scheme in ("data", "blob", "about") or (parts.hostname or "") in LOCAL_HOSTS


class Shooter:
    def __init__(self, browser, base: str, out: Path, lang: str) -> None:
        self.browser = browser
        self.base = base
        self.out = out
        self.lang = lang
        self.errors: list[dict] = []
        self.current = ""

    def _note(self, kind: str, text: str) -> None:
        self.errors.append({"shot": self.current, "kind": kind, "text": text})

    def _wire(self, page) -> None:
        page.on(
            "pageerror", lambda err: self._note("pageerror", f"{err.name}: {err.message}\n{err.stack or ''}".strip())
        )

        def on_console(msg) -> None:
            text = msg.text
            if msg.type == "error":
                # blocked map tiles etc. (everything not on localhost is aborted on purpose)
                url = (msg.location or {}).get("url", "")
                if text.startswith("Failed to load resource") and url and not is_local(url):
                    return
                self._note("console", text)
            elif msg.type == "warning" and text.startswith("Whereabouts"):
                self._note("warning", text)

        page.on("console", on_console)
        page.on(
            "requestfailed",
            lambda req: is_local(req.url) and self._note("request", f"{req.url}: {req.failure}"),
        )
        page.on(
            "response",
            lambda res: is_local(res.url) and res.status >= 400 and self._note("http", f"{res.status} {res.url}"),
        )

    def _context(self, device: str, theme: str):
        spec = DEVICES[device]
        context = self.browser.new_context(
            viewport=spec["viewport"],
            is_mobile=spec["is_mobile"],
            has_touch=spec["has_touch"],
            device_scale_factor=1,
            locale="de-DE" if self.lang == "de" else "en-US",
            timezone_id=TIMEZONE,
            color_scheme=theme,
            reduced_motion="reduce",
            service_workers="block",
        )
        # deterministic: no map tiles, no fonts or anything else from the internet
        context.route("**/*", lambda route: route.continue_() if is_local(route.request.url) else route.abort())
        return context

    def _load(self, page, view: str, theme: str, extra: str = "") -> None:
        page.clock.set_fixed_time(FIXED_TIME)
        page.goto(f"{self.base}?view={view}&theme={theme}&lang={self.lang}{extra}", wait_until="load")
        page.add_style_tag(content=NO_MOTION_CSS)
        page.wait_for_function("window.__waReady === true", timeout=20000)
        # the settings page waits ~3 s for <ha-selector> (not there) before it draws
        page.wait_for_selector(READY[view], state="visible", timeout=20000)
        self._settle(page)

    @staticmethod
    def _settle(page) -> None:
        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except PlaywrightError:
            pass
        # two frames + a little time for late layout (ResizeObserver, fitBounds, tile fallback)
        page.evaluate("() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))")
        page.wait_for_timeout(700)

    def _shot(self, page, name: str) -> None:
        page.screenshot(path=str(self.out / f"{name}.png"), full_page=True, animations="disabled", caret="hide")

    def _open_all(self, page) -> None:
        """Open every category (button "expand all") and every sub-area (<details>)."""
        page.evaluate(
            """() => {
              const root = document.querySelector('whereabouts-settings');
              if (root.querySelector('.kat.zu')) {
                const all = root.querySelector('.alle-klappen');
                if (all) all.click();
                // fallback: click each closed header
                root.querySelectorAll('.kat.zu > .kat-kopf').forEach((h) => h.click());
              }
            }"""
        )
        self._settle(page)
        # sub-areas may only appear once their category is open (e.g. diagnostics): twice
        for _ in range(2):
            page.evaluate(
                """() => document.querySelectorAll('whereabouts-settings details:not([open])')
                       .forEach((d) => { d.open = true; })"""
            )
            self._settle(page)

    def _shoot_open(self, page, name: str) -> None:
        size = page.viewport_size
        height = page.evaluate(
            """() => {
              const box = document.querySelector('.wap-seite.wap-einstellungen');
              return Math.ceil(box.getBoundingClientRect().top + box.scrollHeight);
            }"""
        )
        page.set_viewport_size({"width": size["width"], "height": max(size["height"], min(height, MAX_OPEN_HEIGHT))})
        self._settle(page)
        page.evaluate("() => { const b = document.querySelector('.wap-seite.wap-einstellungen'); b.scrollTop = 0; }")
        self._shot(page, name)
        page.set_viewport_size(size)

    def _heat_pixels(self, page) -> int:
        """Number of painted pixels in the heatmap canvas (0 = empty or missing)."""
        return page.evaluate(
            """() => {
              const c = document.querySelector('whereabouts-history-card canvas.leaflet-heatmap-layer');
              if (!c || !c.width || !c.height) return 0;
              const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
              let n = 0;
              for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
              return n;
            }"""
        )

    def _view(self, page) -> dict:
        return page.evaluate(
            """() => {
              const m = document.querySelector('whereabouts-history-card')._map;
              const c = m.getCenter();
              return { lat: Math.round(c.lat * 1e5) / 1e5, lon: Math.round(c.lng * 1e5) / 1e5, zoom: m.getZoom() };
            }"""
        )

    def _check_heat(self, page, name: str) -> None:
        """The heatmap must be drawn (0.7.5 broke it unnoticed), in both colour modes, and switching
        between route and heatmap must keep zoom and position (0.7.10)."""

        def fail(text: str) -> None:
            self._note("heatcheck", f"{name}: {text}")

        def settle() -> None:
            page.wait_for_timeout(700)

        card = "whereabouts-history-card"
        page.click(f"{card} .modus .segment[data-modus=heat]")
        try:
            page.wait_for_selector(f"{card} canvas.leaflet-heatmap-layer", state="attached", timeout=10000)
        except PlaywrightError:
            fail("no heatmap canvas after switching to the heatmap")
            return
        settle()
        if not self._heat_pixels(page):
            fail("heatmap is empty (default: total per place off)")
        # switches in the legend: logarithmic colours on, by visits on, then back off
        for selector, label in ((".heatLog", "total per place"), (".nachBesuchen", "by visits")):
            page.click(f"{card} {selector}")
            settle()
            if not self._heat_pixels(page):
                fail(f"heatmap is empty with the switch '{label}' on")
        for selector in (".heatLog", ".nachBesuchen"):
            page.click(f"{card} {selector}")
        settle()
        # zoom and position stay when switching: move the map, go to the route and back
        page.evaluate(
            """() => {
              const m = document.querySelector('whereabouts-history-card')._map;
              const c = m.getCenter();
              m.setView([c.lat + 0.004, c.lng + 0.006], Math.max(m.getZoom() - 1, 3), { animate: false });
            }"""
        )
        settle()
        before = self._view(page)
        for mode in ("route", "heat", "route"):
            page.click(f"{card} .modus .segment[data-modus={mode}]")
            settle()
            after = self._view(page)
            if after != before:
                fail(f"switching to {mode} moved the map: {before} -> {after}")
        if self._heat_pixels(page):
            fail("the heatmap is still drawn in route mode")

    def _check_tasks(self, device: str, theme: str) -> None:
        """Group "Open tasks" (0.7.10): a running job with progress and "Cancel", the offer to import
        from the recorder, the open points."""
        name = f"settings-tasks_{device}_{theme}"
        self.current = name
        context = self._context(device, theme)
        page = context.new_page()
        self._wire(page)

        def fail(text: str) -> None:
            self._note("taskscheck", f"{name}: {text}")

        try:
            self._load(page, "settings", theme, "&tasks=job")
            root = "whereabouts-settings .aufgaben"
            try:
                page.wait_for_selector(f"{root} .job-lauf progress", state="visible", timeout=10000)
            except PlaywrightError:
                fail("no running job with a progress bar under 'Open tasks'")
                return
            if not page.query_selector(f"{root} .aufgabe-offen"):
                fail("no open point listed (missing addresses)")
            if not page.query_selector(f"{root} .adressauftrag progress"):
                fail("the progress of the address lookup is not shown under 'Open tasks'")
            page.evaluate("() => document.querySelector('whereabouts-settings #kat-tasks').scrollIntoView()")
            self._settle(page)
            self._shot(page, name)
            page.click(f"{root} .job-lauf .abbrechen")
            try:
                page.wait_for_selector(f"{root} .job-fertig", state="visible", timeout=10000)
            except PlaywrightError:
                fail("cancelling the job did not show the end of the job")
            # the offer to import from the recorder comes once per opening of the page
            self._load(page, "settings", theme, "&tasks=offer")
            try:
                page.wait_for_selector("whereabouts-settings .dialog", state="visible", timeout=10000)
            except PlaywrightError:
                fail("the offer to import from the recorder did not appear")
                return
            page.click("whereabouts-settings .dialog [data-wahl=cancel]")
            page.wait_for_selector("whereabouts-settings .dialog", state="detached", timeout=10000)
            if not page.query_selector(f"{root} [data-aufgabe=recorder]"):
                fail("the offer is not listed under 'Open tasks' after 'Later'")
        except PlaywrightError as err:
            self._note("harness", f"{name}: {str(err).splitlines()[0]}")
        finally:
            context.close()
        print(f"  {name}", flush=True)

    def run(self, only: str | None = None) -> int:
        count = 0
        for device in DEVICES:
            for theme in THEMES:
                for view in VIEWS:
                    name = f"{view}_{device}_{theme}"
                    open_name = f"{view}-open_{device}_{theme}"
                    if only and only not in (name, open_name):
                        continue
                    context = self._context(device, theme)
                    page = context.new_page()
                    self._wire(page)
                    try:
                        self.current = name
                        self._load(page, view, theme)
                        if not only or only == name:
                            self._shot(page, name)
                            count += 1
                        if view == "history" and (not only or only == name):
                            self._check_heat(page, name)
                        if view == "settings" and (not only or only == open_name):
                            self.current = open_name
                            self._open_all(page)
                            self._shoot_open(page, open_name)
                            count += 1
                    except PlaywrightError as err:
                        self._note("harness", str(err).splitlines()[0])
                        try:
                            self._shot(page, self.current)
                        except PlaywrightError:
                            pass
                    finally:
                        context.close()
                    print(f"  {name}", flush=True)
        for device, theme in (("pc", "light"), ("phone", "dark")):
            if not only or only == f"settings-tasks_{device}_{theme}":
                self._check_tasks(device, theme)
                count += 1
        return count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=str(HERE / "out"), help="folder for the screenshots (default tests/ui/out)")
    parser.add_argument("--chrome", help="use this Chrome/Chromium executable instead of Playwright's")
    parser.add_argument("--lang", default="de", choices=["de", "en"])
    parser.add_argument("--only", help="only this shot, e.g. settings-open_pc_dark")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    port = free_port()
    server = start_server(port)
    started = time.monotonic()
    try:
        with sync_playwright() as p:
            options = {"executable_path": args.chrome} if args.chrome else {}
            browser = p.chromium.launch(**options)
            shooter = Shooter(browser, f"http://localhost:{port}/tests/ui/index.html", out, args.lang)
            count = shooter.run(args.only)
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)
    errors = shooter.errors
    (out / "errors.json").write_text(json.dumps(errors, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    failing = [e for e in errors if e["kind"] != "warning"]
    print(
        f"{count} screenshots in {out} ({time.monotonic() - started:.0f} s), {len(failing)} errors, "
        f"{len(errors) - len(failing)} warnings"
    )
    for e in errors:
        print(f"  [{e['kind']}] {e['shot']}: {e['text'].splitlines()[0] if e['text'] else ''}")
    return 1 if failing else 0


if __name__ == "__main__":
    sys.exit(main())
