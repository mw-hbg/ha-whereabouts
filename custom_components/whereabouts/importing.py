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
) -> dict:
    """Read a file and store its points (or only count them with preview=True)."""
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
    if preview:
        return {
            "persons": sorted(by_person),
            "total": total,
            "days": day_count,
            "first": dates[0] if dates else "",
            "last": dates[-1] if dates else "",
        }

    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        raise ImportError_("not_set_up")
    added = skipped = days = 0
    for dest, points in by_person.items():
        outcome = await hass.async_add_executor_job(runtime.storage.import_points, dest, points, replace)
        added += outcome["added"]
        skipped += outcome["skipped"]
        days += outcome["days"]
    await runtime.async_refresh_known(hass)
    return {
        "persons": sorted(by_person),
        "added": added,
        "skipped": skipped,
        "days": days,
        "total": total,
    }
