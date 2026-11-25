"""Log and trash of the data maintenance (0.7.3)."""

from __future__ import annotations

import os
from datetime import datetime

import pytest
from homeassistant.core import HomeAssistant

from custom_components.whereabouts.journal import HINT_ENTRIES, Journal, history_size
from custom_components.whereabouts.storage import HistoryStorage, Point

from .conftest import setup_integration

pytestmark = pytest.mark.usefixtures("zones")
D = "2026-06-24"
D2 = "2026-06-25"


def _text(path: str) -> str:
    with open(path, encoding="utf-8") as file:
        return file.read()


def _exists(path: str) -> bool:
    return os.path.exists(path)


def _person(hass: HomeAssistant, key: str) -> None:
    hass.states.async_set(f"person.{key}", "home", {"friendly_name": key.title()})


async def _call(ws, n: int, **msg):
    await ws.send_json({"id": n, **msg})
    return await ws.receive_json()


def _two_close_points(storage: HistoryStorage, date: str = D) -> None:
    storage.import_points(
        "alex", [Point(date, "08:00:00", "not_home", 48.5, 8.5), Point(date, "08:00:10", "not_home", 48.6, 8.5)]
    )


async def test_rules_are_logged_and_restored(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    _two_close_points(runtime.storage)
    before = _text(runtime.storage.path("alex", D))
    ws = await hass_ws_client(hass)

    # a preview writes nothing to the log
    await _call(ws, 1, type="whereabouts/maintenance/rules", persons=["person.alex"])
    assert (await _call(ws, 2, type="whereabouts/journal/list"))["result"]["items"] == []

    await _call(ws, 3, type="whereabouts/maintenance/rules", persons=["person.alex"], preview=False)
    listing = (await _call(ws, 4, type="whereabouts/journal/list"))["result"]
    entry = listing["items"][0]
    assert entry["action"] == "rules" and entry["persons"] == ["alex"] and entry["trash"] is True
    assert entry["days"] == 1 and entry["rows"] == 1 and entry["size"] > 0 and entry["user"]
    assert listing["trash_bytes"] == entry["size"] and listing["trash_days"] == 30
    assert len(runtime.storage.read_points("alex", D)) == 1

    preview = (await _call(ws, 5, type="whereabouts/journal/restore", entry=entry["id"]))["result"]
    assert preview["changed"] == []
    done = (await _call(ws, 6, type="whereabouts/journal/restore", entry=entry["id"], preview=False))["result"]
    assert done["days"] == 1
    assert _text(runtime.storage.path("alex", D)) == before

    items = (await _call(ws, 7, type="whereabouts/journal/list"))["result"]["items"]
    assert items[0]["action"] == "restore" and items[0]["ref"] == entry["id"] and items[0]["trash"] is True
    assert items[1]["restored"] == items[0]["id"]

    # restoring the restore brings the rules' result back
    await _call(ws, 8, type="whereabouts/journal/restore", entry=items[0]["id"], preview=False)
    assert len(runtime.storage.read_points("alex", D)) == 1

    hass_admin_user.groups = []
    assert (await _call(ws, 9, type="whereabouts/journal/list"))["error"]["code"] == "unauthorized"


async def test_restore_warns_about_later_changes_and_removes_new_days(
    hass: HomeAssistant, hass_ws_client, hass_admin_user
):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    _two_close_points(runtime.storage)
    ws = await hass_ws_client(hass)
    await _call(ws, 1, type="whereabouts/maintenance/rules", persons=["person.alex"], preview=False)
    entry = (await _call(ws, 2, type="whereabouts/journal/list"))["result"]["items"][0]

    runtime.storage.import_points("alex", [Point(D, "12:00:00", "home", 52.5, 13.4)])
    os.utime(runtime.storage.path("alex", D), ns=(1, 1))  # surely another change time
    preview = (await _call(ws, 3, type="whereabouts/journal/restore", entry=entry["id"]))["result"]
    assert preview["changed"] == [f"alex_{D}"]

    # a backup of a day that did not exist: restoring removes it again
    journal = runtime.journal
    backup = journal.backup(journal.new_id(datetime(2026, 6, 26, 9, 0, 0)))
    point = Point(D2, "09:00:00", "home", 52.5, 13.4)
    runtime.storage.with_backup(backup, runtime.storage.import_points, "alex", [point])
    new = journal.add({"id": os.path.basename(backup.folder), "action": "import", "persons": ["alex"]}, backup)
    assert new["days"] == 1
    await _call(ws, 4, type="whereabouts/journal/restore", entry=new["id"], preview=False)
    assert not _exists(runtime.storage.path("alex", D2))


async def test_import_and_delete_are_logged(hass: HomeAssistant, hass_ws_client, hass_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    client = await hass_client()
    csv = f"person,date,start,end,state,latitude,longitude,address\nalex,{D},08:00:00,,home,52.5,13.4,\n"
    response = await client.post(
        "/api/whereabouts/import", data={"file": csv.encode(), "person": "", "mode": "merge", "preview": "false"}
    )
    assert (await response.json())["added"] == 1
    ws = await hass_ws_client(hass)
    entry = (await _call(ws, 1, type="whereabouts/journal/list"))["result"]["items"][0]
    assert (entry["action"], entry["from"], entry["to"], entry["rows"], entry["mode"]) == ("import", D, D, 1, "merge")

    await _call(ws, 2, type="whereabouts/delete", person="person.alex", date=D, times=["08:00:00"])
    entry = (await _call(ws, 3, type="whereabouts/journal/list"))["result"]["items"][0]
    assert (entry["action"], entry["rows"], entry["trash"]) == ("delete", 1, True)
    await _call(ws, 4, type="whereabouts/journal/restore", entry=entry["id"], preview=False)
    assert len(runtime.storage.read_points("alex", D)) == 1


async def test_delete_entries_and_expire(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    _two_close_points(runtime.storage)
    ws = await hass_ws_client(hass)
    await _call(ws, 1, type="whereabouts/maintenance/rules", persons=["person.alex"], preview=False)
    _two_close_points(runtime.storage, D2)
    await _call(ws, 2, type="whereabouts/maintenance/rules", persons=["person.alex"], preview=False)
    first, second = (await _call(ws, 3, type="whereabouts/journal/list"))["result"]["items"]

    assert (await _call(ws, 4, type="whereabouts/journal/delete", ids=[first["id"]]))["result"]["deleted"] == 1
    assert not _exists(os.path.join(runtime.journal.trash, first["id"]))

    assert runtime.journal.expire("2999-01-01") == 1
    items = (await _call(ws, 5, type="whereabouts/journal/list"))["result"]
    assert items["items"][0]["trash"] is False and items["items"][0]["expired"] is True
    assert items["trash_bytes"] == 0
    err = await _call(ws, 6, type="whereabouts/journal/restore", entry=second["id"])
    assert err["error"]["code"] == "not_found"
    assert (await _call(ws, 7, type="whereabouts/journal/delete", before="2999-01-01"))["result"]["deleted"] == 1


def test_sizes_and_hint(tmp_path):
    storage = HistoryStorage(str(tmp_path / "history"))
    storage.import_points("alex", [Point(D, "08:00:00", "home", 52.5, 13.4)])
    storage.import_points("alex", [Point(D2, "08:00:00", "home", 52.5, 13.4)])
    storage.import_points("sam", [Point(D, "08:00:00", "home", 52.5, 13.4)])
    size = history_size(storage.folder)
    assert size["days"] == 3 and set(size["persons"]) == {"alex", "sam"}
    assert size["persons"]["alex"]["days"] == 2
    assert size["bytes"] == sum(p["bytes"] for p in size["persons"].values()) > 0
    assert history_size(str(tmp_path / "missing")) == {"bytes": 0, "days": 0, "persons": {}}

    journal = Journal(str(tmp_path), storage.folder)
    for n in range(HINT_ENTRIES):
        journal.add({"id": f"20260101-000000-{n:06x}", "action": "rules"})
    summary = journal.summary()
    assert summary["entries"] == HINT_ENTRIES and summary["hint"] is True and summary["trash_bytes"] == 0


async def test_settings_show_sizes(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    _two_close_points(runtime.storage)
    ws = await hass_ws_client(hass)
    admin = (await _call(ws, 1, type="whereabouts/settings"))["result"]["admin"]
    assert admin["history_size"]["persons"]["alex"]["days"] == 1
    assert admin["journal"]["entries"] == 0
    assert admin["options"]["trash_days"] == 30


async def test_address_lookup_is_only_logged_and_can_be_dismissed(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    runtime.storage.import_points("alex", [Point(D, "08:00:00", "home", 52.5, 13.4)])
    ws = await hass_ws_client(hass)
    status = (await _call(ws, 1, type="whereabouts/addresses/start", persons=["person.alex"], preview=False))["result"]
    assert status["status"] == "done"  # nothing missing
    entry = (await _call(ws, 2, type="whereabouts/journal/list"))["result"]["items"][0]
    assert (entry["action"], entry["trash"], entry["total"]) == ("addresses", False, 0)
    assert not _exists(runtime.journal.trash)

    done = (await _call(ws, 3, type="whereabouts/addresses/control", action="dismiss"))["result"]
    assert done["status"] == "idle"


async def test_automatic_retention_is_logged_and_restorable(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    """0.7.5: the nightly deletion goes through log and trash like every other change."""
    from custom_components.whereabouts import async_apply_retention

    _person(hass, "alex")
    await setup_integration(hass, retention_days=30)
    runtime = hass.data["whereabouts"]
    runtime.storage.import_points("alex", [Point("2020-01-01", "08:00:00", "home", 48.1, 8.1)])
    _two_close_points(runtime.storage, "2999-01-01")
    old_file = runtime.storage.path("alex", "2020-01-01")
    before = _text(old_file)

    assert await async_apply_retention(hass, runtime) == 1
    assert not _exists(old_file) and _exists(runtime.storage.path("alex", "2999-01-01"))

    ws = await hass_ws_client(hass)
    entry = (await _call(ws, 1, type="whereabouts/journal/list"))["result"]["items"][0]
    assert entry["action"] == "retention" and entry["persons"] == ["alex"] and entry["trash"] is True
    assert (entry["from"], entry["to"], entry["rows"]) == ("2020-01-01", "2020-01-01", 1)

    await _call(ws, 2, type="whereabouts/journal/restore", entry=entry["id"], preview=False)
    assert _text(old_file) == before
