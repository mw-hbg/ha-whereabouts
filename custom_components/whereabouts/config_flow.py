"""Set-up and options (all in the Home Assistant UI)."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant.components.file_upload import process_uploaded_file
from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import selector

from . import base_persons, merged_options
from .const import (
    ADDRESS_SOURCES,
    CONF_ADDRESS_MAX_DISTANCE,
    CONF_ADDRESS_SENSORS,
    CONF_ADDRESS_SOURCE,
    CONF_MIN_INTERVAL,
    CONF_PANEL,
    CONF_PANEL_ICON,
    CONF_PANEL_TITLE,
    CONF_PERSONS,
    CONF_RECORD_PERSONS,
    CONF_RETENTION_DAYS,
    CONF_SAME_PLACE_DISTANCE,
    DEFAULT_OPTIONS,
    DOMAIN,
    NAME,
)
from .geo import find_address_sensor
from .importer import ImportError_
from .importing import import_bytes

_LOGGER = logging.getLogger(__name__)

CONF_FILE = "file"
CONF_TARGET_PERSON = "target_person"
CONF_REPLACE = "replace"
CONF_PANEL_HIDDEN = "panel_hidden"


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


def _person_list(hass: HomeAssistant, entity_ids: list[str]) -> selector.SelectSelector:
    """Persons as a list with ticks (not Home Assistant's entity picker)."""
    options = []
    for entity_id in entity_ids:
        state = hass.states.get(entity_id)
        options.append({"value": entity_id, "label": state.name if state else entity_id})
    return selector.SelectSelector(
        selector.SelectSelectorConfig(options=options, multiple=True, mode=selector.SelectSelectorMode.LIST)
    )


class WhereaboutsConfigFlow(ConfigFlow, domain=DOMAIN):
    """First set-up: which persons, whose history, sidebar, addresses."""

    VERSION = 1

    def __init__(self) -> None:
        self._options: dict[str, Any] = {}
        self._chosen: list[str] = []

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Step 1: the persons Whereabouts works with, sidebar entry, addresses."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        everyone = sorted(self.hass.states.async_entity_ids("person"))
        if user_input is not None:
            chosen = [p for p in everyone if p in user_input.get(CONF_PERSONS, [])]
            self._options = {
                **DEFAULT_OPTIONS,
                # all chosen = "all persons" (new persons appear automatically)
                CONF_PERSONS: [] if set(chosen) == set(everyone) else chosen,
                CONF_PANEL: user_input[CONF_PANEL],
                CONF_ADDRESS_SOURCE: user_input[CONF_ADDRESS_SOURCE],
            }
            self._chosen = chosen
            if not chosen:
                return self.async_create_entry(title=NAME, data={}, options=self._options)
            return await self.async_step_recording()
        schema = vol.Schema(
            {
                vol.Optional(CONF_PERSONS, default=everyone): _person_list(self.hass, everyone),
                vol.Required(CONF_PANEL, default=True): selector.BooleanSelector(),
                vol.Required(CONF_ADDRESS_SOURCE, default=DEFAULT_OPTIONS[CONF_ADDRESS_SOURCE]): _select(
                    ADDRESS_SOURCES, CONF_ADDRESS_SOURCE
                ),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    async def async_step_recording(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Step 2: whose history is recorded - only persons from step 1, all ticked."""
        if user_input is not None:
            record = [p for p in self._chosen if p in user_input.get(CONF_RECORD_PERSONS, [])]
            return self.async_create_entry(title=NAME, data={}, options={**self._options, CONF_RECORD_PERSONS: record})
        schema = vol.Schema(
            {vol.Optional(CONF_RECORD_PERSONS, default=self._chosen): _person_list(self.hass, self._chosen)}
        )
        return self.async_show_form(step_id="recording", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return WhereaboutsOptionsFlow()


class WhereaboutsOptionsFlow(OptionsFlow):
    """Options as a menu: one section per card, recording, addresses, import.

    Everything else (persons, colours, rights, sidebar) is on the settings page."""

    def _values(self) -> dict:
        return merged_options(self.config_entry)

    def _save(self, changes: dict) -> ConfigFlowResult:
        return self.async_create_entry(data={**self._values(), **changes})

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        return self.async_show_menu(
            step_id="init", menu_options=["open_settings", "dashboard", "recording", "addresses", "import_file"]
        )

    async def async_step_open_settings(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """A link to the settings page - it works even when the dashboard is hidden."""
        return self.async_abort(reason="open_settings")

    async def async_step_dashboard(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Sidebar entry: hidden or not, name and icon."""
        values = self._values()
        if user_input is not None:
            return self._save(
                {
                    CONF_PANEL: not user_input.get(CONF_PANEL_HIDDEN, False),
                    CONF_PANEL_TITLE: (user_input.get(CONF_PANEL_TITLE) or "").strip()[:40],
                    CONF_PANEL_ICON: user_input.get(CONF_PANEL_ICON) or DEFAULT_OPTIONS[CONF_PANEL_ICON],
                }
            )
        schema = vol.Schema(
            {
                vol.Optional(CONF_PANEL_HIDDEN, default=not values[CONF_PANEL]): selector.BooleanSelector(),
                vol.Optional(
                    CONF_PANEL_TITLE, description={"suggested_value": values.get(CONF_PANEL_TITLE) or None}
                ): selector.TextSelector(),
                vol.Optional(
                    CONF_PANEL_ICON, description={"suggested_value": values.get(CONF_PANEL_ICON) or None}
                ): selector.IconSelector(),
            }
        )
        return self.async_show_form(step_id="dashboard", data_schema=schema)

    async def async_step_recording(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Whose history is recorded, how often, how long it is kept."""
        values = self._values()
        if user_input is not None:
            return self._save(user_input)
        schema = vol.Schema(
            {
                vol.Optional(CONF_RECORD_PERSONS, default=values[CONF_RECORD_PERSONS]): _person_list(
                    self.hass, base_persons(self.hass, values)
                ),
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
    result = await import_bytes(hass, filename, data, target, replace, same_place_distance)
    return {key: str(value) if not isinstance(value, list) else ", ".join(value) for key, value in result.items()}
