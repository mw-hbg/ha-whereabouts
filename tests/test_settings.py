"""Settings page: personal settings, defaults, locks, rights, options, import, sidebar."""

from __future__ import annotations

import pytest
from aiohttp import FormData
from homeassistant.components.frontend import DATA_PANELS
from homeassistant.core import HomeAssistant

from custom_components.whereabouts.const import PANEL_URL
from custom_components.whereabouts.storage import HistoryStorage, Point

from .conftest import HOME, setup_integration

pytestmark = pytest.mark.usefixtures("zones")

OTHER = "0123456789abcdef0123456789abcdef"


def _person(hass: HomeAssistant, key: str, user_id: str | None = None) -> None:
    hass.states.async_set(
        f"person.{key}",
        "home",
        {"friendly_name": key.title(), "user_id": user_id, "latitude": HOME[0], "longitude": HOME[1]},
    )


async def _ws(client, msg_id: int, **message):
    await client.send_json({"id": msg_id, **message})
    return await client.receive_json()


async def _setup(hass, admin_id):
    _person(hass, "alex", admin_id)
    _person(hass, "sam", OTHER)
    _person(hass, "kim")
    entry = await setup_integration(hass, record_persons=["person.alex", "person.sam"])
    storage = entry.runtime_data.storage
    for key in ("alex", "sam"):
        await hass.async_add_executor_job(storage.add_point, key, Point("2026-06-24", "08:00:00", "home", *HOME))
    return entry


async def test_sidebar_page_is_registered(hass: HomeAssistant):
    entry = await setup_integration(hass)
    panel = hass.data[DATA_PANELS][PANEL_URL]
    assert panel.sidebar_title in ("Whereabouts", "Standorte")
    assert panel.sidebar_icon == "mdi:map-marker-radius"
    assert panel.require_admin is False
    # Without the sidebar entry the page stays reachable (settings), only hidden
    hass.config_entries.async_update_entry(entry, options={**entry.options, "panel": False})
    await hass.async_block_till_done()
    panel = hass.data[DATA_PANELS][PANEL_URL]
    assert panel.sidebar_title is None
    # Other options do not register the page again (an open page would be rebuilt)
    hass.config_entries.async_update_entry(entry, options={**entry.options, "min_interval": 120})
    await hass.async_block_till_done()
    assert hass.data[DATA_PANELS][PANEL_URL] is panel
    # Unloading keeps it, removing the integration removes it
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert PANEL_URL in hass.data[DATA_PANELS]
    await hass.config_entries.async_remove(entry.entry_id)
    assert PANEL_URL not in hass.data[DATA_PANELS]


async def test_personal_settings_and_defaults(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    await _setup(hass, hass_admin_user.id)
    ws = await hass_ws_client(hass)
    data = (await _ws(ws, 1, type="whereabouts/settings"))["result"]
    assert data["is_admin"] and data["effective"]["map"]["tiles"] == "esri"
    assert {u["name"] for u in data["admin"]["users"]} >= {hass_admin_user.name}
    # Own value
    result = await _ws(ws, 2, type="whereabouts/settings/save", scope="own", category="map", values={"tiles": "osm"})
    assert result["success"]
    # Invalid values and unknown keys are refused
    result = await _ws(ws, 3, type="whereabouts/settings/save", scope="own", category="map", values={"tiles": "x"})
    assert result["error"]["code"] == "invalid"
    result = await _ws(ws, 4, type="whereabouts/settings/save", scope="own", category="map", values={"evil": 1})
    assert result["error"]["code"] == "invalid"
    # Defaults for everybody
    result = await _ws(
        ws, 5, type="whereabouts/settings/save", scope="defaults", category="zones", values={"zone_color": "#123456"}
    )
    assert result["success"]
    info = (await _ws(ws, 6, type="whereabouts/info"))["result"]
    assert info["settings"]["tiles"] == "osm"
    assert info["settings"]["zone_color"] == "#123456"
    # Back to the defaults
    assert (await _ws(ws, 7, type="whereabouts/settings/reset", scope="own", category="map"))["success"]
    info = (await _ws(ws, 8, type="whereabouts/info"))["result"]
    assert info["settings"]["tiles"] == "esri"


async def test_settings_are_kept_after_reload(hass: HomeAssistant, hass_ws_client, hass_admin_user, hass_storage):
    entry = await _setup(hass, hass_admin_user.id)
    ws = await hass_ws_client(hass)
    await _ws(ws, 1, type="whereabouts/settings/save", scope="own", category="map", values={"map_link": "osm"})
    assert hass_storage["whereabouts.settings"]["data"]["users"][hass_admin_user.id]["map"]["map_link"] == "osm"
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    data = (await _ws(ws, 2, type="whereabouts/settings"))["result"]
    assert data["effective"]["map"]["map_link"] == "osm"


async def test_normal_user_locks_and_admin_only_commands(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    await _setup(hass, hass_admin_user.id)
    ws = await hass_ws_client(hass)
    # Lock "map" for all non-admins, except nobody
    assert (await _ws(ws, 1, type="whereabouts/settings/lock", category="map", mode="all"))["success"]
    await _ws(ws, 2, type="whereabouts/settings/save", scope="defaults", category="map", values={"tiles": "osm"})
    hass_admin_user.groups = []  # now a normal user
    ws2 = await hass_ws_client(hass)
    data = (await _ws(ws2, 1, type="whereabouts/settings"))["result"]
    assert not data["is_admin"] and "admin" not in data
    assert data["locked"] == ["map"]
    assert data["effective"]["map"]["tiles"] == "osm"
    result = await _ws(ws2, 2, type="whereabouts/settings/save", scope="own", category="map", values={"tiles": "esri"})
    assert result["error"]["code"] == "locked"
    # Other categories stay open
    result = await _ws(
        ws2, 3, type="whereabouts/settings/save", scope="own", category="zones", values={"zones_in": "none"}
    )
    assert result["success"]
    # Administration is refused
    for message in (
        {"type": "whereabouts/settings/save", "scope": "defaults", "category": "zones", "values": {}},
        {"type": "whereabouts/settings/lock", "category": "map", "mode": "none"},
        {"type": "whereabouts/settings/options", "values": {"retention_days": 1}},
        {"type": "whereabouts/settings/rights", "user_id": OTHER, "rights": None},
        {"type": "whereabouts/settings/diagnostics"},
    ):
        result = await _ws(ws2, 10 + len(str(message)), **message)
        assert not result["success"], message


async def test_lock_with_exceptions_and_selected_users(hass: HomeAssistant, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    settings = entry.runtime_data.settings

    class User:
        def __init__(self, user_id):
            self.id = user_id
            self.is_admin = False

    await settings.async_set_lock("map", "all", [OTHER], [])
    assert not settings.is_locked("map", User(OTHER))
    assert settings.is_locked("map", User("f" * 32))
    await settings.async_set_lock("map", "selected", [], [OTHER])
    assert settings.is_locked("map", User(OTHER))
    assert not settings.is_locked("map", User("f" * 32))
    assert not settings.is_locked("map", hass_admin_user)


async def test_rights_per_user(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    await _setup(hass, hass_admin_user.id)  # alex belongs to this user
    ws = await hass_ws_client(hass)
    # This user may see Sam's history and delete nothing
    result = await _ws(
        ws,
        1,
        type="whereabouts/settings/rights",
        user_id=hass_admin_user.id,
        rights={"live": ["person.alex"], "history": ["person.sam"], "delete": []},
    )
    assert result["success"]
    hass_admin_user.groups = []
    ws2 = await hass_ws_client(hass)
    info = (await _ws(ws2, 1, type="whereabouts/info"))["result"]
    assert info["shown"] == ["person.alex"]
    assert [(p["entity_id"], p["can_delete"]) for p in info["persons"]] == [("person.sam", False)]
    assert (await _ws(ws2, 2, type="whereabouts/history", person="person.sam", date="2026-06-24"))["success"]
    result = await _ws(ws2, 3, type="whereabouts/history", person="person.alex", date="2026-06-24")
    assert result["error"]["code"] == "forbidden"
    result = await _ws(ws2, 4, type="whereabouts/delete", person="person.sam", date="2026-06-24", times=["08:00:00"])
    assert result["error"]["code"] == "forbidden"


async def test_rules_for_everybody(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    ws = await hass_ws_client(hass)
    levels = {"live": "own", "history": "all", "delete": "none"}
    assert (await _ws(ws, 1, type="whereabouts/settings/rights_default", levels=levels))["success"]
    hass_admin_user.groups = []
    settings = entry.runtime_data.settings
    assert settings.allowed(hass_admin_user, "live") == ["person.alex"]
    assert settings.allowed(hass_admin_user, "history") == ["person.alex", "person.kim", "person.sam"]
    assert settings.allowed(hass_admin_user, "delete") == []


async def test_options_from_the_settings_page(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    ws = await hass_ws_client(hass)
    result = await _ws(ws, 1, type="whereabouts/settings/options", values={"min_interval": 120, "panel_title": "Wo"})
    assert result["success"]
    await hass.async_block_till_done()
    assert entry.options["min_interval"] == 120
    assert hass.data[DATA_PANELS][PANEL_URL].sidebar_title == "Wo"
    result = await _ws(ws, 2, type="whereabouts/settings/options", values={"min_interval": 1})
    assert result["error"]["code"] == "invalid"
    result = await _ws(ws, 3, type="whereabouts/settings/options", values={"carto_api_key": 'a"b'})
    assert result["error"]["code"] == "invalid"


async def test_diagnostics(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    await _setup(hass, hass_admin_user.id)
    ws = await hass_ws_client(hass)
    result = (await _ws(ws, 1, type="whereabouts/settings/diagnostics"))["result"]
    alex = next(p for p in result["persons"] if p["entity_id"] == "person.alex")
    assert alex["recorded"] and alex["history"]["days"] == 1
    assert alex["address_sensor_ok"] is False


async def test_import_preview_and_import(hass: HomeAssistant, hass_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    client = await hass_client()
    csv = b"00:05:06;home;52.52;13.40\n10:00:00;not_home;48.0;8.0;Street 1, Town\n"

    def form(preview: bool) -> FormData:
        data = FormData()
        data.add_field("file", csv, filename="kim_2026-06-20.csv")
        data.add_field("preview", "true" if preview else "false")
        return data

    response = await client.post("/api/whereabouts/import", data=form(True))
    assert response.status == 200
    preview = await response.json()
    assert preview["total"] == 2 and preview["persons"] == ["kim"] and preview["first"] == "2026-06-20"
    days = await hass.async_add_executor_job(entry.runtime_data.storage.days, "kim")
    assert days == []  # preview stores nothing
    response = await client.post("/api/whereabouts/import", data=form(False))
    assert response.status == 200
    assert (await response.json())["added"] == 2
    assert await hass.async_add_executor_job(entry.runtime_data.storage.days, "kim") == ["2026-06-20"]


async def test_import_only_for_admins(hass: HomeAssistant, hass_client, hass_admin_user):
    await _setup(hass, hass_admin_user.id)
    hass_admin_user.groups = []
    client = await hass_client()
    data = FormData()
    data.add_field("file", b"x", filename="a.csv")
    response = await client.post("/api/whereabouts/import", data=data)
    assert response.status == 403


async def test_history_over_a_period(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    storage = entry.runtime_data.storage
    await hass.async_add_executor_job(storage.add_point, "alex", Point("2026-06-25", "09:00:00", "home", *HOME))
    ws = await hass_ws_client(hass)
    result = await _ws(ws, 1, type="whereabouts/history", person="person.alex", date="2026-06-24", date_to="2026-06-25")
    assert [s["date"] for s in result["result"]["stays"]] == ["2026-06-24", "2026-06-25"]
    result = await _ws(ws, 2, type="whereabouts/history", person="person.alex", date="2026-01-01", date_to="2026-06-25")
    assert result["error"]["code"] == "invalid_range"  # more than 93 days per request


async def test_export_several_persons_and_days(hass: HomeAssistant, hass_client, hass_admin_user):
    import io
    import zipfile

    entry = await _setup(hass, hass_admin_user.id)
    storage = entry.runtime_data.storage
    await hass.async_add_executor_job(storage.add_point, "alex", Point("2026-06-25", "09:00:00", "home", *HOME))
    client = await hass_client()
    base = "/api/whereabouts/export?persons=person.alex,person.sam&from=2026-06-24&to=2026-06-25&format=csv"
    # one file with both persons
    response = await client.get(base)
    text = await response.text()
    assert response.status == 200 and text.count("\n") == 4  # header + 3 stays
    assert "alex,2026-06-25" in text and "sam,2026-06-24" in text
    # every person and day on its own -> ZIP
    response = await client.get(base + "&split_day=1&split_person=1")
    assert response.headers["Content-Type"] == "application/zip"
    names = sorted(zipfile.ZipFile(io.BytesIO(await response.read())).namelist())
    assert names == ["alex_2026-06-24.csv", "alex_2026-06-25.csv", "sam_2026-06-24.csv"]
    response = await client.get(base.replace("csv", "gpx") + "&split_person=1")
    names = sorted(zipfile.ZipFile(io.BytesIO(await response.read())).namelist())
    assert names == ["alex_2026-06-24_2026-06-25.gpx", "sam_2026-06-24_2026-06-25.gpx"]


async def test_persons_in_whereabouts_limit_everything(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    ws = await hass_ws_client(hass)
    assert (await _ws(ws, 1, type="whereabouts/settings/options", values={"persons": ["person.alex"]}))["success"]
    await hass.async_block_till_done()
    assert entry.options["record_persons"] == ["person.alex"]  # Sam no longer recorded ...
    days = await hass.async_add_executor_job(entry.runtime_data.storage.days, "sam")
    assert days == ["2026-06-24"]  # ... but the history is kept
    data = (await _ws(ws, 2, type="whereabouts/settings"))["result"]
    assert [p["entity_id"] for p in data["persons"]] == ["person.alex"]
    assert len(data["admin"]["all_persons"]) == 3
    result = await _ws(ws, 3, type="whereabouts/history", person="person.sam", date="2026-06-24")
    assert result["error"]["code"] == "forbidden"


async def test_promote_and_sync(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    settings = entry.runtime_data.settings
    ws = await hass_ws_client(hass)
    await _ws(ws, 1, type="whereabouts/settings/save", scope="own", category="map", values={"tiles": "osm"})
    assert (await _ws(ws, 2, type="whereabouts/settings/promote", category="map"))["success"]
    assert settings.defaults()["map"]["tiles"] == "osm"

    class Other:
        id = OTHER
        is_admin = False

    await settings.async_set("own", OTHER, "zones", {"zones_in": "none"})
    assert (await _ws(ws, 3, type="whereabouts/settings/flags", user_id="all", sync=True))["success"]
    await _ws(ws, 4, type="whereabouts/settings/save", scope="own", category="map", values={"map_link": "waze"})
    assert settings.synced(Other()) and settings.settings_hidden(Other())
    assert settings.effective(Other())["map"]["map_link"] == "waze"  # follows the admin live
    assert settings.effective(Other())["zones"]["zones_in"] == "both"
    assert settings.locked_categories(Other()) == list(settings.defaults())
    # Switching off: the administrator's settings stay for everybody, own values are gone
    await _ws(ws, 5, type="whereabouts/settings/flags", user_id="all", sync=False)
    assert not settings.synced(Other())
    assert settings.effective(Other())["map"]["map_link"] == "waze"
    assert settings.effective(Other())["zones"]["zones_in"] == "both"
    assert settings.own(OTHER) == {}


async def test_sync_and_fixed_settings_per_user(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    settings = entry.runtime_data.settings
    ws = await hass_ws_client(hass)

    class Other:
        id = OTHER
        is_admin = False

    await _ws(ws, 1, type="whereabouts/settings/save", scope="own", category="map", values={"tiles": "carto"})
    assert (await _ws(ws, 2, type="whereabouts/settings/flags", user_id=OTHER, sync=True))["success"]
    assert settings.effective(Other())["map"]["tiles"] == "carto"
    # Off for one user: my settings become theirs
    await _ws(ws, 3, type="whereabouts/settings/flags", user_id=OTHER, sync=False)
    assert settings.own(OTHER)["map"]["tiles"] == "carto"
    # Hide the settings tab only
    await _ws(ws, 4, type="whereabouts/settings/flags", user_id=OTHER, hide_settings=True)
    assert settings.settings_hidden(Other()) and not settings.synced(Other())
    # An administrator edits the user's values and fixes one of them
    result = await _ws(
        ws, 5, type="whereabouts/settings/save", scope="own", user_id=OTHER, category="map", values={"map_link": "osm"}
    )
    assert result["success"]
    await _ws(ws, 6, type="whereabouts/settings/field_lock", user_id=OTHER, category="map", keys=["map_link"])
    assert settings.locked_keys(Other(), "map") == ["map_link"]
    real = await hass.auth.async_create_user("Robin")
    await settings.async_set("own", real.id, "map", {"map_link": "osm"})
    await settings.async_set_field_lock(real.id, "map", ["map_link"])
    user = (await _ws(ws, 7, type="whereabouts/settings/user", user_id=real.id))["result"]
    assert user["effective"]["map"]["map_link"] == "osm" and user["field_locks"] == {"map": ["map_link"]}
    # The whole category fixed for this user: their (admin-set) values still apply
    await _ws(ws, 8, type="whereabouts/settings/field_lock", user_id=OTHER, category="map", keys=["*"])
    assert settings.is_locked("map", Other())
    assert settings.effective(Other())["map"]["map_link"] == "osm"


async def test_options_reset(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    hass.config_entries.async_update_entry(entry, options={**entry.options, "panel_title": "Orte", "min_interval": 120})
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    result = await _ws(ws, 1, type="whereabouts/settings/options_reset", keys=["panel_title", "panel", "panel_icon"])
    assert result["success"]
    await hass.async_block_till_done()
    entry = hass.config_entries.async_entries("whereabouts")[0]
    assert entry.options["panel_title"] == "" and entry.options["min_interval"] == 120


def test_import_merges_into_gaps(tmp_path):
    storage = HistoryStorage(str(tmp_path))
    storage.import_points("alex", [Point("2026-06-24", "08:00:00", "home", *HOME, end="12:00:00")])
    points = [
        Point("2026-06-24", "08:00:05", "home", *HOME, end="11:59:00"),  # inside the stored stay
        Point("2026-06-24", "13:00:00", "not_home", 48.1, 9.1, "Main Street 1", end="13:30:00"),  # a gap
        Point("2026-06-25", "09:00:00", "home", *HOME),  # a new day
    ]
    plan = {day["date"]: day for day in storage.import_plan("alex", points)}
    assert plan["2026-06-24"]["status"] == "add" and plan["2026-06-24"]["new"] == 1
    assert plan["2026-06-25"]["status"] == "new"
    outcome = storage.import_points("alex", points, days=["2026-06-24"])
    assert outcome == {"added": 1, "skipped": 1, "days": 1}
    assert [s.start for s in storage.read_day("alex", "2026-06-24")] == ["08:00:00", "13:00:00"]
    assert storage.days("alex") == ["2026-06-24"]


def test_import_skips_existing_days(tmp_path):
    storage = HistoryStorage(str(tmp_path))
    storage.import_points("alex", [Point("2026-06-24", "08:00:00", "home", *HOME, end="12:00:00")])
    points = [
        Point("2026-06-24", "13:00:00", "not_home", 48.1, 9.1, "Main Street 1"),  # day with data
        Point("2026-06-25", "09:00:00", "home", *HOME),  # a new day
    ]
    plan = {day["date"]: day for day in storage.import_plan("alex", points, "skip")}
    assert plan["2026-06-24"]["status"] == "skip" and plan["2026-06-24"]["new"] == 0
    assert plan["2026-06-25"]["status"] == "new" and plan["2026-06-25"]["new"] == 1
    outcome = storage.import_points("alex", points, skip_existing=True)
    assert outcome == {"added": 1, "skipped": 1, "days": 1}
    assert [s.start for s in storage.read_day("alex", "2026-06-24")] == ["08:00:00"]
    assert storage.days("alex") == ["2026-06-24", "2026-06-25"]


async def test_users_are_marked_technical(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    await _setup(hass, hass_admin_user.id)
    await hass.auth.async_create_user("MQTT", group_ids=["system-users"])
    ws = await hass_ws_client(hass)
    users = (await _ws(ws, 1, type="whereabouts/settings"))["result"]["admin"]["users"]
    by_name = {u["name"]: u for u in users}
    assert by_name["MQTT"]["technical"] is True
    assert by_name[hass_admin_user.name]["technical"] is False  # linked to person.alex


async def test_value_equal_to_default_is_no_own_value(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    settings = entry.runtime_data.settings
    ws = await hass_ws_client(hass)
    await _ws(ws, 1, type="whereabouts/settings/save", scope="own", category="map", values={"tiles": "osm"})
    assert settings.own(hass_admin_user.id)["map"] == {"tiles": "osm"}
    # Back to the value that applies anyway: the own value is removed
    await _ws(ws, 2, type="whereabouts/settings/save", scope="own", category="map", values={"tiles": "esri"})
    assert settings.own(hass_admin_user.id) == {}
    # Defaults equal to the built-in value are no defaults either
    await _ws(ws, 3, type="whereabouts/settings/save", scope="defaults", category="map", values={"tiles": "esri"})
    assert "map" not in settings.data["defaults"]
    # Also for another user, edited by an administrator
    await _ws(
        ws,
        4,
        type="whereabouts/settings/save",
        scope="own",
        user_id=OTHER,
        category="zones",
        values={"zones_in": "both"},
    )
    assert settings.own(OTHER) == {}


async def test_factory_reset_and_restore(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    settings = entry.runtime_data.settings
    ws = await hass_ws_client(hass)
    await settings.async_set("defaults", "", "map", {"tiles": "carto"})
    await settings.async_set("own", hass_admin_user.id, "map", {"map_link": "osm"})
    await settings.async_set("own", OTHER, "map", {"map_link": "waze"})
    # Only for me: the built-in values, although the defaults differ
    result = await _ws(ws, 1, type="whereabouts/settings/reset", scope="own", category="map", factory=True)
    token = result["result"]["undo"]
    mine = settings.effective(hass_admin_user)["map"]
    assert mine["tiles"] == "esri" and mine["map_link"] == "google"
    assert settings.own(OTHER)["map"] == {"map_link": "waze"}
    assert (await _ws(ws, 2, type="whereabouts/settings/restore", token=token))["success"]
    assert settings.own(hass_admin_user.id)["map"] == {"map_link": "osm"}
    # A token works once
    assert not (await _ws(ws, 3, type="whereabouts/settings/restore", token=token))["success"]
    # For everybody: defaults and all own values gone, restorable
    result = await _ws(
        ws, 4, type="whereabouts/settings/reset", scope="own", category="map", factory=True, everyone=True
    )
    assert "map" not in settings.data["defaults"] and settings.own(OTHER) == {}
    await _ws(ws, 5, type="whereabouts/settings/restore", token=result["result"]["undo"])
    assert settings.defaults()["map"]["tiles"] == "carto" and settings.own(OTHER)["map"] == {"map_link": "waze"}


async def test_new_users_wait_for_a_decision(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    entry = await _setup(hass, hass_admin_user.id)
    settings = entry.runtime_data.settings
    ws = await hass_ws_client(hass)
    first = await hass.auth.async_create_user("Robin")
    _person(hass, "robin", first.id)
    # First start: users already there are known, nothing to decide
    data = (await _ws(ws, 1, type="whereabouts/settings"))["result"]
    assert data["admin"]["pending_users"] == [] and data["admin"]["has_other_users"]
    new = await hass.auth.async_create_user("Guest")
    _person(hass, "guest", new.id)
    await settings.async_set("own", hass_admin_user.id, "map", {"tiles": "osm"})
    data = (await _ws(ws, 2, type="whereabouts/settings"))["result"]
    assert data["admin"]["pending_users"] == [new.id]
    # Until decided: like the administrator
    assert settings.effective(new)["map"]["tiles"] == "osm"
    await _ws(ws, 3, type="whereabouts/settings/new_users", user_ids=[new.id], action="later")
    assert (await _ws(ws, 4, type="whereabouts/settings"))["result"]["admin"]["pending_users"] == [new.id]
    # Copied once: stays when the administrator changes again
    await _ws(ws, 5, type="whereabouts/settings/new_users", user_ids=[new.id], action="copy")
    await settings.async_set("own", hass_admin_user.id, "map", {"tiles": "carto"})
    assert settings.effective(new)["map"]["tiles"] == "osm" and not settings.synced(new)
    assert (await _ws(ws, 6, type="whereabouts/settings"))["result"]["admin"]["pending_users"] == []


async def test_image_fetch_refuses_local_addresses(hass: HomeAssistant, hass_client, hass_admin_user):
    await _setup(hass, hass_admin_user.id)
    client = await hass_client()
    for url in ("http://127.0.0.1/x.png", "http://192.168.0.1/x.png", "file:///etc/passwd", "ftp://example.com/a"):
        response = await client.get("/api/whereabouts/image", params={"url": url})
        assert response.status == 400, url


async def test_map_style_becomes_per_service(hass: HomeAssistant, hass_storage, hass_admin_user):
    hass_storage["whereabouts.settings"] = {
        "version": 1,
        "key": "whereabouts.settings",
        "data": {"defaults": {}, "users": {OTHER: {"map": {"map_style": "dark", "tiles": "osm"}}}},
    }
    entry = await _setup(hass, hass_admin_user.id)
    own = entry.runtime_data.settings.own(OTHER)["map"]
    assert "map_style" not in own
    assert own["map_dark_osm"] == "dark" and own["map_dark_esri"] == "dark" and own["map_dark_carto"] == "dark"
