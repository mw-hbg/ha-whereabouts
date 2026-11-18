"""Importing a history file - used by the settings page and the options dialog."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .geo import zone_in_snapshot, zone_snapshot
from .importer import ImportError_, read_import, summarize
from .logger import person_key


async def import_bytes(
    hass: HomeAssistant,
    filename: str,
    data: bytes,
    target: str | None,
    replace: bool,
    same_place_distance: float,
    preview: bool = False,
    days: list[str] | None = None,
) -> dict:
    """Read a file and store its points (or only plan it with preview=True).

    Without ``replace`` the file is merged: only entries that fall into gaps
    of stored days are added. ``days`` ("person|YYYY-MM-DD") limits the import
    to the days ticked in the preview.
    """
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
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        raise ImportError_("not_set_up")
    mode = "replace" if replace else "merge"
    if preview:
        plan = []
        for dest, points in sorted(by_person.items()):
            for day in await hass.async_add_executor_job(runtime.storage.import_plan, dest, points, mode):
                plan.append({"person": dest, **day})
        return {
            "persons": sorted(by_person),
            "total": total,
            "days": day_count,
            "first": dates[0] if dates else "",
            "last": dates[-1] if dates else "",
            "mode": mode,
            "plan": plan,
        }

    added = skipped = day_total = 0
    for dest, points in by_person.items():
        wanted = None if days is None else [d.split("|", 1)[1] for d in days if d.split("|", 1)[0] == dest]
        outcome = await hass.async_add_executor_job(
            lambda dest=dest, points=points, wanted=wanted: runtime.storage.import_points(
                dest, points, replace, wanted, True
            )
        )
        added += outcome["added"]
        skipped += outcome["skipped"]
        day_total += outcome["days"]
    days = day_total
    await runtime.async_refresh_known(hass)
    return {
        "persons": sorted(by_person),
        "added": added,
        "skipped": skipped,
        "days": days,
        "total": total,
    }
