"""Diagnostics download (Settings > Devices & services > Whereabouts > Download diagnostics).

Only counts and settings - no places, no coordinates, no addresses, no names of
persons. Keys, persons and sensors are redacted.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    CONF_ADDRESS_SENSORS,
    CONF_CARTO_KEY,
    CONF_DELETE_ACCESS,
    CONF_HISTORY_ACCESS,
    CONF_PERSONS,
    CONF_RECORD_PERSONS,
    DOMAIN,
)

# Redacted in the options: keys, and everything that names persons or sensors.
TO_REDACT = {
    CONF_CARTO_KEY,
    CONF_ADDRESS_SENSORS,
    CONF_PERSONS,
    CONF_RECORD_PERSONS,
    CONF_HISTORY_ACCESS,
    CONF_DELETE_ACCESS,
}


def _storage_summary(runtime) -> dict[str, Any]:
    files = runtime.storage.list_files()
    days = {date for _, date in files}
    return {
        "files": len(files),
        "persons_with_history": len({person for person, _ in files}),
        "days": len(days),
        "first_day": min(days) if days else None,
        "last_day": max(days) if days else None,
    }


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: ConfigEntry) -> dict[str, Any]:
    runtime = hass.data.get(DOMAIN)
    result: dict[str, Any] = {
        "entry_options": async_redact_data(dict(entry.options), TO_REDACT),
        "running": runtime is not None,
    }
    if runtime is None:
        return result
    nominatim = runtime.nominatim
    result.update(
        {
            "version": runtime.version,
            "options": async_redact_data(dict(runtime.options), TO_REDACT),
            "storage": await hass.async_add_executor_job(_storage_summary, runtime),
            "journal": await hass.async_add_executor_job(runtime.journal.summary) if runtime.journal else None,
            "nominatim": {"paused": bool(nominatim.paused)} if nominatim else None,
            "address_job": runtime.addresses.state.get("status") if runtime.addresses else None,
            "data_version": runtime.data_version,
            "panel": runtime.panel,
        }
    )
    return result
