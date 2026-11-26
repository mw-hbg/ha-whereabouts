"""Whereabouts - live map and location history for Home Assistant persons."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import timedelta

from homeassistant.components import frontend, panel_custom
from homeassistant.components.frontend import add_extra_js_url, remove_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import Event, HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_time_change, async_track_time_interval
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration
from homeassistant.util import dt as dt_util

from . import api, downloads, jobs_api, journal_api, maintenance, settings_api
from .addresses import AddressJob
from .const import (
    CARDS_FILE,
    CONF_PANEL,
    CONF_PANEL_ICON,
    CONF_PANEL_TITLE,
    CONF_RETENTION_DAYS,
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
from .jobs import JobManager
from .journal import Journal
from .logger import LocationLogger
from .maintenance import ZoneWatch
from .nominatim import Nominatim
from .settings import Settings
from .storage import HistoryStorage

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
DATA_STATIC = f"{DOMAIN}_static_registered"


def merged_options(entry: ConfigEntry) -> dict:
    """Defaults plus what the user set.

    Older versions had a person list per card (0.1.x one for both). They become
    the persons Whereabouts works with; both cards always exist now.
    """
    options = {**DEFAULT_OPTIONS, **entry.options}
    legacy = set(options.pop("show_persons", None) or [])
    legacy |= set(options.pop("show_persons_live", None) or [])
    legacy |= set(options.pop("show_persons_history", None) or [])
    if "persons" not in entry.options and legacy:
        options["persons"] = sorted(legacy)
    options["live_card"] = True
    options["history_card"] = True
    return options


def base_persons(hass: HomeAssistant, options: dict) -> list[str]:
    """Persons Whereabouts works with: the chosen ones that exist, or all."""
    existing = sorted(hass.states.async_entity_ids("person"))
    chosen = options.get("persons") or []
    return [p for p in existing if p in chosen] if chosen else existing


@dataclass
class Runtime:
    """Everything that belongs to the running integration."""

    version: str
    options: dict
    storage: HistoryStorage
    logger: LocationLogger
    settings: Settings
    nominatim: Nominatim | None = None
    addresses: AddressJob | None = None
    zones: ZoneWatch | None = None
    journal: Journal | None = None  # 0.7.3: log and trash of the data maintenance
    jobs: JobManager | None = None  # 0.7.10: background jobs (maintenance, export, import from the recorder)
    js_url: str | None = None
    panel: bool = False
    # Raised whenever stored data changes outside the live recording (import,
    # data maintenance, deleting, addresses): open cards then load again.
    data_version: int = 0
    # 0.7.5: which days of which persons the last change touched ({"person.alex": ["2026-06-24"]});
    # None = unknown or many, the cards then load everything again.
    data_days: dict[str, list[str]] | None = None
    _known: set[str] = field(default_factory=set)

    def known_persons(self) -> set[str]:
        """Persons with stored history (also no longer recorded ones)."""
        return set(self._known)

    async def async_refresh_known(
        self, hass: HomeAssistant, data_changed: bool = False, days: dict[str, list[str]] | None = None
    ) -> None:
        files = await hass.async_add_executor_job(self.storage.list_files)
        self._known = {f"person.{person}" for person, _ in files}
        if data_changed:
            self.data_version += 1
            self.data_days = days
        async_dispatcher_send(hass, SIGNAL_INFO_CHANGED)

    def data_changed(self, hass: HomeAssistant, days: dict[str, list[str]] | None = None) -> None:
        """Stored data changed: tell the open cards to load again (event loop only).

        ``days``: when only a few days changed, the cards reload just those.
        """
        self.data_version += 1
        self.data_days = days
        async_dispatcher_send(hass, SIGNAL_INFO_CHANGED)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the API and the card files once."""
    api.async_register(hass)
    settings_api.async_register(hass)
    maintenance.async_register(hass)
    journal_api.async_register(hass)
    jobs_api.async_register(hass)
    hass.http.register_view(downloads.DownloadView())
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


PANEL_KEY = f"{DOMAIN}_panel"


async def _register_panel(hass: HomeAssistant, options: dict, version: str) -> None:
    """The sidebar page. Without the sidebar entry it stays reachable at /whereabouts.

    It stays registered across reloads of the integration (every change of an
    option reloads it): Home Assistant rebuilds an open page whenever the panel
    is registered again, so this happens only when entry, name, icon or version
    really changed.
    """
    show = bool(options[CONF_PANEL])
    signature = (show, panel_title(hass, options), options[CONF_PANEL_ICON], version)
    if hass.data.get(PANEL_KEY) == signature and PANEL_URL in hass.data.get("frontend_panels", {}):
        return
    if PANEL_URL in hass.data.get("frontend_panels", {}):
        frontend.async_remove_panel(hass, PANEL_URL)
    hass.data[PANEL_KEY] = signature
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
    storage = HistoryStorage(
        os.path.join(base, HISTORY_FOLDER), options[CONF_SAME_PLACE_DISTANCE], dt_util.get_default_time_zone()
    )
    nominatim = Nominatim(hass, os.path.join(base, GEOCODE_CACHE_FILE), version)
    logger = LocationLogger(hass, storage, nominatim, options)
    settings = Settings(hass)
    await settings.async_load(dict(entry.options))
    runtime = Runtime(version, options, storage, logger, settings, nominatim)
    runtime.zones = ZoneWatch(hass)
    runtime.journal = Journal(base, storage.folder)
    await runtime.zones.async_load()
    runtime.addresses = AddressJob(
        hass,
        storage,
        nominatim,
        float(options[CONF_SAME_PLACE_DISTANCE]),
        lambda: runtime.data_changed(hass),
    )
    runtime.addresses.journal = runtime.journal
    runtime.jobs = JobManager(hass, runtime)
    runtime.addresses.on_finished = lambda state: hass.async_create_task(runtime.jobs.async_address_finished(state))
    await runtime.async_refresh_known(hass)

    # The card files are always loaded: the sidebar page uses them, too.
    runtime.js_url = await _register_frontend(hass, version)
    await _register_panel(hass, options, version)
    runtime.panel = True

    hass.data[DOMAIN] = runtime
    entry.runtime_data = runtime
    logger.start()
    await runtime.addresses.async_load()  # a job that was running goes on
    await runtime.jobs.async_load()
    entry.async_on_unload(entry.add_update_listener(_options_updated))

    async def _flush_cache(_event: Event) -> None:
        """Home Assistant stops: the address cache of the last 30 s is saved, too (0.7.5)."""
        await nominatim.flush()

    entry.async_on_unload(hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, _flush_cache))

    async def _expire_trash(_now=None) -> None:
        limit = journal_api.expire_limit(runtime.options)
        if limit:
            await hass.async_add_executor_job(runtime.journal.expire, limit)

    async def _retention(_now=None) -> None:
        await async_apply_retention(hass, runtime)

    async def _clean_exports(_now=None) -> None:
        await hass.async_add_executor_job(downloads.cleanup, downloads.exports_folder(hass))

    await _clean_exports()
    entry.async_on_unload(async_track_time_interval(hass, _clean_exports, timedelta(hours=1)))
    await _expire_trash()
    entry.async_on_unload(async_track_time_change(hass, _expire_trash, hour=3, minute=27, second=0))
    if options.get(CONF_RETENTION_DAYS):
        entry.async_on_unload(async_track_time_change(hass, _retention, hour=3, minute=17, second=0))
    async_dispatcher_send(hass, SIGNAL_INFO_CHANGED)  # open cards follow the new options
    return True


async def async_apply_retention(hass: HomeAssistant, runtime: Runtime) -> int:
    """Delete the days older than "Delete history automatically after … days" (0.7.5).

    Like every other change of stored data this is logged and the files go to the
    trash first, so a deletion can be undone for the trash period.
    """
    days = int(runtime.options.get(CONF_RETENTION_DAYS) or 0)
    if days <= 0:
        return 0
    limit = (dt_util.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    storage = runtime.storage

    def work() -> tuple[list[tuple[str, str]], int]:
        old = [(person, day) for person, day in storage.list_files() if day < limit]
        return old, storage.delete_before(limit)

    entry_id, backup = journal_api.async_begin(runtime)

    def run() -> tuple[list[tuple[str, str]], int]:
        return storage.with_backup(backup, work) if backup is not None else work()

    old, removed = await hass.async_add_executor_job(run)
    if removed:
        persons = sorted({person for person, _ in old})
        dates = sorted(day for _, day in old)
        await journal_api.async_finish(
            hass, runtime, entry_id, backup, "retention", None, persons, dates[0], dates[-1], removed
        )
        await runtime.async_refresh_known(hass, data_changed=True)
        _LOGGER.info("Removed %s day files older than %s days (kept in the trash)", removed, days)
    return removed


async def _options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    runtime: Runtime = entry.runtime_data
    runtime.logger.stop()
    if runtime.addresses:
        await runtime.addresses.async_stop()
    if runtime.jobs:
        await runtime.jobs.async_stop()
    if runtime.js_url:
        remove_extra_js_url(hass, runtime.js_url)
    # The sidebar page stays (see _register_panel); it is removed with the entry.
    hass.data.pop(DOMAIN, None)
    async_dispatcher_send(hass, SIGNAL_INFO_CHANGED)
    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Removing the integration keeps the history on purpose.

    The files stay in <config>/whereabouts/ and can be deleted by hand; they
    are picked up again if the integration is added back.
    """
    if PANEL_URL in hass.data.get("frontend_panels", {}):
        frontend.async_remove_panel(hass, PANEL_URL)
    hass.data.pop(PANEL_KEY, None)
    _LOGGER.info("Whereabouts removed. The stored history was kept in %s", hass.config.path(STORAGE_FOLDER))
