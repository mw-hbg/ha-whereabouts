"""Recording rules and zones applied to whole lists of points.

Pure Python (no Home Assistant imports): used by the import, by "Adapt data to
the recording rules" and by "Recalculate zones in the data".

The rules are the same the live recording follows (see logger.py):

- "Same place up to … m" (``same_place_distance``): consecutive points at the
  same place (same zone, or away and closer than the distance to where the
  stay began) become one stay; its end is the last point there.
- "Minimum interval" (``min_interval``, seconds): while somebody is away and
  moving, a new place is only stored when at least this much time has passed
  since the last stored point. A change of zone is always kept.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field, replace

from .storage import STATE_NOT_HOME, Point, distance_m, is_valid_time, point_end_key, point_key, same_stay, to_float

ZoneList = list[tuple[str, float, float, float]]  # (state name, latitude, longitude, radius)

# A stored zone is kept when the point lies this far outside its circle: Home
# Assistant also counts the GPS accuracy, which is not stored.
ZONE_TOLERANCE_M = 100.0

GONE = "__gone__"  # selection: states of zones that no longer exist


@dataclass
class DayStats:
    """What the rules do with one day."""

    points: int = 0  # before
    stays: int = 0  # after
    merged: int = 0  # joined into the stay before
    dropped: int = 0  # thinned out (minimum interval)

    def as_dict(self) -> dict:
        return {"points": self.points, "stays": self.stays, "merged": self.merged, "dropped": self.dropped}


def apply_rules(
    points: Iterable[Point], same_place_distance: float, min_interval: float
) -> tuple[list[Point], dict[str, DayStats]]:
    """Points of one person -> stays following the rules, plus what happened per day.

    Days are handled separately (a stay never crosses midnight). The input is
    not changed.
    """
    ordered = sorted(
        (p for p in points if is_valid_time(p.time)),
        key=lambda p: (p.date, point_key(p)),
    )
    result: list[Point] = []
    stats: dict[str, DayStats] = {}
    last_kept = 0  # seconds of the last point that counted as "stored"
    for point in ordered:
        day = stats.setdefault(point.date, DayStats())
        day.points += 1
        moment = point_key(point)
        last = result[-1] if result and result[-1].date == point.date else None
        if last is not None and same_stay(
            last.state, last.latitude, last.longitude, point.state, point.latitude, point.longitude, same_place_distance
        ):
            if point_end_key(point) > point_end_key(last):
                last.end = point.end or point.time
                last.end_offset = (point.end_offset or point.offset) if point.end else point.offset
            if not last.tz and point.tz:
                last.tz = point.tz
            if not last.address and point.address:
                last.address = point.address
            if (
                (last.latitude is None or last.longitude is None)
                and point.latitude is not None
                and point.longitude is not None
            ):
                # 0.7.2: a stay without position (old archive rows) takes the position of the entry,
                # so the time stays visible instead of vanishing into a row the cards hide
                last.latitude, last.longitude = point.latitude, point.longitude
            if moment - last_kept >= min_interval:
                last_kept = moment
            day.merged += 1
            continue
        if last is not None and point.state == last.state and moment - last_kept < min_interval:
            day.dropped += 1
            continue
        kept = replace(point)
        if kept.end and point_end_key(kept) <= point_key(kept):
            kept.end, kept.end_offset = "", ""
        result.append(kept)
        last_kept = moment
        day.stays += 1
    return result, stats


# --- zones --------------------------------------------------------------------------------------------------
def zone_at(zones: ZoneList, lat: float, lon: float) -> str:
    """Person state a point would have: "home", a zone name or "not_home".

    Like Home Assistant itself: the smallest zone containing the point wins.
    """
    best: tuple[float, str] | None = None
    for name, zlat, zlon, radius in zones:
        if distance_m(lat, lon, zlat, zlon) <= radius and (best is None or radius < best[0]):
            best = (radius, name)
    return best[1] if best else STATE_NOT_HOME


def zone_for_point(point: Point, zones: ZoneList, renames: dict[str, str] | None = None) -> str:
    """The state a stored point gets with today's zones.

    1. A renamed zone: the old name becomes the new one.
    2. The point lies in a zone (smallest wins): that zone.
    3. It was in a zone that still exists and lies just outside the circle
       (GPS accuracy): it stays there.
    4. Otherwise away ("not_home").
    Points without coordinates keep their (renamed) state.
    """
    state = (renames or {}).get(point.state, point.state)
    lat, lon = to_float(point.latitude), to_float(point.longitude)
    if lat is None or lon is None:
        return state
    found = zone_at(zones, lat, lon)
    if found != STATE_NOT_HOME:
        return found
    for name, zlat, zlon, radius in zones:
        if name == state and distance_m(lat, lon, zlat, zlon) <= radius + ZONE_TOLERANCE_M:
            return state
    return STATE_NOT_HOME


@dataclass
class ZoneStats:
    """What recalculating the zones changes."""

    checked: int = 0
    changed: int = 0
    need_address: int = 0  # became "not_home" without an address
    transitions: Counter = field(default_factory=Counter)  # (old, new) -> count

    def add(self, other: ZoneStats) -> None:
        self.checked += other.checked
        self.changed += other.changed
        self.need_address += other.need_address
        self.transitions.update(other.transitions)

    def as_dict(self, limit: int = 30) -> dict:
        return {
            "checked": self.checked,
            "changed": self.changed,
            "need_address": self.need_address,
            "transitions": [{"from": old, "to": new, "n": n} for (old, new), n in self.transitions.most_common(limit)],
        }


def recalculate_zones(
    points: list[Point],
    zones: ZoneList,
    renames: dict[str, str] | None = None,
    only: set[str] | None = None,
) -> tuple[list[Point], ZoneStats]:
    """New states for stored points (the list is changed in place and returned).

    ``only``: zone names (plus "not_home" and ``GONE``); a point changes only
    when its old or new state is one of them. None = all.
    """
    names = {name for name, *_ in zones}
    stats = ZoneStats()
    for point in points:
        stats.checked += 1
        new = zone_for_point(point, zones, renames)
        if new == point.state:
            continue
        if only is not None:
            old_key = point.state if point.state in names or point.state == STATE_NOT_HOME else GONE
            if old_key not in only and new not in only:
                continue
        stats.changed += 1
        stats.transitions[(point.state, new)] += 1
        if new != STATE_NOT_HOME:
            point.address = ""
        elif not point.address:
            stats.need_address += 1
        point.state = new
    return points, stats
