"""All languages have the same keys and placeholders as English."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).parent.parent / "custom_components" / "whereabouts"
TRANSLATIONS = sorted((ROOT / "translations").glob("*.json"))


def _flatten(data: dict, prefix: str = "") -> dict[str, str]:
    result = {}
    for key, value in data.items():
        if isinstance(value, dict):
            result.update(_flatten(value, f"{prefix}{key}."))
        else:
            result[f"{prefix}{key}"] = value
    return result


def test_strings_equal_english():
    assert json.loads((ROOT / "strings.json").read_text()) == json.loads(
        (ROOT / "translations" / "en.json").read_text()
    )


@pytest.mark.parametrize("path", TRANSLATIONS, ids=lambda p: p.name)
def test_same_keys_and_placeholders(path: Path):
    english = _flatten(json.loads((ROOT / "translations" / "en.json").read_text()))
    other = _flatten(json.loads(path.read_text()))
    assert set(other) == set(english)
    for key, text in english.items():
        assert set(re.findall(r"{\w+}", other[key])) == set(re.findall(r"{\w+}", text)), key
