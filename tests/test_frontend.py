"""Frontend files: same texts in every language, valid JavaScript, nothing loaded from elsewhere."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

FRONTEND = Path(__file__).parent.parent / "custom_components" / "whereabouts" / "frontend"
LANGUAGES = sorted((FRONTEND / "i18n").glob("*.json"))
OWN_JS = sorted(p for p in FRONTEND.glob("*.js"))


@pytest.mark.parametrize("path", LANGUAGES, ids=lambda p: p.name)
def test_same_keys_and_placeholders(path: Path):
    english = json.loads((FRONTEND / "i18n" / "en.json").read_text(encoding="utf-8"))
    other = json.loads(path.read_text(encoding="utf-8"))
    assert set(other) == set(english)
    for key, text in english.items():
        assert set(re.findall(r"{\w+}", other[key])) == set(re.findall(r"{\w+}", text)), key


def test_every_used_key_exists():
    english = json.loads((FRONTEND / "i18n" / "en.json").read_text(encoding="utf-8"))
    used = set()
    for path in OWN_JS:
        used |= set(re.findall(r"\bt\('([a-z_]+)'", path.read_text(encoding="utf-8")))
        used |= set(re.findall(r"_t\('([a-z_]+)'", path.read_text(encoding="utf-8")))
    assert used, "no translation keys found"
    assert used <= set(english), sorted(used - set(english))


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
@pytest.mark.parametrize("path", OWN_JS, ids=lambda p: p.name)
def test_javascript_syntax(path: Path):
    result = subprocess.run(
        ["node", "--input-type=module", "--check"],
        input=path.read_text(encoding="utf-8"),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize("path", OWN_JS, ids=lambda p: p.name)
def test_no_code_from_other_servers(path: Path):
    """Leaflet is bundled; scripts and styles must never come from a CDN."""
    text = path.read_text(encoding="utf-8")
    assert not re.search(r"\.src\s*=\s*[\"'`]https?://", text)  # <script src>
    assert not re.search(r"<link[^>]*href=\"https?://", text)  # stylesheets
    assert not re.search(r"import\(\s*[\"'`]https?://", text)  # modules
    assert "cdnjs" not in text and "unpkg" not in text


def test_leaflet_is_the_released_file():
    """Same file as the official Leaflet 1.9.4 release (published SRI hash)."""
    import base64
    import hashlib

    digest = base64.b64encode(hashlib.sha384((FRONTEND / "leaflet" / "leaflet.js").read_bytes()).digest()).decode()
    assert digest == "cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH"
