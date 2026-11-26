"""WebSocket commands of the settings page and the file import.

Every user reads and changes only their own personal settings (unless the
administrator locked the category). Defaults, locks, rights, the integration
options and the import are for administrators only.
"""

from __future__ import annotations

import ipaddress
import os
import re
import secrets
import socket
import time
from http import HTTPStatus
from typing import Any
from urllib.parse import urlparse

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
    CONF_MAX_GPS_ACCURACY,
    CONF_MIN_INTERVAL,
    CONF_PANEL,
    CONF_PANEL_ICON,
    CONF_PANEL_TITLE,
    CONF_PERSONS,
    CONF_RECORD_PERSONS,
    CONF_RETENTION_DAYS,
    CONF_SAME_PLACE_DISTANCE,
    CONF_TRASH_DAYS,
    DEFAULT_OPTIONS,
    DOMAIN,
    SIGNAL_INFO_CHANGED,
)
from .geo import find_address_sensor
from .importer import ImportError_
from .importing import import_bytes
from .journal import history_size
from .logger import person_key
from .settings import CATEGORIES, LOCK_MODES, RIGHT_KINDS, RIGHT_LEVELS, category_defaults, validate_values

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
        vol.Optional(CONF_PERSONS): _PERSONS,
        vol.Optional(CONF_RECORD_PERSONS): _PERSONS,
        vol.Optional(CONF_MIN_INTERVAL): vol.All(vol.Coerce(int), vol.Range(min=10, max=3600)),
        vol.Optional(CONF_SAME_PLACE_DISTANCE): vol.All(vol.Coerce(int), vol.Range(min=10, max=1000)),
        vol.Optional(CONF_MAX_GPS_ACCURACY): vol.All(vol.Coerce(int), vol.Range(min=0, max=1000)),
        vol.Optional(CONF_RETENTION_DAYS): vol.All(vol.Coerce(int), vol.Range(min=0, max=36500)),
        vol.Optional(CONF_TRASH_DAYS): vol.All(vol.Coerce(int), vol.Range(min=0, max=36500)),
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
        ws_promote,
        ws_flags,
        ws_field_lock,
        ws_user,
        ws_options_reset,
        ws_check_key,
        ws_restore,
        ws_new_users,
        ws_retention_preview,
        ws_image_in_use,
    ):
        websocket_api.async_register_command(hass, command)
    hass.http.register_view(ImportView())
    hass.http.register_view(FetchImageView())


def _ready(hass, connection, msg, admin: bool = False):
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_SET_UP, "Whereabouts is not set up")
        return None
    if admin and not connection.user.is_admin:
        connection.send_error(msg["id"], ERR_FORBIDDEN, "Only for administrators")
        return None
    return runtime


def _stored_counts(files: list[tuple[str, str]]) -> dict[str, int]:
    return {"persons": len({person for person, _ in files}), "days": len(files)}


def _changed(hass: HomeAssistant) -> None:
    """Open cards and pages follow at once."""
    async_dispatcher_send(hass, SIGNAL_INFO_CHANGED)


def _persons(hass: HomeAssistant, only: list[str] | None = None) -> list[dict[str, Any]]:
    result = []
    for entity_id in sorted(hass.states.async_entity_ids("person")):
        if only is not None and entity_id not in only:
            continue
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
    linked = {
        state.attributes.get("user_id") for state in hass.states.async_all("person") if state.attributes.get("user_id")
    }
    return sorted(
        (
            {
                "id": u.id,
                "name": u.name or u.id,
                "is_admin": u.is_admin,
                "active": u.is_active,
                # e.g. the MQTT broker's user: may only log in locally or has no person
                "technical": bool(getattr(u, "local_only", False)) or u.id not in linked,
            }
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
    from . import base_persons

    user = connection.user
    settings = runtime.settings
    base = base_persons(hass, runtime.options)
    result: dict[str, Any] = {
        "version": runtime.version,
        "is_admin": user.is_admin,
        "user": {"id": user.id, "name": user.name},
        "categories": list(CATEGORIES),
        "own": settings.own(user.id),
        "effective": settings.effective(user),
        "defaults": settings.defaults(),
        # built-in values: "Auf Standard zurücksetzen" goes back to these
        "factory": {cat: category_defaults(cat) for cat in CATEGORIES},
        "locked": settings.locked_categories(user),
        "rights": {kind: settings.allowed(user, kind) for kind in RIGHT_KINDS},
        "own_rights": user.id in settings.data["rights"],
        "persons": _persons(hass, base),
        "synced": settings.synced(user),
        "settings_hidden": settings.settings_hidden(user),
        "field_locks": {cat: settings.locked_keys(user, cat) for cat in CATEGORIES if settings.locked_keys(user, cat)},
        "carto_key_set": bool(runtime.options.get(CONF_CARTO_KEY)),
        "zones": [
            {"entity_id": z.entity_id, "name": z.name, "passive": bool(z.attributes.get("passive"))}
            for z in sorted(hass.states.async_all("zone"), key=lambda z: (z.entity_id != "zone.home", z.name.lower()))
        ],
    }
    if user.is_admin:
        users = await _users(hass)
        # other users that settings and rights can be made for
        others = [u for u in users if u["id"] != user.id and not u["is_admin"] and not u["technical"] and u["active"]]
        pending = await settings.async_note_users(user, [u["id"] for u in others])
        result["admin"] = {
            **settings.admin_view(),
            "pending_users": pending,
            "has_other_users": bool(others),
            "users": users,
            "options": {str(key): runtime.options.get(str(key)) for key in OPTIONS_SCHEMA.schema},
            # built-in values of the options (marked "own value" where they differ)
            "option_defaults": {
                str(key): DEFAULT_OPTIONS.get(str(key)) for key in OPTIONS_SCHEMA.schema if str(key) in DEFAULT_OPTIONS
            },
            "all_persons": _persons(hass),
            "address": _address_info(hass, runtime, base),
            # zones created, changed, renamed or removed since the data was last checked
            "zone_changes": (await runtime.zones.async_changes())[0] if runtime.zones else [],
            "address_job": runtime.addresses.status() if runtime.addresses else {"status": "idle"},
            # short info for the header of "Diagnostics"
            "stored": _stored_counts(await hass.async_add_executor_job(runtime.storage.list_files)),
            # 0.7.3: size of the history (per person) and of the trash
            "history_size": await hass.async_add_executor_job(history_size, runtime.storage.folder),
            "journal": await hass.async_add_executor_job(runtime.journal.summary) if runtime.journal else None,
        }
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/save",
        vol.Required("scope"): vol.In(["own", "defaults"]),
        vol.Required("category"): vol.In(list(CATEGORIES)),
        vol.Required("values"): dict,
        # administrators: change another user's own values
        vol.Optional("user_id"): _USER_ID,
    }
)
@websocket_api.async_response
async def ws_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Change personal values (own), a user's values or the defaults (administrators)."""
    other = msg.get("user_id") and msg["user_id"] != connection.user.id
    runtime = _ready(hass, connection, msg, admin=msg["scope"] == "defaults" or bool(other))
    if runtime is None:
        return
    user = connection.user
    if msg["scope"] == "own" and not other:
        locked = runtime.settings.locked_keys(user, msg["category"])
        if "*" in locked or any(key in locked for key in msg["values"]):
            connection.send_error(msg["id"], ERR_LOCKED, "Fixed by the administrator")
            return
    try:
        validate_values(msg["category"], msg["values"])
    except vol.Invalid as err:
        connection.send_error(msg["id"], ERR_INVALID, str(err))
        return
    await runtime.settings.async_set(msg["scope"], msg.get("user_id") or user.id, msg["category"], msg["values"])
    _changed(hass)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/reset",
        vol.Required("scope"): vol.In(["own", "defaults"]),
        vol.Optional("category"): vol.In(list(CATEGORIES)),
        vol.Optional("user_id"): _USER_ID,
        # back to the built-in values (not just to the defaults)
        vol.Optional("factory", default=False): bool,
        # administrators: also for all users and the defaults
        vol.Optional("everyone", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_reset(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Back to the defaults (own / a user) or to the built-in values (defaults, administrators)."""
    other = msg.get("user_id") and msg["user_id"] != connection.user.id
    runtime = _ready(hass, connection, msg, admin=msg["scope"] == "defaults" or bool(other))
    if runtime is None:
        return
    user = connection.user
    if (
        msg["scope"] == "own"
        and not other
        and msg.get("category")
        and runtime.settings.locked_keys(user, msg["category"])
    ):
        connection.send_error(msg["id"], ERR_LOCKED, "Fixed by the administrator")
        return
    target = msg.get("user_id") or user.id
    if msg["factory"] and msg.get("category"):
        if msg["everyone"] and not user.is_admin:
            connection.send_error(msg["id"], ERR_FORBIDDEN, "Only for administrators")
            return
        settings = runtime.settings
        snap = settings.snapshot(msg["category"])
        if not msg["everyone"]:
            snap = {"only": target, "users": {target: snap["users"].get(target)}}
        token = _remember(hass, user.id, msg["category"], snap)
        await settings.async_factory_reset(target, msg["category"], msg["everyone"])
        _changed(hass)
        connection.send_result(msg["id"], {"undo": token})
        return
    await runtime.settings.async_reset(msg["scope"], target, msg.get("category"))
    _changed(hass)
    connection.send_result(msg["id"])


UNDO_SECONDS = 35  # the page offers "restore" for 30 s
_UNDO_KEY = f"{DOMAIN}_undo"


def _remember(hass: HomeAssistant, user_id: str, category: str, snap: dict) -> str:
    store: dict = hass.data.setdefault(_UNDO_KEY, {})
    now = time.monotonic()
    for token in [t for t, entry in store.items() if now - entry[0] > UNDO_SECONDS]:
        store.pop(token, None)
    token = secrets.token_hex(8)
    store[token] = (now, user_id, category, snap)
    return token


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/restore",
        vol.Required("token"): vol.All(str, vol.Length(max=40)),
    }
)
@websocket_api.async_response
async def ws_restore(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Undo a reset of a whole category (within 30 s)."""
    runtime = _ready(hass, connection, msg)
    if runtime is None:
        return
    entry = hass.data.get(_UNDO_KEY, {}).pop(msg["token"], None)
    if entry is None or entry[1] != connection.user.id or time.monotonic() - entry[0] > UNDO_SECONDS:
        connection.send_error(msg["id"], ERR_INVALID, "Too late")
        return
    _, _, category, snap = entry
    settings = runtime.settings
    if "only" in snap:
        value = snap["users"].get(snap["only"])
        own = settings.data["users"].setdefault(snap["only"], {})
        if value is None:
            own.pop(category, None)
        else:
            own[category] = value
        if not own:
            settings.data["users"].pop(snap["only"], None)
        await settings.async_save()
    else:
        await settings.async_restore(category, snap)
    _changed(hass)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/new_users",
        vol.Required("user_ids"): vol.All([_USER_ID], vol.Length(min=1, max=100)),
        vol.Required("action"): vol.In(["copy", "sync", "factory", "later"]),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_new_users(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Decide which settings new users start with."""
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    await runtime.settings.async_decide_users(connection.user, msg["user_ids"], msg["action"])
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
    if values.get(CONF_PERSONS):
        # Only persons Whereabouts works with are recorded.
        options[CONF_RECORD_PERSONS] = [p for p in options[CONF_RECORD_PERSONS] if p in values[CONF_PERSONS]]
    if CONF_ADDRESS_SENSORS in values:
        options[CONF_ADDRESS_SENSORS] = {k: v for k, v in values[CONF_ADDRESS_SENSORS].items() if v}
    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"])


def _is_address_sensor(state) -> bool:
    attrs = state.attributes
    return ("Location" in attrs or "location" in attrs) and any(
        key in attrs for key in ("Locality", "locality", "Thoroughfare", "thoroughfare")
    )


def _address_info(hass: HomeAssistant, runtime, base: list[str]) -> dict[str, Any]:
    """Per person the sensor found automatically, and all sensors that deliver addresses."""
    auto = {}
    for entity_id in base:
        sensor_id = find_address_sensor(hass, hass.states.get(entity_id))
        sensor = hass.states.get(sensor_id) if sensor_id else None
        auto[entity_id] = {
            "sensor": sensor_id or "",
            "name": sensor.name if sensor else "",
            "ok": bool(sensor and sensor.state not in ("unavailable", "unknown")),
        }
    sensors = sorted(
        ({"entity_id": s.entity_id, "name": s.name} for s in hass.states.async_all("sensor") if _is_address_sensor(s)),
        key=lambda s: s["name"].lower(),
    )
    return {"auto": auto, "sensors": sensors}


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/promote",
        vol.Optional("category"): vol.In(list(CATEGORIES)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_promote(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """My current settings (one category or all) become the defaults for everybody."""
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    await runtime.settings.async_promote(connection.user, msg.get("category"))
    _changed(hass)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/flags",
        # a user's ID or "all"
        vol.Required("user_id"): vol.Any("all", _USER_ID),
        vol.Optional("sync"): bool,
        vol.Optional("hide_settings"): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_flags(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Synchronise with my settings / hide the settings tab - for one user or everybody."""
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    values = {key: msg[key] for key in ("sync", "hide_settings") if key in msg}
    admins = {u.id for u in await hass.auth.async_get_users() if u.is_admin}
    await runtime.settings.async_set_flags(connection.user, msg["user_id"], values, admins)
    _changed(hass)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/field_lock",
        vol.Required("user_id"): _USER_ID,
        vol.Required("category"): vol.In(list(CATEGORIES)),
        vol.Required("keys"): vol.All([vol.All(str, vol.Length(max=60))], vol.Length(max=50)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_field_lock(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Fix single settings (or with "*" the whole category) for one user."""
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    await runtime.settings.async_set_field_lock(msg["user_id"], msg["category"], msg["keys"])
    _changed(hass)
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/user",
        vol.Required("user_id"): _USER_ID,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_user(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """One user's settings, for an administrator editing them."""
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    other = await hass.auth.async_get_user(msg["user_id"])
    if other is None:
        connection.send_error(msg["id"], ERR_INVALID, "Unknown user")
        return
    settings = runtime.settings
    connection.send_result(
        msg["id"],
        {
            "id": other.id,
            "name": other.name,
            "is_admin": other.is_admin,
            "own": settings.own(other.id),
            "effective": settings.effective(other),
            "field_locks": settings.field_locks(other.id),
            "synced": settings.synced(other),
            "rights": {kind: settings.allowed(other, kind) for kind in RIGHT_KINDS},
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/options_reset",
        vol.Required("keys"): vol.All([vol.In([str(k) for k in OPTIONS_SCHEMA.schema])], vol.Length(min=1)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_options_reset(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Back to the built-in values for some integration options (e.g. the sidebar)."""
    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        connection.send_error(msg["id"], ERR_NOT_SET_UP, "Whereabouts is not set up")
        return
    options = {**runtime.options}
    for key in msg["keys"]:
        if key in DEFAULT_OPTIONS:
            options[key] = DEFAULT_OPTIONS[key]
        else:
            options.pop(key, None)
    hass.config_entries.async_update_entry(entries[0], options=options)
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/settings/check_key"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_check_key(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Does CARTO deliver a tile with the stored key? (one small request)"""
    from homeassistant.helpers.aiohttp_client import async_get_clientsession

    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    key = runtime.options.get(CONF_CARTO_KEY) or ""
    if not key:
        connection.send_result(msg["id"], {"ok": False, "reason": "no_key"})
        return
    url = f"https://a.basemaps.cartocdn.com/rastertiles/voyager/12/2148/1409.png?key={key}"
    try:
        async with async_get_clientsession(hass).get(url, timeout=10) as response:
            ok = response.status == 200 and response.content_type.startswith("image/")
            reason = "" if ok else f"http_{response.status}"
    except Exception:  # noqa: BLE001 - any network problem means "could not check"
        ok, reason = False, "unreachable"
    connection.send_result(msg["id"], {"ok": ok, "reason": reason})


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
    from . import base_persons

    base = base_persons(hass, runtime.options)
    for entity_id in sorted(hass.states.async_entity_ids("person")):
        if entity_id not in base:
            continue
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
            # 0.7.5: for the download of Home Assistant's diagnostics (diagnostics.py)
            "entry_id": next((e.entry_id for e in hass.config_entries.async_entries(DOMAIN)), ""),
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
            elif part.name in ("person", "replace", "preview", "mode", "day_edges"):
                fields[part.name] = (await part.text())[:120]
            elif part.name == "days":
                fields["days"] = (await part.text())[:200_000]
        if not data:
            return self.json({"error": "no_file"}, HTTPStatus.BAD_REQUEST)
        target = fields.get("person") or None
        if target and not _PERSON_RE(target):
            return self.json({"error": "unknown_person"}, HTTPStatus.BAD_REQUEST)
        days = None
        if "days" in fields:
            days = [d for d in fields["days"].split(",") if re.match(r"^[a-z0-9_]{1,100}\|\d{4}-\d{2}-\d{2}$", d)]
        try:
            result = await import_bytes(
                hass,
                filename,
                data,
                target,
                fields.get("replace") == "true",
                float(runtime.options[CONF_SAME_PLACE_DISTANCE]),
                preview=fields.get("preview") == "true",
                days=days,
                mode=fields.get("mode"),
                day_edges=fields.get("day_edges") == "true",
                user=user,
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


MAX_IMAGE_BYTES = 10 * 1024 * 1024


def _public_host(host: str) -> bool:
    """Only addresses on the internet: nothing in the home network or on this machine."""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if not address.is_global:
            return False
    return bool(infos)


class FetchImageView(HomeAssistantView):
    """GET /api/whereabouts/image?url=... - loads a picture from the internet once,
    so the page can crop it. Admins only. Only images, at most 10 MB, only public addresses."""

    url = "/api/whereabouts/image"
    name = "api:whereabouts:image"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        from homeassistant.helpers.aiohttp_client import async_get_clientsession

        hass: HomeAssistant = request.app["hass"]
        if _runtime(hass) is None:
            return self.json_message("Whereabouts is not set up", HTTPStatus.NOT_FOUND)
        user = request.get("hass_user")
        if user is None or not user.is_admin:
            return self.json({"error": "admin_only"}, HTTPStatus.FORBIDDEN)
        target = request.query.get("url", "")[:2000]
        parsed = urlparse(target)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return self.json({"error": "invalid_url"}, HTTPStatus.BAD_REQUEST)
        if not await hass.async_add_executor_job(_public_host, parsed.hostname):
            return self.json({"error": "not_public"}, HTTPStatus.BAD_REQUEST)
        try:
            async with async_get_clientsession(hass).get(target, timeout=15, allow_redirects=False) as response:
                if response.status != 200:
                    return self.json({"error": f"http_{response.status}"}, HTTPStatus.BAD_GATEWAY)
                if not response.content_type.startswith("image/") or response.content_type == "image/svg+xml":
                    return self.json({"error": "not_image"}, HTTPStatus.BAD_REQUEST)
                if (response.content_length or 0) > MAX_IMAGE_BYTES:
                    return self.json({"error": "too_large"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                chunks, size = [], 0
                async for chunk in response.content.iter_chunked(256 * 1024):
                    size += len(chunk)
                    if size > MAX_IMAGE_BYTES:
                        return self.json({"error": "too_large"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                    chunks.append(chunk)
                content_type = response.content_type
        except Exception:  # noqa: BLE001 - any network problem means "could not load"
            return self.json({"error": "unreachable"}, HTTPStatus.BAD_GATEWAY)
        return web.Response(body=b"".join(chunks), content_type=content_type, headers={"Cache-Control": "no-store"})


def _days_before(folder: str, limit: str) -> int:
    """Number of day files older than ``limit`` (what the retention would delete)."""
    try:
        names = os.listdir(folder)
    except FileNotFoundError:
        return 0
    count = 0
    for name in names:
        if name.endswith(".csv") and "_" in name and name[:-4].rsplit("_", 1)[1] < limit:
            count += 1
    return count


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/retention_preview",
        vol.Required("days"): vol.All(vol.Coerce(int), vol.Range(min=1, max=36500)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_retention_preview(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """How many day files (all persons) the next nightly cleanup would delete."""
    from datetime import timedelta

    from homeassistant.util import dt as dt_util

    runtime = _ready(hass, connection, msg, admin=True)
    if runtime is None:
        return
    limit = (dt_util.now() - timedelta(days=msg["days"])).strftime("%Y-%m-%d")
    count = await hass.async_add_executor_job(_days_before, runtime.storage.folder, limit)
    connection.send_result(msg["id"], {"files": count, "before": limit})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/settings/image_in_use",
        vol.Required("image_id"): vol.Match(r"^[a-z0-9]{1,64}$"),
    }
)
@callback
def ws_image_in_use(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Is an uploaded picture still used somewhere (any user's settings, the defaults, a person)?

    The settings page deletes a replaced picture only when nobody uses it any more."""
    runtime = _ready(hass, connection, msg)
    if runtime is None:
        return
    needle = f"/api/image/serve/{msg['image_id']}/"
    data = runtime.settings.data
    texts = [str(data.get("defaults")), str(data.get("users"))]
    texts += [str(state.attributes.get("entity_picture") or "") for state in hass.states.async_all("person")]
    connection.send_result(msg["id"], {"in_use": any(needle in text for text in texts)})
