"""Compare two folders of screenshots pixel by pixel (informational, always exit code 0).

    python tests/ui/compare.py --old DIR --new DIR --diff DIR

For every changed picture a diff image goes into --diff (unchanged pixels faded,
changed pixels red), plus report.md with changed / new / removed / unchanged.
With --errors (errors.json of shoot.py) the report also lists the JavaScript errors.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops

# per channel: smaller differences count as equal (anti-aliasing noise)
TOLERANCE = 8


def diff_image(old: Image.Image, new: Image.Image) -> tuple[int, Image.Image]:
    """Number of changed pixels and a picture showing them."""
    width, height = max(old.width, new.width), max(old.height, new.height)
    a = Image.new("RGB", (width, height), (255, 0, 255))
    b = Image.new("RGB", (width, height), (0, 255, 255))
    a.paste(old.convert("RGB"), (0, 0))
    b.paste(new.convert("RGB"), (0, 0))
    delta = ImageChops.difference(a, b).convert("L")
    mask = delta.point(lambda v: 255 if v > TOLERANCE else 0)
    changed = mask.histogram()[255]
    faded = Image.blend(b.convert("L").convert("RGB"), Image.new("RGB", (width, height), (255, 255, 255)), 0.7)
    red = Image.new("RGB", (width, height), (230, 0, 0))
    return changed, Image.composite(red, faded, mask)


def pngs(folder: Path | None) -> dict[str, Path]:
    if not folder or not folder.is_dir():
        return {}
    return {p.name: p for p in sorted(folder.glob("*.png"))}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--old", help="screenshots of the previous run (may be missing)")
    parser.add_argument("--new", required=True, help="screenshots of this run")
    parser.add_argument("--diff", required=True, help="output: diff images and report.md")
    parser.add_argument("--errors", help="errors.json written by shoot.py (listed in the report)")
    args = parser.parse_args()

    old = pngs(Path(args.old) if args.old else None)
    new = pngs(Path(args.new))
    out = Path(args.diff)
    out.mkdir(parents=True, exist_ok=True)

    lines = ["## UI screenshots", ""]
    if not old:
        lines += ["No previous shots to compare with.", "", f"{len(new)} screenshots taken."]
    else:
        changed, unchanged = [], []
        for name in sorted(set(old) & set(new)):
            with Image.open(old[name]) as a, Image.open(new[name]) as b:
                count, picture = diff_image(a, b)
                size_note = "" if a.size == b.size else f", size {a.width}×{a.height} → {b.width}×{b.height}"
            if count:
                picture.save(out / name)
                total = picture.width * picture.height
                changed.append(f"`{name}` – {count} px ({100 * count / total:.2f} %){size_note}")
            else:
                unchanged.append(name)
        added = sorted(set(new) - set(old))
        removed = sorted(set(old) - set(new))
        lines.append(
            f"Changed: {len(changed)} · new: {len(added)} · removed: {len(removed)} · unchanged: {len(unchanged)}"
        )
        for title, items in (
            ("Changed", changed),
            ("New", [f"`{n}`" for n in added]),
            ("Removed", [f"`{n}`" for n in removed]),
            ("Unchanged", [f"`{n}`" for n in unchanged]),
        ):
            if items:
                lines += ["", f"### {title}", ""] + [f"- {item}" for item in items]
    if args.errors:
        lines += ["", "### JavaScript errors", ""]
        path = Path(args.errors)
        errors = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None
        if errors is None:
            lines.append("errors.json missing – the screenshot run did not finish.")
        elif not errors:
            lines.append("None.")
        else:
            for e in errors:
                first = (e.get("text") or "").splitlines()[0][:300] if e.get("text") else ""
                lines.append(f"- **{e.get('kind')}** `{e.get('shot')}`: {first}")
    report = "\n".join(lines) + "\n"
    (out / "report.md").write_text(report, encoding="utf-8")
    print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
