"""Whereabouts - live map and location history for Home Assistant persons."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field

from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from . import api
from .const import (
    CARDS_FILE,
    CONF_HISTORY_CARD,
    CONF_LIVE_CARD,
    CONF_SAME_PLACE_DISTANCE,
    DEFAULT_OPTIONS,
    DOMAIN,
    FRONTEND_URL_BASE,
    GEOCODE_CACHE_FILE,
    HISTORY_FOLDER,
    SIGNAL_INFO_CHANGED,
    STORAGE_FOLDER,
)
from .logger import LocationLogger
from .nominatim import Nominatim
from .storage import HistoryStorage

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
DATA_STATIC = f"{DOMAIN}_static_registered"


def merged_options(entry: ConfigEntry) -> dict:
    """Defaults plus what the user set."""
    return {**DEFAULT_OPTIONS, **entry.options}


@dataclass
class Runtime:
    """Everything that belongs to the running integration."""

    version: str
    options: dict
    storage: HistoryStorage
    logger: LocationLogger
    js_url: str | None = None
    _known: set[str] = field(default_factory=set)

    def known_persons(self) -> set[str]:
        """Persons with stored history (also no longer recorded ones)."""
        return set(self._known)

    async def async_refresh_known(self, hass: HomeAssistant) -> None:
        files = await hass.async_add_executor_job(self.storage.list_files)
        self._known = {f"person.{person}" for person, _ in files}
        async_dispatcher_send(hass, SIGNAL_INFO_CHANGED)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the API and the card files once."""
    api.async_register(hass)
    return True


async def _register_frontend(hass: HomeAssistant, version: str) -> str:
    if not hass.data.get(DATA_STATIC):
        folder = os.path.join(os.path.dirname(__file__), "frontend")
        await hass.http.async_register_static_paths([StaticPathConfig(FRONTEND_URL_BASE, folder, cache_headers=False)])
        hass.data[DATA_STATIC] = True
    # Version in the URL: browsers and proxies (e.g. Cloudflare) load the new
    # cards right after an update.
    url = f"{FRONTEND_URL_BASE}/{CARDS_FILE}?v={version}"
    add_extra_js_url(hass, url)
    return url


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    integration = await async_get_integration(hass, DOMAIN)
    version = str(integration.version)
    options = merged_options(entry)

    base = hass.config.path(STORAGE_FOLDER)
    storage = HistoryStorage(os.path.join(base, HISTORY_FOLDER), options[CONF_SAME_PLACE_DISTANCE])
    nominatim = Nominatim(hass, os.path.join(base, GEOCODE_CACHE_FILE), version)
    logger = LocationLogger(hass, storage, nominatim, options)
    runtime = Runtime(version, options, storage, logger)
    await runtime.async_refresh_known(hass)

    if options[CONF_LIVE_CARD] or options[CONF_HISTORY_CARD]:
        runtime.js_url = await _register_frontend(hass, version)

    hass.data[DOMAIN] = runtime
    entry.runtime_data = runtime
    logger.start()
    entry.async_on_unload(entry.add_update_listener(_options_updated))
    async_dispatcher_send(hass, SIGNAL_INFO_CHANGED)  # open cards follow the new options
    return True


async def _options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    runtime: Runtime = entry.runtime_data
    runtime.logger.stop()
    if runtime.js_url:
        remove_extra_js_url(hass, runtime.js_url)
    hass.data.pop(DOMAIN, None)
    async_dispatcher_send(hass, SIGNAL_INFO_CHANGED)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Removing the integration keeps the history on purpose.

    The files stay in <config>/whereabouts/ and can be deleted by hand; they
    are picked up again if the integration is added back.
    """
    _LOGGER.info("Whereabouts removed. The stored history was kept in %s", hass.config.path(STORAGE_FOLDER))
