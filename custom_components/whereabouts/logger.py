"""Writes the location history: listens to the recorded persons."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_change
from homeassistant.util import dt as dt_util

from .const import (
    ADDRESS_SOURCE_OSM,
    ADDRESS_SOURCE_PHONE,
    ADDRESS_SOURCE_PHONE_OSM,
    CONF_ADDRESS_MAX_DISTANCE,
    CONF_ADDRESS_SENSORS,
    CONF_ADDRESS_SOURCE,
    CONF_MIN_INTERVAL,
    CONF_RECORD_PERSONS,
    CONF_RETENTION_DAYS,
    GEOCODE_WAIT_SECONDS,
)
from .geo import find_address_sensor, phone_address, position_for
from .nominatim import Nominatim
from .storage import HistoryStorage, Point

_LOGGER = logging.getLogger(__name__)


def person_key(entity_id: str) -> str:
    """person.alex -> alex (used in file names)."""
    return entity_id.split(".", 1)[1]


class LocationLogger:
    """Stores a point whenever a recorded person moves.

    - A change of place (other state, e.g. entering a zone) is always stored.
    - Position updates at the same place at most once per ``min_interval``.
    - At 23:59:59 and 00:00:00 every recorded person gets a point, so a day
      is closed properly and the next day never starts empty.
    """

    def __init__(self, hass: HomeAssistant, storage: HistoryStorage, nominatim: Nominatim, options: dict) -> None:
        self.hass = hass
        self.storage = storage
        self.nominatim = nominatim
        self.options = options
        self.persons: list[str] = list(options.get(CONF_RECORD_PERSONS) or [])
        self._last_write: dict[str, float] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._unsubs: list[CALLBACK_TYPE] = []

    @callback
    def start(self) -> None:
        if self.persons:
            self._unsubs.append(async_track_state_change_event(self.hass, self.persons, self._state_changed))
            self._unsubs.append(async_track_time_change(self.hass, self._day_end, hour=23, minute=59, second=59))
            self._unsubs.append(async_track_time_change(self.hass, self._day_start, hour=0, minute=0, second=0))
        if self.options.get(CONF_RETENTION_DAYS):
            self._unsubs.append(async_track_time_change(self.hass, self._retention, hour=3, minute=17, second=0))

    @callback
    def stop(self) -> None:
        while self._unsubs:
            self._unsubs.pop()()

    # --- triggers ------------------------------------------------------------
    @callback
    def _state_changed(self, event: Event[EventStateChangedData]) -> None:
        old, new = event.data["old_state"], event.data["new_state"]
        if new is None or new.state in (STATE_UNKNOWN, STATE_UNAVAILABLE):
            return
        entity_id = new.entity_id
        now = time.monotonic()
        moved = old is None or old.state != new.state
        if not moved and now - self._last_write.get(entity_id, 0.0) < self.options[CONF_MIN_INTERVAL]:
            return
        self._last_write[entity_id] = now
        self.hass.async_create_task(self.async_record(new, dt_util.now()), f"whereabouts record {entity_id}")

    async def _day_end(self, now: datetime) -> None:
        await self._record_all(now)

    async def _day_start(self, now: datetime) -> None:
        await self._record_all(now)

    async def _record_all(self, now: datetime) -> None:
        for entity_id in self.persons:
            state = self.hass.states.get(entity_id)
            if state and state.state not in (STATE_UNKNOWN, STATE_UNAVAILABLE):
                await self.async_record(state, now)

    async def _retention(self, now: datetime) -> None:
        days = int(self.options.get(CONF_RETENTION_DAYS) or 0)
        if days <= 0:
            return
        limit = (now - timedelta(days=days)).strftime("%Y-%m-%d")
        removed = await self.hass.async_add_executor_job(self.storage.delete_before, limit)
        if removed:
            _LOGGER.info("Removed %s day files older than %s days", removed, days)

    # --- storing -------------------------------------------------------------
    async def async_record(self, person: State, when: datetime) -> None:
        """Store one point for ``person`` at local time ``when``."""
        entity_id = person.entity_id
        lock = self._locks.setdefault(entity_id, asyncio.Lock())
        async with lock:
            key = person_key(entity_id)
            position = position_for(self.hass, person)
            lat, lon = position if position else (None, None)
            date, clock = when.strftime("%Y-%m-%d"), when.strftime("%H:%M:%S")
            address = ""
            try:
                if lat is not None and await self.hass.async_add_executor_job(
                    self.storage.needs_address, key, date, person.state, lat, lon
                ):
                    address = await self._address(entity_id, lat, lon)
            except Exception:  # an address must never prevent storing the point
                _LOGGER.exception("Looking up the address failed")
            point = Point(date, clock, person.state, lat, lon, address)
            try:
                await self.hass.async_add_executor_job(self.storage.add_point, key, point)
            except (OSError, ValueError):
                _LOGGER.exception("Could not store the position of %s", entity_id)

    async def _address(self, entity_id: str, lat: float, lon: float) -> str:
        source = self.options[CONF_ADDRESS_SOURCE]
        max_distance = float(self.options[CONF_ADDRESS_MAX_DISTANCE])
        if source in (ADDRESS_SOURCE_PHONE, ADDRESS_SOURCE_PHONE_OSM):
            sensor = (self.options.get(CONF_ADDRESS_SENSORS) or {}).get(entity_id) or find_address_sensor(
                self.hass, self.hass.states.get(entity_id)
            )
            if sensor:
                # The phone's geocoding often arrives a moment after the position.
                for attempt in range(GEOCODE_WAIT_SECONDS + 1):
                    address = phone_address(self.hass, sensor, lat, lon, max_distance)
                    if address or attempt == GEOCODE_WAIT_SECONDS:
                        break
                    await asyncio.sleep(1)
                if address:
                    return address
        if source in (ADDRESS_SOURCE_OSM, ADDRESS_SOURCE_PHONE_OSM):
            return await self.nominatim.reverse(lat, lon)
        return ""
