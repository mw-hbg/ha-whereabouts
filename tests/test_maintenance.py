"""Changing stored data through the settings page (real Home Assistant)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
from homeassistant.core import HomeAssistant

from custom_components.whereabouts import addresses as addresses_module
from custom_components.whereabouts.storage import Point

from .conftest import setup_integration

pytestmark = pytest.mark.usefixtures("zones")
D = "2026-06-24"
LOOKUP = "custom_components.whereabouts.nominatim.Nominatim.lookup"


def _person(hass: HomeAssistant, key: str) -> None:
    hass.states.async_set(f"person.{key}", "home", {"friendly_name": key.title()})


async def test_import_applies_rules_and_warns(hass: HomeAssistant, hass_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass, retention_days=3650, record_persons=[])
    client = await hass_client()
    csv = (
        "person,date,start,end,state,latitude,longitude,address\n"
        "alex,2000-01-01,08:00:00,,not_home,48.70,9.00,\n"  # in the zone Work, long ago
        f"alex,{D},08:00:00,,not_home,48.5,8.5,\n"
        f"alex,{D},08:00:20,,not_home,48.6,8.5,\n"  # 20 s later: thinned out
        f"alex,{D},08:10:00,,not_home,48.6,8.5001,\n"
        f"alex,{D},08:20:00,,not_home,48.6,8.5002,\n"  # same place
    )

    async def post(preview: bool, days: str | None = None):
        data = {"file": csv.encode(), "person": "", "mode": "merge", "preview": "true" if preview else "false"}
        if days is not None:
            data["days"] = days
        response = await client.post("/api/whereabouts/import", data=data)
        return await response.json()

    preview = await post(True)
    plan = {d["date"]: d for d in preview["plan"]}
    assert plan["2000-01-01"]["expired"] is True
    assert plan[D]["expired"] is False
    assert (plan[D]["points"], plan[D]["stays"], plan[D]["dropped"], plan[D]["merged"]) == (4, 2, 1, 1)
    assert preview["not_recorded"] == ["alex"]
    result = await post(False, f"alex|{D}")
    assert result["added"] == 2 and result["missing_addresses"] == 2
    runtime = hass.data["whereabouts"]
    assert [p.end for p in runtime.storage.read_points("alex", D)] == ["", "08:20:00"]


async def test_zone_changes_and_recalculation(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    runtime.storage.import_points(
        "alex", [Point(D, "08:00:00", "Work", 48.70, 9.00), Point(D, "09:00:00", "not_home", 48.0, 8.0)]
    )
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "whereabouts/settings"})
    first = (await ws.receive_json())["result"]["admin"]
    assert first["zone_changes"] == []  # the first look only remembers the zones
    assert first["address_job"]["status"] == "idle"

    # rename the zone Work
    state = hass.states.get("zone.work")
    hass.states.async_set("zone.work", "0", {**state.attributes, "friendly_name": "Office"})
    await ws.send_json({"id": 2, "type": "whereabouts/settings"})
    changes = (await ws.receive_json())["result"]["admin"]["zone_changes"]
    assert changes == [{"kind": "renamed", "entity_id": "zone.work", "name": "Office", "old_name": "Work"}]

    await ws.send_json({"id": 3, "type": "whereabouts/maintenance/zones", "persons": ["person.alex"]})
    preview = (await ws.receive_json())["result"]
    assert preview["changed"] == 1 and preview["transitions"] == [{"from": "Work", "to": "Office", "n": 1}]
    assert runtime.storage.read_points("alex", D)[0].state == "Work"

    await ws.send_json(
        {"id": 4, "type": "whereabouts/maintenance/zones", "persons": ["person.alex"], "preview": False, "ack": True}
    )
    assert (await ws.receive_json())["result"]["changed"] == 1
    assert runtime.storage.read_points("alex", D)[0].state == "Office"
    await ws.send_json({"id": 5, "type": "whereabouts/settings"})
    assert (await ws.receive_json())["result"]["admin"]["zone_changes"] == []


async def test_rules_command_and_admin_only(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    runtime.storage.import_points(
        "alex", [Point(D, "08:00:00", "not_home", 48.5, 8.5), Point(D, "08:00:10", "not_home", 48.6, 8.5)]
    )
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "whereabouts/maintenance/rules", "persons": ["person.alex"]})
    assert (await ws.receive_json())["result"]["dropped"] == 1
    await ws.send_json({"id": 2, "type": "whereabouts/maintenance/rules", "persons": ["person.alex"], "preview": False})
    assert (await ws.receive_json())["success"]
    assert len(runtime.storage.read_points("alex", D)) == 1

    hass_admin_user.groups = []
    await ws.send_json({"id": 3, "type": "whereabouts/maintenance/rules", "persons": ["person.alex"]})
    assert (await ws.receive_json())["error"]["code"] == "unauthorized"


async def test_address_job_fills_once_per_place_pauses_and_resumes(
    hass: HomeAssistant, hass_ws_client, hass_admin_user
):
    _person(hass, "alex")
    entry = await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    runtime.storage.import_points(
        "alex",
        [
            Point(D, "08:00:00", "not_home", 48.5, 8.5),
            Point(D, "09:00:00", "not_home", 48.50001, 8.5),  # same place: no second request
            Point(D, "10:00:00", "not_home", 48.6, 8.6, "Known"),
            Point(D, "11:00:00", "home", 48.0, 8.0),
        ],
        merge=False,
    )
    asked = []

    async def fake_lookup(self, lat, lon, min_gap=1.5):
        asked.append((lat, lon, min_gap))
        return f"Street {len(asked)}", True

    ws = await hass_ws_client(hass)
    with patch(LOOKUP, fake_lookup):
        await ws.send_json({"id": 1, "type": "whereabouts/addresses/start", "persons": ["person.alex"]})
        assert (await ws.receive_json())["result"] == {"missing": 2, "busy": False}
        await ws.send_json(
            {"id": 2, "type": "whereabouts/addresses/start", "persons": ["person.alex"], "preview": False}
        )
        assert (await ws.receive_json())["result"]["total"] == 2
        await runtime.addresses._task
    assert asked == [(48.5, 8.5, 1.0)]
    assert [p.address for p in runtime.storage.read_points("alex", D)] == ["Street 1", "Street 1", "Known", ""]
    await ws.send_json({"id": 3, "type": "whereabouts/addresses/status"})
    status = (await ws.receive_json())["result"]
    assert (status["status"], status["done"], status["found"]) == ("done", 2, 2)

    # paused jobs survive a reload and go on after "resume"
    runtime.storage.import_points("alex", [Point("2026-06-25", "08:00:00", "not_home", 47.0, 7.0)])
    with patch(LOOKUP, fake_lookup):
        await runtime.addresses.async_start(["alex"], "2026-06-25", "")
        await runtime.addresses.async_pause()
        await hass.config_entries.async_reload(entry.entry_id)
        await hass.async_block_till_done()
        job = hass.data["whereabouts"].addresses
        assert job.state["status"] == addresses_module.PAUSED
        await job.async_resume()
        await job._task
    assert hass.data["whereabouts"].storage.read_points("alex", "2026-06-25")[0].address.startswith("Street")


def _write_old_day(folder: Path) -> None:
    """A day as written before 0.7 (no offset, no time zone)."""
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"alex_{D}.csv").write_text("08:00:00;not_home;40.7128;-74.006;;09:00:00\n")


async def test_time_zones_commands(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    await hass.async_add_executor_job(_write_old_day, Path(runtime.storage.folder))
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "whereabouts/maintenance/timezones", "persons": ["person.alex"]})
    preview = (await ws.receive_json())["result"]
    assert (preview["days_changed"], preview["offsets"], preview["zones"]) == (1, 1, 1)
    await ws.send_json(
        {"id": 2, "type": "whereabouts/maintenance/timezones", "persons": ["person.alex"], "preview": False}
    )
    assert (await ws.receive_json())["result"]["days_changed"] == 1
    [stay] = runtime.storage.read_day("alex", D)
    assert stay.tz == "America/New_York" and stay.offset

    await ws.send_json({"id": 3, "type": "whereabouts/time_zones", "points": [[40.7128, -74.006]]})
    assert (await ws.receive_json())["result"]["zones"] == ["America/New_York"]
