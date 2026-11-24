"""Time zones of stored times.

Pure Python (no Home Assistant imports); the place lookup is blocking and runs
in the executor.

- **UTC offset** (``+01:00``): stored with every time, so the hour that occurs
  twice when the clocks go back in autumn stays unambiguous. Times keep being
  the local time of Home Assistant, and a day stays Home Assistant's day.
- **Time zone of the place** (IANA name such as ``America/New_York``): looked
  up offline from the coordinates (tzfpy) and stored when it is not Home
  Assistant's own. The cards use it to show the local time on journeys.

Old rows without an offset get one from Home Assistant's time zone. In the
doubled hour the order of the rows decides: once a time lies before the one
before it, the clocks have gone back (winter time from there on).
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from datetime import date as date_type
from datetime import datetime, time, timedelta, timezone, tzinfo
from functools import lru_cache

try:  # offline lookup of the time zone of a place
    from tzfpy import get_tz as _get_tz
except ImportError:  # pragma: no cover - the requirement is installed by Home Assistant
    _get_tz = None

_OFFSET_RE = re.compile(r"^([+-])(\d{2}):?(\d{2})$")
_MAX_OFFSET = 14 * 3600


def format_offset(delta: timedelta | None) -> str:
    """timedelta -> ``+01:00`` (``""`` for None)."""
    if delta is None:
        return ""
    total = int(delta.total_seconds())
    sign = "-" if total < 0 else "+"
    total = abs(total)
    return f"{sign}{total // 3600:02d}:{total % 3600 // 60:02d}"


def parse_offset(text: object) -> int | None:
    """``+01:00`` / ``+0100`` / ``Z`` -> seconds east of UTC; None if not valid."""
    value = str(text or "").strip()
    if value in ("Z", "z"):
        return 0
    match = _OFFSET_RE.match(value)
    if not match:
        return None
    seconds = int(match.group(2)) * 3600 + int(match.group(3)) * 60
    if int(match.group(3)) >= 60 or seconds > _MAX_OFFSET:
        return None
    return -seconds if match.group(1) == "-" else seconds


def clean_offset(text: object) -> str:
    """A valid offset in the stored form (``+01:00``), otherwise ``""``."""
    seconds = parse_offset(text)
    return "" if seconds is None else format_offset(timedelta(seconds=seconds))


def seconds_of(clock: str) -> int:
    hours, minutes, seconds = (int(part) for part in clock.split(":"))
    return hours * 3600 + minutes * 60 + seconds


def moment(date: str, clock: str, offset: str = "") -> int:
    """Seconds since the epoch of a stored time; without offset: as if it were UTC.

    Within one day this orders correctly also in the doubled hour, as long as
    the rows of the day either all have an offset or none.
    """
    day = date_type.fromisoformat(date)
    base = (day.toordinal() - 719163) * 86400 + seconds_of(clock)
    shift = parse_offset(offset)
    return base - (shift or 0)


def _local(date: str, clock: str, zone: tzinfo, fold: int) -> datetime:
    return datetime.combine(date_type.fromisoformat(date), time.fromisoformat(clock), zone).replace(fold=fold)


def offset_at(date: str, clock: str, zone: tzinfo, fold: int = 0) -> str:
    return format_offset(_local(date, clock, zone, fold).utcoffset())


def to_zone(date: str, clock: str, offset: str, zone: tzinfo) -> tuple[str, str, str]:
    """A time with any UTC offset -> (date, time, offset) in ``zone`` (Home Assistant's)."""
    shift = parse_offset(offset)
    if shift is None:
        return date, clock, offset
    instant = datetime.combine(
        date_type.fromisoformat(date), time.fromisoformat(clock), timezone(timedelta(seconds=shift))
    )
    local = instant.astimezone(zone)
    return local.strftime("%Y-%m-%d"), local.strftime("%H:%M:%S"), format_offset(local.utcoffset())


def is_ambiguous(date: str, clock: str, zone: tzinfo) -> bool:
    """True in the hour that occurs twice (clocks going back; not the gap in spring)."""
    first, second = _local(date, clock, zone, 0).utcoffset(), _local(date, clock, zone, 1).utcoffset()
    return first is not None and second is not None and first > second


def resolve_offsets(date: str, items: Sequence[tuple[str, str]], zone: tzinfo) -> tuple[list[tuple[str, str]], int]:
    """(start, end) of one day in stored order -> (start offset, end offset) each.

    For rows without offsets. The end offset is only given when it differs
    from the start offset. Also returns how many times in the doubled hour
    had to be assumed to be summer time (nothing told the order).
    """
    window = doubled_hour(date, zone)
    result: list[tuple[str, str]] = []
    if window is None:
        for start, end in items:
            start_offset = offset_at(date, start, zone)
            end_offset = offset_at(date, end, zone) if end and end != start else ""
            result.append((start_offset, end_offset if end_offset != start_offset else ""))
        return result, 0
    low, high = window

    def inside(clock: str) -> bool:
        return low <= clock < high

    folded = False  # the clocks have gone back already
    latest = ""  # latest time seen before that
    assumed = 0
    for start, end in items:
        if inside(start):
            if not folded and latest and start < latest:
                folded = True
            if not folded:
                assumed += 1
        start_offset = offset_at(date, start, zone, 1 if folded and inside(start) else 0)
        end_offset = ""
        if end and end != start:
            if inside(end):
                summer = offset_at(date, end, zone, 0)
                winter = offset_at(date, end, zone, 1)
                if folded or moment(date, end, summer) < moment(date, start, start_offset):
                    end_offset = winter
                else:
                    end_offset = summer
                    assumed += 1
            else:
                end_offset = offset_at(date, end, zone, 0)
            if end_offset == start_offset:
                end_offset = ""
        result.append((start_offset, end_offset))
        last = max(start, end or start)
        if last >= high or (end and end < start):
            folded = True
        if not folded:
            latest = max(latest, last)
    return result, assumed


@lru_cache(maxsize=512)
def _doubled_hour(date: str, key: str, zone: tzinfo) -> tuple[str, str] | None:
    first = None
    last = None
    for minute in range(0, 24 * 60, 15):
        clock = f"{minute // 60:02d}:{minute % 60:02d}:00"
        if is_ambiguous(date, clock, zone):
            first = first or clock
            last = minute
    if first is None:
        return None
    end = last + 15
    return first, f"{end // 60:02d}:{end % 60:02d}:00"


def doubled_hour(date: str, zone: tzinfo) -> tuple[str, str] | None:
    """(from, to) local times that occur twice on ``date``, or None."""
    return _doubled_hour(date, str(zone), zone)


# --- time zone of a place -------------------------------------------------------------------------------------
@lru_cache(maxsize=8192)
def _zone_of(lat: float, lon: float) -> str:
    if _get_tz is None:
        return ""
    try:
        return _get_tz(lon, lat) or ""
    except Exception:  # noqa: BLE001 - an unknown place must never stop storing
        return ""


def place_zone(lat: object, lon: object) -> str:
    """IANA time zone at a point (``""`` when unknown). Rounded to ~100 m for the cache."""
    try:
        la, lo = float(lat), float(lon)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return ""
    if not (-90 <= la <= 90 and -180 <= lo <= 180):
        return ""
    return _zone_of(round(la, 3), round(lo, 3))


def foreign_zone(lat: object, lon: object, home: str) -> str:
    """The time zone of a place if it is not Home Assistant's (``home``), else ``""``."""
    found = place_zone(lat, lon)
    return "" if not found or found == home else found


def zone_name(zone: tzinfo | None) -> str:
    """IANA name of a tzinfo (``""`` for UTC-like or unknown)."""
    return str(getattr(zone, "key", "") or "")
