"""Settings page: personal settings, defaults, locks, rights, options, import, sidebar."""

from __future__ import annotations

import pytest
from aiohttp import FormData
from homeassistant.components.frontend import DATA_PANELS
from homeassistant.core import HomeAssistant

from custom_components.whereabouts.const import PANEL_URL
from custom_components.whereabouts.storage import Point

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
    assert await hass.config_entries.async_unload(entry.entry_id)
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
        ws2, 3, type="whereabouts/settings/save", scope="own", category="zones", values={"show_zones": False}
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
