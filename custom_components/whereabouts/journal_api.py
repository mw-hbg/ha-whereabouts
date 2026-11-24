"""Log and trash of the data maintenance: WebSocket commands and helpers (0.7.3).

- whereabouts/journal/list      entries, size of the trash
- whereabouts/journal/restore   put the days of an entry back (preview: which days changed since)
- whereabouts/journal/delete    delete entries (by id or older than a date) with their trash

Only for administrators. The helpers ``async_logged`` / ``async_begin`` /
``async_finish`` are used by every action that changes stored data.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.util import dt as dt_util

from .const import CONF_TRASH_DAYS, DEFAULT_OPTIONS, DOMAIN
from .journal import Backup

_ID = vol.Match(r"^[0-9]{8}-[0-9]{6}-[0-9a-f]{6}$")
_DATE = vol.Match(r"^\d{4}-\d{2}-\d{2}$")


@callback
def async_register(hass: HomeAssistant) -> None:
    for command in (ws_list, ws_restore, ws_delete):
        websocket_api.async_register_command(hass, command)


def _user_name(user) -> str:
    return str(getattr(user, "name", "") or "") if user is not None else ""


def _keys(persons) -> list[str]:
    return sorted({str(p).split(".", 1)[-1] for p in persons or []})


def async_begin(runtime) -> tuple[str, Backup | None]:
    """A new entry id and the backup that collects the files the action writes."""
    journal = getattr(runtime, "journal", None)
    if journal is None:
        return "", None
    entry_id = journal.new_id(dt_util.now())
    return entry_id, journal.backup(entry_id)


async def async_finish(
    hass: HomeAssistant,
    runtime,
    entry_id: str,
    backup: Backup | None,
    action: str,
    user=None,
    persons=None,
    date_from: str = "",
    date_to: str = "",
    rows: int = 0,
    **extra: Any,
) -> dict[str, Any] | None:
    journal = getattr(runtime, "journal", None)
    if journal is None or not entry_id:
        return None
    entry = {
        "id": entry_id,
        "time": dt_util.now().isoformat(timespec="seconds"),
        "action": action,
        "persons": _keys(persons),
        "from": date_from or "",
        "to": date_to or "",
        "user": _user_name(user),
        "rows": int(rows or 0),
        **extra,
    }
    return await hass.async_add_executor_job(journal.add, entry, backup)


async def async_logged(
    hass: HomeAssistant,
    runtime,
    action: str,
    user,
    persons,
    date_from: str,
    date_to: str,
    work: Callable[[], Any],
    rows: Callable[[Any], int] = lambda result: 0,
) -> Any:
    """Run ``work`` in the executor with a backup, then write the log entry."""
    entry_id, backup = async_begin(runtime)
    if backup is None:
        return await hass.async_add_executor_job(work)
    result = await hass.async_add_executor_job(runtime.storage.with_backup, backup, work)
    await async_finish(hass, runtime, entry_id, backup, action, user, persons, date_from, date_to, rows(result))
    return result


def _runtime(hass: HomeAssistant, connection, msg):
    runtime = hass.data.get(DOMAIN)
    if runtime is None or getattr(runtime, "journal", None) is None:
        connection.send_error(msg["id"], "not_set_up", "Whereabouts is not set up")
        return None
    return runtime


def trash_days(options: dict) -> int:
    value = options.get(CONF_TRASH_DAYS)
    return int(DEFAULT_OPTIONS[CONF_TRASH_DAYS] if value is None else value)


def expire_limit(options: dict) -> str:
    """Trash older than this date is removed ('' = never)."""
    days = trash_days(options)
    return (dt_util.now() - timedelta(days=days)).strftime("%Y-%m-%d") if days > 0 else ""


@websocket_api.websocket_command({vol.Required("type"): "whereabouts/journal/list"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    journal = runtime.journal
    entries = await hass.async_add_executor_job(journal.entries)
    summary = await hass.async_add_executor_job(journal.summary)
    connection.send_result(msg["id"], {**summary, "items": entries, "trash_days": trash_days(runtime.options)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/journal/restore",
        vol.Required("entry"): _ID,
        vol.Optional("preview", default=True): bool,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_restore(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    journal = runtime.journal
    changed = await hass.async_add_executor_job(journal.changed_since, msg["entry"])
    if changed is None:
        connection.send_error(msg["id"], "not_found", "Nothing to restore")
        return
    if msg["preview"]:
        connection.send_result(msg["id"], {"changed": changed, "preview": True})
        return
    original = next((e for e in await hass.async_add_executor_job(journal.entries) if e["id"] == msg["entry"]), {})
    entry_id, backup = async_begin(runtime)
    days = await hass.async_add_executor_job(runtime.storage.locked, journal.restore_files, msg["entry"], backup)
    entry = await async_finish(
        hass,
        runtime,
        entry_id,
        backup,
        "restore",
        connection.user,
        original.get("persons"),
        original.get("from", ""),
        original.get("to", ""),
        days,
        ref=msg["entry"],
        ref_action=original.get("action", ""),
    )
    await hass.async_add_executor_job(journal.update, msg["entry"], {"restored": entry["id"] if entry else ""})
    await runtime.async_refresh_known(hass, data_changed=True)
    connection.send_result(msg["id"], {"days": days, "changed": changed, "preview": False})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "whereabouts/journal/delete",
        vol.Optional("ids"): vol.All([_ID], vol.Length(max=5000)),
        vol.Optional("before"): _DATE,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    runtime = _runtime(hass, connection, msg)
    if runtime is None:
        return
    if not msg.get("ids") and not msg.get("before"):
        connection.send_error(msg["id"], "invalid", "ids or before needed")
        return
    deleted = await hass.async_add_executor_job(runtime.journal.delete, msg.get("ids"), msg.get("before", ""))
    connection.send_result(msg["id"], {"deleted": deleted})
