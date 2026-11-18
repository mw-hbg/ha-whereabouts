"""Integration tests with a real Home Assistant."""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.util import dt as dt_util

from custom_components.whereabouts.const import DEFAULT_OPTIONS, DOMAIN
from custom_components.whereabouts.geo import phone_address, position_for
from custom_components.whereabouts.storage import Point

from .conftest import HOME, setup_integration

pytestmark = pytest.mark.usefixtures("zones")
UPLOAD = "custom_components.whereabouts.config_flow.process_uploaded_file"
FILE_ID = "3f1e7c2a-5b8d-4c6e-9a1f-2b3c4d5e6f70"


def _person(hass: HomeAssistant, key: str, state: str, user_id: str | None = None, **attrs) -> None:
    hass.states.async_set(f"person.{key}", state, {"friendly_name": key.title(), "user_id": user_id, **attrs})


# --- set-up ---------------------------------------------------------------
async def test_config_flow_creates_entry_and_only_once(hass: HomeAssistant):
    for key in ("alex", "sam", "kim"):
        _person(hass, key, "home")
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    # Step 1: persons Whereabouts works with (Kim not), sidebar, addresses
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {"persons": ["person.alex", "person.sam"], "panel": True, "address_source": "phone"},
    )
    assert result["type"] is FlowResultType.FORM and result["step_id"] == "recording"
    # Step 2 lists only those two, both ticked by default; Sam is unticked
    options = result["data_schema"].schema
    default = next(k for k in options if k == "record_persons").default()
    assert default == ["person.alex", "person.sam"]
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"record_persons": ["person.alex"]})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["options"]["persons"] == ["person.alex", "person.sam"]
    assert result["options"]["record_persons"] == ["person.alex"]
    assert result["options"]["panel"] is True
    assert result["options"]["retention_days"] == 0  # never delete by default
    assert DEFAULT_OPTIONS["address_source"] == "phone_osm"  # Companion app, otherwise OpenStreetMap
    await hass.async_block_till_done()
    again = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert again["type"] is FlowResultType.ABORT


async def test_all_persons_ticked_means_all(hass: HomeAssistant):
    _person(hass, "alex", "home")
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"persons": ["person.alex"], "panel": False, "address_source": "osm"}
    )
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"record_persons": []})
    assert result["options"]["persons"] == []  # = everybody, also persons added later
    assert result["options"]["record_persons"] == []


async def test_cards_are_served(hass: HomeAssistant, hass_client):
    await setup_integration(hass)
    client = await hass_client()
    for path in ("whereabouts-cards.js", "shared.js", "i18n/de.json", "leaflet/leaflet.js", "leaflet/leaflet.css"):
        response = await client.get(f"/whereabouts_static/{path}")
        assert response.status == 200, path


# --- recording ------------------------------------------------------------
async def test_records_moves_and_throttles_updates(hass: HomeAssistant):
    _person(hass, "alex", "home", latitude=HOME[0], longitude=HOME[1])
    entry = await setup_integration(hass, record_persons=["person.alex"], min_interval=60)
    runtime = entry.runtime_data
    _person(hass, "alex", "home", latitude=HOME[0] + 0.0001, longitude=HOME[1])  # first update: stored
    await hass.async_block_till_done()
    _person(hass, "alex", "home", latitude=HOME[0] + 0.0002, longitude=HOME[1])  # within 60 s: skipped
    await hass.async_block_till_done()
    _person(hass, "alex", "Work", latitude=48.70, longitude=9.00)  # change of place: always
    await hass.async_block_till_done()
    today = dt_util.now().strftime("%Y-%m-%d")
    stays = await hass.async_add_executor_job(runtime.storage.read_day, "alex", today)
    assert [s.state for s in stays] == ["home", "Work"]
    assert len(stays[0].times) == 1


async def test_not_recorded_person_is_ignored(hass: HomeAssistant):
    _person(hass, "sam", "home", latitude=HOME[0], longitude=HOME[1])
    entry = await setup_integration(hass, record_persons=["person.alex"])
    _person(hass, "sam", "not_home", latitude=48.0, longitude=8.0)
    await hass.async_block_till_done()
    assert await hass.async_add_executor_job(entry.runtime_data.storage.list_files) == []


async def test_wifi_tracker_uses_gps_inside_zone_else_zone_centre(hass: HomeAssistant):
    hass.states.async_set(
        "device_tracker.phone",
        "home",
        {
            "source_type": "gps",
            "latitude": HOME[0] + 0.0003,
            "longitude": HOME[1],
            "gps_accuracy": 10,
        },
    )
    hass.states.async_set("device_tracker.router", "home", {"source_type": "router"})
    _person(hass, "alex", "home", device_trackers=["device_tracker.router", "device_tracker.phone"])
    assert position_for(hass, hass.states.get("person.alex")) == (HOME[0] + 0.0003, HOME[1])
    # GPS far outside the home zone (stale): use the zone centre instead
    hass.states.async_set(
        "device_tracker.phone",
        "not_home",
        {
            "source_type": "gps",
            "latitude": 47.0,
            "longitude": 8.0,
            "gps_accuracy": 10,
        },
    )
    assert position_for(hass, hass.states.get("person.alex")) == HOME


async def test_phone_address_only_when_close_and_country_hidden(hass: HomeAssistant):
    hass.states.async_set(
        "sensor.phone_geocoded_location",
        "Street 1\n71083 Town\nGermany",
        {
            "Location": [48.0, 8.0],
            "Thoroughfare": "Street",
            "Sub Thoroughfare": "1",
            "Locality": "Town",
            "Country": "Germany",
            "ISO Country Code": "DE",
        },
    )
    assert phone_address(hass, "sensor.phone_geocoded_location", 48.0005, 8.0, 150) == "Street 1, Town"
    assert phone_address(hass, "sensor.phone_geocoded_location", 48.01, 8.0, 150) == ""  # 1.1 km: stale
    hass.states.async_set(
        "sensor.phone_geocoded_location",
        "x",
        {
            "location": [48.0, 8.0],
            "thoroughfare": "Rue",
            "locality": "Paris",
            "country": "France",
            "iso_country_code": "FR",
        },
    )
    assert phone_address(hass, "sensor.phone_geocoded_location", 48.0, 8.0, 150) == "Rue, Paris, France"


async def test_osm_is_used_only_when_chosen(hass: HomeAssistant):
    _person(hass, "alex", "home", latitude=HOME[0], longitude=HOME[1])
    entry = await setup_integration(hass, record_persons=["person.alex"], address_source="phone")
    runtime = entry.runtime_data
    runtime.logger.stop()  # only the direct calls below
    with patch.object(runtime.logger.nominatim, "reverse", return_value="OSM 1, Town") as reverse:
        await runtime.logger.async_record(hass.states.get("person.alex"), dt_util.now())
        _person(hass, "alex", "not_home", latitude=48.0, longitude=8.0)
        with patch("custom_components.whereabouts.logger.GEOCODE_WAIT_SECONDS", 0):
            await runtime.logger.async_record(hass.states.get("person.alex"), dt_util.now())
        reverse.assert_not_called()
    runtime.logger.options["address_source"] = "phone_osm"
    with (
        patch.object(runtime.logger.nominatim, "reverse", return_value="OSM 1, Town") as reverse,
        patch("custom_components.whereabouts.logger.GEOCODE_WAIT_SECONDS", 0),
    ):
        _person(hass, "alex", "not_home", latitude=48.1, longitude=8.0)
        await runtime.logger.async_record(hass.states.get("person.alex"), dt_util.now())
        reverse.assert_called_once()
    stays = await hass.async_add_executor_job(runtime.storage.read_day, "alex", dt_util.now().strftime("%Y-%m-%d"))
    assert stays[-1].address == "OSM 1, Town"


async def test_midnight_points(hass: HomeAssistant):
    _person(hass, "alex", "home", latitude=HOME[0], longitude=HOME[1])
    entry = await setup_integration(hass, record_persons=["person.alex"])
    runtime = entry.runtime_data
    runtime.logger.stop()
    tz = dt_util.get_default_time_zone()
    await runtime.logger._day_end(datetime(2026, 6, 24, 23, 59, 59, tzinfo=tz))
    await runtime.logger._day_start(datetime(2026, 6, 25, 0, 0, 0, tzinfo=tz))
    assert await hass.async_add_executor_job(runtime.storage.days, "alex") == ["2026-06-24", "2026-06-25"]


# --- API and permissions --------------------------------------------------
async def _prepare_history(hass: HomeAssistant, admin_id: str):
    _person(hass, "alex", "home", user_id=admin_id, latitude=HOME[0], longitude=HOME[1])
    _person(hass, "sam", "home", user_id="someone-else", latitude=HOME[0], longitude=HOME[1])
    entry = await setup_integration(hass, record_persons=["person.alex", "person.sam"])
    storage = entry.runtime_data.storage
    for key in ("alex", "sam"):
        await hass.async_add_executor_job(storage.add_point, key, Point("2026-06-24", "08:00:00", "home", *HOME))
    return entry


async def test_admin_can_read_and_delete(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    await _prepare_history(hass, hass_admin_user.id)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "whereabouts/info"})
    info = (await ws.receive_json())["result"]
    assert {p["entity_id"]: p["can_view"] for p in info["persons"]} == {"person.sam": True, "person.alex": True}
    await ws.send_json({"id": 2, "type": "whereabouts/history", "person": "person.sam", "date": "2026-06-24"})
    result = (await ws.receive_json())["result"]
    assert result["stays"][0]["times"] == ["08:00:00"]
    await ws.send_json({"id": 3, "type": "whereabouts/days", "person": "person.sam", "month": "2026-06"})
    assert (await ws.receive_json())["result"]["days"] == ["2026-06-24"]
    await ws.send_json(
        {"id": 4, "type": "whereabouts/delete", "person": "person.sam", "date": "2026-06-24", "times": ["08:00:00"]}
    )
    assert (await ws.receive_json())["result"] == {"deleted": 1}


async def test_new_installation_lets_everybody_see_everything(hass: HomeAssistant, hass_admin_user):
    entry = await _prepare_history(hass, hass_admin_user.id)
    assert entry.runtime_data.settings.data["rights_default"] == {"live": "all", "history": "all", "delete": "all"}


async def test_user_sees_only_own_person(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _prepare_history(hass, hass_admin_user.id)  # alex is linked to this user
    await entry.runtime_data.settings.async_set_rights_default({"history": "own", "delete": "own"})
    hass_admin_user.groups = []  # ... who is now a normal user
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "whereabouts/info"})
    info = (await ws.receive_json())["result"]
    assert [p["entity_id"] for p in info["persons"]] == ["person.alex"]  # nothing about the others
    await ws.send_json({"id": 2, "type": "whereabouts/history", "person": "person.sam", "date": "2026-06-24"})
    assert (await ws.receive_json())["error"]["code"] == "forbidden"
    await ws.send_json({"id": 3, "type": "whereabouts/history", "person": "person.alex", "date": "2026-06-24"})
    assert (await ws.receive_json())["success"]
    await ws.send_json(
        {"id": 4, "type": "whereabouts/delete", "person": "person.sam", "date": "2026-06-24", "times": ["08:00:00"]}
    )
    assert (await ws.receive_json())["error"]["code"] == "forbidden"


async def test_admins_only(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _prepare_history(hass, hass_admin_user.id)
    hass.config_entries.async_update_entry(entry, options={**entry.options, "history_access": "admins"})
    await hass.async_block_till_done()
    hass_admin_user.groups = []
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "whereabouts/history", "person": "person.alex", "date": "2026-06-24"})
    assert (await ws.receive_json())["error"]["code"] == "forbidden"


async def test_invalid_input_is_rejected(hass: HomeAssistant, hass_ws_client):
    await setup_integration(hass)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "whereabouts/history", "person": "person.x", "date": "../../etc"})
    assert not (await ws.receive_json())["success"]


async def test_export_csv_and_gpx(hass: HomeAssistant, hass_client, hass_admin_user):
    await _prepare_history(hass, hass_admin_user.id)
    client = await hass_client()
    response = await client.get("/api/whereabouts/export?person=person.alex&from=2026-06-24&format=csv")
    assert response.status == 200
    assert "alex,2026-06-24,08:00:00" in await response.text()
    response = await client.get("/api/whereabouts/export?person=person.alex&from=2026-06-24&format=gpx")
    assert "<gpx" in await response.text()
    for query in (
        "person=person.alex&from=bad",
        "person=person.x/..&from=2026-06-24",
        "person=person.alex&from=2000-01-01&to=2026-06-24",
        "person=sensor.x&from=2026-06-24",
    ):
        response = await client.get(f"/api/whereabouts/export?{query}")
        assert response.status == 400, query


async def test_export_needs_login(hass: HomeAssistant, hass_client_no_auth):
    await setup_integration(hass)
    client = await hass_client_no_auth()
    response = await client.get("/api/whereabouts/export?person=person.alex&from=2026-06-24")
    assert response.status == 401


# --- import -----------------------------------------------------------------
@contextmanager
def _uploaded(path: Path):
    yield path


async def test_import_through_options(hass: HomeAssistant, tmp_path):
    _person(hass, "alex", "home")
    entry = await setup_integration(hass)
    upload = tmp_path / "alex_2026-06-24.csv"
    upload.write_text("00:05:06;home;52.52;13.40\n10:00:00;not_home;48.0;8.0;Street 1, Town\n", encoding="utf-8")
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "import_file"})
    with patch(UPLOAD, return_value=_uploaded(upload)):
        result = await hass.config_entries.options.async_configure(
            result["flow_id"], {"file": FILE_ID, "replace": False}
        )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "import_done"
    assert result["description_placeholders"]["added"] == "2"
    assert "person.alex" in entry.runtime_data.known_persons()


async def test_import_gpx_needs_person(hass: HomeAssistant, tmp_path):
    entry = await setup_integration(hass)
    upload = tmp_path / "track.gpx"
    upload.write_text(
        '<gpx><trk><trkseg><trkpt lat="48" lon="8"><time>2026-06-24T06:00:00Z</time></trkpt></trkseg></trk></gpx>'
    )
    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"next_step_id": "import_file"})
    with patch(UPLOAD, return_value=_uploaded(upload)):
        result = await hass.config_entries.options.async_configure(
            result["flow_id"], {"file": FILE_ID, "replace": False}
        )
    assert result["errors"] == {"base": "person_required"}


async def test_unload(hass: HomeAssistant):
    entry = await setup_integration(hass, record_persons=["person.alex"])
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert DOMAIN not in hass.data
    await asyncio.sleep(0)


async def test_subscription_follows_options(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _prepare_history(hass, hass_admin_user.id)
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "whereabouts/subscribe"})
    assert (await ws.receive_json())["success"]
    first = (await ws.receive_json())["event"]
    assert first["shown"] == ["person.alex", "person.sam"]
    assert [p["entity_id"] for p in first["persons"]] == ["person.alex", "person.sam"]
    # Only Sam in Whereabouts: open cards get it without reloading
    hass.config_entries.async_update_entry(entry, options={**entry.options, "persons": ["person.sam"]})
    await hass.async_block_till_done()
    for _ in range(5):
        event = (await ws.receive_json())["event"]
        if event.get("available") and event["shown"] == ["person.sam"]:
            break
    assert event["shown"] == ["person.sam"]
    assert [p["entity_id"] for p in event["persons"]] == ["person.sam"]
    # History of Alex is kept, only hidden
    days = await hass.async_add_executor_job(entry.runtime_data.storage.days, "alex")
    assert days == ["2026-06-24"]


async def test_old_person_lists_become_the_persons(hass: HomeAssistant):
    entry = await setup_integration(hass, record_persons=["person.alex"])
    old = {key: value for key, value in entry.options.items() if key != "persons"}
    hass.config_entries.async_update_entry(
        entry, options={**old, "show_persons_live": ["person.sam"], "show_persons_history": ["person.alex"]}
    )
    from custom_components.whereabouts import merged_options

    options = merged_options(entry)
    assert options["persons"] == ["person.alex", "person.sam"]
    assert "show_persons_live" not in options and options["history_card"] is True
