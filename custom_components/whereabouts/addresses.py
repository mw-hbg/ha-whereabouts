"""Looking up missing addresses in the background ("Fetch missing addresses").

Only stays away from zones ("not_home") without an address. One job at a
time, OpenStreetMap Nominatim with exactly one request per second, places
closer than "same place up to … m" to an already found one are asked only
once. The job can be paused and continues after a restart of Home Assistant
(its state is kept in .storage/whereabouts.address_job).
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import STATE_NOT_HOME
from .nominatim import Nominatim
from .storage import HistoryStorage, distance_m

_LOGGER = logging.getLogger(__name__)

STORE_KEY = "whereabouts.address_job"
STORE_VERSION = 1
REQUEST_GAP_SECONDS = 1.0
OSM_WAIT_SECONDS = 60  # OpenStreetMap refused (403/429) or not reachable: wait, then try again
MAX_FAILED_TRIES = 3  # per stay and run, when OpenStreetMap could not be asked

IDLE, RUNNING, PAUSED, DONE, CANCELLED = "idle", "running", "paused", "done", "cancelled"


def missing_in_day(storage: HistoryStorage, person: str, date: str) -> list[tuple[str, float, float]]:
    """(start time, latitude, longitude) of away stays without an address."""
    return [
        (p.time, p.latitude, p.longitude)
        for p in storage.read_points(person, date)
        if p.state == STATE_NOT_HOME and not p.address and p.latitude is not None and p.longitude is not None
    ]


def count_missing(storage: HistoryStorage, files: list[tuple[str, str]]) -> int:
    return sum(len(missing_in_day(storage, person, date)) for person, date in files)


class AddressJob:
    """The one background job. All methods run in the event loop."""

    def __init__(
        self,
        hass: HomeAssistant,
        storage: HistoryStorage,
        nominatim: Nominatim,
        same_place_distance: float,
        on_change: Callable[[], None] | None = None,
    ) -> None:
        self.hass = hass
        self.storage = storage
        self.nominatim = nominatim
        self.same_place_distance = same_place_distance
        self._on_change = on_change
        self._store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY, private=True)
        self.state: dict[str, Any] = {"status": IDLE}
        self._task: asyncio.Task | None = None
        self._resume = asyncio.Event()
        self._resume.set()
        self.waiting_for_osm = False
        self.journal = None  # 0.7.3: the log; the finished job updates its entry

    # --- state --------------------------------------------------------------------------------------------
    async def async_load(self) -> None:
        """Read the stored state; a job that was running goes on."""
        data = await self._store.async_load()
        if isinstance(data, dict) and data.get("status") in (RUNNING, PAUSED, DONE, CANCELLED):
            self.state = data
        if self.state.get("status") == PAUSED:
            self._resume.clear()
        if self.state.get("status") in (RUNNING, PAUSED):
            self._start_task()

    async def _save(self) -> None:
        await self._store.async_save(self.state)

    async def async_save(self) -> None:
        await self._save()

    def status(self) -> dict[str, Any]:
        return {**self.state, "waiting_for_osm": self.waiting_for_osm or self.nominatim.paused}

    @property
    def busy(self) -> bool:
        return self.state.get("status") in (RUNNING, PAUSED)

    # --- control ------------------------------------------------------------------------------------------
    async def async_start(
        self,
        persons: list[str],
        date_from: str,
        date_to: str,
        log: Callable[[dict[str, Any]], Awaitable[str]] | None = None,
    ) -> dict[str, Any]:
        """Start a job for these persons (keys) and days; raises RuntimeError when one is already running.

        ``log`` (0.7.5) creates the entry in the log and returns its id. It is called
        before the task starts, so even a job that ends at once can update its entry.
        """
        if self.busy:
            raise RuntimeError("busy")
        files = await self.hass.async_add_executor_job(self.storage.files_in, persons, date_from, date_to)
        total = await self.hass.async_add_executor_job(count_missing, self.storage, files)
        self.state = {
            "status": RUNNING if total else DONE,
            "persons": list(persons),
            "from": date_from,
            "to": date_to,
            "total": total,
            "done": 0,
            "found": 0,
            "cursor": "",
            "started": dt_util.now().isoformat(timespec="seconds"),
            "finished": "" if total else dt_util.now().isoformat(timespec="seconds"),
        }
        if log is not None:
            entry_id = await log(self.state)
            if entry_id:
                self.state["journal_id"] = entry_id
        await self._save()
        self._resume.set()
        if total:
            self._start_task()
        return self.status()

    async def async_pause(self) -> None:
        if self.state.get("status") == RUNNING:
            self.state["status"] = PAUSED
            self._resume.clear()
            await self._save()
            await self.nominatim.flush()

    async def async_resume(self) -> None:
        if self.state.get("status") == PAUSED:
            self.state["status"] = RUNNING
            await self._save()
            self._resume.set()
            if self._task is None or self._task.done():
                self._start_task()

    async def async_cancel(self) -> None:
        if self.busy:
            self.state["status"] = CANCELLED
            self.state["finished"] = dt_util.now().isoformat(timespec="seconds")
            await self._save()
            self._resume.set()
            if self._task:
                self._task.cancel()
                self._task = None
            await self.nominatim.flush()
            await self._log_end()
            self._changed()

    async def async_dismiss(self) -> None:
        """A finished or cancelled job was clicked away: nothing is shown any more."""
        if self.state.get("status") in (DONE, CANCELLED):
            self.state = {"status": IDLE}
            await self._save()

    async def async_stop(self) -> None:
        """Integration unloaded: stop the task, keep the state (it goes on after the reload)."""
        if self._task:
            self._task.cancel()
            self._task = None
        await self.nominatim.flush()

    async def _log_end(self) -> None:
        """The job ended: its entry in the log gets the numbers."""
        entry_id = self.state.get("journal_id")
        if self.journal is None or not entry_id:
            return
        values = {"rows": self.state.get("found", 0), "done": self.state.get("done", 0), "status": self.state["status"]}
        await self.hass.async_add_executor_job(self.journal.update, entry_id, values)

    def _changed(self) -> None:
        if self._on_change:
            self._on_change()

    def _start_task(self) -> None:
        self._task = self.hass.async_create_background_task(self._run(), "whereabouts missing addresses")

    # --- the job ------------------------------------------------------------------------------------------
    async def _run(self) -> None:
        try:
            await self._work()
        except asyncio.CancelledError:
            raise
        except Exception:  # never let the job break the integration
            _LOGGER.exception("Looking up missing addresses failed")
            self.state["status"] = CANCELLED
            await self._save()
            await self._log_end()
            self._changed()

    async def _work(self) -> None:
        state = self.state
        files = await self.hass.async_add_executor_job(
            self.storage.files_in, state["persons"], state.get("from", ""), state.get("to", "")
        )
        files.sort(key=lambda f: (f[1], f[0]))  # day by day
        found_places: list[tuple[float, float, str]] = []  # this run's answers
        for person, date in files:
            if state.get("cursor") and f"{date}|{person}" <= state["cursor"]:
                continue
            missing = await self.hass.async_add_executor_job(missing_in_day, self.storage, person, date)
            found: dict[str, str] = {}
            for clock, lat, lon in missing:
                await self._resume.wait()
                address = next(
                    (a for la, lo, a in found_places if distance_m(lat, lon, la, lo) < self.same_place_distance),
                    None,
                )
                if address is None:
                    address = await self._ask(lat, lon)
                    found_places.append((lat, lon, address))
                    if len(found_places) > 500:
                        del found_places[:100]
                if address:
                    found[clock] = address
                    state["found"] += 1
                state["done"] += 1
            if found:
                await self.hass.async_add_executor_job(self.storage.set_addresses, person, date, found)
            state["cursor"] = f"{date}|{person}"
            await self._save()
        state["status"] = DONE
        state["finished"] = dt_util.now().isoformat(timespec="seconds")
        await self._save()
        await self.nominatim.flush()
        await self._log_end()
        self._changed()
        _LOGGER.info("Missing addresses: %s of %s found", state["found"], state["done"])

    async def _ask(self, lat: float, lon: float) -> str:
        """One answer from OpenStreetMap; waits while it refuses or cannot be reached."""
        failed = 0
        while True:
            await self._resume.wait()
            if self.nominatim.paused:  # refused (403/429): no request for an hour
                self.waiting_for_osm = True
                await asyncio.sleep(OSM_WAIT_SECONDS)
                continue
            address, answered = await self.nominatim.lookup(lat, lon, REQUEST_GAP_SECONDS)
            if answered:
                self.waiting_for_osm = False
                return address
            failed += 1
            if failed >= MAX_FAILED_TRIES:
                self.waiting_for_osm = False
                return ""
            self.waiting_for_osm = True
            await asyncio.sleep(OSM_WAIT_SECONDS)
