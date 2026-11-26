"""Background jobs (0.7.10): maintenance, export, download, import from the recorder, open tasks."""

from __future__ import annotations

import os
import zipfile
from datetime import datetime
from unittest.mock import patch

import pytest
from homeassistant.core import HomeAssistant, State
from homeassistant.util import dt as dt_util

from custom_components.whereabouts import downloads
from custom_components.whereabouts.jobs import KINDS, day_range, merge_result, month_ranges
from custom_components.whereabouts.storage import Point

from .conftest import setup_integration, wait_job

pytestmark = pytest.mark.usefixtures("zones")
D = "2026-06-24"


def _person(hass: HomeAssistant, key: str) -> None:
    hass.states.async_set(f"person.{key}", "home", {"friendly_name": key.title()})


async def _call(ws, n: int, **msg):
    await ws.send_json({"id": n, **msg})
    return await ws.receive_json()


def test_merge_result_adds_numbers_and_transitions():
    total: dict = {}
    merge_result(total, {"days": 1, "changed": 2, "transitions": [{"from": "a", "to": "b", "n": 2}]})
    merge_result(
        total,
        {"days": 1, "changed": 1, "transitions": [{"from": "a", "to": "b", "n": 1}, {"from": "b", "to": "c", "n": 5}]},
    )
    assert total["days"] == 2 and total["changed"] == 3
    assert total["transitions"] == [{"from": "b", "to": "c", "n": 5}, {"from": "a", "to": "b", "n": 3}]


def test_month_and_day_ranges():
    assert month_ranges("2026-01-15", "2026-03-02") == [
        ("2026-01-15", "2026-01-31"),
        ("2026-02-01", "2026-02-28"),
        ("2026-03-01", "2026-03-02"),
    ]
    assert month_ranges("2026-12-30", "2027-01-01") == [("2026-12-30", "2026-12-31"), ("2027-01-01", "2027-01-01")]
    assert day_range("2026-02-27", "2026-03-01") == ["2026-02-27", "2026-02-28", "2026-03-01"]


async def test_one_job_at_a_time_and_cancel(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    for day in ("2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23"):
        runtime.storage.import_points(
            "alex", [Point(day, "08:00:00", "not_home", 48.5, 8.5), Point(day, "08:00:10", "not_home", 48.6, 8.5)]
        )
    ws = await hass_ws_client(hass)
    first = await _call(ws, 1, type="whereabouts/maintenance/rules", persons=["person.alex"], preview=False)
    job = first["result"]["job"]
    assert job["status"] == "running" and job["total"] == 4
    # a second job (or the address job) is refused while one runs
    second = await _call(ws, 2, type="whereabouts/maintenance/rules", persons=["person.alex"], preview=False)
    assert second["error"]["code"] == "busy"
    third = await _call(ws, 3, type="whereabouts/addresses/start", persons=["person.alex"], preview=False)
    assert third["error"]["code"] == "busy"
    cancelled = (await _call(ws, 4, type="whereabouts/jobs/control", action="cancel"))["result"]["job"]
    assert cancelled["status"] in ("cancelled", "done")
    assert cancelled["done"] <= cancelled["total"]
    await wait_job(hass)
    await _call(ws, 40, type="whereabouts/jobs/control", action="dismiss")

    # cancelled after the first day: that day is done and in the log, the rest stays as it was
    kind = KINDS["maintenance"]
    original = kind.step

    async def cancel_after_first(jobs, state, unit):
        part = await original(jobs, state, unit)
        jobs._cancel = True
        return part

    with patch.object(kind, "step", cancel_after_first):
        await runtime.jobs.async_start(
            "maintenance", ["alex"], "2026-06-20", "2026-06-23", {"action": "rules"}, "Admin"
        )
        status = await wait_job(hass)
    assert status["status"] == "cancelled" and status["done"] == 1 and status["total"] == 4
    # what was done is in the log
    entries = (await _call(ws, 41, type="whereabouts/journal/list"))["result"]["items"]
    assert entries and entries[0]["action"] == "rules"
    dismissed = (await _call(ws, 42, type="whereabouts/jobs/control", action="dismiss"))["result"]["job"]
    assert dismissed == {"status": "idle"}


async def test_job_state_is_kept_and_a_running_job_goes_on(hass: HomeAssistant, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    runtime.storage.import_points(
        "alex", [Point(D, "08:00:00", "not_home", 48.5, 8.5), Point(D, "08:00:10", "not_home", 48.6, 8.5)]
    )
    jobs = runtime.jobs
    await jobs.async_start("maintenance", ["alex"], D, D, {"action": "rules"}, "Admin")
    status = await wait_job(hass)
    assert status["status"] == "done" and status["user"] == "Admin"
    # the saved state comes back after a reload
    stored = await jobs._store.async_load()
    assert stored["job"]["status"] == "done" and stored["job"]["result"]["dropped"] == 1


async def test_export_job_builds_a_zip_and_the_download_view_serves_only_it(
    hass: HomeAssistant, hass_ws_client, hass_client, hass_admin_user
):
    _person(hass, "alex")
    _person(hass, "sam")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    for key in ("alex", "sam"):
        runtime.storage.import_points(key, [Point("2026-05-30", "08:00:00", "not_home", 48.5, 8.5)])
        runtime.storage.import_points(key, [Point("2026-06-02", "09:00:00", "not_home", 48.6, 8.6)])
    ws = await hass_ws_client(hass)
    started = await _call(
        ws,
        1,
        type="whereabouts/jobs/export",
        persons=["person.alex", "person.sam"],
        **{"from": "2026-05-01", "to": "2026-06-30"},
    )
    assert started["result"]["job"]["total"] == 2  # May, June
    status = await wait_job(hass)
    assert status["status"] == "done" and status["result"]["files"] == 2
    name = status["file"]
    assert downloads.FILE_NAME.match(name)
    path = os.path.join(downloads.exports_folder(hass), name)
    with zipfile.ZipFile(path) as archive:
        assert sorted(archive.namelist()) == ["alex/alex_2026.csv", "sam/sam_2026.csv"]
        text = archive.read("alex/alex_2026.csv").decode()
    # one header, both months in one file per person and year
    assert text.count("person,date") == 1 and "2026-05-30" in text and "2026-06-02" in text
    assert not [f for f in os.listdir(downloads.exports_folder(hass)) if f.startswith(downloads.TEMP_PREFIX)]

    client = await hass_client()
    response = await client.get(f"/api/whereabouts/download/{name}")
    assert response.status == 200
    assert response.headers["Content-Type"] == "application/zip"
    assert "attachment" in response.headers["Content-Disposition"] and "no-store" in response.headers["Cache-Control"]
    assert (await client.get("/api/whereabouts/download/abcdef123456_nothing.zip")).status == 404
    for bad in ("secrets.yaml", "..%2F..%2Fsecrets.yaml", "abcdef123456_x.csv", "ABCDEF123456_x.zip"):
        assert (await client.get(f"/api/whereabouts/download/{bad}")).status in (400, 404)


async def test_export_job_is_for_administrators_only(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    ws = await hass_ws_client(hass)
    hass_admin_user.groups = []
    reply = await _call(
        ws, 1, type="whereabouts/jobs/export", persons=["person.alex"], **{"from": "2026-05-01", "to": "2026-06-30"}
    )
    assert reply["error"]["code"] == "unauthorized"


def test_cleanup_removes_old_files_and_temp_folders(tmp_path):
    old = tmp_path / "aaaaaaaaaaaa_old.zip"
    old.write_bytes(b"x")
    fresh = tmp_path / "bbbbbbbbbbbb_new.zip"
    fresh.write_bytes(b"x")
    temp = tmp_path / "tmp_cccccccccccc"
    temp.mkdir()
    (temp / "f.csv").write_text("x")
    now = old.stat().st_mtime + 25 * 3600
    os.utime(fresh, (now - 3600, now - 3600))
    assert downloads.cleanup(str(tmp_path), now=now) == 2
    assert sorted(os.listdir(tmp_path)) == ["bbbbbbbbbbbb_new.zip"]


async def test_recorder_import_preview_and_job_fill_only_gaps(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass, persons=["person.alex"])
    runtime = hass.data["whereabouts"]
    # the stored day already has the morning; the recorder knows the morning and the afternoon
    runtime.storage.import_points("alex", [Point(D, "08:00:00", "not_home", 48.5, 8.5)])

    def at(hour: int, lat: float, lon: float, state: str = "not_home") -> State:
        when = datetime(2026, 6, 24, hour, 0, tzinfo=dt_util.get_default_time_zone())
        return State("person.alex", state, {"latitude": lat, "longitude": lon}, last_changed=when, last_updated=when)

    found = {"person.alex": [at(8, 48.5, 8.5), at(15, 48.7, 8.7), at(16, 48.7001, 8.7001)]}
    hass.config.components.add("recorder")

    class FakeInstance:
        async def async_add_executor_job(self, func, *args):
            return found

    ws = await hass_ws_client(hass)
    with patch("homeassistant.components.recorder.get_instance", return_value=FakeInstance()):
        preview = (
            await _call(ws, 1, type="whereabouts/recorder/preview", persons=["person.alex"], **{"from": D, "to": D})
        )["result"]
        assert preview["days"] == 1 and preview["added"] >= 1 and not preview["busy"]
        assert runtime.storage.read_day("alex", D)[-1].start == "08:00:00"  # nothing written by a preview
        started = await _call(ws, 2, type="whereabouts/recorder/start", persons=["person.alex"], **{"from": D, "to": D})
        assert started["result"]["job"]["kind"] == "recorder"
        status = await wait_job(hass)
    assert status["status"] == "done" and status["result"]["added"] >= 1
    starts = [stay.start for stay in runtime.storage.read_day("alex", D)]
    assert "08:00:00" in starts and any(s.startswith("15:") for s in starts)
    entries = (await _call(ws, 3, type="whereabouts/journal/list"))["result"]["items"]
    assert entries[0]["action"] == "import" and entries[0]["file"] == "recorder"
    # an import that found stays away without an address leaves an open task
    assert runtime.jobs.open_tasks()["hint"] == "done"
    assert runtime.jobs.open_tasks()["addresses"] >= 1


async def test_recorder_hint_and_open_addresses(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    ws = await hass_ws_client(hass)
    assert runtime.jobs.open_tasks() == {"hint": "open", "addresses": 0}
    reply = await _call(ws, 1, type="whereabouts/recorder/hint", hint="later")
    assert reply["result"]["open"]["hint"] == "later"
    reply = await _call(ws, 2, type="whereabouts/recorder/hint", hint="never")
    assert reply["result"]["open"]["hint"] == "never"
    await runtime.jobs.async_set_open_addresses(7)
    stored = await runtime.jobs._store.async_load()
    assert stored["hint"] == "never" and stored["open_addresses"] == 7
    await runtime.jobs.async_address_finished({"found": 3})
    assert runtime.jobs.open_tasks()["addresses"] == 4
    cleared = await _call(ws, 3, type="whereabouts/jobs/addresses_clear")
    assert cleared["result"]["open"]["addresses"] == 0
    settings = (await _call(ws, 4, type="whereabouts/settings"))["result"]["admin"]
    assert settings["job"] == {"status": "idle"} and settings["open_tasks"]["hint"] == "never"
