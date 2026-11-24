"""WebSocket commands and the export download - the only way to the history.

Every request is checked against the logged-in Home Assistant user and the
rights set on the settings page (see settings.Settings.allowed):
administrators may do everything; other users by default see the history of
the person linked to their own user account and may delete it.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Any

import voluptuous as vol
from aiohttp import web
from homeassistant.auth.models import User
from homeassistant.components import websocket_api
from homeassistant.components.http import KEY_HASS_USER, HomeAssistantView
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.util import dt as dt_util

from .const import (
    CONF_CARTO_KEY,
    CONF_PANEL,
    CONF_RECORD_PERSONS,
    DOMAIN,
    PANEL_URL,
    SIGNAL_INFO_CHANGED,
)
from .logger import person_key
from .settings import CATEGORIES, card_settings
from .storage import Stay, export_csv_multi, is_valid_date, is_valid_key
from .timezones import foreign_zone, parse_offset

DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
TIME_PATTERN = r"^\d{2}:\d{2}:\d{2}$"

ERR_NOT_SET_UP = "not_set_up"
ERR_FORBIDDEN = "forbidden"
ERR_NOT_RECORDED = "not_recorded"
MAX_RANGE_DAYS = 93  # per request; the cards load longer periods month by month


def _runtime(hass: HomeAssistant):
    """The running instance (see __init__.Runtime) or None."""
    return hass.data.get(DOMAIN)


def _base(hass: HomeAssistant, runtime) -> list[str]:
    from . import base_persons

    return base_persons(hass, runtime.options)


def can_view(hass: HomeAssistant, user: User | None, person_entity: str) -> bool:
    runtime = _runtime(hass)
    return (
        bool(runtime)
        and person_entity in _base(hass, runtime)
        and person_entity in runtime.settings.allowed(user, "history")
    )


def can_delete(hass: HomeAssistant, user: User | None, person_entity: str) -> bool:
    runtime = _runtime(hass)
    return can_view(hass, user, person_entity) and person_entity in runtime.settings.allowed(user, "delete")


def _stay_dict(stay: Stay) -> dict[str, Any]:
    return stay.as_dict()


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_info)
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_history)
    websocket_api.async_register_command(hass, ws_days)
    websocket_api.async_register_command(hass, ws_delete)
    websocket_api.async_register_command(hass, ws_time_zones)
    hass.http.register_view(ExportView())


def _check(hass, connection, msg, person: str, check) -> bool:
    """Common checks; sends the error itself and returns False if not allowed."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_SET_UP, "Whereabouts is not set up")
        return False
    if person not in runtime.options[CONF_RECORD_PERSONS] and person not in runtime.known_persons():
        connection.send_error(msg["id"], ERR_NOT_RECORDED, "No history for this person")
        return False
    if not check(hass, connection.user, person):
        connection.send_error(msg["id"], ERR_FORBIDDEN, "Not allowed")
        return False
    return True


def build_info(hass: HomeAssistant, user: User | None) -> dict[str, Any]:
    """What the cards need to know - for this user."""
    runtime = _runtime(hass)
    if runtime is None:
        return {"available": False}
    settings = runtime.settings
    base = _base(hass, runtime)
    live_allowed = set(settings.allowed(user, "live"))
    history_allowed = set(settings.allowed(user, "history"))
    delete_allowed = set(settings.allowed(user, "delete"))
    # History: persons that have (or get) a history and that this user may
    # see - nothing about the others.
    persons = []
    for entity_id in sorted(set(runtime.options[CONF_RECORD_PERSONS]) | set(runtime.known_persons())):
        if entity_id not in base or entity_id not in history_allowed:
            continue
        persons.append(
            {
                "entity_id": entity_id,
                "recording": entity_id in runtime.options[CONF_RECORD_PERSONS],
                "can_view": True,
                "can_delete": entity_id in delete_allowed,
            }
        )
    personal = card_settings(settings.effective(user))
    # settings the user cannot change themselves (e.g. the zone switch in the legend is greyed out)
    locked: set[str] = set()
    fixed = settings.locked_categories(user)
    for cat, spec in CATEGORIES.items():
        keys = list(spec) if cat in fixed else settings.locked_keys(user, cat)
        locked.update(spec if "*" in keys else keys)
    personal[CONF_CARTO_KEY] = runtime.options.get(CONF_CARTO_KEY, "")
    return {
        "available": True,
        "version": runtime.version,
        "live_card": True,
        "history_card": True,
        "base": base,
        "shown": [p for p in base if p in live_allowed],
        "persons": persons,
        "settings": personal,
        "locked_keys": sorted(locked),
        "is_admin": bool(user and user.is_admin),
        "synced": settings.synced(user),
        "settings_hidden": settings.settings_hidden(user),
        # administrators get a way to the settings when the dashboard or its settings view is hidden
        "panel_shown": bool(runtime.options.get(CONF_PANEL, True)),
        "panel_url": "/" + PANEL_URL,
        "today": dt_util.now().strftime("%Y-%m-%d"),
    }


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/info"})
@callback
def ws_info(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """What the cards need to know: enabled cards, persons and the user's rights."""
    info = build_info(hass, connection.user)
    if not info["available"]:
        connection.send_error(msg["id"], ERR_NOT_SET_UP, "Whereabouts is not set up")
        return
    connection.send_result(msg["id"], info)


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Like whereabouts/info, and again whenever the options change - the cards follow at once."""

    @callback
    def _send() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], build_info(hass, connection.user)))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_INFO_CHANGED, _send)
    connection.send_result(msg["id"])
    _send()


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/history",
        vol.Required("person"): str,
        vol.Required("date"): vol.Match(DATE_PATTERN),
        # optional: last day of a period (max. MAX_RANGE_DAYS days)
        vol.Optional("date_to"): vol.Match(DATE_PATTERN),
    }
)
@websocket_api.async_response
async def ws_history(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Stays of one person on one day or in a period (each stay with its date)."""
    person = msg["person"]
    if not _check(hass, connection, msg, person, can_view):
        return
    runtime = _runtime(hass)
    date_from = msg["date"]
    date_to = msg.get("date_to") or date_from
    first, last = dt_util.parse_date(date_from), dt_util.parse_date(date_to)
    if first is None or last is None or last < first or (last - first).days >= MAX_RANGE_DAYS:
        connection.send_error(msg["id"], "invalid_range", f"Period of 1 to {MAX_RANGE_DAYS} days")
        return
    rows = await hass.async_add_executor_job(runtime.storage.export_rows, person_key(person), date_from, date_to)
    connection.send_result(msg["id"], {"stays": [{**_stay_dict(stay), "date": day} for day, stay in rows]})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/days",
        vol.Required("person"): str,
        vol.Optional("month", default=""): vol.Match(r"^(\d{4}-\d{2})?$"),
    }
)
@websocket_api.async_response
async def ws_days(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Days with data (for the date picker)."""
    person = msg["person"]
    if not _check(hass, connection, msg, person, can_view):
        return
    runtime = _runtime(hass)
    days = await hass.async_add_executor_job(runtime.storage.days, person_key(person), msg["month"])
    connection.send_result(msg["id"], {"days": days})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/delete",
        vol.Required("person"): str,
        vol.Required("date"): vol.Match(DATE_PATTERN),
        vol.Required("times"): vol.All([vol.Match(TIME_PATTERN)], vol.Length(min=1, max=5000)),
    }
)
@websocket_api.async_response
async def ws_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Delete stays (by the start times of their rows)."""
    person = msg["person"]
    if not _check(hass, connection, msg, person, can_delete):
        return
    runtime = _runtime(hass)
    deleted = await hass.async_add_executor_job(
        runtime.storage.delete_times, person_key(person), msg["date"], msg["times"]
    )
    connection.send_result(msg["id"], {"deleted": deleted})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/time_zones",
        vol.Required("points"): vol.All(
            [vol.All([vol.Coerce(float)], vol.Length(min=2, max=2))], vol.Length(min=1, max=100)
        ),
    }
)
@websocket_api.async_response
async def ws_time_zones(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Time zones of places ("" = Home Assistant's own or unknown) - for the local time in "Where is…?"."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], "not_set_up", "Whereabouts is not set up")
        return
    home = runtime.storage.zone_name
    zones = await hass.async_add_executor_job(lambda: [foreign_zone(lat, lon, home) for lat, lon in msg["points"]])
    connection.send_result(msg["id"], {"zones": zones, "home": home})


class ExportView(HomeAssistantView):
    """GET /api/whereabouts/export?persons=person.a,person.b&from=…&to=…&format=csv|gpx
    &split_day=1&split_person=1

    One file, or a ZIP when the splitting gives more than one file. ("person"
    instead of "persons" still works.)"""

    url = "/api/whereabouts/export"
    name = "api:whereabouts:export"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        user = request[KEY_HASS_USER]
        runtime = _runtime(hass)
        persons = [p for p in (request.query.get("persons") or request.query.get("person", "")).split(",") if p]
        date_from = request.query.get("from", "")
        date_to = request.query.get("to", date_from)
        fmt = request.query.get("format", "csv")
        split_day = request.query.get("split_day") == "1"
        split_person = request.query.get("split_person") == "1"
        if runtime is None:
            return self.json_message("Whereabouts is not set up", HTTPStatus.NOT_FOUND)
        if (
            not persons
            or len(persons) > 50
            or any(not p.startswith("person.") or not is_valid_key(person_key(p)) for p in persons)
            or not is_valid_date(date_from)
            or not is_valid_date(date_to)
            or date_from > date_to
            or fmt not in ("csv", "gpx")
        ):
            return self.json_message("Invalid request", HTTPStatus.BAD_REQUEST)
        if (dt_util.parse_date(date_to) - dt_util.parse_date(date_from)).days > 3660:
            return self.json_message("Range too long (max. 10 years)", HTTPStatus.BAD_REQUEST)
        if any(not can_view(hass, user, p) for p in persons):
            return self.json_message("Not allowed", HTTPStatus.FORBIDDEN)
        groups = []
        for person in persons:
            key = person_key(person)
            rows = await hass.async_add_executor_job(runtime.storage.export_rows, key, date_from, date_to)
            groups.append((key, rows))
        timezone = dt_util.get_default_time_zone()
        files = _export_files(groups, fmt, split_day, split_person, date_from, date_to, timezone)
        headers = {"Cache-Control": "no-store"}
        if len(files) == 1:
            name, body = next(iter(files.items()))
            headers["Content-Disposition"] = f'attachment; filename="{name}"'
            content_type = "application/gpx+xml" if fmt == "gpx" else "text/csv"
            return web.Response(text=body, content_type=content_type, charset="utf-8", headers=headers)
        archive = await hass.async_add_executor_job(_zip, files)
        span = date_from if date_from == date_to else f"{date_from}_{date_to}"
        headers["Content-Disposition"] = f'attachment; filename="whereabouts_{span}.zip"'
        return web.Response(body=archive, content_type="application/zip", headers=headers)


def _export_files(groups, fmt, split_day, split_person, date_from, date_to, timezone) -> dict[str, str]:
    """File name -> content, split by day and/or person as asked."""
    span = date_from if date_from == date_to else f"{date_from}_{date_to}"
    days = sorted({day for _, rows in groups for day, _ in rows}) or [date_from]
    files: dict[str, str] = {}

    def render(parts: list[tuple[str, list]]) -> str:
        return export_csv_multi(parts) if fmt == "csv" else export_gpx_multi(parts, timezone)

    person_sets = [[g] for g in groups] if split_person or len(groups) == 1 else [groups]
    for parts in person_sets:
        who = parts[0][0] if len(parts) == 1 else "whereabouts"
        if split_day:
            for day in days:
                day_parts = [(p, [r for r in rows if r[0] == day]) for p, rows in parts]
                if any(rows for _, rows in day_parts) or len(days) == 1:
                    files[f"{who}_{day}.{fmt}"] = render(day_parts)
        else:
            files[f"{who}_{span}.{fmt}"] = render(parts)
    if not files:
        files[f"whereabouts_{span}.{fmt}"] = render(groups)
    return files


def _zip(files: dict[str, str]) -> bytes:
    import io
    import zipfile

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, body in files.items():
            archive.writestr(name, body)
    return buffer.getvalue()


def export_gpx(person: str, rows: list[tuple[str, Stay]], timezone) -> str:
    """Stays as GPX waypoints (start of each stay) plus one track per day."""
    return export_gpx_multi([(person, rows)], timezone)


def export_gpx_multi(groups: list[tuple[str, list[tuple[str, Stay]]]], timezone) -> str:
    """Several persons: waypoints named with the person, one track per person and day."""
    from datetime import datetime, timedelta
    from datetime import timezone as dt_timezone
    from xml.sax.saxutils import escape, quoteattr

    def stamp(day: str, clock: str, offset: str = "") -> str:
        # the stored UTC offset makes the doubled hour in autumn unambiguous
        seconds = parse_offset(offset)
        zone = timezone if seconds is None else dt_timezone(timedelta(seconds=seconds))
        local = datetime.fromisoformat(f"{day}T{clock}").replace(tzinfo=zone)
        return local.astimezone(dt_util.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="Whereabouts for Home Assistant" xmlns="http://www.topografix.com/GPX/1/1">',
    ]
    multi = len(groups) > 1
    for person, rows in groups:
        for day, stay in rows:
            label = stay.address or stay.state
            if multi:
                label = f"{person}: {label}"
            lines.append(
                f"  <wpt lat={quoteattr(str(stay.latitude))} lon={quoteattr(str(stay.longitude))}>"
                f"<time>{stamp(day, stay.start, stay.offset)}</time><name>{escape(label)}</name>"
                f"<desc>{escape(f'{stay.start}-{stay.end}')}</desc></wpt>"
            )
    for person, rows in groups:
        days: dict[str, list[Stay]] = {}
        for day, stay in rows:
            days.setdefault(day, []).append(stay)
        for day, stays in days.items():
            lines.append(f"  <trk><name>{escape(person)} {day}</name><trkseg>")
            for stay in stays:
                ends = [(stay.start, stay.offset)]
                if (stay.end, stay.end_offset or stay.offset) != ends[0]:
                    ends.append((stay.end, stay.end_offset or stay.offset))
                for clock, offset in ends:
                    lines.append(
                        f"    <trkpt lat={quoteattr(str(stay.latitude))} lon={quoteattr(str(stay.longitude))}>"
                        f"<time>{stamp(day, clock, offset)}</time></trkpt>"
                    )
            lines.append("  </trkseg></trk>")
    lines.append("</gpx>")
    return "\n".join(lines) + "\n"
