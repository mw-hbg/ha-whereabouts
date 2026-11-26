"""Background jobs for the long actions (0.7.10).

One job at a time (also not together with "Fetch missing addresses", which keeps its own
job in ``addresses.py``): the data maintenance (recording rules, zones, time zones, edges
of days, coordinates), the export of a long period as a ZIP file and the import from the
Home Assistant recorder. Every job works day by day (or month by month), shows its
progress, can be cancelled (it stops after the current day; what was done stays and is in
the log and trash) and goes on after a restart of Home Assistant.

The state is kept in .storage/whereabouts.jobs, together with what is still open
("open tasks"): the offer to import from the recorder and the number of missing addresses.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
import time
import zipfile
from collections.abc import Callable
from datetime import date as date_type
from datetime import timedelta
from types import SimpleNamespace
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import downloads
from .const import CONF_MIN_INTERVAL, CONF_SAME_PLACE_DISTANCE, DEFAULT_OPTIONS
from .journal_api import async_begin, async_finish

_LOGGER = logging.getLogger(__name__)

STORE_KEY = "whereabouts.jobs"
STORE_VERSION = 1
IDLE, RUNNING, DONE, CANCELLED, FAILED = "idle", "running", "done", "cancelled", "failed"
KEEP_TRANSITIONS = 200
SAVE_EVERY_SECONDS = 3
MAX_RECORDER_DAYS = 400
HINT_OPEN, HINT_LATER, HINT_NEVER, HINT_DONE = "open", "later", "never", "done"

ACTIONS = ("rules", "timezones", "day_edges", "positions", "zones")
# numbers of the log entry per action (what the preview showed as "changes")
ROWS: dict[str, Callable[[dict], int]] = {
    "rules": lambda r: int(r.get("merged", 0)) + int(r.get("dropped", 0)),
    "timezones": lambda r: int(r.get("offsets", 0)) + int(r.get("zones", 0)),
    "day_edges": lambda r: int(r.get("starts", 0)) + int(r.get("ends", 0)),
    "positions": lambda r: int(r.get("from_day", 0)) + int(r.get("from_zone", 0)) + int(r.get("removed", 0)),
    "zones": lambda r: int(r.get("changed", 0)),
}


def merge_result(total: dict[str, Any], part: dict[str, Any]) -> None:
    """Add the numbers of ``part`` to ``total``; the zone transitions are added by (from, to)."""
    for key, value in part.items():
        if key == "transitions":
            items = total.setdefault(key, [])
            index = {(t["from"], t["to"]): t for t in items}
            for t in value:
                found = index.get((t["from"], t["to"]))
                if found:
                    found["n"] += t["n"]
                else:
                    item = dict(t)
                    items.append(item)
                    index[(t["from"], t["to"])] = item
            items.sort(key=lambda t: -t["n"])
            del items[KEEP_TRANSITIONS:]
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            total[key] = total.get(key, 0) + value
        else:
            total[key] = value


def month_ranges(date_from: str, date_to: str) -> list[tuple[str, str]]:
    """Calendar months (first day, last day) that touch the period, clipped to it."""
    start = date_type.fromisoformat(date_from)
    end = date_type.fromisoformat(date_to)
    months = []
    day = start
    while day <= end:
        following = (day.replace(day=28) + timedelta(days=4)).replace(day=1)
        last = min(following - timedelta(days=1), end)
        months.append((day.isoformat(), last.isoformat()))
        day = following
    return months


def day_range(date_from: str, date_to: str) -> list[str]:
    start = date_type.fromisoformat(date_from)
    end = date_type.fromisoformat(date_to)
    return [(start + timedelta(days=n)).isoformat() for n in range((end - start).days + 1)]


class JobManager:
    """The one background job; all methods run in the event loop (storage work in the executor)."""

    def __init__(self, hass: HomeAssistant, runtime) -> None:
        self.hass = hass
        self.runtime = runtime
        self._store: Store[dict[str, Any]] = Store(hass, STORE_VERSION, STORE_KEY, private=True)
        self.state: dict[str, Any] = {"status": IDLE}
        self.hint: str = HINT_OPEN  # offer to import from the recorder
        self.open_addresses: int = 0  # stays still without an address after an import or a lookup
        self._task: asyncio.Task | None = None
        self._cancel = False
        self._ctx: dict[str, Any] = {}
        self._backup = None
        self._saved_at = 0.0

    # --- state --------------------------------------------------------------------------------------------
    async def async_load(self) -> None:
        data = await self._store.async_load()
        if isinstance(data, dict):
            self.hint = (
                data.get("hint") if data.get("hint") in (HINT_OPEN, HINT_LATER, HINT_NEVER, HINT_DONE) else HINT_OPEN
            )
            self.open_addresses = max(0, int(data.get("open_addresses") or 0))
            job = data.get("job")
            if isinstance(job, dict) and job.get("status") in (RUNNING, DONE, CANCELLED, FAILED):
                self.state = job
        if self.state.get("status") == RUNNING:
            self._start_task()

    def _data(self) -> dict[str, Any]:
        return {"job": self.state, "hint": self.hint, "open_addresses": self.open_addresses}

    async def async_save(self) -> None:
        self._saved_at = time.monotonic()
        await self._store.async_save(self._data())

    async def _save_now_and_then(self) -> None:
        """Progress is saved every few seconds, so a restart goes on near where it stopped."""
        if time.monotonic() - self._saved_at >= SAVE_EVERY_SECONDS:
            await self.async_save()

    def status(self) -> dict[str, Any]:
        return dict(self.state)

    def open_tasks(self) -> dict[str, Any]:
        return {"hint": self.hint, "addresses": self.open_addresses}

    @property
    def busy(self) -> bool:
        return self.state.get("status") == RUNNING

    async def async_set_hint(self, hint: str) -> None:
        if hint in (HINT_OPEN, HINT_LATER, HINT_NEVER, HINT_DONE):
            self.hint = hint
            await self.async_save()

    async def async_address_finished(self, state: dict[str, Any]) -> None:
        """The address job ended: what it found is no longer open."""
        await self.async_set_open_addresses(self.open_addresses - int(state.get("found") or 0))

    async def async_set_open_addresses(self, count: int) -> None:
        count = max(0, int(count))
        if count != self.open_addresses:
            self.open_addresses = count
            await self.async_save()

    # --- control ------------------------------------------------------------------------------------------
    async def async_start(
        self,
        kind: str,
        persons: list[str],
        date_from: str,
        date_to: str,
        params: dict[str, Any] | None = None,
        user: str = "",
    ) -> dict[str, Any]:
        """Start a job for these persons (keys) and days; RuntimeError("busy") while another runs."""
        runtime = self.runtime
        if self.busy or (runtime.addresses is not None and runtime.addresses.busy):
            raise RuntimeError("busy")
        params = dict(params or {})
        token = downloads.new_token()
        self.state = {
            "status": RUNNING,
            "id": token,
            "kind": kind,
            "action": params.get("action", kind),
            "persons": list(persons),
            "from": date_from,
            "to": date_to,
            "params": params,
            "user": user,
            "total": 0,
            "done": 0,
            "result": {},
            "started": dt_util.now().isoformat(timespec="seconds"),
            "finished": "",
        }
        self._cancel = False
        self._backup = None
        self._ctx = {}
        units = await self._kind(kind).units(self, self.state)
        self.state["total"] = len(units)
        if not units:
            await self._end(DONE)
            return self.status()
        if self._kind(kind).backup:
            entry_id, self._backup = async_begin(runtime)
            self.state["journal_id"] = entry_id
        await self.async_save()
        self._start_task()
        return self.status()

    async def async_cancel(self) -> dict[str, Any]:
        """Stop after the current day; what was done stays (log and trash)."""
        if self.busy:
            self._cancel = True
            task = self._task
            if task is not None and not task.done():
                try:
                    await asyncio.wait_for(asyncio.shield(task), 60)
                except (TimeoutError, asyncio.CancelledError):
                    pass
        return self.status()

    async def async_dismiss(self) -> None:
        """A finished job was clicked away: nothing is shown any more."""
        if self.state.get("status") in (DONE, CANCELLED, FAILED):
            self.state = {"status": IDLE}
            await self.async_save()

    async def async_stop(self) -> None:
        """Integration unloaded: stop the task, keep the state (it goes on after the reload)."""
        if self._task:
            self._task.cancel()
            self._task = None
        await self._store.async_save(self._data())

    # --- the job ------------------------------------------------------------------------------------------
    @staticmethod
    def _kind(name: str):
        return KINDS[name]

    def _start_task(self) -> None:
        self._task = self.hass.async_create_background_task(self._run(), "whereabouts job")

    async def _run(self) -> None:
        try:
            await self._work()
        except asyncio.CancelledError:
            raise
        except Exception as err:  # never let a job break the integration
            _LOGGER.exception("Background job %s failed", self.state.get("kind"))
            self.state["error"] = str(err)[:200]
            await self._end(FAILED)

    async def _work(self) -> None:
        state = self.state
        kind = self._kind(state["kind"])
        units = await kind.units(self, state)
        state["total"] = len(units)
        if kind.backup and self._backup is None:
            self._backup = self._resume_backup(state.get("journal_id", ""))
        while state["done"] < len(units):
            if self._cancel:
                await self._end(CANCELLED)
                return
            part = await kind.step(self, state, units[state["done"]])
            merge_result(state["result"], part or {})
            state["done"] += 1
            await self._save_now_and_then()
            await asyncio.sleep(0)
        await self._end(DONE)

    def _resume_backup(self, entry_id: str):
        """After a restart: the backup goes on in the same folder; saved files stay as they were."""
        journal = self.runtime.journal
        if journal is None or not entry_id:
            return None
        backup = journal.backup(entry_id)
        try:
            for name in os.listdir(backup.folder):
                if name.endswith(".csv"):
                    backup.saved[name] = True
        except OSError:
            pass
        return backup

    async def _end(self, status: str) -> None:
        state = self.state
        kind = self._kind(state["kind"])
        state["status"] = status
        state["finished"] = dt_util.now().isoformat(timespec="seconds")
        try:
            await kind.finish(self, state, status)
        except Exception:
            _LOGGER.exception("Finishing the background job %s failed", state.get("kind"))
            if status == DONE:
                state["status"] = FAILED
        await self.async_save()
        self._task = None
        if kind.backup and state.get("done"):
            self.runtime.data_changed(self.hass)

    # --- helpers for the kinds -----------------------------------------------------------------------------
    def run_in_backup(self, func, *args):
        """Executor: ``func`` with every day file it writes saved to the backup first."""
        storage = self.runtime.storage
        if self._backup is None:
            return func(*args)
        return storage.with_backup(self._backup, func, *args)

    async def log_entry(self, state: dict[str, Any], action: str, rows: int, **extra: Any) -> None:
        """The entry in the log (and the trash) of a job that changed data."""
        entry_id = state.get("journal_id") or ""
        user = SimpleNamespace(name=state.get("user", ""))
        await async_finish(
            self.hass,
            self.runtime,
            entry_id,
            self._backup,
            action,
            user,
            state.get("persons"),
            state.get("from", ""),
            state.get("to", ""),
            rows,
            status=state.get("status", ""),
            total=state.get("total", 0),
            done=state.get("done", 0),
            **extra,
        )


# --- the kinds --------------------------------------------------------------------------------------------
class MaintenanceKind:
    """Recording rules, zones, time zones, edges of days, coordinates - one day (file) per step."""

    backup = True

    async def units(self, jobs: JobManager, state: dict[str, Any]) -> list:
        runtime = jobs.runtime
        hass = jobs.hass
        files = await hass.async_add_executor_job(
            runtime.storage.files_in, state["persons"], state["from"], state["to"]
        )
        files = sorted(files, key=lambda f: (f[1], f[0]))
        action = state["params"].get("action")
        if action not in ACTIONS:
            raise ValueError(f"unknown action {action}")
        from .geo import zone_snapshot

        ctx: dict[str, Any] = {}
        options = runtime.options
        if action == "rules":
            ctx["distance"] = float(options.get(CONF_SAME_PLACE_DISTANCE) or DEFAULT_OPTIONS[CONF_SAME_PLACE_DISTANCE])
            ctx["interval"] = float(options.get(CONF_MIN_INTERVAL) or DEFAULT_OPTIONS[CONF_MIN_INTERVAL])
        elif action == "positions":
            ctx["zones"] = zone_snapshot(hass)
        elif action == "zones":
            _, renames = await runtime.zones.async_changes()
            only = state["params"].get("zones")
            ctx.update(zones=zone_snapshot(hass), renames=renames, only=set(only) if only is not None else None)
        jobs._ctx = ctx
        return files

    async def step(self, jobs: JobManager, state: dict[str, Any], unit) -> dict[str, Any]:
        from . import maintenance as m

        storage = jobs.runtime.storage
        ctx = jobs._ctx
        files = [tuple(unit)]
        action = state["params"]["action"]
        if action == "rules":
            func = lambda: m.rules_on_days(storage, files, ctx["distance"], ctx["interval"], True)  # noqa: E731
        elif action == "timezones":
            func = lambda: m.time_zones_on_days(storage, files, True)  # noqa: E731
        elif action == "day_edges":
            func = lambda: m.edges_on_days(storage, files, True)  # noqa: E731
        elif action == "positions":
            func = lambda: m.positions_on_days(storage, files, ctx["zones"], True)  # noqa: E731
        else:
            func = lambda: m.zones_on_days(  # noqa: E731
                storage, files, ctx["zones"], ctx["renames"], ctx["only"], True
            )
        return await jobs.hass.async_add_executor_job(jobs.run_in_backup, func)

    async def finish(self, jobs: JobManager, state: dict[str, Any], status: str) -> None:
        action = state["params"]["action"]
        result = state["result"]
        if state.get("done"):
            await jobs.log_entry(state, action, ROWS[action](result))
        if status != DONE:
            return
        runtime = jobs.runtime
        if action == "zones" and state["params"].get("ack") and runtime.zones is not None:
            await runtime.zones.async_ack()
        # zones changed stays that now need an address: look them up afterwards (when asked for)
        if (
            action == "zones"
            and state["params"].get("addresses")
            and result.get("need_address")
            and runtime.addresses is not None
        ):
            try:
                await runtime.addresses.async_start(state["persons"], state["from"], state["to"], None)
            except RuntimeError:
                pass


class ExportKind:
    """A long period as a ZIP file: month by month into temporary files, then zipped."""

    backup = False

    async def units(self, jobs: JobManager, state: dict[str, Any]) -> list:
        folder = downloads.exports_folder(jobs.hass)
        await jobs.hass.async_add_executor_job(lambda: os.makedirs(folder, exist_ok=True))
        await jobs.hass.async_add_executor_job(downloads.cleanup, folder)
        return month_ranges(state["from"], state["to"])

    def _temp(self, jobs: JobManager, state: dict[str, Any]) -> str:
        return os.path.join(downloads.exports_folder(jobs.hass), f"{downloads.TEMP_PREFIX}{state['id']}")

    async def step(self, jobs: JobManager, state: dict[str, Any], unit) -> dict[str, Any]:
        first, last = unit
        temp = self._temp(jobs, state)
        fmt = state["params"].get("format", "csv")
        storage = jobs.runtime.storage
        timezone = dt_util.get_default_time_zone()

        def work() -> dict[str, Any]:
            from .api import export_gpx_multi
            from .storage import export_csv_multi

            os.makedirs(temp, exist_ok=True)
            rows_total = 0
            for person in state["persons"]:
                rows = storage.export_rows(person, first, last)
                if not rows:
                    continue
                rows_total += len(rows)
                if fmt == "gpx":
                    name = os.path.join(temp, person, f"{person}_{first[:7]}.gpx")
                    text = export_gpx_multi([(person, rows)], timezone)
                    mode = "w"
                else:
                    name = os.path.join(temp, person, f"{person}_{first[:4]}.csv")
                    text = export_csv_multi([(person, rows)])
                    mode = "a" if os.path.exists(name) else "w"
                    if mode == "a":
                        text = text.split("\n", 1)[1]  # the header only once
                os.makedirs(os.path.dirname(name), exist_ok=True)
                with open(name, mode, encoding="utf-8", newline="") as file:
                    file.write(text)
            return {"rows": rows_total}

        return await jobs.hass.async_add_executor_job(work)

    async def finish(self, jobs: JobManager, state: dict[str, Any], status: str) -> None:
        temp = self._temp(jobs, state)
        hass = jobs.hass
        if status != DONE:
            await hass.async_add_executor_job(shutil.rmtree, temp, True)
            return
        name = downloads.final_name(state["id"], f"whereabouts_{state['from']}_{state['to']}", "zip")
        target = os.path.join(downloads.exports_folder(hass), name)

        def build() -> int:
            count = 0
            with zipfile.ZipFile(target + ".part", "w", zipfile.ZIP_DEFLATED) as archive:
                for root, _dirs, files in sorted(os.walk(temp)):
                    for file in sorted(files):
                        path = os.path.join(root, file)
                        archive.write(path, os.path.relpath(path, temp))
                        count += 1
            os.replace(target + ".part", target)
            shutil.rmtree(temp, ignore_errors=True)
            return count

        if not await hass.async_add_executor_job(os.path.isdir, temp):
            state["result"]["files"] = 0
            return
        state["result"]["files"] = await hass.async_add_executor_job(build)
        state["file"] = name


class RecorderKind:
    """Import from the Home Assistant recorder: one person and day per step, only fills gaps."""

    backup = True

    async def units(self, jobs: JobManager, state: dict[str, Any]) -> list:
        days = day_range(state["from"], state["to"])
        return [(person, day) for day in days for person in state["persons"]]

    async def step(self, jobs: JobManager, state: dict[str, Any], unit) -> dict[str, Any]:
        person, day = unit
        return await async_import_day(jobs, person, day, write=True)

    async def finish(self, jobs: JobManager, state: dict[str, Any], status: str) -> None:
        result = state["result"]
        if state.get("done"):
            await jobs.log_entry(state, "import", int(result.get("added", 0)), mode="merge", file="recorder")
        await jobs.runtime.async_refresh_known(jobs.hass, data_changed=True)
        if status == DONE:
            await jobs.async_set_hint(HINT_DONE)
            if result.get("missing_addresses"):
                await jobs.async_set_open_addresses(jobs.open_addresses + int(result["missing_addresses"]))


async def recorder_points(hass: HomeAssistant, person: str, day: str) -> list:
    """The stays of one person and day as the recorder knows them (a list of ``Point``)."""
    from homeassistant.components.recorder import get_instance, history

    from .geo import position_for
    from .storage import Point
    from .timezones import format_offset

    entity_id = f"person.{person}"
    start = dt_util.start_of_local_day(date_type.fromisoformat(day))
    end = start + timedelta(days=1)

    def query():
        return history.get_significant_states(
            hass,
            start,
            end,
            [entity_id],
            include_start_time_state=True,
            significant_changes_only=False,
            minimal_response=False,
            no_attributes=False,
        )

    found = await get_instance(hass).async_add_executor_job(query)
    points = []
    for state in found.get(entity_id, []):
        if state.state in ("unknown", "unavailable"):
            continue
        when = dt_util.as_local(state.last_updated)
        if when.strftime("%Y-%m-%d") != day:
            continue
        position = position_for(hass, state)
        lat, lon = position if position else (None, None)
        points.append(
            Point(day, when.strftime("%H:%M:%S"), state.state, lat, lon, offset=format_offset(when.utcoffset()))
        )
    return points


async def async_import_day(jobs: JobManager, person: str, day: str, write: bool) -> dict[str, Any]:
    """Recorder -> recording rules -> merge into the stored day (nothing written with write=False)."""
    from .rules import apply_rules
    from .storage import complete_points

    hass = jobs.hass
    runtime = jobs.runtime
    storage = runtime.storage
    options = runtime.options
    distance = float(options.get(CONF_SAME_PLACE_DISTANCE) or DEFAULT_OPTIONS[CONF_SAME_PLACE_DISTANCE])
    interval = float(options.get(CONF_MIN_INTERVAL) or DEFAULT_OPTIONS[CONF_MIN_INTERVAL])
    points = await recorder_points(hass, person, day)
    if not points:
        return {"days": 1, "empty": 1}

    def prepare():
        complete_points(points, storage.zone)
        stays, _stats = apply_rules(points, distance, interval)
        return stays

    stays = await hass.async_add_executor_job(prepare)
    missing = sum(1 for p in stays if p.state == "not_home" and not p.address and p.latitude is not None)
    if not write:
        plan = await hass.async_add_executor_job(storage.import_plan, person, stays, "merge")
        return {
            "days": 1,
            "stays": len(stays),
            "added": sum(int(d.get("new", 0)) for d in plan),
            "days_new": sum(1 for d in plan if d.get("status") == "new"),
            "days_add": sum(1 for d in plan if d.get("status") == "add"),
        }
    outcome = await hass.async_add_executor_job(
        jobs.run_in_backup, lambda: storage.import_points(person, stays, False, [day], True, False)
    )
    return {
        "days": 1,
        "stays": len(stays),
        "added": outcome["added"],
        "skipped": outcome["skipped"],
        "missing_addresses": missing if outcome["added"] else 0,
    }


def recorded_persons(runtime) -> list[str]:
    """Keys of the persons that are recorded."""
    return sorted(str(p).split(".", 1)[-1] for p in runtime.logger.persons)


KINDS: dict[str, Any] = {"maintenance": MaintenanceKind(), "export": ExportKind(), "recorder": RecorderKind()}

__all__ = ["JobManager", "KINDS"]
