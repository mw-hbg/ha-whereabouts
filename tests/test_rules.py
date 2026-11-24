"""Recording rules, zone recalculation and zone changes (pure Python)."""

from __future__ import annotations

from datetime import UTC

import pytest

from custom_components.whereabouts.importer import read_import
from custom_components.whereabouts.maintenance import rules_on_days, zone_diff, zones_on_days
from custom_components.whereabouts.rules import GONE, apply_rules, recalculate_zones, zone_for_point
from custom_components.whereabouts.storage import HistoryStorage, Point

D = "2026-06-24"
ZONES = [("home", 48.0, 8.0, 100.0), ("Work", 48.1, 8.1, 150.0), ("Desk", 48.1, 8.1, 20.0)]


@pytest.fixture
def store(tmp_path):
    return HistoryStorage(str(tmp_path / "history"))


def test_rules_merge_same_place_and_thin_out_moving():
    points = [
        Point(D, "08:00:00", "home", 48.0, 8.0),
        Point(D, "08:30:00", "home", 48.0001, 8.0),  # same zone -> merged
        Point(D, "09:00:00", "not_home", 48.5, 8.5),
        Point(D, "09:00:20", "not_home", 48.51, 8.5),  # moved, only 20 s later -> dropped
        Point(D, "09:01:10", "not_home", 48.52, 8.5),  # 70 s after the last kept -> kept
        Point(D, "09:01:30", "not_home", 48.52, 8.5001),  # same place -> merged
        Point(D, "09:01:40", "Work", 48.1, 8.1),  # change of zone always kept
    ]
    result, stats = apply_rules(points, 50, 60)
    assert [(p.time, p.end, p.state) for p in result] == [
        ("08:00:00", "08:30:00", "home"),
        ("09:00:00", "", "not_home"),
        ("09:01:10", "09:01:30", "not_home"),
        ("09:01:40", "", "Work"),
    ]
    assert stats[D].as_dict() == {"points": 7, "stays": 4, "merged": 2, "dropped": 1}
    assert points[0].end == ""  # input untouched


def test_rules_never_merge_across_midnight():
    points = [Point(D, "23:59:59", "home", 48.0, 8.0), Point("2026-06-25", "00:00:00", "home", 48.0, 8.0)]
    result, stats = apply_rules(points, 50, 60)
    assert len(result) == 2 and set(stats) == {D, "2026-06-25"}


def test_csv_import_assigns_zones_to_away_and_empty_states():
    text = (
        "person,date,start,end,state,latitude,longitude,address\n"
        f"alex,{D},08:00:00,,not_home,48.1,8.1,Street 1\n"
        f"alex,{D},09:00:00,,,48.5,8.5,\n"
        f"alex,{D},10:00:00,,Gym,48.5,8.5,\n"
    )
    zone = lambda lat, lon: "Work" if lat < 48.2 else "not_home"  # noqa: E731
    parsed = read_import("x.csv", text.encode(), timezone=UTC, zone_for=zone)
    assert [p.state for p in parsed["alex"]] == ["Work", "not_home", "Gym"]


def test_zone_for_point_rules():
    def at(state, lat, lon):
        return zone_for_point(Point(D, "08:00:00", state, lat, lon), ZONES, {"Office": "Work"})

    assert at("not_home", 48.1, 8.1) == "Desk"  # smallest zone wins
    assert at("not_home", 48.0, 8.0) == "home"
    assert at("home", 48.0015, 8.0) == "home"  # ~170 m: just outside, kept (GPS accuracy)
    assert at("home", 48.01, 8.0) == "not_home"  # ~1 km
    assert at("Gone", 48.5, 8.5) == "not_home"  # deleted zone
    assert at("Office", 48.1012, 8.1) == "Work"  # renamed, just outside
    assert zone_for_point(Point(D, "08:00:00", "Office", None, None), ZONES, {"Office": "Work"}) == "Work"


def test_recalculate_only_selected_zones():
    def points():
        return [
            Point(D, "08:00:00", "Gone", 48.5, 8.5),
            Point(D, "09:00:00", "not_home", 48.0, 8.0, "Street 1"),
        ]

    _, stats = recalculate_zones(points(), ZONES, {}, {"Work"})
    assert stats.changed == 0
    changed, stats = recalculate_zones(points(), ZONES, {}, {GONE})
    assert [p.state for p in changed] == ["not_home", "not_home"] and stats.need_address == 1
    changed, stats = recalculate_zones(points(), ZONES, {}, None)
    assert [(p.state, p.address) for p in changed] == [("not_home", ""), ("home", "")]
    assert dict(stats.transitions) == {("Gone", "not_home"): 1, ("not_home", "home"): 1}


def test_zone_diff():
    old = {"zone.home": ["home", 48.0, 8.0, 100.0], "zone.a": ["A", 1, 1, 50.0], "zone.b": ["B", 2, 2, 50.0]}
    old["zone.c"] = ["C", 3, 3, 50.0]
    new = {
        "zone.home": ["home", 48.0, 8.0, 100.0],
        "zone.a": ["A2", 1, 1, 50.0],  # renamed in the UI
        "zone.b_new": ["B new", 2, 2, 50.0],  # YAML zone renamed: new ID, same place
        "zone.d": ["D", 4, 4, 50.0],
    }
    new["zone.home"] = ["home", 48.0, 8.0, 150.0]  # radius changed
    changes, renames = zone_diff(old, new)
    assert renames == {"A": "A2", "B": "B new"}
    assert sorted((c["kind"], c["name"]) for c in changes) == [
        ("added", "D"),
        ("changed", "home"),
        ("removed", "C"),
        ("renamed", "A2"),
        ("renamed", "B new"),
    ]


def test_rules_and_zones_on_stored_days(store):
    rows = [
        Point(D, "08:00:00", "not_home", 48.5, 8.5),
        Point(D, "08:00:30", "not_home", 48.6, 8.5),
        Point(D, "12:00:00", "Old", 48.1, 8.1),
    ]
    store.import_points("alex", rows, merge=False)
    files = store.files_in(["alex"])
    preview = rules_on_days(store, files, 50, 60, write=False)
    assert preview["dropped"] == 1 and preview["days_changed"] == 1
    assert len(store.read_points("alex", D)) == 3  # preview writes nothing
    rules_on_days(store, files, 50, 60, write=True)
    assert [p.time for p in store.read_points("alex", D)] == ["08:00:00", "12:00:00"]

    result = zones_on_days(store, files, ZONES, {"Old": "Work"}, None, write=True)
    assert result["changed"] == 1
    assert [p.state for p in store.read_points("alex", D)] == ["not_home", "Desk"]


def test_set_addresses_only_fills_empty_away_rows(store):
    store.import_points(
        "alex",
        [Point(D, "08:00:00", "not_home", 48.5, 8.5), Point(D, "09:00:00", "not_home", 48.6, 8.6, "Kept")],
        merge=False,
    )
    assert store.set_addresses("alex", D, {"08:00:00": "New 1", "09:00:00": "Other"}) == 1
    assert [p.address for p in store.read_points("alex", D)] == ["New 1", "Kept"]


def test_rules_entry_with_position_is_not_swallowed_by_stay_without_position():
    """0.7.2: pyscript archive rows have no coordinates; a later entry with them must stay visible."""
    points = [
        Point(D, "00:00:00", "home", None, None, end="07:32:12"),
        Point(D, "07:40:00", "home", 48.0, 8.0, end="12:00:00"),
    ]
    result, _ = apply_rules(points, 50, 60)
    assert len(result) == 1
    assert (result[0].latitude, result[0].longitude) == (48.0, 8.0)
    assert (result[0].time, result[0].end) == ("00:00:00", "12:00:00")


def test_rules_on_stored_day_keeps_stay_visible(store):
    store._ensure_folder()  # add_point would already extend the first row; write the archive state directly
    store._write_points(
        store.path("alex", D),
        [
            Point(D, "00:00:00", "home", None, None, end="07:32:12"),
            Point(D, "07:40:00", "home", 48.0, 8.0, end="12:00:00"),
        ],
    )
    rules_on_days(store, [("alex", D)], 50, 60, write=True)
    [stay] = store.read_day("alex", D)
    assert (stay.start, stay.end, stay.state) == ("00:00:00", "12:00:00", "home")


def test_day_edges_ignore_rows_without_position(store):
    day1, day2 = "2026-11-01", "2026-11-02"
    store.add_point("alex", Point(day1, "20:00:00", "home", 48.0, 8.0, end="23:00:00"))
    store.add_point("alex", Point(day2, "00:00:00", "home", None, None, end="01:00:00"))
    store.add_point("alex", Point(day2, "07:00:00", "not_home", 48.5, 8.5, "Street", end="09:00:00"))
    plan = store.fill_edges("alex", [day2], write=False)
    assert plan["starts"] == 1
    store.fill_edges("alex", [day2])
    assert [(s.start, s.end, s.state) for s in store.read_day("alex", day2)][0] == ("00:00:00", "07:00:00", "home")


def test_import_gap_ignores_stored_rows_without_position(store):
    store.add_point("alex", Point(D, "00:00:00", "home", None, None, end="12:00:00"))
    result = store.import_points("alex", [Point(D, "08:00:00", "home", 48.0, 8.0, end="10:00:00")])
    assert result  # something was stored
    [stay] = store.read_day("alex", D)
    assert (stay.start, stay.end) == ("08:00:00", "10:00:00")
