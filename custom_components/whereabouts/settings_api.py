"""WebSocket commands of the settings page and the file import.

Every user reads and changes only their own personal settings (unless the
administrator locked the category). Defaults, locks, rights, the integration
options and the import are for administrators only.
"""

from __future__ import annotations

import os
from http import HTTPStatus
from typing import Any

import voluptuous as vol
from aiohttp import web
from homeassistant.components import websocket_api
from homeassistant.components.http import KEY_HASS_USER, HomeAssistantView
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import (
    ADDRESS_SOURCES,
    CONF_ADDRESS_MAX_DISTANCE,
    CONF_ADDRESS_SENSORS,
    CONF_ADDRESS_SOURCE,
    CONF_CARTO_KEY,
    CONF_HISTORY_CARD,
    CONF_LIVE_CARD,
    CONF_MIN_INTERVAL,
    CONF_PANEL,
    CONF_PANEL_ICON,
    CONF_PANEL_TITLE,
    CONF_RECORD_PERSONS,
    CONF_RETENTION_DAYS,
    CONF_SAME_PLACE_DISTANCE,
    CONF_SHOW_PERSONS_HISTORY,
    CONF_SHOW_PERSONS_LIVE,
    DOMAIN,
    SIGNAL_INFO_CHANGED,
)
from .geo import find_address_sensor
from .importer import ImportError_
from .importing import import_bytes
from .logger import person_key
from .settings import CATEGORIES, LOCK_MODES, RIGHT_KINDS, RIGHT_LEVELS, validate_values

ERR_NOT_SET_UP = "not_set_up"
ERR_FORBIDDEN = "forbidden"
ERR_LOCKED = "locked"
ERR_INVALID = "invalid"

MAX_IMPORT_BYTES = 50 * 1024 * 1024

_PERSON = vol.Match(r"^person\.[a-z0-9_]{1,100}$")
_USER_ID = vol.Match(r"^[0-9a-f]{32}$")
_PERSONS = vol.All([_PERSON], vol.Length(max=200))

# Integration options that the settings page may change (administrators only)
OPTIONS_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_LIVE_CARD): bool,
        vol.Optional(CONF_HISTORY_CARD): bool,
        vol.Optional(CONF_SHOW_PERSONS_LIVE): _PERSONS,
        vol.Optional(CONF_SHOW_PERSONS_HISTORY): _PERSONS,
        vol.Optional(CONF_RECORD_PERSONS): _PERSONS,
        vol.Optional(CONF_MIN_INTERVAL): vol.All(vol.Coerce(int), vol.Range(min=10, max=3600)),
        vol.Optional(CONF_SAME_PLACE_DISTANCE): vol.All(vol.Coerce(int), vol.Range(min=10, max=1000)),
        vol.Optional(CONF_RETENTION_DAYS): vol.All(vol.Coerce(int), vol.Range(min=0, max=36500)),
        vol.Optional(CONF_ADDRESS_SOURCE): vol.In(ADDRESS_SOURCES),
        vol.Optional(CONF_ADDRESS_MAX_DISTANCE): vol.All(vol.Coerce(int), vol.Range(min=10, max=5000)),
        vol.Optional(CONF_ADDRESS_SENSORS): vol.Schema({_PERSON: vol.Any(None, vol.Match(r"^sensor\.[a-z0-9_]+$"))}),
        vol.Optional(CONF_PANEL): bool,
        vol.Optional(CONF_PANEL_TITLE): vol.All(str, vol.Length(max=40)),
        vol.Optional(CONF_PANEL_ICON): vol.All(str, vol.Match(r"^(mdi:[a-z0-9-]{1,60})?$")),
        vol.Optional(CONF_CARTO_KEY): vol.All(str, vol.Length(max=200), vol.Match(r"^[A-Za-z0-9_-]*$")),
    }
)


def _runtime(hass: HomeAssistant):
    return hass.data.get(DOMAIN)


@callback
def async_register(hass: HomeAssistant) -> None:
    for command in (
        ws_get,
        ws_save,
        ws_reset,
        ws_lock,
        ws_rights,
        ws_rights_default,
        ws_options,
        ws_diagnostics,
    ):
        websocket_api.async_register_command(hass, command)
    hass.http.register_view(ImportView())


def _ready(hass, connection, msg, admin: bool = False):
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_SET_UP, "Whereabouts is not set up")
        return None
    if admin and not connection.user.is_admin:
        connection.send_error(msg["id"], ERR_FORBIDDEN, "Only for administrators")
        return None
    return runtime


def _changed(hass: HomeAssistant) -> None:
    """Open cards and pages follow at once."""
    async_dispatcher_send(hass, SIGNAL_INFO_CHANGED)


def _persons(hass: HomeAssistant) -> list[dict[str, Any]]:
    result = []
    for entity_id in sorted(hass.states.async_entity_ids("person")):
        state = hass.states.get(entity_id)
        result.append(
            {
                "entity_id": entity_id,
                "name": state.name if state else entity_id,
                "picture": (state.attributes.get("entity_picture") if state else None) or "",
                "user_id": (state.attributes.get("user_id") if state else None) or "",
            }
        )
    return result


async def _users(hass: HomeAssistant) -> list[dict[str, Any]]:
    users = await hass.auth.async_get_users()
    return sorted(
        (
            {"id": u.id, "name": u.name or u.id, "is_admin": u.is_admin, "active": u.is_active}
            for u in users
            if not u.system_generated
        ),
        key=lambda u: (not u["is_admin"], u["name"].lower()),
    )


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/settings"})
@websocket_api.async_response
async def ws_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Everything the settings page shows - for this user."""
    runtime = _ready(hass, connection, msg)
    if runtime is None:
        return
    user = connection.user
    settings = runtime.settings
    result: dict[str, Any] = {
        "version": runtime.version,
        "is_admin": user.is_admin,
        "user": {"id": user.id, "name": user.name},
        "categories": list(CATEGORIES),
        "own": settings.own(user.id),
        "effective": settings.effective(user),
        "defaults": settings.defaults(),
        "locked": settings.locked_categories(user),
        "rights": {kind: settings.allowed(user, kind) for kind in RIGHT_KINDS},
        "own_rights": user.id in settings.data["rights"],
        "persons": _persons(hass),
        "cards": {
            CONF_LIVE_CARD: runtime.options[CONF_LIVE_CARD],
            CONF_HISTORY_CARD: runtime.options[CONF_HISTORY_CARD],
        },
    }
    if user.is_admin:
        result["admin"] = {
            **settings.admin_view(),
            "users": await _users(hass),
            "options": {str(key): runtime.options.get(str(key)) for key in OPTIONS_SCHEMA.schema},
        }
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/save",
        vol.Required("scope"): vol.In(["own", "defaults"]),
        vol.Required("category"): vol.In(list(CATEGORIES)),
        vol.Required("values"): dict,
    }
)
@websocket_api.async_response
async def ws_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Change personal values (own) or the defaults for everybody (administrators)."""
    runtime = _ready(hass, connection, msg, admin=msg["scope"] == "defaults")
    if runtime is None:
        return
    user = connection.user
    if msg["scope"] == "own" and runtime.settings.is_locked(msg["category"], user):
        connection.send_error(msg["id"], ERR_LOCKED, "Locked by the administrator")
        return
    try:
        validate_values(msg["category"], msg["values"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], ERR_INVALID, str(err))
        return
    await runtime.settings.async_set(msg["scope"], user, msg["category"], msg["values"])
    _changed(hass)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/reset",
        vol.Required("scope"): vol.In(["own", "defaults"]),
        vol.Optional("category"): vol.In(list(CATEGORIES)),
    }
)
@websocket_api.async_response
async def ws_reset(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Back to the defaults (own) or to the built-in values (defaults, administrators)."""
    runtime = _ready(hass, connection, msg, admin=msg["scope"] == "defaults")
    if runtime is None:
        return
    await runtime.settings.async_reset(msg["scope"], connection.user, msg.get("category"))
    _changed(hass)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/lock",
        vol.Required("category"): vol.In(list(CATEGORIES)),
        vol.Required("mode"): vol.In(list(LOCK_MODES)),
        vol.Optional("except", default=[]): vol.All([_USER_ID], vol.Length(max=500)),
        vol.Optional("users", default=[]): vol.All([_USER_ID], vol.Length(max=500)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_lock(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    await runtime.settings.async_set_lock(msg["category"], msg["mode"], msg["except"], msg["users"])
    _changed(hass)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/rights",
        vol.Required("user_id"): _USER_ID,
        # None = back to the rules for all users
        vol.Required("rights"): vol.Any(None, {vol.Optional(kind): _PERSONS for kind in RIGHT_KINDS}),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_rights(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    await runtime.settings.async_set_rights(msg["user_id"], msg["rights"])
    _changed(hass)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/rights_default",
        vol.Required("levels"): {vol.Optional(kind): vol.In(list(RIGHT_LEVELS)) for kind in RIGHT_KINDS},
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_rights_default(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    await runtime.settings.async_set_rights_default(msg["levels"])
    _changed(hass)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/options",
        vol.Required("values"): dict,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_options(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Change integration options (recording, addresses, sidebar ...). Reloads the integration."""
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    try:
        values = OPTIONS_SCHEMA(msg["values"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], ERR_INVALID, str(err))
        return
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], ERR_NOT_SET_UP, "Whereabouts is not set up")
        return
    entry = entries[0]
    options = {**runtime.options, **values}
    if not options[CONF_HISTORY_CARD]:
        options[CONF_RECORD_PERSONS] = []
    if CONF_ADDRESS_SENSORS in values:
        options[CONF_ADDRESS_SENSORS] = {k: v for k, v in values[CONF_ADDRESS_SENSORS].items() if v}
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"])


def _file_stats(folder: str) -> dict[str, dict[str, Any]]:
    """Per person: number of days, first and last day, size in bytes."""
    stats: dict[str, dict[str, Any]] = {}
    try:
        names = os.listdir(folder)
    except FileNotFoundError:
        return stats
    for name in names:
        if not name.endswith(".csv") or "_" not in name:
            continue
        key, date = name[:-4].rsplit("_", 1)
        entry = stats.setdefault(key, {"days": 0, "first": date, "last": date, "bytes": 0})
        entry["days"] += 1
        entry["first"] = min(entry["first"], date)
        entry["last"] = max(entry["last"], date)
        try:
            entry["bytes"] += os.path.getsize(os.path.join(folder, name))
        except OSError:
            pass
    return stats


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/settings/diagnostics"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_diagnostics(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Trackers, the Companion app's address sensor and the stored history per person."""
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    stats = await hass.async_add_executor_job(_file_stats, runtime.storage.folder)
    persons = []
    for entity_id in sorted(hass.states.async_entity_ids("person")):
        state = hass.states.get(entity_id)
        trackers = []
        for tracker_id in (state.attributes.get("device_trackers") or []) if state else []:
            tracker = hass.states.get(tracker_id)
            trackers.append(
                {
                    "entity_id": tracker_id,
                    "name": tracker.name if tracker else tracker_id,
                    "source_type": (tracker.attributes.get("source_type") if tracker else None) or "",
                    "state": tracker.state if tracker else "missing",
                    "last_updated": tracker.last_updated.isoformat() if tracker else "",
                }
            )
        configured = runtime.options.get(CONF_ADDRESS_SENSORS, {}).get(entity_id)
        sensor_id = configured or find_address_sensor(hass, state)
        sensor = hass.states.get(sensor_id) if sensor_id else None
        persons.append(
            {
                "entity_id": entity_id,
                "name": state.name if state else entity_id,
                "state": state.state if state else "",
                "source": (state.attributes.get("source") if state else None) or "",
                "trackers": trackers,
                "address_sensor": sensor_id or "",
                "address_sensor_ok": bool(sensor and sensor.state not in ("unavailable", "unknown")),
                "recorded": entity_id in runtime.options[CONF_RECORD_PERSONS],
                "history": stats.get(person_key(entity_id)),
            }
        )
    nominatim = runtime.nominatim
    connection.send_result(
        msg["id"],
        {
            "persons": persons,
            "osm_paused": bool(nominatim and nominatim.paused),
            "folder": runtime.storage.folder,
        },
    )


class ImportView(HomeAssistantView):
    """POST /api/whereabouts/import (multipart: file, person, replace, preview) - administrators only."""

    url = "/api/whereabouts/import"
    name = "api:whereabouts:import"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        user = request[KEY_HASS_USER]
        if not user.is_admin:
            return self.json_message("Only for administrators", HTTPStatus.FORBIDDEN)
        runtime = _runtime(hass)
        if runtime is None:
            return self.json_message("Whereabouts is not set up", HTTPStatus.NOT_FOUND)
        if request.content_length and request.content_length > MAX_IMPORT_BYTES + 10_000:
            return self.json({"error": "too_large"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        fields: dict[str, str] = {}
        filename, data = "", b""
        reader = await request.multipart()
        while (part := await reader.next()) is not None:
            if part.name == "file":
                filename = os.path.basename(part.filename or "import")
                chunks, size = [], 0
                while chunk := await part.read_chunk(256 * 1024):
                    size += len(chunk)
                    if size > MAX_IMPORT_BYTES:
                        return self.json({"error": "too_large"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                    chunks.append(chunk)
                data = b"".join(chunks)
            elif part.name in ("person", "replace", "preview"):
                fields[part.name] = (await part.text())[:120]
        if not data:
            return self.json({"error": "no_file"}, HTTPStatus.BAD_REQUEST)
        target = fields.get("person") or None
        if target and not _PERSON_RE(target):
            return self.json({"error": "unknown_person"}, HTTPStatus.BAD_REQUEST)
        try:
            result = await import_bytes(
                hass,
                filename,
                data,
                target,
                fields.get("replace") == "true",
                float(runtime.options[CONF_SAME_PLACE_DISTANCE]),
                preview=fields.get("preview") == "true",
            )
        except ImportError_ as err:
            return self.json({"error": err.key, "detail": err.detail}, HTTPStatus.BAD_REQUEST)
        if fields.get("preview") != "true":
            _changed(hass)
        return self.json(result)


def _PERSON_RE(value: str) -> bool:  # noqa: N802
    try:
        _PERSON(value)
    except vol.Invalid:
        return False
    return True
