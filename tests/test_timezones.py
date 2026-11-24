"""UTC offsets and time zones of places (0.7)."""

from __future__ import annotations

from zoneinfo import ZoneInfo

import pytest

from custom_components.whereabouts.api import export_gpx
from custom_components.whereabouts.importer import parse_whereabouts_csv
from custom_components.whereabouts.rules import apply_rules
from custom_components.whereabouts.storage import (
    HistoryStorage,
    Point,
    complete_points,
    export_csv,
    point_row,
)
from custom_components.whereabouts.timezones import (
    clean_offset,
    doubled_hour,
    foreign_zone,
    moment,
    parse_offset,
    resolve_offsets,
)

BERLIN = ZoneInfo("Europe/Berlin")
AUTUMN = "2026-10-25"  # clocks go back 03:00 -> 02:00
SPRING = "2026-03-29"  # clocks go forward 02:00 -> 03:00
NEW_YORK = (40.7128, -74.006)
HOME = (48.5966, 8.8697)


@pytest.fixture
def store(tmp_path):
    return HistoryStorage(str(tmp_path / "history"), same_place_distance=50, zone=BERLIN)


def test_offsets_parse_and_format():
    assert parse_offset("+01:00") == 3600
    assert parse_offset("-0530") == -(5 * 3600 + 30 * 60)
    assert parse_offset("Z") == 0
    assert parse_offset("+15:00") is None
    assert parse_offset("nonsense") is None
    assert clean_offset("+0545") == "+05:45"
    assert clean_offset("") == ""


def test_doubled_hour_only_in_autumn():
    assert doubled_hour(AUTUMN, BERLIN) == ("02:00:00", "03:00:00")
    assert doubled_hour(SPRING, BERLIN) is None
    assert doubled_hour("2026-07-01", BERLIN) is None


def test_order_decides_the_doubled_hour():
    offsets, assumed = resolve_offsets(
        AUTUMN, [("00:05:00", "02:20:00"), ("02:10:00", "02:50:00"), ("02:30:00", "08:00:00")], BERLIN
    )
    # the second stay starts before the first ended: the clocks have gone back
    assert offsets == [("+02:00", ""), ("+01:00", ""), ("+01:00", "")]
    assert assumed == 1  # the end 02:20 of the first stay


def test_stay_over_the_switch_gets_two_offsets():
    assert resolve_offsets(AUTUMN, [("00:05:00", "08:12:00")], BERLIN)[0] == [("+02:00", "+01:00")]
    assert resolve_offsets(SPRING, [("01:30:00", "04:00:00")], BERLIN)[0] == [("+01:00", "+02:00")]


def test_recording_over_the_switch(store):
    store.add_point("alex", Point(AUTUMN, "00:05:00", "home", *HOME, offset="+02:00"))
    store.add_point("alex", Point(AUTUMN, "02:40:00", "home", *HOME, offset="+02:00"))
    store.add_point("alex", Point(AUTUMN, "02:10:00", "home", *HOME, offset="+01:00"))  # later, after the switch
    store.add_point("alex", Point(AUTUMN, "08:12:00", "home", *HOME, offset="+01:00"))
    [stay] = store.read_day("alex", AUTUMN)
    assert (stay.start, stay.offset, stay.end, stay.end_offset) == ("00:05:00", "+02:00", "08:12:00", "+01:00")
    assert stay.as_dict()["end_offset"] == "+01:00"
    assert store.read_points("alex", AUTUMN)[0].end_offset == "+01:00"


def test_end_in_the_second_hour_is_kept(store):
    store.add_point("alex", Point(AUTUMN, "02:40:00", "home", *HOME, offset="+02:00"))
    store.add_point("alex", Point(AUTUMN, "02:10:00", "home", *HOME, offset="+01:00"))
    [stay] = store.read_day("alex", AUTUMN)
    # 02:10 winter time is later than 02:40 summer time
    assert (stay.start, stay.end, stay.end_offset) == ("02:40:00", "02:10:00", "+01:00")


def test_old_rows_without_offset_are_completed(store, tmp_path):
    folder = tmp_path / "history"
    folder.mkdir()
    (folder / f"alex_{AUTUMN}.csv").write_text(
        "00:05:00;home;48.5966;8.8697;;02:30:00\n02:15:00;not_home;48.6;8.9;Street;02:45:00\n"
    )
    points = store.read_points("alex", AUTUMN)
    assert [(p.time, p.offset) for p in points] == [("00:05:00", "+02:00"), ("02:15:00", "+01:00")]
    result = store.fill_time_zones("alex", AUTUMN, write=False)
    assert result == {"rows": 2, "offsets": 2, "zones": 0, "assumed": 1}
    store.fill_time_zones("alex", AUTUMN)
    text = (folder / f"alex_{AUTUMN}.csv").read_text()
    assert "02:15:00;not_home;48.6;8.9;Street;02:45:00;+01:00" in text
    assert store.fill_time_zones("alex", AUTUMN, write=False)["offsets"] == 0


def test_time_zone_of_a_place(store):
    assert foreign_zone(*NEW_YORK, "Europe/Berlin") == "America/New_York"
    assert foreign_zone(*HOME, "Europe/Berlin") == ""
    store.add_point("alex", Point("2026-07-01", "10:00:00", "not_home", *NEW_YORK, offset="+02:00"))
    assert store.fill_time_zones("alex", "2026-07-01", write=True)["zones"] == 1
    [stay] = store.read_day("alex", "2026-07-01")
    assert stay.tz == "America/New_York"


def test_row_leaves_out_empty_trailing_columns():
    assert point_row(Point("2026-07-01", "10:00:00", "home", 48.1, 8.1)) == ["10:00:00", "home", "48.1", "8.1", "", ""]
    assert point_row(Point("2026-07-01", "10:00:00", "home", 48.1, 8.1, offset="+02:00"))[-1] == "+02:00"


def test_rules_order_the_doubled_hour():
    points = [
        Point(AUTUMN, "02:40:00", "home", *HOME, offset="+02:00"),
        Point(AUTUMN, "02:10:00", "not_home", 48.7, 9.0, offset="+01:00"),
    ]
    kept, _ = apply_rules(points, 50, 0)
    assert [(p.time, p.offset) for p in kept] == [("02:40:00", "+02:00"), ("02:10:00", "+01:00")]


def test_import_completes_offsets_and_zones():
    text = (
        "person,date,start,end,state,latitude,longitude,address,utc_offset\n"
        f"alex,{AUTUMN},02:30:00,,home,{HOME[0]},{HOME[1]},,\n"
        f"alex,{AUTUMN},02:10:00,,not_home,{NEW_YORK[0]},{NEW_YORK[1]},,\n"
        f"alex,2026-07-01,10:00:00,,home,{HOME[0]},{HOME[1]},,+05:00\n"
    )
    points = parse_whereabouts_csv(text)["alex"]
    complete_points(points, BERLIN)
    # file order decides the doubled hour; a time with its own offset is converted to Home Assistant's time
    assert [(p.time, p.offset) for p in points] == [
        ("02:30:00", "+02:00"),
        ("02:10:00", "+01:00"),
        ("07:00:00", "+02:00"),
    ]
    assert [p.tz for p in points] == ["", "America/New_York", ""]


def test_import_converts_foreign_offsets_to_home_time():
    text = (
        "person,date,start,end,state,latitude,longitude,address,utc_offset\n"
        f"alex,2026-11-23,20:00:00,23:30:00,not_home,{NEW_YORK[0]},{NEW_YORK[1]},,-05:00\n"
    )
    [point] = parse_whereabouts_csv(text)["alex"]
    complete_points([point], BERLIN)
    # 20:00 in New York is 02:00 of the next day in Berlin; the end stays on that day
    assert (point.date, point.time, point.offset, point.end, point.end_offset) == (
        "2026-11-24",
        "02:00:00",
        "+01:00",
        "05:30:00",
        "",
    )
    assert point.tz == "America/New_York"


def test_export_writes_offsets_and_exact_gpx_times(store):
    store.add_point("alex", Point(AUTUMN, "02:30:00", "home", *HOME, offset="+02:00"))
    store.add_point("alex", Point(AUTUMN, "02:30:00", "not_home", 48.7, 9.0, offset="+01:00"))
    rows = store.export_rows("alex", AUTUMN, AUTUMN)
    lines = export_csv("alex", rows).splitlines()
    assert lines[1].endswith(",+02:00,,") and lines[2].endswith(",+01:00,,")
    gpx = export_gpx("alex", rows, BERLIN)
    assert "2026-10-25T00:30:00Z" in gpx and "2026-10-25T01:30:00Z" in gpx


def test_moment_orders_across_offsets():
    assert moment(AUTUMN, "02:30:00", "+02:00") < moment(AUTUMN, "02:10:00", "+01:00")


BANGKOK = (13.7563, 100.5018)


def test_import_splits_a_stay_over_home_midnight():
    # 00:00-08:00 in Bangkok (+07:00) is 18:00-02:00 in Berlin: split at Berlin's midnight
    points = [Point("2026-11-20", "00:00:00", "not_home", *BANGKOK, end="08:00:00", offset="+07:00")]
    complete_points(points, BERLIN)
    assert [(p.date, p.time, p.end, p.offset, p.end_offset) for p in points] == [
        ("2026-11-19", "18:00:00", "23:59:59", "+01:00", ""),
        ("2026-11-20", "00:00:00", "02:00:00", "+01:00", ""),
    ]
    assert {p.tz for p in points} == {"Asia/Bangkok"}


def test_import_split_ending_at_midnight_leaves_no_empty_piece():
    points = [Point("2026-11-20", "00:00:00", "not_home", *BANGKOK, end="06:00:00", offset="+07:00")]
    complete_points(points, BERLIN)
    assert [(p.date, p.time, p.end) for p in points] == [("2026-11-19", "18:00:00", "23:59:59")]


def test_import_split_over_the_clock_change_keeps_both_offsets():
    # 20:00-23:00 in New York (-04:00) on 24.10. = 02:00 (+02:00) to 04:00 (+01:00) in Berlin on 25.10.
    points = [Point("2026-10-24", "20:00:00", "not_home", *NEW_YORK, end="23:00:00", offset="-04:00")]
    complete_points(points, BERLIN)
    assert [(p.date, p.time, p.end, p.offset, p.end_offset) for p in points] == [
        ("2026-10-25", "02:00:00", "04:00:00", "+02:00", "+01:00"),
    ]


def test_edges_of_days(store):
    day1, day2, day3 = "2026-11-01", "2026-11-02", "2026-11-03"
    store.add_point("alex", Point(day1, "08:00:00", "home", *HOME, end="20:00:00"))
    store.add_point("alex", Point(day1, "21:00:00", "not_home", 48.7, 9.0, "Street 1", end="22:30:00"))
    store.add_point("alex", Point(day2, "07:00:00", "home", *HOME, end="18:00:00"))
    store.add_point("alex", Point("2026-11-05", "07:00:00", "home", *HOME, end="18:00:00"))  # no neighbour
    plan = store.fill_edges("alex", [day1, day2, day3, "2026-11-05"], write=False)
    # day 1: no day before, but the next day exists -> end; day 2: day before exists -> start
    assert plan == {"days": 3, "days_changed": 2, "starts": 1, "ends": 1}
    store.fill_edges("alex", [day1, day2, "2026-11-05"])
    stays1 = store.read_day("alex", day1)
    assert (stays1[-1].state, stays1[-1].end) == ("not_home", "23:59:59")
    stays2 = store.read_day("alex", day2)
    assert [(s.start, s.end, s.state, s.address) for s in stays2] == [
        ("00:00:00", "07:00:00", "not_home", "Street 1"),
        ("07:00:00", "18:00:00", "home", ""),
    ]
    assert stays2[0].offset == "+01:00"
    # second run: nothing left to do
    assert store.fill_edges("alex", [day1, day2], write=False)["days_changed"] == 0


def test_edge_at_the_same_place_moves_the_start(store):
    store.add_point("alex", Point("2026-11-01", "20:00:00", "home", *HOME, end="23:59:59"))
    store.add_point("alex", Point("2026-11-02", "06:30:00", "home", *HOME, end="09:00:00"))
    store.fill_edges("alex", ["2026-11-02"])
    [stay] = store.read_day("alex", "2026-11-02")
    assert (stay.start, stay.end) == ("00:00:00", "09:00:00")


def test_import_plan_counts_edges(store):
    store.add_point("alex", Point("2026-11-01", "20:00:00", "home", *HOME, end="23:59:59"))
    new = [Point("2026-11-02", "06:30:00", "not_home", 48.7, 9.0, end="09:00:00")]
    plan = store.edges_plan("alex", new, "merge")
    assert (plan["starts"], plan["ends"]) == (1, 0)
    assert store.days("alex") == ["2026-11-01"]  # nothing written
