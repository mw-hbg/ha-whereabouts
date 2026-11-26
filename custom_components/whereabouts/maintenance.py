"""Changing stored data: recording rules, zones, missing addresses.

WebSocket commands for administrators:

- whereabouts/maintenance/rules       adapt stored days to the recording rules
- whereabouts/maintenance/zones       recalculate the zones of stored entries
- whereabouts/maintenance/zone_ack    "don't ask again" for the current zone changes
- whereabouts/maintenance/timezones   add missing UTC offsets and time zones of places
- whereabouts/maintenance/day_edges   close the gaps at the start and end of stored days
- whereabouts/maintenance/positions   give rows without coordinates a position (0.7.2)
- whereabouts/addresses/status        state of the background job
- whereabouts/addresses/start         start it (or count what it would do)
- whereabouts/addresses/control       pause | resume | cancel | dismiss (hide a finished job)

Every command with ``preview: true`` only counts; without it the change is
made and cannot be undone.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import CONF_MIN_INTERVAL, CONF_SAME_PLACE_DISTANCE, DEFAULT_OPTIONS, DOMAIN
from .geo import zone_snapshot
from .journal_api import async_finish, async_logged
from .rules import DayStats, PositionStats, ZoneStats, apply_rules, fill_positions, recalculate_zones
from .storage import HistoryStorage

ZONES_STORE_KEY = "whereabouts.zones_seen"
ZONES_STORE_VERSION = 1

_PERSON = vol.Match(r"^person\.[a-z0-9_]{1,100}$")
_DATE = vol.Any("", vol.Match(r"^\d{4}-\d{2}-\d{2}$"))
_SCOPE = {
    vol.Required("persons"): vol.All([_PERSON], vol.Length(min=1, max=200)),
    vol.Optional("from", default=""): _DATE,
    vol.Optional("to", default=""): _DATE,
}


@callback
def async_register(hass: HomeAssistant) -> None:
    for command in (
        ws_rules,
        ws_zones,
        ws_zone_ack,
        ws_time_zones,
        ws_day_edges,
        ws_positions,
        ws_address_status,
        ws_address_start,
        ws_address_control,
    ):
        websocket_api.async_register_command(hass, command)


def _keys(persons: list[str]) -> list[str]:
    return [p.split(".", 1)[1] for p in persons]


async def _run(hass: HomeAssistant, connection, runtime, msg: dict, action: str, work, rows) -> dict[str, Any]:
    """Only count (preview) or change the days - then with backup and log entry (0.7.3)."""
    if msg["preview"]:
        return await hass.async_add_executor_job(work)
    return await async_logged(
        hass, runtime, action, connection.user, msg["persons"], msg["from"], msg["to"], work, rows
    )


async def _start_job(hass: HomeAssistant, connection, runtime, msg: dict, action: str, **params: Any) -> None:
    """The real run (0.7.10): a background job with progress, cancel and log; the answer is the job."""
    try:
        status = await runtime.jobs.async_start(
            "maintenance",
            _keys(msg["persons"]),
            msg["from"],
            msg["to"],
            {"action": action, **params},
            str(getattr(connection.user, "name", "") or ""),
        )
    except RuntimeError:
        connection.send_error(msg["id"], "busy", "Another task is running")
        return
    connection.send_result(msg["id"], {"job": status, "preview": False})


def _runtime(hass: HomeAssistant, connection, msg):
    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        connection.send_error(msg["id"], "not_set_up", "Whereabouts is not set up")
    return runtime


# --- recording rules ------------------------------------------------------------------------------------
def rules_on_days(
    storage: HistoryStorage,
    files: list[tuple[str, str]],
    same_place_distance: float,
    min_interval: float,
    write: bool,
) -> dict[str, Any]:
    total = DayStats()
    days_changed = 0
    for person, date in files:

        def change(points, date=date):
            new, stats = apply_rules(points, same_place_distance, min_interval)
            day = stats.get(date, DayStats())
            return (new if day.stays != day.points else None), day

        day = storage.transform_day(person, date, change, write)
        total.points += day.points
        total.stays += day.stays
        total.merged += day.merged
        total.dropped += day.dropped
        days_changed += day.stays != day.points
    return {**total.as_dict(), "days": len(files), "days_changed": days_changed}


@websocket_api.websocket_command(
    {vol.Required("type"): "whereabouts/maintenance/rules", vol.Optional("preview", default=True): bool, **_SCOPE}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_rules(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    if not msg["preview"]:
        await _start_job(hass, connection, runtime, msg, "rules")
        return
    options = runtime.options
    distance = float(options.get(CONF_SAME_PLACE_DISTANCE) or DEFAULT_OPTIONS[CONF_SAME_PLACE_DISTANCE])
    interval = float(options.get(CONF_MIN_INTERVAL) or DEFAULT_OPTIONS[CONF_MIN_INTERVAL])
    files = await hass.async_add_executor_job(runtime.storage.files_in, _keys(msg["persons"]), msg["from"], msg["to"])
    result = await _run(
        hass,
        connection,
        runtime,
        msg,
        "rules",
        lambda: rules_on_days(runtime.storage, files, distance, interval, not msg["preview"]),
        lambda r: r["merged"] + r["dropped"],
    )
    if not msg["preview"] and result["days_changed"]:
        runtime.data_changed(hass)
    connection.send_result(
        msg["id"], {**result, "same_place_distance": distance, "min_interval": interval, "preview": msg["preview"]}
    )


# --- time zones -----------------------------------------------------------------------------------------
def time_zones_on_days(storage: HistoryStorage, files: list[tuple[str, str]], write: bool) -> dict[str, Any]:
    total = {"rows": 0, "offsets": 0, "zones": 0, "assumed": 0}
    days_changed = 0
    for person, date in files:
        day = storage.fill_time_zones(person, date, write)
        for key in total:
            total[key] += day[key]
        days_changed += bool(day["offsets"] or day["zones"])
    return {**total, "days": len(files), "days_changed": days_changed}


@websocket_api.websocket_command(
    {vol.Required("type"): "whereabouts/maintenance/timezones", vol.Optional("preview", default=True): bool, **_SCOPE}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_time_zones(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    if not msg["preview"]:
        await _start_job(hass, connection, runtime, msg, "timezones")
        return
    files = await hass.async_add_executor_job(runtime.storage.files_in, _keys(msg["persons"]), msg["from"], msg["to"])
    result = await _run(
        hass,
        connection,
        runtime,
        msg,
        "timezones",
        lambda: time_zones_on_days(runtime.storage, files, not msg["preview"]),
        lambda r: r["offsets"] + r["zones"],
    )
    if not msg["preview"] and result["days_changed"]:
        runtime.data_changed(hass)
    connection.send_result(msg["id"], {**result, "preview": msg["preview"]})


# --- edges of days -------------------------------------------------------------------------------------
def edges_on_days(storage: HistoryStorage, files: list[tuple[str, str]], write: bool) -> dict[str, Any]:
    by_person: dict[str, list[str]] = {}
    for person, date in files:
        by_person.setdefault(person, []).append(date)
    total = {"days": 0, "days_changed": 0, "starts": 0, "ends": 0}
    for person, dates in by_person.items():
        found = storage.fill_edges(person, dates, write)
        for key in total:
            total[key] += found[key]
    return total


@websocket_api.websocket_command(
    {vol.Required("type"): "whereabouts/maintenance/day_edges", vol.Optional("preview", default=True): bool, **_SCOPE}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_day_edges(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    if not msg["preview"]:
        await _start_job(hass, connection, runtime, msg, "day_edges")
        return
    files = await hass.async_add_executor_job(runtime.storage.files_in, _keys(msg["persons"]), msg["from"], msg["to"])
    result = await _run(
        hass,
        connection,
        runtime,
        msg,
        "day_edges",
        lambda: edges_on_days(runtime.storage, files, not msg["preview"]),
        lambda r: r["starts"] + r["ends"],
    )
    if not msg["preview"] and result["days_changed"]:
        runtime.data_changed(hass)
    connection.send_result(msg["id"], {**result, "preview": msg["preview"]})


# --- rows without coordinates ---------------------------------------------------------------------------
def positions_on_days(
    storage: HistoryStorage, files: list[tuple[str, str]], zones: list, write: bool
) -> dict[str, Any]:
    total = PositionStats()
    days_changed = 0
    for person, date in files:

        def change(points):
            new, stats = fill_positions(points, zones)
            return new, stats

        stats = storage.transform_day(person, date, change, write)
        total.add(stats)
        days_changed += bool(stats.from_day or stats.from_zone or stats.removed)
    return {**total.as_dict(), "days": len(files), "days_changed": days_changed}


@websocket_api.websocket_command(
    {vol.Required("type"): "whereabouts/maintenance/positions", vol.Optional("preview", default=True): bool, **_SCOPE}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_positions(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    if not msg["preview"]:
        await _start_job(hass, connection, runtime, msg, "positions")
        return
    files = await hass.async_add_executor_job(runtime.storage.files_in, _keys(msg["persons"]), msg["from"], msg["to"])
    zones = zone_snapshot(hass)
    result = await _run(
        hass,
        connection,
        runtime,
        msg,
        "positions",
        lambda: positions_on_days(runtime.storage, files, zones, not msg["preview"]),
        lambda r: r["from_day"] + r["from_zone"] + r["removed"],
    )
    if not msg["preview"] and result["days_changed"]:
        runtime.data_changed(hass)
    connection.send_result(msg["id"], {**result, "preview": msg["preview"]})


# --- zones ----------------------------------------------------------------------------------------------
def _zone_entries(hass: HomeAssistant) -> dict[str, list]:
    """Active zones by entity ID: [state name, latitude, longitude, radius]."""
    result = {}
    for zone in hass.states.async_all("zone"):
        if zone.attributes.get("passive"):
            continue
        lat, lon = zone.attributes.get("latitude"), zone.attributes.get("longitude")
        radius = zone.attributes.get("radius")
        if lat is None or lon is None or radius is None:
            continue
        name = "home" if zone.entity_id == "zone.home" else zone.name
        result[zone.entity_id] = [name, round(float(lat), 6), round(float(lon), 6), float(radius)]
    return result


def zone_diff(old: dict[str, list], new: dict[str, list]) -> tuple[list[dict], dict[str, str]]:
    """What changed between two zone lists: (changes, renames {old name: new name}).

    A zone whose entity ID changed but that lies at the same place with the
    same radius counts as renamed (zones from YAML get a new ID with a new name).
    """
    changes: list[dict] = []
    renames: dict[str, str] = {}
    removed = {eid: z for eid, z in old.items() if eid not in new}
    added = {eid: z for eid, z in new.items() if eid not in old}
    for eid, gone in list(removed.items()):
        twin = next((a for a, z in added.items() if z[1:] == gone[1:]), None)
        if twin:
            renames[gone[0]] = added[twin][0]
            changes.append({"kind": "renamed", "entity_id": twin, "name": added[twin][0], "old_name": gone[0]})
            del removed[eid], added[twin]
    for eid, zone in new.items():
        if eid in old and eid not in added:
            before = old[eid]
            if before[0] != zone[0]:
                renames[before[0]] = zone[0]
                changes.append({"kind": "renamed", "entity_id": eid, "name": zone[0], "old_name": before[0]})
            elif before[1:] != zone[1:]:
                changes.append({"kind": "changed", "entity_id": eid, "name": zone[0]})
    changes += [{"kind": "added", "entity_id": eid, "name": z[0]} for eid, z in added.items()]
    changes += [{"kind": "removed", "entity_id": eid, "name": z[0]} for eid, z in removed.items()]
    return changes, renames


class ZoneWatch:
    """Remembers the zones the data was last checked against."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, ZONES_STORE_VERSION, ZONES_STORE_KEY, private=True)
        self._seen: dict[str, list] | None = None

    async def async_load(self) -> None:
        data = await self._store.async_load()
        self._seen = data.get("zones") if isinstance(data, dict) and isinstance(data.get("zones"), dict) else None

    async def async_changes(self) -> tuple[list[dict], dict[str, str]]:
        """Changes since the last check. The first time, today's zones are simply remembered."""
        current = _zone_entries(self.hass)
        if self._seen is None:
            await self.async_ack()
            return [], {}
        return zone_diff(self._seen, current)

    async def async_ack(self) -> None:
        self._seen = _zone_entries(self.hass)
        await self._store.async_save({"zones": self._seen})


def zones_on_days(
    storage: HistoryStorage,
    files: list[tuple[str, str]],
    zones: list,
    renames: dict[str, str],
    only: set[str] | None,
    write: bool,
) -> dict[str, Any]:
    total = ZoneStats()
    days_changed = 0
    for person, date in files:

        def change(points):
            new, stats = recalculate_zones(points, zones, renames, only)
            return (new if stats.changed else None), stats

        stats = storage.transform_day(person, date, change, write)
        total.add(stats)
        days_changed += bool(stats.changed)
    return {**total.as_dict(), "days": len(files), "days_changed": days_changed}


def _zone_params(msg: dict) -> dict[str, Any]:
    params: dict[str, Any] = {"ack": bool(msg.get("ack")), "addresses": bool(msg.get("addresses"))}
    if "zones" in msg:
        params["zones"] = list(msg["zones"])
    return params


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/maintenance/zones",
        vol.Optional("preview", default=True): bool,
        # zone names, "not_home" and "__gone__" (zones that no longer exist); missing = all
        vol.Optional("zones"): vol.All([vol.All(str, vol.Length(max=200))], vol.Length(max=500)),
        # after "Recalculate" in the question about changed zones: remember today's zones
        vol.Optional("ack", default=False): bool,
        # afterwards look up the addresses of stays that need one (0.7.10: the job starts that itself)
        vol.Optional("addresses", default=False): bool,
        **_SCOPE,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_zones(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    if not msg["preview"]:
        await _start_job(hass, connection, runtime, msg, "zones", **_zone_params(msg))
        return
    _, renames = await runtime.zones.async_changes()
    zones = zone_snapshot(hass)
    only = set(msg["zones"]) if "zones" in msg else None
    files = await hass.async_add_executor_job(runtime.storage.files_in, _keys(msg["persons"]), msg["from"], msg["to"])
    result = await _run(
        hass,
        connection,
        runtime,
        msg,
        "zones",
        lambda: zones_on_days(runtime.storage, files, zones, renames, only, not msg["preview"]),
        lambda r: r["changed"],
    )
    if not msg["preview"]:
        if msg["ack"]:
            await runtime.zones.async_ack()
        if result["days_changed"]:
            runtime.data_changed(hass)
    connection.send_result(msg["id"], {**result, "renames": renames, "preview": msg["preview"]})


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/maintenance/zone_ack"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_zone_ack(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    await runtime.zones.async_ack()
    connection.send_result(msg["id"], None)


def address_log(hass: HomeAssistant, runtime, user, persons: list[str], date_from: str, date_to: str):
    """The log entry of "Fetch missing addresses" (only logged, no backup: the job only fills empty addresses)."""
    if runtime.journal is None:
        return None

    async def log(state: dict[str, Any]) -> str:
        entry = await async_finish(
            hass,
            runtime,
            runtime.journal.new_id(dt_util.now()),
            None,
            "addresses",
            user,
            persons,
            date_from,
            date_to,
            state.get("found", 0),
            total=state.get("total", 0),
            status=state.get("status", ""),
        )
        return entry["id"] if entry else ""

    return log


# --- missing addresses ----------------------------------------------------------------------------------
@websocket_api.websocket_command({vol.Required("type"): "whereabouts/addresses/status"})
@websocket_api.require_admin
@callback
def ws_address_status(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    connection.send_result(msg["id"], runtime.addresses.status())


@websocket_api.websocket_command(
    {vol.Required("type"): "whereabouts/addresses/start", vol.Optional("preview", default=True): bool, **_SCOPE}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_address_start(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    from .addresses import count_missing

    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    keys = _keys(msg["persons"])
    if msg["preview"]:
        files = await hass.async_add_executor_job(runtime.storage.files_in, keys, msg["from"], msg["to"])
        missing = await hass.async_add_executor_job(count_missing, runtime.storage, files)
        busy = runtime.addresses.busy or bool(runtime.jobs and runtime.jobs.busy)
        connection.send_result(msg["id"], {"missing": missing, "busy": busy})
        return

    log = address_log(hass, runtime, connection.user, msg["persons"], msg["from"], msg["to"])

    try:
        if runtime.jobs and runtime.jobs.busy:
            raise RuntimeError("busy")
        status = await runtime.addresses.async_start(keys, msg["from"], msg["to"], log)
    except RuntimeError:
        connection.send_error(msg["id"], "busy", "A lookup is already running")
        return
    connection.send_result(msg["id"], status)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/addresses/control",
        vol.Required("action"): vol.In(["pause", "resume", "cancel", "dismiss"]),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_address_control(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    job = runtime.addresses
    await {
        "pause": job.async_pause,
        "resume": job.async_resume,
        "cancel": job.async_cancel,
        "dismiss": job.async_dismiss,
    }[msg["action"]]()
    connection.send_result(msg["id"], job.status())
