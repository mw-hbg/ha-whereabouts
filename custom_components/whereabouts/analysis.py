"""Evaluation of a place (0.8.0): the visits of persons within a circle.

A visit is a run of stays inside the circle; stays less than ``GAP_SECONDS`` apart
belong to the same visit (this joins the stays split at midnight and short GPS
jumps). Visits shorter than the minimum duration are passing through and are not
counted unless asked for. The visits are grouped by day, month or year: a visit
counts in the period it begins in, its duration is split at midnight.

The calculation runs month by month in the executor as its own small job per user
(not in the ``JobManager``: users without admin rights may evaluate the persons
they may see, and the evaluation reads only, it never blocks the data maintenance).
The result is kept in memory for ``KEEP_SECONDS``; after a restart it is gone.
"""

from __future__ import annotations

import asyncio
import logging
import math
import time
from dataclasses import dataclass, field
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from . import downloads
from .jobs import month_ranges
from .logger import person_key
from .storage import Stay, distance_m
from .timezones import moment

_LOGGER = logging.getLogger(__name__)

GAP_SECONDS = 15 * 60
MAX_DAYS = 3660  # about 10 years
MAX_PERSONS = 20
RADIUS_MIN, RADIUS_MAX = 25, 5000
MAX_MINUTES = 600
KEEP_SECONDS = 30 * 60
LIST_LIMIT = 500  # visits sent to the card (the files get all)
MAX_VISITS = 100_000
GROUPS = ("day", "month", "year")

RUNNING, DONE, CANCELLED, FAILED = "running", "done", "cancelled", "failed"


@dataclass
class Visit:
    """One visit of one person inside the circle."""

    person: str  # person.alex
    start_day: str
    start: str  # clock time as stored
    start_m: int
    end_day: str
    end: str
    end_m: int
    state: str = ""
    address: str = ""
    days: dict[str, int] = field(default_factory=dict)  # seconds per day

    @property
    def seconds(self) -> int:
        return sum(self.days.values())

    def as_dict(self) -> dict[str, Any]:
        return {
            "person": self.person,
            "date": self.start_day,
            "start": self.start[:5],
            "end_date": self.end_day,
            "end": self.end[:5],
            "seconds": self.seconds,
            "state": self.state,
            "address": self.address,
        }


def _known(value) -> bool:
    return isinstance(value, int | float) and math.isfinite(value)


class VisitBuilder:
    """Collects the visits of one person; stays are added in the order of time."""

    def __init__(self, person: str, latitude: float, longitude: float, radius: float, gap: int = GAP_SECONDS) -> None:
        self.person = person
        self.center = (latitude, longitude)
        self.radius = radius
        self.gap = gap
        self.open: Visit | None = None
        self.visits: list[Visit] = []

    def inside(self, stay: Stay) -> bool:
        return distance_m(self.center[0], self.center[1], stay.latitude, stay.longitude) <= self.radius

    def add(self, day: str, stay: Stay) -> None:
        if not _known(stay.latitude) or not _known(stay.longitude):
            return  # without a position nothing is known about this stay: it neither counts nor ends a visit
        if not self.inside(stay):
            self.close()
            return
        start_m = moment(day, stay.start, stay.offset)
        end_clock = stay.end or stay.start
        end_m = max(start_m, moment(day, end_clock, stay.end_offset or stay.offset))
        address = stay.address if stay.state == "not_home" else ""
        visit = self.open
        if visit is not None and start_m - visit.end_m <= self.gap:
            # the short pause counts as being there; overlapping stays are not counted twice
            visit.days[day] = visit.days.get(day, 0) + max(0, end_m - visit.end_m)
            if end_m > visit.end_m:
                visit.end_m, visit.end_day, visit.end = end_m, day, end_clock
            if not visit.address and address:
                visit.address = address
            if visit.state == "not_home" and stay.state != "not_home":
                visit.state = stay.state  # a zone names the place better than an address
            return
        self.close()
        self.open = Visit(
            self.person, day, stay.start, start_m, day, end_clock, end_m, stay.state, address, {day: end_m - start_m}
        )

    def close(self) -> None:
        if self.open is not None:
            self.visits.append(self.open)
            self.open = None


def counted(visits: list[Visit], min_seconds: int, count_short: bool) -> list[Visit]:
    """The visits that count: all when passing through counts, else only the long enough ones."""
    return list(visits) if count_short else [v for v in visits if v.seconds >= min_seconds]


def period_of(day: str, group: str) -> str:
    return day if group == "day" else day[:7] if group == "month" else day[:4]


def summarize(visits: list[Visit], group: str, persons: list[str]) -> dict[str, Any]:
    """Table rows per (period, person) and totals per person."""
    order = {p: i for i, p in enumerate(persons)}
    rows: dict[tuple[str, str], dict[str, Any]] = {}
    totals: dict[str, dict[str, Any]] = {}

    def row(key: tuple[str, str]) -> dict[str, Any]:
        if key not in rows:
            rows[key] = {"period": key[0], "person": key[1], "visits": 0, "days": set(), "seconds": 0, "longest": 0}
        return rows[key]

    for visit in visits:
        seconds = visit.seconds
        first = row((period_of(visit.start_day, group), visit.person))
        first["visits"] += 1
        first["longest"] = max(first["longest"], seconds)
        for day, part in visit.days.items():
            entry = row((period_of(day, group), visit.person))
            entry["seconds"] += part
            entry["days"].add(day)
        total = totals.setdefault(
            visit.person, {"person": visit.person, "visits": 0, "days": set(), "seconds": 0, "longest": 0}
        )
        total["visits"] += 1
        total["seconds"] += seconds
        total["longest"] = max(total["longest"], seconds)
        total["days"].update(visit.days)

    def done(entry: dict[str, Any]) -> dict[str, Any]:
        return {**entry, "days": len(entry["days"])}

    ordered = sorted(rows.values(), key=lambda r: (r["period"], order.get(r["person"], 99)))
    return {
        "group": group,
        "rows": [done(r) for r in ordered],
        "totals": [done(totals[p]) for p in persons if p in totals],
    }


@dataclass
class Run:
    """One evaluation of one user."""

    id: str
    params: dict[str, Any]
    status: str = RUNNING
    total: int = 0
    done: int = 0
    visits: list[Visit] = field(default_factory=list)
    truncated: bool = False
    finished: float = 0.0
    stamp: str = ""  # when the calculation ended (local time)
    cancel: bool = False
    task: asyncio.Task | None = None

    def status_dict(self) -> dict[str, Any]:
        return {"id": self.id, "status": self.status, "total": self.total, "done": self.done, "params": self.params}


class AnalysisManager:
    """At most one evaluation per user; results expire after ``KEEP_SECONDS``."""

    def __init__(self, hass: HomeAssistant, runtime) -> None:
        self.hass = hass
        self.runtime = runtime
        self._runs: dict[str, Run] = {}

    def _expire(self) -> None:
        now = time.monotonic()
        for user, run in list(self._runs.items()):
            if run.status != RUNNING and now - run.finished > KEEP_SECONDS:
                del self._runs[user]

    def get(self, user: str) -> Run | None:
        self._expire()
        return self._runs.get(user)

    async def async_start(self, user: str, params: dict[str, Any]) -> Run:
        """Start (a running evaluation of the same user is cancelled first)."""
        await self.async_cancel(user)
        run = Run(downloads.new_token(), dict(params))
        months = month_ranges(params["from"], params["to"])
        run.total = len(months)
        self._runs[user] = run
        run.task = self.hass.async_create_background_task(self._work(run, months), "whereabouts analysis")
        return run

    async def async_cancel(self, user: str) -> Run | None:
        run = self._runs.get(user)
        if run is None or run.status != RUNNING:
            return run
        run.cancel = True
        if run.task is not None:
            try:
                await asyncio.wait_for(asyncio.shield(run.task), timeout=10)
            except (TimeoutError, asyncio.CancelledError):
                run.task.cancel()
        if run.status == RUNNING:
            self._end(run, CANCELLED)
        return run

    async def async_stop(self) -> None:
        for user in list(self._runs):
            await self.async_cancel(user)
        self._runs.clear()

    @staticmethod
    def _end(run: Run, status: str) -> None:
        run.status = status
        run.finished = time.monotonic()

    async def _work(self, run: Run, months: list[tuple[str, str]]) -> None:
        params = run.params
        storage = self.runtime.storage
        builders = [
            VisitBuilder(p, params["latitude"], params["longitude"], params["radius"]) for p in params["persons"]
        ]

        def month(first: str, last: str) -> None:
            for builder in builders:
                for day, stay in storage.export_rows(person_key(builder.person), first, last):
                    builder.add(day, stay)

        try:
            for first, last in months:
                if run.cancel:
                    self._end(run, CANCELLED)
                    return
                await self.hass.async_add_executor_job(month, first, last)
                run.done += 1
            visits: list[Visit] = []
            for builder in builders:
                builder.close()
                visits.extend(builder.visits)
            visits = counted(visits, int(params["min_minutes"]) * 60, bool(params["count_short"]))
            visits.sort(key=lambda v: (v.start_m, v.person))
            if len(visits) > MAX_VISITS:
                visits, run.truncated = visits[:MAX_VISITS], True
            run.visits = visits
            run.stamp = dt_util.now().isoformat(timespec="minutes")
            self._end(run, DONE)
        except Exception:
            _LOGGER.exception("Whereabouts: evaluation failed")
            self._end(run, FAILED)

    def result(self, run: Run, group: str, limit: int = LIST_LIMIT) -> dict[str, Any]:
        answer = run.status_dict()
        if run.status == DONE:
            answer["table"] = summarize(run.visits, group, run.params["persons"])
            answer["visits"] = [v.as_dict() for v in run.visits[:limit]]
            answer["visit_count"] = len(run.visits)
            answer["truncated"] = run.truncated
            answer["stamp"] = run.stamp
        return answer


__all__ = ["AnalysisManager", "Visit", "VisitBuilder", "counted", "summarize"]
