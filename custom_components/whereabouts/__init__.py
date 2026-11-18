"""Whereabouts - live map and location history for Home Assistant persons."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field

from homeassistant.components import frontend, panel_custom
from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from . import api, settings_api
from .const import (
    CARDS_FILE,
    CONF_PANEL,
    CONF_PANEL_ICON,
    CONF_PANEL_TITLE,
    CONF_SAME_PLACE_DISTANCE,
    DEFAULT_OPTIONS,
    DOMAIN,
    FRONTEND_URL_BASE,
    GEOCODE_CACHE_FILE,
    HISTORY_FOLDER,
    PANEL_ELEMENT,
    PANEL_FILE,
    PANEL_URL,
    SIGNAL_INFO_CHANGED,
    STORAGE_FOLDER,
)
from .logger import LocationLogger
from .nominatim import Nominatim
from .settings import Settings
from .storage import HistoryStorage

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
DATA_STATIC = f"{DOMAIN}_static_registered"


def merged_options(entry: ConfigEntry) -> dict:
    """Defaults plus what the user set (0.1.x had one person list for both cards)."""
    options = {**DEFAULT_OPTIONS, **entry.options}
    legacy = options.pop("show_persons", None)
    if legacy:
        for key in ("show_persons_live", "show_persons_history"):
            if key not in entry.options:
                options[key] = list(legacy)
    return options


@dataclass
class Runtime:
    """Everything that belongs to the running integration."""

    version: str
    options: dict
    storage: HistoryStorage
    logger: LocationLogger
    settings: Settings
    nominatim: Nominatim | None = None
    js_url: str | None = None
    panel: bool = False
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
    settings_api.async_register(hass)
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


def panel_title(hass: HomeAssistant, options: dict) -> str:
    """Own title, or "Standorte" / "Whereabouts" by the system language."""
    if options.get(CONF_PANEL_TITLE):
        return str(options[CONF_PANEL_TITLE])
    return "Standorte" if (hass.config.language or "").startswith("de") else "Whereabouts"


async def _register_panel(hass: HomeAssistant, options: dict, version: str) -> None:
    """The sidebar page. Without the sidebar entry it stays reachable at /whereabouts."""
    show = bool(options[CONF_PANEL])
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=panel_title(hass, options) if show else None,
        sidebar_icon=(options[CONF_PANEL_ICON] or "mdi:map-marker-radius") if show else None,
        module_url=f"{FRONTEND_URL_BASE}/{PANEL_FILE}?v={version}",
        require_admin=False,
        config={"version": version},
    )


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    integration = await async_get_integration(hass, DOMAIN)
    version = str(integration.version)
    options = merged_options(entry)

    base = hass.config.path(STORAGE_FOLDER)
    storage = HistoryStorage(os.path.join(base, HISTORY_FOLDER), options[CONF_SAME_PLACE_DISTANCE])
    nominatim = Nominatim(hass, os.path.join(base, GEOCODE_CACHE_FILE), version)
    logger = LocationLogger(hass, storage, nominatim, options)
    settings = Settings(hass)
    await settings.async_load(dict(entry.options))
    runtime = Runtime(version, options, storage, logger, settings, nominatim)
    await runtime.async_refresh_known(hass)

    # The card files are always loaded: the sidebar page uses them, too.
    runtime.js_url = await _register_frontend(hass, version)
    await _register_panel(hass, options, version)
    runtime.panel = True

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
    if runtime.panel:
        frontend.async_remove_panel(hass, PANEL_URL)
    hass.data.pop(DOMAIN, None)
    async_dispatcher_send(hass, SIGNAL_INFO_CHANGED)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Removing the integration keeps the history on purpose.

    The files stay in <config>/whereabouts/ and can be deleted by hand; they
    are picked up again if the integration is added back.
    """
    _LOGGER.info("Whereabouts removed. The stored history was kept in %s", hass.config.path(STORAGE_FOLDER))
