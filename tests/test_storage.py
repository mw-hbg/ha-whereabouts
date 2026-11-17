"""Storage and importer (pure Python)."""

from __future__ import annotations

import io
import os
import zipfile
from datetime import UTC

import pytest

from custom_components.whereabouts.importer import ImportError_, read_import
from custom_components.whereabouts.storage import HistoryStorage, Point, build_stays, export_csv

D = "2026-06-24"


@pytest.fixture
def store(tmp_path) -> HistoryStorage:
    return HistoryStorage(str(tmp_path / "history"), same_place_distance=50)


def test_same_zone_extends_stay(store):
    assert store.add_point("alex", Point(D, "08:00:00", "home", 48.1, 8.1)) == "new"
    # Different position inside the zone: still the same stay
    assert store.add_point("alex", Point(D, "09:30:00", "home", 48.1005, 8.1005)) == "extended"
    stays = store.read_day("alex", D)
    assert len(stays) == 1
    assert (stays[0].start, stays[0].end) == ("08:00:00", "09:30:00")


def test_away_new_stay_only_when_moved(store):
    store.add_point("alex", Point(D, "10:00:00", "not_home", 48.0, 8.0, "Street 1, Town"))
    store.add_point("alex", Point(D, "10:05:00", "not_home", 48.0001, 8.0001))  # ~13 m
    store.add_point("alex", Point(D, "10:20:00", "not_home", 48.01, 8.0))  # ~1.1 km
    stays = store.read_day("alex", D)
    assert [s.start for s in stays] == ["10:00:00", "10:20:00"]
    assert stays[0].address == "Street 1, Town"
    assert stays[0].end == "10:05:00"


def test_address_only_away_and_needs_address(store):
    store.add_point("alex", Point(D, "08:00:00", "home", 48.1, 8.1, "ignored"))
    assert store.read_day("alex", D)[0].address == ""
    assert not store.needs_address("alex", D, "home", 48.1, 8.1)
    assert store.needs_address("alex", D, "not_home", 48.0, 8.0)
    store.add_point("alex", Point(D, "10:00:00", "not_home", 48.0, 8.0, "A"))
    assert not store.needs_address("alex", D, "not_home", 48.0, 8.0)


def test_separator_and_newlines_cannot_break_rows(store):
    store.add_point("alex", Point(D, "10:00:00", "not_home", 48.0, 8.0, "Evil; street\nnext"))
    with open(store.path("alex", D), encoding="utf-8") as file:
        assert file.read().count("\n") == 1
    assert store.read_day("alex", D)[0].address == "Evil, street next"


def test_legacy_rows_are_merged_when_reading():
    rows = [
        ["00:05:06", "home", "52.5285265", "13.4066225"],
        ["00:37:07", "home", "52.5285536", "13.4066153"],
        ["07:10:00", "not_home", "48.6", "8.9", "Somewhere 3, Town"],
        ["06:00:00", "home", "52.5285", "13.4066", "", "07:00:00"],  # out of order
    ]
    stays = build_stays(rows, 50)
    assert [(s.start, s.end, s.state) for s in stays] == [
        ("00:05:06", "07:00:00", "home"),
        ("07:10:00", "07:10:00", "not_home"),
    ]
    assert stays[0].times == ["00:05:06", "00:37:07", "06:00:00"]


def test_delete_and_file_removed_when_empty(store):
    store.add_point("alex", Point(D, "08:00:00", "home", 48.1, 8.1))
    store.add_point("alex", Point(D, "10:00:00", "not_home", 48.0, 8.0))
    assert store.delete_times("alex", D, ["10:00:00", "not-a-time"]) == 1
    assert store.delete_times("alex", D, ["08:00:00"]) == 1
    assert not os.path.exists(store.path("alex", D))
    assert store.days("alex") == []


def test_invalid_keys_never_reach_the_file_system(store):
    for person, date in (("../etc", D), ("alex", "2026-06-24/../x"), ("Alex", D)):
        with pytest.raises(ValueError):
            store.path(person, date)


def test_files_are_private(store):
    store.add_point("alex", Point(D, "08:00:00", "home", 48.1, 8.1))
    assert os.stat(store.path("alex", D)).st_mode & 0o077 == 0


def test_retention(store):
    store.add_point("alex", Point("2026-01-01", "08:00:00", "home", 48.1, 8.1))
    store.add_point("alex", Point(D, "08:00:00", "home", 48.1, 8.1))
    assert store.delete_before("2026-06-01") == 1
    assert store.days("alex") == [D]


def test_import_skips_duplicates_or_replaces(store):
    store.add_point("alex", Point(D, "08:00:00", "home", 48.1, 8.1))
    points = [Point(D, "08:00:00", "home", 1.0, 1.0), Point(D, "12:00:00", "Work", 48.7, 9.0)]
    assert store.import_points("alex", points) == {"added": 1, "skipped": 1, "days": 1}
    assert [s.latitude for s in store.read_day("alex", D)] == [48.1, 48.7]
    store.import_points("alex", points, replace_days=True)
    assert [s.latitude for s in store.read_day("alex", D)] == [1.0, 48.7]


def test_export_import_round_trip(store, tmp_path):
    store.add_point("alex", Point(D, "08:00:00", "home", 48.1, 8.1))
    store.add_point("alex", Point(D, "10:00:00", "not_home", 48.0, 8.0, "Street 1, Town, with comma"))
    text = export_csv("alex", store.export_rows("alex", D, D))
    assert text.splitlines()[0] == "person,date,start,end,state,latitude,longitude,address"
    other = HistoryStorage(str(tmp_path / "other"))
    parsed = read_import(
        "export.csv", text.encode(), timezone=UTC, zone_for=lambda a, b: "not_home", same_place_distance=50
    )
    other.import_points("alex", parsed["alex"])
    assert [s.as_dict() for s in other.read_day("alex", D)] == [s.as_dict() for s in store.read_day("alex", D)]


def test_import_legacy_zip_with_macos_junk():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("standortverlauf_archiv/alex_2026-06-24.csv", "00:05:06;home;52.52;13.40\n")
        archive.writestr("standortverlauf_archiv/sam_2026-06-25.csv", "07:00:00;not_home;48.6;8.9;A 1, B;07:30:00\n")
        archive.writestr("__MACOSX/standortverlauf_archiv/._alex_2026-06-24.csv", b"\x00\x05junk")
        archive.writestr("standortverlauf_archiv/.osm_cache.json", "{}")
    parsed = read_import(
        "archiv.zip", buffer.getvalue(), timezone=UTC, zone_for=lambda a, b: "", same_place_distance=50
    )
    assert set(parsed) == {"alex", "sam"}
    assert parsed["sam"][0].end == "07:30:00"


def test_import_gpx_assigns_zones_and_merges():
    gpx = b"""<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>
<trkpt lat="52.5285" lon="13.4066"><time>2026-06-24T06:00:00Z</time></trkpt>
<trkpt lat="52.5286" lon="13.4067"><time>2026-06-24T06:10:00Z</time></trkpt>
<trkpt lat="48.65" lon="8.95"><time>2026-06-24T07:00:00Z</time></trkpt>
<trkpt lat="48.66" lon="8.96"><time>2026-06-24T07:05:00Z</time></trkpt>
<trkpt lat="1" lon="1"></trkpt>
</trkseg></trk></gpx>"""
    zone = lambda lat, lon: "home" if lat > 52.0 else "not_home"  # noqa: E731
    points = read_import("track.gpx", gpx, timezone=UTC, zone_for=zone, same_place_distance=50)[""]
    assert [(p.time, p.end, p.state) for p in points] == [
        ("06:00:00", "06:10:00", "home"),
        ("07:00:00", "", "not_home"),
        ("07:05:00", "", "not_home"),
    ]


def test_unknown_and_oversized_files():
    with pytest.raises(ImportError_) as err:
        read_import("x.csv", b"foo,bar\n1,2\n", timezone=UTC, zone_for=lambda a, b: "", same_place_distance=50)
    assert err.value.key == "unknown_format"
    with pytest.raises(ImportError_) as err:
        read_import(
            "x.gpx", b"<gpx" + b" " * (51 * 1024 * 1024), timezone=UTC, zone_for=lambda a, b: "", same_place_distance=50
        )
    assert err.value.key == "too_large"


def test_import_keeps_same_second_rows_of_one_file(store):
    points = [Point(D, "06:46:37", "home", 48.1, 8.1), Point(D, "06:46:37", "not_home", 48.2, 8.2)]
    assert store.import_points("alex", points)["added"] == 2
    assert store.import_points("alex", points)["skipped"] == 2
