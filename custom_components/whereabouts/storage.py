"""File storage for the location history.

Pure Python (no Home Assistant imports), all functions are blocking and are
called through the executor.

One CSV file per person and day: ``<person>_<YYYY-MM-DD>.csv``, separator
``;``, no header, one row per stay::

    start;state;latitude;longitude;address;end

- ``state`` is the person's state (``home``, ``not_home`` or a zone name).
- ``address`` is only filled when the person was away (``not_home``).
- ``end`` is the time the stay was last confirmed. Rows of older files may
  lack it; consecutive rows at the same place are merged when reading.

A stay is "the same place" when the state is equal AND, for ``not_home``,
the new point is less than ``same_place_distance`` metres from where the
stay began. Inside a zone the position does not matter.

The format is the one of the original pyscript version, so existing
archives can simply be imported.
"""

from __future__ import annotations

import csv
import io
import math
import os
import re
import threading
from collections.abc import Iterable
from dataclasses import dataclass, field

_KEY_RE = re.compile(r"^[a-z0-9_]{1,64}$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^\d{2}:\d{2}:\d{2}$")
_FILE_RE = re.compile(r"^([a-z0-9_]{1,64})_(\d{4}-\d{2}-\d{2})\.csv$")

STATE_NOT_HOME = "not_home"


def is_valid_key(value: str) -> bool:
    """Person keys and dates end up in file names: allow only safe values."""
    return isinstance(value, str) and bool(_KEY_RE.match(value))


def is_valid_date(value: str) -> bool:
    return isinstance(value, str) and bool(_DATE_RE.match(value))


def is_valid_time(value: str) -> bool:
    if not isinstance(value, str) or not _TIME_RE.match(value):
        return False
    hours, minutes, seconds = (int(part) for part in value.split(":"))
    return hours < 24 and minutes < 60 and seconds < 60


def clean_text(value: object) -> str:
    """Remove what would break a row: separator and line breaks."""
    text = "" if value is None else str(value)
    return text.replace(";", ",").replace("\r", " ").replace("\n", " ").strip()


def format_coordinate(value: float | None) -> str:
    """Coordinates with at most 7 decimals (~1 cm), without trailing zeros."""
    if value is None:
        return ""
    return f"{value:.7f}".rstrip("0").rstrip(".")


def to_float(value: object) -> float | None:
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres."""
    radius = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(min(1.0, a)))


def same_stay(
    state_a: str,
    lat_a: object,
    lon_a: object,
    state_b: str,
    lat_b: object,
    lon_b: object,
    same_place_distance: float,
) -> bool:
    """True if point b still belongs to the stay that began at point a."""
    if not state_a or state_a != state_b:
        return False
    if state_a != STATE_NOT_HOME:
        return True  # same zone, position inside it does not matter
    la, oa, lb, ob = to_float(lat_a), to_float(lon_a), to_float(lat_b), to_float(lon_b)
    if None in (la, oa, lb, ob):
        return False
    return distance_m(la, oa, lb, ob) < same_place_distance


@dataclass
class Stay:
    """One stay at one place, as shown in the cards."""

    start: str
    end: str
    state: str
    latitude: float
    longitude: float
    address: str = ""
    # Start times of all rows merged into this stay (needed for deleting)
    times: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "start": self.start,
            "end": self.end,
            "state": self.state,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "address": self.address,
            "times": list(self.times),
        }


@dataclass
class Point:
    """One row to store (also used by the importers)."""

    date: str
    time: str
    state: str
    latitude: float | None
    longitude: float | None
    address: str = ""
    end: str = ""


def build_stays(rows: Iterable[list[str]], same_place_distance: float) -> list[Stay]:
    """Merge consecutive rows at the same place into stays.

    Rows are sorted by time first: while a point waits for its address, a
    later point may be written before it.
    """
    stays: list[Stay] = []
    usable = sorted((r for r in rows if len(r) >= 4), key=lambda r: r[0].strip())
    for row in usable:
        start, state = row[0].strip(), row[1].strip()
        lat, lon = to_float(row[2]), to_float(row[3])
        if lat is None or lon is None or not is_valid_time(start):
            continue
        address = row[4].strip() if len(row) > 4 else ""
        end = row[5].strip() if len(row) > 5 and is_valid_time(row[5].strip()) else start
        if stays:
            last = stays[-1]
            if same_stay(last.state, last.latitude, last.longitude, state, lat, lon, same_place_distance):
                last.end = max(last.end, end)
                last.times.append(start)
                if not last.address and address:
                    last.address = address
                continue
        stays.append(Stay(start, max(start, end), state, lat, lon, address, [start]))
    return stays


class HistoryStorage:
    """All file access of the location history."""

    def __init__(self, folder: str, same_place_distance: float = 50) -> None:
        self.folder = folder
        self.same_place_distance = same_place_distance
        # One lock for all files: writes are rare and short.
        self._lock = threading.Lock()

    # --- paths ------------------------------------------------------------
    def path(self, person: str, date: str) -> str:
        if not is_valid_key(person) or not is_valid_date(date):
            raise ValueError("invalid person or date")
        return os.path.join(self.folder, f"{person}_{date}.csv")

    def _ensure_folder(self) -> None:
        os.makedirs(self.folder, mode=0o700, exist_ok=True)

    @staticmethod
    def _read_rows(path: str) -> list[list[str]]:
        try:
            with open(path, encoding="utf-8", newline="") as file:
                return [row for row in csv.reader(file, delimiter=";") if row]
        except FileNotFoundError:
            return []

    @staticmethod
    def _write_rows(path: str, rows: list[list[str]]) -> None:
        """Replace a file atomically; remove it when no row is left."""
        if not rows:
            if os.path.exists(path):
                os.remove(path)
            return
        temp = path + ".tmp"
        with open(temp, "w", encoding="utf-8", newline="") as file:
            for row in rows:
                file.write(";".join(clean_text(value) for value in row) + "\n")
        os.chmod(temp, 0o600)
        os.replace(temp, path)

    # --- writing ----------------------------------------------------------
    def needs_address(self, person: str, date: str, state: str, lat: float | None, lon: float | None) -> bool:
        """Whether a new point would need an address.

        Only for ``not_home`` and only if it starts a new stay or the current
        stay has none yet - saves geocoding requests.
        """
        if state != STATE_NOT_HOME:
            return False
        with self._lock:
            rows = self._read_rows(self.path(person, date))
        if not rows:
            return True
        last = rows[-1]
        if len(last) >= 4 and same_stay(last[1], last[2], last[3], state, lat, lon, self.same_place_distance):
            return not (len(last) > 4 and last[4].strip())
        return True

    def add_point(self, person: str, point: Point) -> str:
        """Extend the last stay or append a new row. Returns "extended" or "new"."""
        if not is_valid_time(point.time):
            raise ValueError("invalid time")
        path = self.path(person, point.date)
        lat, lon = format_coordinate(point.latitude), format_coordinate(point.longitude)
        state = clean_text(point.state)
        address = clean_text(point.address) if state == STATE_NOT_HOME else ""
        with self._lock:
            self._ensure_folder()
            rows = self._read_rows(path)
            if rows:
                last = rows[-1]
                if len(last) >= 4 and same_stay(last[1], last[2], last[3], state, lat, lon, self.same_place_distance):
                    while len(last) < 6:
                        last.append("")
                    if not last[4].strip() and address:
                        last[4] = address
                    last[5] = max(last[5].strip() or last[0], point.end or point.time)
                    last[0] = min(last[0], point.time)  # a late, earlier point
                    self._write_rows(path, rows)
                    return "extended"
            rows.append([point.time, state, lat, lon, address, point.end if point.end > point.time else ""])
            self._write_rows(path, rows)
            return "new"

    # --- reading ----------------------------------------------------------
    def read_day(self, person: str, date: str) -> list[Stay]:
        with self._lock:
            rows = self._read_rows(self.path(person, date))
        return build_stays(rows, self.same_place_distance)

    def list_files(self) -> list[tuple[str, str]]:
        """All (person, date) pairs that have a file, sorted."""
        try:
            names = os.listdir(self.folder)
        except FileNotFoundError:
            return []
        found = []
        for name in names:
            match = _FILE_RE.match(name)
            if match:
                found.append((match.group(1), match.group(2)))
        return sorted(found)

    def days(self, person: str, prefix: str = "") -> list[str]:
        """Dates with data for one person, optionally only those starting with prefix (e.g. "2026-10")."""
        return [d for p, d in self.list_files() if p == person and d.startswith(prefix)]

    # --- deleting ---------------------------------------------------------
    def delete_times(self, person: str, date: str, times: Iterable[str]) -> int:
        """Delete all rows whose start time is in ``times``."""
        wanted = {t for t in times if is_valid_time(t)}
        if not wanted:
            return 0
        path = self.path(person, date)
        with self._lock:
            rows = self._read_rows(path)
            keep = [row for row in rows if row[0].strip() not in wanted]
            deleted = len(rows) - len(keep)
            if deleted:
                self._write_rows(path, keep)
        return deleted

    def delete_before(self, date: str) -> int:
        """Remove all files of days before ``date`` (retention). Returns the number of files."""
        removed = 0
        with self._lock:
            for person, day in self.list_files():
                if day < date:
                    os.remove(self.path(person, day))
                    removed += 1
        return removed

    # --- import / export --------------------------------------------------
    def import_points(self, person: str, points: Iterable[Point], replace_days: bool = False) -> dict:
        """Store imported points.

        Existing rows with the same start time are kept (duplicates are
        skipped) unless ``replace_days`` is set: then each imported day
        replaces the stored day completely.
        """
        by_day: dict[str, list[Point]] = {}
        for point in points:
            if is_valid_date(point.date) and is_valid_time(point.time):
                by_day.setdefault(point.date, []).append(point)
        added = skipped = 0
        with self._lock:
            self._ensure_folder()
            for day, day_points in sorted(by_day.items()):
                path = self.path(person, day)
                rows = [] if replace_days else self._read_rows(path)
                existing = {row[0].strip() for row in rows}
                # Duplicates are only checked against what was stored before:
                # a file may legitimately contain two rows with the same second.
                for point in sorted(day_points, key=lambda p: p.time):
                    if point.time in existing:
                        skipped += 1
                        continue
                    rows.append(
                        [
                            point.time,
                            clean_text(point.state),
                            format_coordinate(point.latitude),
                            format_coordinate(point.longitude),
                            clean_text(point.address) if point.state == STATE_NOT_HOME else "",
                            point.end if point.end and point.end > point.time else "",
                        ]
                    )
                    added += 1
                rows.sort(key=lambda r: r[0].strip())
                self._write_rows(path, rows)
        return {"added": added, "skipped": skipped, "days": len(by_day)}

    def export_rows(self, person: str, date_from: str, date_to: str) -> list[tuple[str, Stay]]:
        """All stays of a person between two dates (inclusive)."""
        result = []
        for day in self.days(person):
            if date_from <= day <= date_to:
                result.extend((day, stay) for stay in self.read_day(person, day))
        return result


_FORMULA_START = ("=", "+", "@", "\t", "\r")


def _no_formula(text: str) -> str:
    """Spreadsheets run cells that start with "=" etc. as formulas - quote them."""
    return "'" + text if text.startswith(_FORMULA_START) else text


def from_export_text(text: str) -> str:
    """Undo _no_formula when importing."""
    return text[1:] if text.startswith("'") and text[1:].startswith(_FORMULA_START) else text


def export_csv(person: str, rows: list[tuple[str, Stay]]) -> str:
    """Whereabouts exchange format (see FORMAT.md), comma separated with header."""
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(["person", "date", "start", "end", "state", "latitude", "longitude", "address"])
    for day, stay in rows:
        writer.writerow(
            [
                person,
                day,
                stay.start,
                stay.end,
                _no_formula(stay.state),
                stay.latitude,
                stay.longitude,
                _no_formula(stay.address),
            ]
        )
    return out.getvalue()
