"""WebSocket commands of the evaluation of a place (0.8.0).

Every user may evaluate the persons whose history they may see (``api.can_view``);
each user has at most one evaluation (see ``analysis.AnalysisManager``).
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.util import dt as dt_util

from . import reports
from .analysis import DONE, GROUPS, MAX_DAYS, MAX_MINUTES, MAX_PERSONS, RADIUS_MAX, RADIUS_MIN
from .api import ERR_FORBIDDEN, ERR_NOT_SET_UP, can_view
from .const import DOMAIN

ERR_NO_RESULT = "no_result"
_DATE = vol.Match(r"^\d{4}-\d{2}-\d{2}$")


@callback
def async_register(hass: HomeAssistant) -> None:
    for command in (ws_start, ws_status, ws_cancel, ws_export):
        websocket_api.async_register_command(hass, command)


def _manager(hass: HomeAssistant, connection, msg):
    runtime = hass.data.get(DOMAIN)
    if runtime is None or getattr(runtime, "analysis", None) is None:
        connection.send_error(msg["id"], ERR_NOT_SET_UP, "Whereabouts is not set up")
        return None
    if connection.user is None:
        connection.send_error(msg["id"], ERR_FORBIDDEN, "Not allowed")
        return None
    return runtime.analysis


def _names(hass: HomeAssistant, persons: list[str]) -> dict[str, str]:
    names = {}
    for person in persons:
        state = hass.states.get(person)
        names[person] = state.name if state is not None else person.split(".", 1)[-1]
    return names


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/analysis/start",
        vol.Required("persons"): vol.All([str], vol.Length(min=1, max=MAX_PERSONS)),
        vol.Required("from"): _DATE,
        vol.Required("to"): _DATE,
        vol.Required("latitude"): vol.All(vol.Coerce(float), vol.Range(min=-90, max=90)),
        vol.Required("longitude"): vol.All(vol.Coerce(float), vol.Range(min=-180, max=180)),
        vol.Required("radius"): vol.All(vol.Coerce(int), vol.Range(min=RADIUS_MIN, max=RADIUS_MAX)),
        vol.Optional("min_minutes", default=10): vol.All(vol.Coerce(int), vol.Range(min=0, max=MAX_MINUTES)),
        vol.Optional("count_short", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_start(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    manager = _manager(hass, connection, msg)
    if manager is None:
        return
    persons = list(dict.fromkeys(msg["persons"]))
    if not all(can_view(hass, connection.user, p) for p in persons):
        connection.send_error(msg["id"], ERR_FORBIDDEN, "Not allowed")
        return
    first, last = dt_util.parse_date(msg["from"]), dt_util.parse_date(msg["to"])
    if first is None or last is None or last < first or (last - first).days >= MAX_DAYS:
        connection.send_error(msg["id"], "invalid_range", f"Period of 1 to {MAX_DAYS} days")
        return
    params: dict[str, Any] = {
        "persons": persons,
        "from": msg["from"],
        "to": msg["to"],
        "latitude": msg["latitude"],
        "longitude": msg["longitude"],
        "radius": msg["radius"],
        "min_minutes": msg["min_minutes"],
        "count_short": msg["count_short"],
    }
    run = await manager.async_start(connection.user.id, params)
    connection.send_result(msg["id"], run.status_dict())


@websocket_api.websocket_command(
    {vol.Required("type"): "whereabouts/analysis/status", vol.Optional("group", default="month"): vol.In(GROUPS)}
)
@websocket_api.async_response
async def ws_status(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    manager = _manager(hass, connection, msg)
    if manager is None:
        return
    run = manager.get(connection.user.id)
    if run is None:
        connection.send_result(msg["id"], {"status": "idle"})
        return
    # the rights may have changed since the start
    if not all(can_view(hass, connection.user, p) for p in run.params["persons"]):
        connection.send_error(msg["id"], ERR_FORBIDDEN, "Not allowed")
        return
    connection.send_result(msg["id"], manager.result(run, msg["group"]))


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/analysis/cancel"})
@websocket_api.async_response
async def ws_cancel(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    manager = _manager(hass, connection, msg)
    if manager is None:
        return
    run = await manager.async_cancel(connection.user.id)
    connection.send_result(msg["id"], run.status_dict() if run else {"status": "idle"})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/analysis/export",
        vol.Required("format"): vol.In(["xlsx", "pdf"]),
        vol.Optional("group", default="month"): vol.In(GROUPS),
        vol.Optional("language", default="en"): vol.All(str, vol.Length(max=16)),
    }
)
@websocket_api.async_response
async def ws_export(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    manager = _manager(hass, connection, msg)
    if manager is None:
        return
    run = manager.get(connection.user.id)
    if run is None or run.status != DONE:
        connection.send_error(msg["id"], ERR_NO_RESULT, "No finished evaluation")
        return
    persons = run.params["persons"]
    if not all(can_view(hass, connection.user, p) for p in persons):
        connection.send_error(msg["id"], ERR_FORBIDDEN, "Not allowed")
        return
    name = await hass.async_add_executor_job(
        reports.write_file, hass, run, msg["format"], msg["group"], _names(hass, persons), msg["language"]
    )
    connection.send_result(msg["id"], {"file": name})
