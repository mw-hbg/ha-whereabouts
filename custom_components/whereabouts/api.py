"""WebSocket commands and the export download - the only way to the history.

Every request is checked against the logged-in Home Assistant user:

- history_access "admins": only administrators
- "admins_and_self" (default): administrators, and every user for the
  person linked to their own user account
- "everyone": every logged-in user

Deleting uses delete_access ("admins" or "admins_and_self") the same way.
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
    ACCESS_ADMINS,
    ACCESS_EVERYONE,
    CONF_DELETE_ACCESS,
    CONF_HISTORY_ACCESS,
    CONF_HISTORY_CARD,
    CONF_LIVE_CARD,
    CONF_RECORD_PERSONS,
    CONF_SHOW_PERSONS_HISTORY,
    CONF_SHOW_PERSONS_LIVE,
    DOMAIN,
    SIGNAL_INFO_CHANGED,
)
from .logger import person_key
from .storage import Stay, export_csv, is_valid_date, is_valid_key

DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
TIME_PATTERN = r"^\d{2}:\d{2}:\d{2}$"

ERR_NOT_SET_UP = "not_set_up"
ERR_FORBIDDEN = "forbidden"
ERR_NOT_RECORDED = "not_recorded"


def _runtime(hass: HomeAssistant):
    """The running instance (see __init__.Runtime) or None."""
    return hass.data.get(DOMAIN)


def _linked_user(hass: HomeAssistant, person_entity: str) -> str | None:
    state = hass.states.get(person_entity)
    return state.attributes.get("user_id") if state else None


def _allowed(hass: HomeAssistant, user: User | None, person_entity: str, level: str) -> bool:
    if user is None:
        return False
    if user.is_admin:
        return True
    if level == ACCESS_ADMINS:
        return False
    if level == ACCESS_EVERYONE:
        return True
    return _linked_user(hass, person_entity) == user.id  # admins_and_self


def can_view(hass: HomeAssistant, user: User | None, person_entity: str) -> bool:
    runtime = _runtime(hass)
    return bool(runtime) and _allowed(hass, user, person_entity, runtime.options[CONF_HISTORY_ACCESS])


def can_delete(hass: HomeAssistant, user: User | None, person_entity: str) -> bool:
    runtime = _runtime(hass)
    return bool(runtime) and _allowed(hass, user, person_entity, runtime.options[CONF_DELETE_ACCESS])


def _stay_dict(stay: Stay) -> dict[str, Any]:
    return stay.as_dict()


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_info)
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_history)
    websocket_api.async_register_command(hass, ws_days)
    websocket_api.async_register_command(hass, ws_delete)
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


def shown_persons(hass: HomeAssistant, options: dict, key: str) -> list[str]:
    """Persons shown in a card: the chosen ones, or every person in Home Assistant."""
    existing = sorted(hass.states.async_entity_ids("person"))
    chosen = options.get(key) or []
    return [p for p in chosen if p in existing] if chosen else existing


def build_info(hass: HomeAssistant, user: User | None) -> dict[str, Any]:
    """What the cards need to know - for this user."""
    runtime = _runtime(hass)
    if runtime is None:
        return {"available": False}
    shown_live = shown_persons(hass, runtime.options, CONF_SHOW_PERSONS_LIVE)
    shown = shown_persons(hass, runtime.options, CONF_SHOW_PERSONS_HISTORY)
    # History: only shown persons that have (or get) a history and that this
    # user may see - nothing about the others.
    persons = []
    for entity_id in sorted(set(runtime.options[CONF_RECORD_PERSONS]) | set(runtime.known_persons())):
        if entity_id not in shown or not can_view(hass, user, entity_id):
            continue
        persons.append(
            {
                "entity_id": entity_id,
                "recording": entity_id in runtime.options[CONF_RECORD_PERSONS],
                "can_view": True,
                "can_delete": can_delete(hass, user, entity_id),
            }
        )
    return {
        "available": True,
        "version": runtime.version,
        "live_card": runtime.options[CONF_LIVE_CARD],
        "history_card": runtime.options[CONF_HISTORY_CARD],
        "shown": shown_live,
        "persons": persons,
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
    }
)
@websocket_api.async_response
async def ws_history(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Stays of one person on one day."""
    person = msg["person"]
    if not _check(hass, connection, msg, person, can_view):
        return
    runtime = _runtime(hass)
    stays = await hass.async_add_executor_job(runtime.storage.read_day, person_key(person), msg["date"])
    connection.send_result(msg["id"], {"stays": [_stay_dict(s) for s in stays]})


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


class ExportView(HomeAssistantView):
    """GET /api/whereabouts/export?person=person.x&from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|gpx"""

    url = "/api/whereabouts/export"
    name = "api:whereabouts:export"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        user = request[KEY_HASS_USER]
        runtime = _runtime(hass)
        person = request.query.get("person", "")
        date_from = request.query.get("from", "")
        date_to = request.query.get("to", date_from)
        fmt = request.query.get("format", "csv")
        if runtime is None:
            return self.json_message("Whereabouts is not set up", HTTPStatus.NOT_FOUND)
        if (
            not person.startswith("person.")
            or not is_valid_key(person_key(person))
            or not is_valid_date(date_from)
            or not is_valid_date(date_to)
            or date_from > date_to
            or fmt not in ("csv", "gpx")
        ):
            return self.json_message("Invalid request", HTTPStatus.BAD_REQUEST)
        if (dt_util.parse_date(date_to) - dt_util.parse_date(date_from)).days > 3660:
            return self.json_message("Range too long (max. 10 years)", HTTPStatus.BAD_REQUEST)
        if not can_view(hass, user, person):
            return self.json_message("Not allowed", HTTPStatus.FORBIDDEN)
        key = person_key(person)
        rows = await hass.async_add_executor_job(runtime.storage.export_rows, key, date_from, date_to)
        name = f"whereabouts_{key}_{date_from}" + ("" if date_from == date_to else f"_{date_to}")
        if fmt == "gpx":
            body, content_type = export_gpx(key, rows, dt_util.get_default_time_zone()), "application/gpx+xml"
        else:
            body, content_type = export_csv(key, rows), "text/csv"
        return web.Response(
            text=body,
            content_type=content_type,
            charset="utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{name}.{fmt}"',
                "Cache-Control": "no-store",
            },
        )


def export_gpx(person: str, rows: list[tuple[str, Stay]], timezone) -> str:
    """Stays as GPX waypoints (start of each stay) plus one track per day."""
    from datetime import datetime
    from xml.sax.saxutils import escape, quoteattr

    def stamp(day: str, clock: str) -> str:
        local = datetime.fromisoformat(f"{day}T{clock}").replace(tzinfo=timezone)
        return local.astimezone(dt_util.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="Whereabouts for Home Assistant" xmlns="http://www.topografix.com/GPX/1/1">',
    ]
    for day, stay in rows:
        label = stay.address or stay.state
        lines.append(
            f"  <wpt lat={quoteattr(str(stay.latitude))} lon={quoteattr(str(stay.longitude))}>"
            f"<time>{stamp(day, stay.start)}</time><name>{escape(label)}</name>"
            f"<desc>{escape(f'{stay.start}-{stay.end}')}</desc></wpt>"
        )
    days: dict[str, list[Stay]] = {}
    for day, stay in rows:
        days.setdefault(day, []).append(stay)
    for day, stays in days.items():
        lines.append(f"  <trk><name>{escape(person)} {day}</name><trkseg>")
        for stay in stays:
            for clock in dict.fromkeys((stay.start, stay.end)):
                lines.append(
                    f"    <trkpt lat={quoteattr(str(stay.latitude))} lon={quoteattr(str(stay.longitude))}>"
                    f"<time>{stamp(day, clock)}</time></trkpt>"
                )
        lines.append("  </trkseg></trk>")
    lines.append("</gpx>")
    return "\n".join(lines) + "\n"
