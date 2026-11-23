"""Reading location history files for the import.

Supported (see FORMAT.md):

- Whereabouts CSV (header ``person,date,start,end,state,latitude,longitude,address``,
  separator ``,`` or ``;``) - also what the export writes
- Daily files of the original pyscript version (``<person>_<YYYY-MM-DD>.csv``),
  single or as ZIP
- GPX (tracks, routes and waypoints with time stamps)

Pure Python, blocking - runs in the executor.
"""

from __future__ import annotations

import csv
import io
import os
import zipfile
from collections.abc import Callable, Iterable
from datetime import datetime, tzinfo
from xml.etree import ElementTree

from .storage import (
    STATE_NOT_HOME,
    Point,
    from_export_text,
    is_valid_date,
    is_valid_key,
    is_valid_time,
    to_float,
)

# Limits against oversized uploads (also inside ZIP files)
MAX_FILE_BYTES = 50 * 1024 * 1024
MAX_ZIP_ENTRIES = 20000
MAX_TOTAL_BYTES = 200 * 1024 * 1024

WHEREABOUTS_HEADER = ["person", "date", "start", "end", "state", "latitude", "longitude", "address"]

ZoneLookup = Callable[[float, float], str]


class ImportError_(ValueError):
    """The file cannot be imported. ``key`` is a translation key."""

    def __init__(self, key: str, detail: str = "") -> None:
        super().__init__(key)
        self.key = key
        self.detail = detail


def _decode(data: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ImportError_("unreadable")


def _legacy_name(name: str) -> tuple[str, str] | None:
    """('alex', '2026-06-24') for 'alex_2026-06-24.csv', else None."""
    base = os.path.basename(name)
    if not base.endswith(".csv") or "_" not in base:
        return None
    person, _, date = base[:-4].rpartition("_")
    if is_valid_key(person) and is_valid_date(date):
        return person, date
    return None


def parse_whereabouts_csv(text: str, zone_for: ZoneLookup | None = None) -> dict[str, list[Point]]:
    """Whereabouts exchange format -> {person: [points]}.

    An empty state or "not_home" gets the zone the point lies in (like GPX).
    """
    first_line = text.split("\n", 1)[0]
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    header = [h.strip().lower() for h in next(reader, [])]
    missing = [col for col in WHEREABOUTS_HEADER[:7] if col not in header]
    if missing:
        raise ImportError_("unknown_format", ", ".join(missing))
    col = {name: header.index(name) for name in WHEREABOUTS_HEADER if name in header}
    result: dict[str, list[Point]] = {}
    for row in reader:
        if not row or len(row) < len(col):
            continue
        values = {name: row[index].strip() for name, index in col.items() if index < len(row)}

        def get(name: str, values: dict = values) -> str:
            return values.get(name, "")

        person, date, start = get("person"), get("date"), get("start")
        if not (is_valid_key(person) and is_valid_date(date) and is_valid_time(start)):
            continue
        end = get("end")
        state = from_export_text(get("state")) or STATE_NOT_HOME
        lat, lon = to_float(get("latitude")), to_float(get("longitude"))
        if state == STATE_NOT_HOME and zone_for and lat is not None and lon is not None:
            state = zone_for(lat, lon) or STATE_NOT_HOME
        result.setdefault(person, []).append(
            Point(
                date=date,
                time=start,
                state=state,
                latitude=lat,
                longitude=lon,
                address=from_export_text(get("address")),
                end=end if is_valid_time(end) else "",
            )
        )
    return result


def parse_legacy_day(text: str, date: str) -> list[Point]:
    """One daily file of the original version (``start;state;lat;lon[;address[;end]]``)."""
    points = []
    for row in csv.reader(io.StringIO(text), delimiter=";"):
        if len(row) < 4 or not is_valid_time(row[0].strip()):
            continue
        end = row[5].strip() if len(row) > 5 else ""
        points.append(
            Point(
                date=date,
                time=row[0].strip(),
                state=row[1].strip() or STATE_NOT_HOME,
                latitude=to_float(row[2]),
                longitude=to_float(row[3]),
                address=row[4].strip() if len(row) > 4 else "",
                end=end if is_valid_time(end) else "",
            )
        )
    return points


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse_gpx(data: bytes, timezone: tzinfo, zone_for: ZoneLookup) -> list[Point]:
    """GPX track/route/waypoints -> points (merged into stays later by the rules).

    Each point gets the state it would have had: the zone it lies in (via
    ``zone_for``), otherwise ``not_home``. Points without a time are skipped.
    """
    try:
        root = ElementTree.fromstring(data)
    except ElementTree.ParseError as err:
        raise ImportError_("unreadable", str(err)) from err
    if _local_name(root.tag) != "gpx":
        raise ImportError_("unknown_format")

    raw: list[tuple[datetime, float, float]] = []
    for element in root.iter():
        if _local_name(element.tag) not in ("trkpt", "rtept", "wpt"):
            continue
        lat, lon = to_float(element.get("lat")), to_float(element.get("lon"))
        when = next((c.text for c in element if _local_name(c.tag) == "time" and c.text), None)
        if lat is None or lon is None or not when:
            continue
        try:
            stamp = datetime.fromisoformat(when.strip().replace("Z", "+00:00"))
        except ValueError:
            continue
        if stamp.tzinfo is None:
            stamp = stamp.replace(tzinfo=timezone)
        raw.append((stamp.astimezone(timezone), lat, lon))
    raw.sort(key=lambda item: item[0])

    return [
        Point(stamp.strftime("%Y-%m-%d"), stamp.strftime("%H:%M:%S"), zone_for(lat, lon), lat, lon)
        for stamp, lat, lon in raw
    ]


def read_import(
    filename: str,
    data: bytes,
    *,
    timezone: tzinfo,
    zone_for: ZoneLookup,
    same_place_distance: float = 0,
) -> dict[str, list[Point]]:
    """Any supported file -> {person key or "": [points]} (the rules are applied later).

    The key "" means: the file does not say whose history it is (GPX).
    """
    if len(data) > MAX_FILE_BYTES:
        raise ImportError_("too_large")
    lower = filename.lower()

    if lower.endswith(".zip") or data[:4] == b"PK\x03\x04":
        return _read_zip(data, timezone=timezone, zone_for=zone_for, same_place_distance=same_place_distance)
    if lower.endswith(".gpx") or data.lstrip()[:5] in (b"<?xml", b"<gpx "):
        return {"": parse_gpx(data, timezone, zone_for)}

    text = _decode(data)
    legacy = _legacy_name(filename)
    first = text.lstrip().split("\n", 1)[0].lower()
    if first.startswith("person"):
        return parse_whereabouts_csv(text, zone_for)
    if legacy:
        return {legacy[0]: parse_legacy_day(text, legacy[1])}
    raise ImportError_("unknown_format")


def _read_zip(data: bytes, **kwargs) -> dict[str, list[Point]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as err:
        raise ImportError_("unreadable", str(err)) from err
    infos = [i for i in archive.infolist() if not i.is_dir()]
    if len(infos) > MAX_ZIP_ENTRIES:
        raise ImportError_("too_large")
    if sum(i.file_size for i in infos) > MAX_TOTAL_BYTES:
        raise ImportError_("too_large")
    result: dict[str, list[Point]] = {}
    for info in infos:
        name = info.filename
        base = os.path.basename(name)
        # macOS adds "__MACOSX/._name" resource files and ".DS_Store"
        if base.startswith(".") or "__MACOSX" in name:
            continue
        if not base.lower().endswith((".csv", ".gpx")):
            continue
        if info.file_size > MAX_FILE_BYTES:
            raise ImportError_("too_large")
        for person, points in read_import(base, archive.read(info), **kwargs).items():
            result.setdefault(person, []).extend(points)
    return result


def summarize(points: Iterable[Point]) -> tuple[int, int]:
    """(number of points, number of days)."""
    points = list(points)
    return len(points), len({p.date for p in points})
