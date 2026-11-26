"""Test fixtures (real Home Assistant via pytest-homeassistant-custom-component)."""

from __future__ import annotations

import asyncio

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.whereabouts.const import DEFAULT_OPTIONS, DOMAIN

HOME = (52.5285, 13.4066)


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    yield


@pytest.fixture(autouse=True)
def own_config_dir(hass: HomeAssistant, tmp_path):
    """Every test gets its own configuration folder (the history lives there)."""
    hass.config.config_dir = str(tmp_path)


@pytest.fixture
async def zones(hass: HomeAssistant):
    hass.config.latitude, hass.config.longitude = HOME
    hass.config.country = "DE"
    assert await async_setup_component(
        hass,
        "zone",
        {"zone": [{"name": "Work", "latitude": 48.70, "longitude": 9.00, "radius": 150}]},
    )
    await hass.async_block_till_done()


async def setup_integration(hass: HomeAssistant, **options) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Whereabouts", data={}, options={**DEFAULT_OPTIONS, **options})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def wait_job(hass: HomeAssistant) -> dict:
    """Wait until the background job (0.7.10) has ended; returns its state."""
    runtime = hass.data[DOMAIN]
    for _ in range(1000):
        if not runtime.jobs.busy:
            break
        await asyncio.sleep(0.01)
    await hass.async_block_till_done()
    return runtime.jobs.status()
