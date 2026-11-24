"""Importing a history file - used by the settings page and the options dialog."""

from __future__ import annotations

from datetime import timedelta

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .const import CONF_MIN_INTERVAL, CONF_RECORD_PERSONS, CONF_RETENTION_DAYS, DEFAULT_OPTIONS, DOMAIN, STATE_NOT_HOME
from .geo import zone_in_snapshot, zone_snapshot
from .importer import ImportError_, read_import, summarize
from .logger import person_key
from .rules import apply_rules
from .storage import complete_points


async def import_bytes(
    hass: HomeAssistant,
    filename: str,
    data: bytes,
    target: str | None,
    replace: bool,
    same_place_distance: float,
    preview: bool = False,
    days: list[str] | None = None,
    mode: str | None = None,
    day_edges: bool = False,
) -> dict:
    """Read a file and store its points (or only plan it with preview=True).

    The recording rules ("same place up to … m", minimum interval) are applied
    first: points at the same place become one stay, points closer in time than
    the minimum interval are thinned out - like the live recording does.

    ``mode``: "merge" (only entries that fall into gaps of stored days are
    added), "replace" (imported days replace stored days) or "skip" (days
    that already have data are left alone). Without it, ``replace`` decides
    between "replace" and "merge". ``days`` ("person|YYYY-MM-DD") limits the import
    to the days ticked in the preview. ``day_edges`` (0.7.1): afterwards close
    the gaps at the edges of the imported days and their neighbours (the place
    of the day before from 00:00, the last place until 23:59:59).
    """
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        raise ImportError_("not_set_up")
    options = runtime.options
    min_interval = float(options.get(CONF_MIN_INTERVAL) or DEFAULT_OPTIONS[CONF_MIN_INTERVAL])

    # Zones are read here (event loop); the importer runs in the executor.
    zones = zone_snapshot(hass)
    parsed = await hass.async_add_executor_job(
        lambda: read_import(
            filename,
            data,
            timezone=dt_util.get_default_time_zone(),
            zone_for=lambda lat, lon: zone_in_snapshot(zones, lat, lon),
            same_place_distance=same_place_distance,
        )
    )
    if not any(parsed.values()):
        raise ImportError_("no_points")

    # UTC offsets (where the file has none) and the time zone of every place
    def complete() -> None:
        for points in parsed.values():
            complete_points(points, runtime.storage.zone)

    await hass.async_add_executor_job(complete)

    # Whose history is it?
    by_person: dict[str, list] = {}
    for key, points in parsed.items():
        if target:
            dest = person_key(target)
        elif key:
            dest = key
        else:
            raise ImportError_("person_required")
        if hass.states.get(f"person.{dest}") is None:
            raise ImportError_("unknown_person", dest)
        by_person.setdefault(dest, []).extend(points)

    total, day_count = summarize(p for points in by_person.values() for p in points)
    dates = sorted({p.date for points in by_person.values() for p in points})

    # The recording rules, per person
    stats: dict[str, dict] = {}
    for dest in list(by_person):
        by_person[dest], stats[dest] = await hass.async_add_executor_job(
            apply_rules, by_person[dest], same_place_distance, min_interval
        )

    if mode not in ("merge", "replace", "skip"):
        mode = "replace" if replace else "merge"
    if preview:
        retention = int(options.get(CONF_RETENTION_DAYS) or 0)
        expired_before = (dt_util.now() - timedelta(days=retention)).strftime("%Y-%m-%d") if retention else ""
        recorded = {person_key(p) for p in options.get(CONF_RECORD_PERSONS) or []}
        plan = []
        for dest, points in sorted(by_person.items()):
            for day in await hass.async_add_executor_job(runtime.storage.import_plan, dest, points, mode):
                rules = stats[dest][day["date"]].as_dict()
                plan.append(
                    {
                        "person": dest,
                        **day,
                        **rules,
                        "expired": bool(expired_before and day["date"] < expired_before),
                    }
                )
        edges = {"starts": 0, "ends": 0, "days_changed": 0}
        if day_edges:
            for dest, points in by_person.items():
                found = await hass.async_add_executor_job(runtime.storage.edges_plan, dest, points, mode)
                for key in edges:
                    edges[key] += found[key]
        return {
            "persons": sorted(by_person),
            "total": total,
            "edges": edges,
            "days": day_count,
            "first": dates[0] if dates else "",
            "last": dates[-1] if dates else "",
            "mode": mode,
            "plan": plan,
            "stays": sum(len(points) for points in by_person.values()),
            "dropped": sum(s.dropped for per_day in stats.values() for s in per_day.values()),
            "merged": sum(s.merged for per_day in stats.values() for s in per_day.values()),
            "not_recorded": sorted(dest for dest in by_person if dest not in recorded),
            "retention_days": retention,
            "same_place_distance": same_place_distance,
            "min_interval": min_interval,
        }

    added = skipped = day_total = edges = 0
    for dest, points in by_person.items():
        wanted = None if days is None else [d.split("|", 1)[1] for d in days if d.split("|", 1)[0] == dest]
        outcome = await hass.async_add_executor_job(
            lambda dest=dest, points=points, wanted=wanted: runtime.storage.import_points(
                dest, points, mode == "replace", wanted, True, mode == "skip"
            )
        )
        added += outcome["added"]
        skipped += outcome["skipped"]
        day_total += outcome["days"]
        if day_edges:
            dates = runtime.storage.edge_dates(p.date for p in points if wanted is None or p.date in wanted)
            found = await hass.async_add_executor_job(runtime.storage.fill_edges, dest, dates)
            edges += found["starts"] + found["ends"]
    await runtime.async_refresh_known(hass, data_changed=True)

    # Imported stays away without an address: the page offers to look them up.
    chosen = None if days is None else {d for d in days}
    touched = [
        (dest, p.date)
        for dest, points in by_person.items()
        for p in points
        if chosen is None or f"{dest}|{p.date}" in chosen
    ]
    missing = sum(
        1
        for dest, points in by_person.items()
        for p in points
        if p.state == STATE_NOT_HOME
        and not p.address
        and p.latitude is not None
        and (chosen is None or f"{dest}|{p.date}" in chosen)
    )
    touched_dates = sorted({d for _, d in touched})
    return {
        "persons": sorted(by_person),
        "added": added,
        "skipped": skipped,
        "days": day_total,
        "total": total,
        "missing_addresses": missing,
        "edges": edges,
        "first": touched_dates[0] if touched_dates else "",
        "last": touched_dates[-1] if touched_dates else "",
    }
