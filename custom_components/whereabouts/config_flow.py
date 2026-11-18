"""Set-up and options (all in the Home Assistant UI)."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant.components.file_upload import process_uploaded_file
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import selector
from homeassistant.util import dt as dt_util

from . import merged_options
from .const import (
    ADDRESS_SOURCES,
    CONF_ADDRESS_MAX_DISTANCE,
    CONF_ADDRESS_SENSORS,
    CONF_ADDRESS_SOURCE,
    CONF_DELETE_ACCESS,
    CONF_HISTORY_ACCESS,
    CONF_HISTORY_CARD,
    CONF_LIVE_CARD,
    CONF_MIN_INTERVAL,
    CONF_RECORD_PERSONS,
    CONF_RETENTION_DAYS,
    CONF_SAME_PLACE_DISTANCE,
    CONF_SHOW_PERSONS_HISTORY,
    CONF_SHOW_PERSONS_LIVE,
    DEFAULT_OPTIONS,
    DELETE_ACCESS_LEVELS,
    DOMAIN,
    HISTORY_ACCESS_LEVELS,
    NAME,
)
from .geo import find_address_sensor, zone_in_snapshot, zone_snapshot
from .importer import ImportError_, read_import, summarize
from .logger import person_key

_LOGGER = logging.getLogger(__name__)

CONF_FILE = "file"
CONF_TARGET_PERSON = "target_person"
CONF_REPLACE = "replace"


def _select(options: list[str], key: str) -> selector.SelectSelector:
    return selector.SelectSelector(
        selector.SelectSelectorConfig(options=options, translation_key=key, mode=selector.SelectSelectorMode.DROPDOWN)
    )


def _number(minimum: int, maximum: int, unit: str) -> selector.NumberSelector:
    return selector.NumberSelector(
        selector.NumberSelectorConfig(
            min=minimum, max=maximum, step=1, unit_of_measurement=unit, mode=selector.NumberSelectorMode.BOX
        )
    )


_PERSONS = selector.EntitySelector(selector.EntitySelectorConfig(domain="person", multiple=True))


def _basic_schema(values: dict) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_LIVE_CARD, default=values[CONF_LIVE_CARD]): selector.BooleanSelector(),
            vol.Required(CONF_HISTORY_CARD, default=values[CONF_HISTORY_CARD]): selector.BooleanSelector(),
            vol.Optional(CONF_RECORD_PERSONS, default=values[CONF_RECORD_PERSONS]): _PERSONS,
            vol.Required(CONF_ADDRESS_SOURCE, default=values[CONF_ADDRESS_SOURCE]): _select(
                ADDRESS_SOURCES, CONF_ADDRESS_SOURCE
            ),
        }
    )


class WhereaboutsConfigFlow(ConfigFlow, domain=DOMAIN):
    """First set-up: which cards, whose history, where addresses come from."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            options = {**DEFAULT_OPTIONS, **user_input}
            if not options[CONF_HISTORY_CARD]:
                options[CONF_RECORD_PERSONS] = []
            return self.async_create_entry(title=NAME, data={}, options=options)
        return self.async_show_form(step_id="user", data_schema=_basic_schema(DEFAULT_OPTIONS))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return WhereaboutsOptionsFlow()


class WhereaboutsOptionsFlow(OptionsFlow):
    """Options as a menu: one section per card, recording, addresses, access, import."""

    def _values(self) -> dict:
        return merged_options(self.config_entry)

    def _save(self, changes: dict) -> ConfigFlowResult:
        options = {**self._values(), **changes}
        if not options[CONF_HISTORY_CARD]:
            options[CONF_RECORD_PERSONS] = []
        return self.async_create_entry(data=options)

    def _names(self, entity_ids: list[str]) -> str:
        """Persons of the other card, for comparison (empty = all)."""
        if not entity_ids:
            return "alle" if (self.hass.config.language or "").startswith("de") else "all"
        names = []
        for entity_id in entity_ids:
            state = self.hass.states.get(entity_id)
            names.append(state.name if state else entity_id)
        return ", ".join(names)

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return self.async_show_menu(
            step_id="init",
            menu_options=["card_live", "card_history", "recording", "addresses", "access", "import_file"],
        )

    async def async_step_card_live(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """The "Where is…?" card: on/off and whom it shows."""
        values = self._values()
        if user_input is not None:
            return self._save(user_input)
        schema = vol.Schema(
            {
                vol.Required(CONF_LIVE_CARD, default=values[CONF_LIVE_CARD]): selector.BooleanSelector(),
                vol.Optional(CONF_SHOW_PERSONS_LIVE, default=values[CONF_SHOW_PERSONS_LIVE]): _PERSONS,
            }
        )
        return self.async_show_form(
            step_id="card_live",
            data_schema=schema,
            description_placeholders={"other": self._names(values[CONF_SHOW_PERSONS_HISTORY])},
        )

    async def async_step_card_history(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """The history card: on/off and whom it shows."""
        values = self._values()
        if user_input is not None:
            return self._save(user_input)
        schema = vol.Schema(
            {
                vol.Required(CONF_HISTORY_CARD, default=values[CONF_HISTORY_CARD]): selector.BooleanSelector(),
                vol.Optional(CONF_SHOW_PERSONS_HISTORY, default=values[CONF_SHOW_PERSONS_HISTORY]): _PERSONS,
            }
        )
        return self.async_show_form(
            step_id="card_history",
            data_schema=schema,
            description_placeholders={"other": self._names(values[CONF_SHOW_PERSONS_LIVE])},
        )

    async def async_step_recording(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Whose history is recorded, how often, how long it is kept."""
        values = self._values()
        if user_input is not None:
            return self._save(user_input)
        schema = vol.Schema(
            {
                vol.Optional(CONF_RECORD_PERSONS, default=values[CONF_RECORD_PERSONS]): _PERSONS,
                vol.Required(CONF_MIN_INTERVAL, default=values[CONF_MIN_INTERVAL]): _number(10, 3600, "s"),
                vol.Required(CONF_SAME_PLACE_DISTANCE, default=values[CONF_SAME_PLACE_DISTANCE]): _number(
                    10, 1000, "m"
                ),
                vol.Required(CONF_RETENTION_DAYS, default=values[CONF_RETENTION_DAYS]): _number(0, 36500, "d"),
            }
        )
        return self.async_show_form(step_id="recording", data_schema=schema)

    async def async_step_addresses(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Address source and, per recorded person, the phone's geocoded sensor."""
        values = self._values()
        persons = values[CONF_RECORD_PERSONS]
        if user_input is not None:
            sensors = {p: user_input[p] for p in persons if user_input.get(p)}
            return self._save(
                {
                    CONF_ADDRESS_SOURCE: user_input[CONF_ADDRESS_SOURCE],
                    CONF_ADDRESS_MAX_DISTANCE: user_input[CONF_ADDRESS_MAX_DISTANCE],
                    CONF_ADDRESS_SENSORS: sensors,
                }
            )
        fields: dict = {
            vol.Required(CONF_ADDRESS_SOURCE, default=values[CONF_ADDRESS_SOURCE]): _select(
                ADDRESS_SOURCES, CONF_ADDRESS_SOURCE
            ),
            vol.Required(CONF_ADDRESS_MAX_DISTANCE, default=values[CONF_ADDRESS_MAX_DISTANCE]): _number(20, 2000, "m"),
        }
        sensor_selector = selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor"))
        for person in persons:
            current = values[CONF_ADDRESS_SENSORS].get(person) or find_address_sensor(
                self.hass, self.hass.states.get(person)
            )
            key = vol.Optional(person, description={"suggested_value": current} if current else None)
            fields[key] = sensor_selector
        return self.async_show_form(
            step_id="addresses",
            data_schema=vol.Schema(fields),
            description_placeholders={"persons": ", ".join(persons) or "-"},
        )

    async def async_step_access(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        values = self._values()
        if user_input is not None:
            return self._save(user_input)
        schema = vol.Schema(
            {
                vol.Required(CONF_HISTORY_ACCESS, default=values[CONF_HISTORY_ACCESS]): _select(
                    HISTORY_ACCESS_LEVELS, CONF_HISTORY_ACCESS
                ),
                vol.Required(CONF_DELETE_ACCESS, default=values[CONF_DELETE_ACCESS]): _select(
                    DELETE_ACCESS_LEVELS, CONF_DELETE_ACCESS
                ),
            }
        )
        return self.async_show_form(step_id="access", data_schema=schema)

    async def async_step_import_file(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Upload a history file (Whereabouts CSV, old daily files as ZIP, GPX)."""
        errors: dict[str, str] = {}
        placeholders = {"detail": ""}
        if user_input is not None:
            try:
                result = await _run_import(
                    self.hass,
                    user_input[CONF_FILE],
                    user_input.get(CONF_TARGET_PERSON),
                    bool(user_input.get(CONF_REPLACE)),
                    float(self._values()[CONF_SAME_PLACE_DISTANCE]),
                )
            except ImportError_ as err:
                errors["base"] = err.key
                placeholders["detail"] = err.detail
            else:
                runtime = self.hass.data.get(DOMAIN)
                if runtime:
                    await runtime.async_refresh_known(self.hass)
                return self.async_abort(reason="import_done", description_placeholders=result)
        schema = vol.Schema(
            {
                vol.Required(CONF_FILE): selector.FileSelector(selector.FileSelectorConfig(accept=".csv,.zip,.gpx")),
                vol.Optional(CONF_TARGET_PERSON): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="person")
                ),
                vol.Required(CONF_REPLACE, default=False): selector.BooleanSelector(),
            }
        )
        return self.async_show_form(
            step_id="import_file", data_schema=schema, errors=errors, description_placeholders=placeholders
        )


async def _run_import(
    hass: HomeAssistant, file_id: str, target: str | None, replace: bool, same_place_distance: float
) -> dict[str, str]:
    """Read the uploaded file and store its points. Returns the summary placeholders."""

    def _read() -> tuple[str, bytes]:
        with process_uploaded_file(hass, file_id) as path:
            return path.name, path.read_bytes()

    filename, data = await hass.async_add_executor_job(_read)
    # Zones are read here (event loop); the importer runs in the executor.
    zones = zone_snapshot(hass)
    parsed = await hass.async_add_executor_job(
        lambda: read_import(
            filename,
            data,
            timezone=dt_util.get_default_time_zone(),
            zone_for=lambda lat, lon: zone_in_snapshot(zones, lat, lon),
            same_place_distance=same_place_distance,
        )
    )
    if not any(parsed.values()):
        raise ImportError_("no_points")

    # Whose history is it?
    by_person: dict[str, list] = {}
    for key, points in parsed.items():
        if target:
            dest = person_key(target)
        elif key:
            dest = key
        else:
            raise ImportError_("person_required")
        if hass.states.get(f"person.{dest}") is None:
            raise ImportError_("unknown_person", dest)
        by_person.setdefault(dest, []).extend(points)

    runtime = hass.data.get(DOMAIN)
    if runtime is None:
        raise ImportError_("not_set_up")
    added = skipped = days = 0
    for dest, points in by_person.items():
        outcome = await hass.async_add_executor_job(runtime.storage.import_points, dest, points, replace)
        added += outcome["added"]
        skipped += outcome["skipped"]
        days += outcome["days"]
    total, _ = summarize(p for points in by_person.values() for p in points)
    return {
        "persons": ", ".join(sorted(by_person)),
        "added": str(added),
        "skipped": str(skipped),
        "days": str(days),
        "total": str(total),
    }
