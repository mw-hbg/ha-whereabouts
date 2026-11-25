"""File storage for the location history.

Pure Python (no Home Assistant imports), all functions are blocking and are
called through the executor.

One CSV file per person and day: ``<person>_<YYYY-MM-DD>.csv``, separator
``;``, no header, one row per stay::

    start;state;latitude;longitude;address;end;offset;end_offset;time_zone

- ``state`` is the person's state (``home``, ``not_home`` or a zone name).
- ``address`` is only filled when the person was away (``not_home``).
- ``end`` is the time the stay was last confirmed. Rows of older files may
  lack it; consecutive rows at the same place are merged when reading.
- ``offset`` (0.7): UTC offset of ``start`` (``+01:00``); ``end_offset`` only
  when the end has another one (the clocks changed during the stay);
  ``time_zone`` only when the place lies in another time zone than Home
  Assistant (see timezones.py). Rows without them are completed when read.
  Empty trailing columns are left out.

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
from dataclasses import dataclass, field, replace
from datetime import date as date_type
from datetime import timedelta, tzinfo

from .timezones import clean_offset, foreign_zone, moment, offset_at, resolve_offsets, to_zone

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
    """Remove what would break a row: separator, quotation marks and line breaks.

    Quotation marks go because a row is written by hand (``;`` joined) but read
    like CSV: an unclosed ``"`` at the start of a cell would swallow the rest of the file.
    """
    text = "" if value is None else str(value)
    return text.replace(";", ",").replace('"', "").replace("\r", " ").replace("\n", " ").strip()


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


# Columns of a stored row
START, STATE, LAT, LON, ADDRESS, END, OFFSET, END_OFFSET, ZONE = range(9)
COLUMNS = 9
_NO_DATE = "1970-01-01"


def _cell(row: list[str], index: int) -> str:
    return row[index].strip() if len(row) > index else ""


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
    offset: str = ""  # UTC offset of start
    end_offset: str = ""  # UTC offset of end
    tz: str = ""  # time zone of the place when it is not Home Assistant's
    start_key: int = 0  # moment of start/end (orders the doubled hour correctly)
    end_key: int = 0

    def as_dict(self) -> dict:
        return {
            "start": self.start,
            "end": self.end,
            "state": self.state,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "address": self.address,
            "times": list(self.times),
            "offset": self.offset,
            "end_offset": self.end_offset or self.offset,
            "tz": self.tz,
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
    offset: str = ""  # UTC offset of time ("" = unknown)
    end_offset: str = ""  # UTC offset of end ("" = like offset)
    tz: str = ""  # time zone of the place when it is not Home Assistant's


def point_key(point: Point) -> int:
    """Moment of a point's start (seconds; without offset as if it were UTC)."""
    return moment(point.date or _NO_DATE, point.time, point.offset)


def point_end_key(point: Point) -> int:
    """Moment of a point's end (its start when it has none)."""
    if not point.end:
        return point_key(point)
    return moment(point.date or _NO_DATE, point.end, point.end_offset or point.offset)


def parse_rows(date: str, rows: Iterable[list[str]], zone: tzinfo | None = None) -> tuple[list[Point], list[bool], int]:
    """Stored rows -> points in stored order, completed with offsets when ``zone`` is given.

    Also returns per point whether it had its own offset, and how many times
    of the doubled hour had to be assumed to be summer time.
    """
    usable = [r for r in rows if len(r) >= 4 and is_valid_time(r[START].strip())]
    points: list[Point] = []
    had: list[bool] = []
    for row in usable:
        end = _cell(row, END)
        points.append(
            Point(
                date=date,
                time=row[START].strip(),
                state=row[STATE].strip(),
                latitude=to_float(row[LAT]),
                longitude=to_float(row[LON]),
                address=_cell(row, ADDRESS),
                end=end if is_valid_time(end) else "",
                offset=clean_offset(_cell(row, OFFSET)),
                end_offset=clean_offset(_cell(row, END_OFFSET)),
                tz=_cell(row, ZONE),
            )
        )
        had.append(bool(points[-1].offset))
    assumed = 0
    if zone is not None and date and not all(had):
        resolved, assumed = resolve_offsets(date, [(p.time, p.end) for p in points], zone)
        for point, own, (offset, end_offset) in zip(points, had, resolved, strict=True):
            if not own:
                point.offset = offset
                if not point.end_offset:
                    point.end_offset = end_offset
    for point in points:
        if point.end and point_end_key(point) <= point_key(point):
            point.end, point.end_offset = "", ""
        if point.end_offset == point.offset:
            point.end_offset = ""
    return points, had, assumed


def rows_to_points(date: str, rows: Iterable[list[str]], zone: tzinfo | None = None) -> list[Point]:
    """Stored rows -> points sorted by their moment."""
    return sorted(parse_rows(date, rows, zone)[0], key=point_key)


def point_row(point: Point) -> list[str]:
    """A point as stored row (empty trailing columns after "end" left out)."""
    has_end = bool(point.end) and point_end_key(point) > point_key(point)
    end_offset = point.end_offset if has_end and point.end_offset != point.offset else ""
    row = [
        point.time,
        clean_text(point.state),
        format_coordinate(point.latitude),
        format_coordinate(point.longitude),
        clean_text(point.address) if point.state == STATE_NOT_HOME else "",
        point.end if has_end else "",
        clean_offset(point.offset),
        clean_offset(end_offset),
        clean_text(point.tz),
    ]
    while len(row) > END + 1 and not row[-1]:
        row.pop()
    return row


def build_stays(
    rows: Iterable[list[str]], same_place_distance: float, date: str = "", zone: tzinfo | None = None
) -> list[Stay]:
    """Merge consecutive rows at the same place into stays.

    Rows are sorted by their moment first: while a point waits for its
    address, a later point may be written before it.
    """
    stays: list[Stay] = []
    for point in rows_to_points(date or _NO_DATE, rows, zone):
        lat, lon = point.latitude, point.longitude
        if lat is None or lon is None:
            continue
        end_key = point_end_key(point)
        end_offset = (point.end_offset or point.offset) if point.end else point.offset
        if stays:
            last = stays[-1]
            if same_stay(last.state, last.latitude, last.longitude, point.state, lat, lon, same_place_distance):
                if end_key > last.end_key:
                    last.end, last.end_offset, last.end_key = point.end or point.time, end_offset, end_key
                last.times.append(point.time)
                if not last.address and point.address:
                    last.address = point.address
                if not last.tz and point.tz:
                    last.tz = point.tz
                continue
        stays.append(
            Stay(
                point.time,
                point.end or point.time,
                point.state,
                lat,
                lon,
                point.address,
                [point.time],
                point.offset,
                end_offset,
                point.tz,
                point_key(point),
                end_key,
            )
        )
    return stays


DAY_START, DAY_END = "00:00:00", "23:59:59"


def _next_date(date: str, days: int = 1) -> str:
    return (date_type.fromisoformat(date) + timedelta(days=days)).isoformat()


def _to_home_time(point: Point, zone: tzinfo) -> list[Point]:
    """A time with another UTC offset (e.g. recorded abroad) -> Home Assistant's time and day.

    A stay that crosses Home Assistant's midnight after the conversion is
    split: it ends at 23:59:59 and goes on at 00:00:00 of the next day.
    """
    end_offset = point.end_offset or point.offset
    date, clock, offset = to_zone(point.date, point.time, point.offset, zone)
    if not (point.end and is_valid_time(point.end)):
        point.date, point.time, point.offset = date, clock, offset
        return [point]
    end_date, end, end_offset = to_zone(point.date, point.end, end_offset, zone)
    spans: list[tuple[str, str, str, str, str]] = []  # date, start, offset, end, end offset
    while date < end_date and len(spans) < 400:
        spans.append((date, clock, offset, DAY_END, offset_at(date, DAY_END, zone)))
        date, clock = _next_date(date), DAY_START
        offset = offset_at(date, clock, zone)
    if not (spans and end == DAY_START):  # ended exactly at midnight: nothing left of the last day
        spans.append((date, clock, offset, end, end_offset))
    pieces = [point] + [replace(point) for _ in spans[1:]]
    for piece, (day, start, start_offset, stop, stop_offset) in zip(pieces, spans, strict=True):
        piece.date, piece.time, piece.offset = day, start, start_offset
        piece.end, piece.end_offset = stop, (stop_offset if stop_offset != start_offset else "")
    return pieces


def complete_points(points: list[Point], zone: tzinfo | None) -> int:
    """Imported points (in file order): missing offsets and the time zone of the place.

    Times with an offset are converted to Home Assistant's time (and day),
    stays over Home Assistant's midnight are split (``points`` is changed in
    place); offsets missing in the file come from Home Assistant's time zone
    (the order decides the doubled hour); the time zone always comes from the
    coordinates. Returns how many times were assumed to be summer time.
    """
    home = str(getattr(zone, "key", "") or "")
    assumed = 0
    result: list[Point] = []
    by_day: dict[str, list[Point]] = {}
    for point in points:
        if not (is_valid_date(point.date) and is_valid_time(point.time)):
            result.append(point)
            continue
        pieces = _to_home_time(point, zone) if zone is not None and point.offset else [point]
        for piece in pieces:
            result.append(piece)
            by_day.setdefault(piece.date, []).append(piece)
    points[:] = result
    for date, day in by_day.items():
        if zone is not None and not all(p.offset for p in day):
            resolved, guessed = resolve_offsets(date, [(p.time, p.end) for p in day], zone)
            assumed += guessed
            for point, (offset, end_offset) in zip(day, resolved, strict=True):
                if not point.offset:
                    point.offset = offset
                    if not point.end_offset:
                        point.end_offset = end_offset
        for point in day:
            point.tz = foreign_zone(point.latitude, point.longitude, home)
    return assumed


def fill_day_edges(
    date: str,
    points: list[Point],
    before: list[Point] | None,
    after_exists: bool,
    zone: tzinfo | None,
    same_place_distance: float,
) -> tuple[list[Point] | None, int, int]:
    """Close the gaps at the edges of a day (0.7.1).

    - Start: when the day does not begin at 00:00:00 and the day before is
      stored, the last place of the day before is added from 00:00:00 until
      the first entry (the first entry itself starts earlier when it is that
      same place).
    - End: when the last stay ends before 23:59:59 and the next day is
      stored, it is extended to 23:59:59.

    ``points`` is not changed. Returns (new points or None, starts, ends).
    """
    if not points:
        return None, 0, 0
    day = sorted((replace(p) for p in points), key=point_key)
    # Rows without coordinates are hidden everywhere (0.7.2): they neither block nor count here
    visible = [p for p in day if p.latitude is not None and p.longitude is not None]
    if not visible:
        return None, 0, 0
    starts = ends = 0
    usable = [p for p in (before or []) if p.latitude is not None and p.longitude is not None]
    first = visible[0]
    if usable and first.time != DAY_START:
        prev = max(usable, key=point_key)
        offset = offset_at(date, DAY_START, zone) if zone is not None else ""
        same = same_stay(
            prev.state, prev.latitude, prev.longitude, first.state, first.latitude, first.longitude, same_place_distance
        )
        if same:
            if not first.end:
                first.end, first.end_offset = first.time, first.offset
            first.time, first.offset = DAY_START, offset
        else:
            day.insert(
                0,
                Point(
                    date,
                    DAY_START,
                    prev.state,
                    prev.latitude,
                    prev.longitude,
                    prev.address if prev.state == STATE_NOT_HOME else "",
                    end=first.time,
                    offset=offset,
                    end_offset=first.offset,
                    tz=prev.tz,
                ),
            )
        if first.end_offset == first.offset:
            first.end_offset = ""
        starts = 1
    if after_exists:
        last = visible[-1]
        end_offset = offset_at(date, DAY_END, zone) if zone is not None else ""
        if max(point_end_key(p) for p in visible) < moment(date, DAY_END, end_offset):
            last.end = DAY_END
            last.end_offset = end_offset if end_offset != last.offset else ""
            ends = 1
    for point in day:
        if point.end_offset == point.offset:
            point.end_offset = ""
    return (day if starts or ends else None), starts, ends


class HistoryStorage:
    """All file access of the location history."""

    def __init__(self, folder: str, same_place_distance: float = 50, zone: tzinfo | None = None) -> None:
        self.folder = folder
        self.same_place_distance = same_place_distance
        # Home Assistant's time zone: completes rows without offset (None in plain tests)
        self.zone = zone
        # One lock for all files: writes are rare and short.
        self._lock = threading.Lock()
        # The trash of the action running in this thread (see with_backup)
        self._local = threading.local()

    @property
    def zone_name(self) -> str:
        return str(getattr(self.zone, "key", "") or "")

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
                # QUOTE_NONE: a quotation mark in an old row must not swallow the rest of the file
                return [row for row in csv.reader(file, delimiter=";", quoting=csv.QUOTE_NONE) if row]
        except FileNotFoundError:
            return []

    def with_backup(self, backup, func, *args, **kwargs):
        """Run ``func`` so that every day file it writes is saved to ``backup`` first (0.7.3).

        Only writes of this thread are saved: the live recording goes on
        unaffected in other threads.
        """
        self._local.backup = backup
        try:
            return func(*args, **kwargs)
        finally:
            self._local.backup = None

    def locked(self, func, *args):
        """Run ``func`` with the storage lock held (restoring from the trash)."""
        with self._lock:
            return func(*args)

    def _write_rows(self, path: str, rows: list[list[str]]) -> None:
        """Replace a file atomically; remove it when no row is left."""
        backup = getattr(self._local, "backup", None)
        if backup is not None:
            backup.save(path)
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

    def complete(self, point: Point) -> Point:
        """Offset from Home Assistant's time zone when the point has none."""
        if not point.offset and self.zone is not None and is_valid_date(point.date) and is_valid_time(point.time):
            point.offset = offset_at(point.date, point.time, self.zone)
        return point

    def rows_to_points(self, date: str, rows: list[list[str]]) -> list[Point]:
        return rows_to_points(date, rows, self.zone)

    def _write_points(self, path: str, points: Iterable[Point]) -> None:
        self._write_rows(path, [point_row(p) for p in sorted(points, key=point_key)])

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
        point = self.complete(point)
        lat, lon = format_coordinate(point.latitude), format_coordinate(point.longitude)
        state = clean_text(point.state)
        with self._lock:
            self._ensure_folder()
            rows = self._read_rows(path)
            if rows:
                last = rows[-1]
                if len(last) >= 4 and same_stay(last[1], last[2], last[3], state, lat, lon, self.same_place_distance):
                    stored = parse_rows(point.date, [last], self.zone)[0]
                    if stored:
                        rows[-1] = point_row(self._extended(stored[0], point))
                        self._write_rows(path, rows)
                        return "extended"
            rows.append(point_row(point))
            self._write_rows(path, rows)
            return "new"

    @staticmethod
    def _extended(stay: Point, point: Point) -> Point:
        """The stored row ``stay`` extended by ``point`` (earlier start / later end)."""
        if not stay.address and point.state == STATE_NOT_HOME and point.address:
            stay.address = clean_text(point.address)
        end_time, end_offset = stay.end or stay.time, (stay.end_offset or stay.offset) if stay.end else stay.offset
        new_end = point.end or point.time
        new_end_offset = (point.end_offset or point.offset) if point.end else point.offset
        if moment(point.date, new_end, new_end_offset) > moment(stay.date, end_time, end_offset):
            end_time, end_offset = new_end, new_end_offset
        if point_key(point) < point_key(stay):  # a late, earlier point
            stay.time, stay.offset = point.time, point.offset
        stay.end, stay.end_offset = end_time, end_offset
        return stay

    # --- reading ----------------------------------------------------------
    def read_day(self, person: str, date: str) -> list[Stay]:
        with self._lock:
            rows = self._read_rows(self.path(person, date))
        return build_stays(rows, self.same_place_distance, date, self.zone)

    def current_stay_since(self, person: str, state: str, today: str, max_days: int = 60) -> str:
        """Start of the stay somebody is in right now, as time with UTC offset ("" = not known) - 0.7.5.

        Days are closed at 23:59:59 and go on at 00:00:00, so the start is searched
        backwards over the day limits as long as the same place goes on. Only when
        the last stored stay is the current state (the recording may be a moment behind).
        """
        stays = self.read_day(person, today)
        if not stays or stays[-1].state != state:
            return ""
        day, start = today, stays[-1]
        for _ in range(max_days):
            if start is not stays[0] or start.start != DAY_START:
                break
            before = _next_date(day, -1)
            earlier = self.read_day(person, before)
            if not earlier:
                break
            last = earlier[-1]
            if not same_stay(
                last.state,
                last.latitude,
                last.longitude,
                start.state,
                start.latitude,
                start.longitude,
                self.same_place_distance,
            ):
                break
            day, start, stays = before, last, earlier
        return f"{day}T{start.start}{start.offset}" if start.offset else ""

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
        backup = getattr(self._local, "backup", None)
        with self._lock:
            for person, day in self.list_files():
                if day < date:
                    path = self.path(person, day)
                    if backup is not None:
                        backup.save(path)  # 0.7.5: the automatic deletion goes to the trash, too
                    os.remove(path)
                    removed += 1
        return removed

    # --- whole days (rules, zones, addresses, time zones) -------------------
    def read_points(self, person: str, date: str) -> list[Point]:
        """The stored rows of one day as points (sorted by time)."""
        with self._lock:
            rows = self._read_rows(self.path(person, date))
        return self.rows_to_points(date, rows)

    def transform_day(self, person: str, date: str, change, write: bool = True):
        """Read a day, let ``change(points)`` return ``(new points or None, result)``, write it.

        Runs under the storage lock, so no point recorded meanwhile gets lost.
        ``None`` (or ``write=False``) leaves the file as it is. Returns ``result``.
        """
        path = self.path(person, date)
        with self._lock:
            rows = self._read_rows(path)
            if not rows:
                return change([])[1]
            new, result = change(self.rows_to_points(date, rows))
            if write and new is not None:
                self._write_points(path, new)
        return result

    def fill_time_zones(self, person: str, date: str, write: bool = True) -> dict[str, int]:
        """Add missing UTC offsets and time zones of places to one stored day.

        Returns the rows, how many got an offset, how many a time zone, and
        how many times of the doubled hour were assumed to be summer time.
        """
        path = self.path(person, date)
        home = self.zone_name
        with self._lock:
            rows = self._read_rows(path)
            points, had, assumed = parse_rows(date, rows, self.zone)
            offsets = sum(1 for own in had if not own) if self.zone is not None else 0
            zones = 0
            for point in points:
                if point.tz:
                    continue
                found = foreign_zone(point.latitude, point.longitude, home)
                if found:
                    point.tz = found
                    zones += 1
            if write and (offsets or zones):
                self._write_points(path, points)
        return {"rows": len(points), "offsets": offsets, "zones": zones, "assumed": assumed if offsets else 0}

    def set_addresses(self, person: str, date: str, addresses: dict[str, str]) -> int:
        """Fill the empty address of away rows ({start time: address}). Returns how many."""
        path = self.path(person, date)
        filled = 0
        with self._lock:
            rows = self._read_rows(path)
            for row in rows:
                address = addresses.get(row[0].strip()) if len(row) >= 4 else None
                if not address or row[1].strip() != STATE_NOT_HOME:
                    continue
                while len(row) < 6:
                    row.append("")
                if not row[4].strip():
                    row[4] = clean_text(address)
                    filled += 1
            if filled:
                self._write_rows(path, rows)
        return filled

    def files_in(self, persons: Iterable[str] | None, date_from: str = "", date_to: str = "") -> list[tuple[str, str]]:
        """(person, date) of the stored days within a selection (empty = everything)."""
        wanted = set(persons) if persons is not None else None
        return [
            (p, d)
            for p, d in self.list_files()
            if (wanted is None or p in wanted) and (not date_from or d >= date_from) and (not date_to or d <= date_to)
        ]

    # --- import / export --------------------------------------------------
    def _by_day(self, points: Iterable[Point]) -> dict[str, list[Point]]:
        by_day: dict[str, list[Point]] = {}
        for point in points:
            if is_valid_date(point.date) and is_valid_time(point.time):
                by_day.setdefault(point.date, []).append(self.complete(point))
        return by_day

    def _gap_points(self, date: str, rows: list[list[str]], day_points: list[Point]) -> list[Point]:
        """Points of an imported day that fall into a gap of the stored day.

        A point is new when its time span (start to end) overlaps no stored
        stay - so nothing is stored twice and nothing stored is overwritten,
        even when the times of the file do not match to the second.
        """
        stays = build_stays(rows, self.same_place_distance, date, self.zone)
        spans = [(stay.start_key, stay.end_key) for stay in stays]
        new = []
        for point in sorted(day_points, key=point_key):
            start, end = point_key(point), max(point_key(point), point_end_key(point))
            if any(start <= s_end and end >= s_start for s_start, s_end in spans):
                continue
            new.append(point)
        return new

    def import_plan(self, person: str, points: Iterable[Point], mode: str = "merge") -> list[dict]:
        """What an import would do, per day (nothing is written)."""
        plan = []
        with self._lock:
            for day, day_points in sorted(self._by_day(points).items()):
                rows = self._read_rows(self.path(person, day))
                existing = len(build_stays(rows, self.same_place_distance, day, self.zone))
                if mode == "replace" or not rows:
                    new = sorted(day_points, key=point_key)
                elif mode == "skip":
                    new = []
                else:
                    new = self._gap_points(day, rows, day_points)
                if not rows:
                    status = "new"
                elif mode == "replace":
                    status = "replace"
                elif mode == "skip":
                    status = "skip"
                else:
                    status = "add" if new else "complete"
                plan.append(
                    {
                        "date": day,
                        "existing": existing,
                        "new": len(new),
                        "status": status,
                        "entries": [
                            {
                                "start": p.time,
                                "end": p.end if p.end and point_end_key(p) > point_key(p) else p.time,
                                "state": clean_text(p.state),
                                "address": clean_text(p.address) if p.state == STATE_NOT_HOME else "",
                            }
                            for p in new[:200]
                        ],
                    }
                )
        return plan

    def import_points(
        self,
        person: str,
        points: Iterable[Point],
        replace_days: bool = False,
        days: Iterable[str] | None = None,
        merge: bool = True,
        skip_existing: bool = False,
    ) -> dict:
        """Store imported points.

        - ``replace_days``: each imported day replaces the stored day completely.
        - otherwise (``merge``): only points that fall into a gap of the stored
          day are added (see ``_gap_points``); with ``merge=False`` only rows
          with exactly the same start are skipped (older behaviour).
        - ``skip_existing``: days that already have data are left alone.
        - ``days``: only these dates are touched (from the preview).
        """
        wanted = set(days) if days is not None else None
        added = skipped = touched = 0
        with self._lock:
            self._ensure_folder()
            for day, day_points in sorted(self._by_day(points).items()):
                if wanted is not None and day not in wanted:
                    continue
                path = self.path(person, day)
                rows = [] if replace_days else self._read_rows(path)
                if rows and skip_existing:
                    skipped += len(day_points)
                    continue
                touched += 1
                if rows and merge:
                    keep = self._gap_points(day, rows, day_points)
                    skipped += len(day_points) - len(keep)
                    day_points = keep
                stored = self.rows_to_points(day, rows)
                existing = {point_key(p) for p in stored}
                # Duplicates are only checked against what was stored before:
                # a file may legitimately contain two rows with the same second.
                for point in sorted(day_points, key=point_key):
                    if point_key(point) in existing:
                        skipped += 1
                        continue
                    stored.append(point)
                    added += 1
                self._write_points(path, stored)
        return {"added": added, "skipped": skipped, "days": touched}

    # --- edges of days (0.7.1) ---------------------------------------------
    def _edges(self, person: str, dates: Iterable[str], days: dict[str, list[Point]] | None, write: bool) -> dict:
        """Close the gaps at the edges of ``dates`` (see ``fill_day_edges``).

        ``days`` overrides stored days (the preview of an import); with it
        nothing is ever written. Call with the lock held.
        """
        stored = set(self.days(person)) | set(days or {})
        cache: dict[str, list[Point]] = {}

        def points_of(day: str) -> list[Point]:
            if days is not None and day in days:
                return days[day]
            if day not in cache:
                if len(cache) > 8:
                    cache.clear()
                cache[day] = self.rows_to_points(day, self._read_rows(self.path(person, day)))
            return cache[day]

        result = {"days": 0, "days_changed": 0, "starts": 0, "ends": 0}
        for date in sorted(set(dates) & stored):
            result["days"] += 1
            prev = _next_date(date, -1)
            new, starts, ends = fill_day_edges(
                date,
                points_of(date),
                points_of(prev) if prev in stored else None,
                _next_date(date) in stored,
                self.zone,
                self.same_place_distance,
            )
            if new is None:
                continue
            result["days_changed"] += 1
            result["starts"] += starts
            result["ends"] += ends
            if write and days is None:
                self._write_points(self.path(person, date), new)
        return result

    def fill_edges(self, person: str, dates: Iterable[str], write: bool = True) -> dict:
        """Data maintenance and after an import: close the gaps at the edges of stored days."""
        with self._lock:
            return self._edges(person, dates, None, write)

    @staticmethod
    def edge_dates(dates: Iterable[str]) -> set[str]:
        """Days whose edges may change when ``dates`` change: they and their neighbours."""
        return {d for date in dates if is_valid_date(date) for d in (_next_date(date, -1), date, _next_date(date))}

    def edges_plan(
        self, person: str, points: Iterable[Point], mode: str = "merge", days: Iterable[str] | None = None
    ) -> dict:
        """How many edges an import would close (nothing is written)."""
        wanted = set(days) if days is not None else None
        result: dict[str, list[Point]] = {}
        with self._lock:
            for day, day_points in self._by_day(points).items():
                if wanted is not None and day not in wanted:
                    continue
                rows = self._read_rows(self.path(person, day))
                if mode == "replace" or not rows:
                    result[day] = list(day_points)
                    continue
                stored = self.rows_to_points(day, rows)
                if mode != "skip":
                    existing = {point_key(p) for p in stored}
                    stored += [p for p in self._gap_points(day, rows, day_points) if point_key(p) not in existing]
                result[day] = stored
            return self._edges(person, self.edge_dates(result), result, False)

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


EXPORT_HEADER = [
    "person",
    "date",
    "start",
    "end",
    "state",
    "latitude",
    "longitude",
    "address",
    "utc_offset",
    "end_utc_offset",
    "time_zone",
]


def export_csv(person: str, rows: list[tuple[str, Stay]]) -> str:
    """Whereabouts exchange format (see FORMAT.md), comma separated with header."""
    return export_csv_multi([(person, rows)])


def export_csv_multi(groups: list[tuple[str, list[tuple[str, Stay]]]]) -> str:
    """Several persons in one file (the column "person" tells them apart)."""
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(EXPORT_HEADER)
    rows = [(person, day, stay) for person, person_rows in groups for day, stay in person_rows]
    rows.sort(key=lambda r: (r[1], r[2].start_key, r[2].start, r[0]))
    for person, day, stay in rows:
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
                stay.offset,
                stay.end_offset if stay.end_offset != stay.offset else "",
                stay.tz,
            ]
        )
    return out.getvalue()
