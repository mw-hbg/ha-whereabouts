"""Tiny static server for the UI test page (stdlib only).

    python tests/ui/serve.py [PORT]

Serves the repository like Home Assistant would serve the integration:
  /whereabouts_static/*  ->  custom_components/whereabouts/frontend/*
  /tests/ui/*            ->  tests/ui/*
  everything else        ->  the repository (e.g. /custom_components/whereabouts/manifest.json)
Open http://localhost:PORT/tests/ui/index.html?view=settings&theme=dark
"""

from __future__ import annotations

import http.server
import sys
from functools import partial
from pathlib import Path
from urllib.parse import unquote, urlsplit

REPO = Path(__file__).resolve().parents[2]
FRONTEND = REPO / "custom_components" / "whereabouts" / "frontend"
STATIC = "/whereabouts_static"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
    }

    def translate_path(self, path: str) -> str:
        clean = unquote(urlsplit(path).path)
        if clean == STATIC or clean.startswith(STATIC + "/"):
            root, rest = FRONTEND, clean[len(STATIC) :]
        else:
            root, rest = REPO, clean
        target = (root / rest.lstrip("/")).resolve()
        # never outside the served folder
        if root != target and root not in target.parents:
            return str(root / "__forbidden__")
        return str(target)

    def end_headers(self) -> None:
        # like Home Assistant (cache_headers=False): always fresh files
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - signature of the base class
        if "-v" in sys.argv:
            super().log_message(format, *args)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    port = int(args[0]) if args else 8765
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(REPO)))
    print(f"Serving {REPO} on http://localhost:{port}/tests/ui/index.html", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
