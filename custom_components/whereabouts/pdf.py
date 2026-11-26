"""A small PDF writer (0.8.0) without extra packages: A4 pages with text, lines and areas.

The character widths are those of the Adobe Core14 font metrics (© Adobe Systems Incorporated).
Ported from the survey kit's ``PdfSeite`` / ``PdfDok.bauen()``: the standard fonts
Helvetica and Helvetica-Bold with WinAnsi encoding (all German characters, the text
can be selected and searched), the page contents compressed with zlib (FlateDecode).
Coordinates are points from the top left corner.
"""

from __future__ import annotations

import unicodedata
import zlib
from datetime import datetime

PAGE_WIDTH, PAGE_HEIGHT = 595.28, 841.89  # A4

# Widths of the characters 32-255 (WinAnsi) in 1/1000 of the font size (Adobe font metrics)
_W = (
    "278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,"
    "584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,"
    "667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,"
    "278,556,500,722,500,500,500,334,260,334,584,761,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,"
    "222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,"
    "333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,"
    "667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,"
    "556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500"
)
_BW = (
    "278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,"
    "584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,"
    "667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,"
    "333,611,556,778,556,556,500,389,280,389,584,761,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,"
    "278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,"
    "333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,"
    "667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,"
    "556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556"
)
WIDTHS = {False: [int(w) for w in _W.split(",")], True: [int(w) for w in _BW.split(",")]}


def _char(c: str) -> str:
    if ord(c) < 32:
        return " "
    try:
        c.encode("cp1252")
    except UnicodeEncodeError:
        # outside WinAnsi: the letter without its accent where there is one (ő -> o), else "?"
        base = unicodedata.normalize("NFKD", c)[:1]
        return base if base and base.isascii() else "?"
    return c


def win_ansi(text: str) -> bytes:
    """Text in WinAnsi (cp1252); other characters become their base letter or "?", control characters a space."""
    return "".join(_char(c) for c in str(text)).encode("cp1252", errors="replace")


def text_width(text: str, size: float, bold: bool = False) -> float:
    table = WIDTHS[bold]
    return sum(table[c - 32] if c >= 32 and table[c - 32] else 556 for c in win_ansi(text)) * size / 1000


def fit(text: str, width: float, size: float, bold: bool = False) -> str:
    """The text shortened with "…" so that it fits into ``width``."""
    text = str(text)
    if text_width(text, size, bold) <= width:
        return text
    while text and text_width(text + "…", size, bold) > width:
        text = text[:-1]
    return text.rstrip() + "…" if text else ""


def wrap(text: str, width: float, size: float, bold: bool = False) -> list[str]:
    """Lines of at most ``width`` (words that are too long are shortened)."""
    lines: list[str] = []
    for paragraph in str(text).split("\n"):
        line = ""
        for word in paragraph.split(" "):
            candidate = f"{line} {word}" if line else word
            if text_width(candidate, size, bold) <= width or not line:
                line = candidate
            else:
                lines.append(fit(line, width, size, bold))
                line = word
        lines.append(fit(line, width, size, bold))
    return lines


def _num(value: float) -> str:
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return text if text not in ("-0", "") else "0"


def _color(rgb: tuple[float, float, float]) -> str:
    return " ".join(_num(c) for c in rgb)


def _escape(data: bytes) -> bytes:
    return data.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


class PdfPage:
    def __init__(self) -> None:
        self.ops: list[bytes] = []

    def text(
        self,
        x: float,
        y: float,
        text: str,
        size: float = 10,
        bold: bool = False,
        align: str = "left",
        color: tuple[float, float, float] = (0, 0, 0),
    ) -> None:
        """Text with its baseline at ``y``."""
        width = text_width(text, size, bold)
        if align == "right":
            x -= width
        elif align == "center":
            x -= width / 2
        font = "F2" if bold else "F1"
        self.ops.append(
            f"BT {_color(color)} rg /{font} {_num(size)} Tf {_num(x)} {_num(PAGE_HEIGHT - y)} Td (".encode()
            + _escape(win_ansi(text))
            + b") Tj ET"
        )

    def rect(self, x: float, y: float, width: float, height: float, fill: tuple[float, float, float]) -> None:
        self.ops.append(
            f"{_color(fill)} rg {_num(x)} {_num(PAGE_HEIGHT - y - height)} {_num(width)} {_num(height)} re f".encode()
        )

    def line(self, x1: float, y1: float, x2: float, y2: float, color=(0.75, 0.75, 0.75), width: float = 0.5) -> None:
        self.ops.append(
            f"{_color(color)} RG {_num(width)} w {_num(x1)} {_num(PAGE_HEIGHT - y1)} m "
            f"{_num(x2)} {_num(PAGE_HEIGHT - y2)} l S".encode()
        )

    def content(self) -> bytes:
        return b"\n".join(self.ops)


class PdfDocument:
    def __init__(self) -> None:
        self.pages: list[PdfPage] = []

    def new_page(self) -> PdfPage:
        page = PdfPage()
        self.pages.append(page)
        return page

    def build(self, title: str, language: str = "en", now: datetime | None = None) -> bytes:
        parts: list[bytes] = []
        offsets: dict[int, int] = {}
        position = 0

        def add(data: bytes) -> None:
            nonlocal position
            parts.append(data)
            position += len(data)

        def obj(number: int, *content: bytes) -> None:
            offsets[number] = position
            add(f"{number} 0 obj\n".encode())
            for item in content:
                add(item)
            add(b"\nendobj\n")

        def stream(number: int, data: bytes) -> None:
            packed = zlib.compress(data, 6)
            obj(number, f"<< /Filter /FlateDecode /Length {len(packed)} >>\nstream\n".encode(), packed, b"\nendstream")

        catalog, pages, info, font, bold = 1, 2, 3, 4, 5
        page_objects = [(6 + 2 * i, 7 + 2 * i) for i in range(len(self.pages))]
        count = 6 + 2 * len(self.pages)
        title_hex = "FEFF" + "".join(f"{b:02X}" for b in title.encode("utf-16-be"))
        stamp = (now or datetime.now()).strftime("D:%Y%m%d%H%M%S")
        resources = f"<< /Font << /F1 {font} 0 R /F2 {bold} 0 R >> >>"
        lang = "de-DE" if language.startswith("de") else "en-GB" if language.startswith("en-GB") else "en-US"

        add(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        obj(catalog, f"<< /Type /Catalog /Pages {pages} 0 R /Lang ({lang}) >>".encode())
        kids = " ".join(f"{p} 0 R" for p, _ in page_objects)
        obj(pages, f"<< /Type /Pages /Count {len(self.pages)} /Kids [{kids}] >>".encode())
        obj(info, f"<< /Title <{title_hex}> /Producer (Whereabouts) /CreationDate ({stamp}) >>".encode())
        obj(font, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
        obj(bold, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
        for page, (number, contents) in zip(self.pages, page_objects, strict=True):
            obj(
                number,
                f"<< /Type /Page /Parent {pages} 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
                f"/Resources {resources} /Contents {contents} 0 R >>".encode(),
            )
            stream(contents, page.content())
        xref = position
        add(f"xref\n0 {count}\n0000000000 65535 f \n".encode())
        for number in range(1, count):
            add(f"{offsets[number]:010d} 00000 n \n".encode())
        add(f"trailer\n<< /Size {count} /Root {catalog} 0 R /Info {info} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
        return b"".join(parts)


__all__ = ["PAGE_HEIGHT", "PAGE_WIDTH", "PdfDocument", "PdfPage", "fit", "text_width", "wrap"]
