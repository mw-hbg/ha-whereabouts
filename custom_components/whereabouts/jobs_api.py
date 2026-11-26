"""WebSocket commands of the background jobs (0.7.10), only for administrators.

- whereabouts/jobs/status        the job (or idle), what is still open
- whereabouts/jobs/control       cancel | dismiss
- whereabouts/jobs/export        export a period as a ZIP file (month by month)
- whereabouts/jobs/addresses_clear   forget the number of open addresses
- whereabouts/recorder/preview   what an import from the recorder would add (nothing is written)
- whereabouts/recorder/start     the import as a job
- whereabouts/recorder/hint      later | never (the offer after the installation)

The maintenance actions start their jobs in ``maintenance.py``.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .jobs import HINT_LATER, HINT_NEVER, MAX_RECORDER_DAYS, async_import_day, day_range, merge_result
from .logger import person_key
from .storage import is_valid_date, is_valid_key

_PERSON = vol.All(str, vol.Match(r"^person\.[a-z0-9_]+$"))
_SCOPE = {
    vol.Required("persons"): vol.All([_PERSON], vol.Length(min=1, max=50)),
    vol.Required("from"): vol.Match(r"^\d{4}-\d{2}-\d{2}$"),
    vol.Required("to"): vol.Match(r"^\d{4}-\d{2}-\d{2}$"),
}
MAX_EXPORT_DAYS = 366 * 40
MAX_PREVIEW_UNITS = 200


@callback
def async_register(hass: HomeAssistant) -> None:
    for command in (
        ws_status,
        ws_control,
        ws_export,
        ws_addresses_clear,
        ws_recorder_preview,
        ws_recorder_start,
        ws_hint,
    ):
        websocket_api.async_register_command(hass, command)


def _runtime(hass: HomeAssistant, connection, msg):
    runtime = hass.data.get(DOMAIN)
    if runtime is None or getattr(runtime, "jobs", None) is None:
        connection.send_error(msg["id"], "not_set_up", "Whereabouts is not set up")
        return None
    return runtime


def _valid_scope(connection, msg, max_days: int) -> list[str] | None:
    """The person keys of a valid scope; sends the error itself when it is not."""
    keys = [person_key(p) for p in msg["persons"]]
    if (
        any(not is_valid_key(k) for k in keys)
        or not is_valid_date(msg["from"])
        or not is_valid_date(msg["to"])
        or msg["from"] > msg["to"]
    ):
        connection.send_error(msg["id"], "invalid", "Invalid request")
        return None
    if (dt_util.parse_date(msg["to"]) - dt_util.parse_date(msg["from"])).days > max_days:
        connection.send_error(msg["id"], "too_long", "Period too long")
        return None
    return keys


def _user(connection) -> str:
    return str(getattr(connection.user, "name", "") or "")


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/jobs/status"})
@websocket_api.require_admin
@callback
def ws_status(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    connection.send_result(msg["id"], {"job": runtime.jobs.status(), "open": runtime.jobs.open_tasks()})


@websocket_api.websocket_command(
    {vol.Required("type"): "whereabouts/jobs/control", vol.Required("action"): vol.In(["cancel", "dismiss"])}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_control(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    if msg["action"] == "cancel":
        await runtime.jobs.async_cancel()
    else:
        await runtime.jobs.async_dismiss()
    connection.send_result(msg["id"], {"job": runtime.jobs.status(), "open": runtime.jobs.open_tasks()})


async def _start(hass: HomeAssistant, connection, msg, runtime, kind: str, keys: list[str], params: dict[str, Any]):
    try:
        status = await runtime.jobs.async_start(kind, keys, msg["from"], msg["to"], params, _user(connection))
    except RuntimeError:
        connection.send_error(msg["id"], "busy", "Another task is running")
        return
    connection.send_result(msg["id"], {"job": status})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/jobs/export",
        vol.Optional("format", default="csv"): vol.In(["csv", "gpx"]),
        **_SCOPE,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_export(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    keys = _valid_scope(connection, msg, MAX_EXPORT_DAYS) if runtime else None
    if keys is None:
        return
    await _start(hass, connection, msg, runtime, "export", keys, {"format": msg["format"]})


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/jobs/addresses_clear"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_addresses_clear(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    await runtime.jobs.async_set_open_addresses(0)
    connection.send_result(msg["id"], {"job": runtime.jobs.status(), "open": runtime.jobs.open_tasks()})


def _recorder_ready(hass: HomeAssistant) -> bool:
    return "recorder" in hass.config.components


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/recorder/preview", **_SCOPE})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_recorder_preview(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    keys = _valid_scope(connection, msg, MAX_RECORDER_DAYS) if runtime else None
    if keys is None:
        return
    if not _recorder_ready(hass):
        connection.send_error(msg["id"], "no_recorder", "The recorder is not available")
        return
    days = day_range(msg["from"], msg["to"])
    if len(days) * len(keys) > MAX_PREVIEW_UNITS:
        connection.send_result(msg["id"], {"too_large": True, "busy": runtime.jobs.busy})
        return
    total: dict[str, Any] = {}
    for day in days:
        for key in keys:
            merge_result(total, await async_import_day(runtime.jobs, key, day, write=False))
    connection.send_result(
        msg["id"], {**total, "busy": runtime.jobs.busy or bool(runtime.addresses and runtime.addresses.busy)}
    )


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/recorder/start", **_SCOPE})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_recorder_start(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    keys = _valid_scope(connection, msg, MAX_RECORDER_DAYS) if runtime else None
    if keys is None:
        return
    if not _recorder_ready(hass):
        connection.send_error(msg["id"], "no_recorder", "The recorder is not available")
        return
    await _start(hass, connection, msg, runtime, "recorder", keys, {})


@websocket_api.websocket_command(
    {vol.Required("type"): "whereabouts/recorder/hint", vol.Required("hint"): vol.In([HINT_LATER, HINT_NEVER])}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_hint(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    await runtime.jobs.async_set_hint(msg["hint"])
    connection.send_result(msg["id"], {"open": runtime.jobs.open_tasks()})
