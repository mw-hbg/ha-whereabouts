"""Evaluation of a place (0.8.0): visits, grouping, rights, Excel and PDF files."""

from __future__ import annotations

import asyncio
import io
import os
import re
import zipfile
import zlib

import pytest
from homeassistant.core import HomeAssistant

from custom_components.whereabouts import downloads
from custom_components.whereabouts.analysis import Run, VisitBuilder, counted, summarize
from custom_components.whereabouts.pdf import text_width, win_ansi
from custom_components.whereabouts.reports import build_pdf, build_xlsx, report
from custom_components.whereabouts.storage import Point, Stay

from .conftest import setup_integration

pytestmark = pytest.mark.usefixtures("zones")

SPOT = (48.5000, 8.5000)
FAR = (48.6000, 8.5000)


def _stay(start: str, end: str, where=SPOT, state="not_home", address="Hauptstraße 1", offset="+01:00") -> Stay:
    return Stay(start, end, state, where[0], where[1], address, [start], offset, offset)


def _visits(stays, radius=100, gap=900):
    builder = VisitBuilder("person.alex", SPOT[0], SPOT[1], radius, gap)
    for day, stay in stays:
        builder.add(day, stay)
    builder.close()
    return builder.visits


def test_stays_join_into_one_visit_across_midnight():
    visits = _visits(
        [
            ("2026-03-01", _stay("22:00:00", "23:59:59")),
            ("2026-03-02", _stay("00:00:00", "01:30:00")),
            ("2026-03-02", _stay("09:00:00", "09:05:00", FAR)),
            ("2026-03-02", _stay("10:00:00", "10:05:00")),
        ]
    )
    assert len(visits) == 2
    first = visits[0]
    assert (first.start_day, first.start, first.end_day, first.end) == (
        "2026-03-01",
        "22:00:00",
        "2026-03-02",
        "01:30:00",
    )
    assert first.days == {"2026-03-01": 7199, "2026-03-02": 5401}
    assert first.seconds == 12600


def test_a_stay_outside_ends_the_visit_even_after_a_short_gap():
    visits = _visits(
        [
            ("2026-03-02", _stay("08:00:00", "08:30:00")),
            ("2026-03-02", _stay("08:31:00", "08:32:00", FAR)),
            ("2026-03-02", _stay("08:33:00", "09:00:00")),
        ]
    )
    assert len(visits) == 2


def test_a_stay_without_position_is_skipped():
    unknown = Stay("08:31:00", "08:32:00", "not_home", None, None)
    visits = _visits(
        [
            ("2026-03-02", _stay("08:00:00", "08:30:00")),
            ("2026-03-02", unknown),
            ("2026-03-02", _stay("08:33:00", "09:00:00")),
        ]
    )
    assert len(visits) == 1 and visits[0].seconds == 3600


def test_short_pause_counts_and_overlaps_are_not_counted_twice():
    visits = _visits([("2026-03-02", _stay("08:00:00", "08:30:00")), ("2026-03-02", _stay("08:40:00", "09:00:00"))])
    assert len(visits) == 1 and visits[0].seconds == 3600
    visits = _visits([("2026-03-02", _stay("08:00:00", "08:30:00")), ("2026-03-02", _stay("08:20:00", "08:25:00"))])
    assert visits[0].seconds == 1800


def test_doubled_hour_with_offsets():
    # 25 October 2026: 02:30 summer time, then 02:10 winter time - 40 minutes, not minus 20
    visits = _visits(
        [
            ("2026-10-25", _stay("02:30:00", "02:59:00", offset="+02:00")),
            ("2026-10-25", _stay("02:00:00", "02:10:00", offset="+01:00")),
        ]
    )
    assert len(visits) == 1 and visits[0].seconds == 40 * 60 - 60 + 60


def test_minimum_duration_and_passing_through():
    visits = _visits([("2026-03-02", _stay("08:00:00", "08:05:00")), ("2026-03-02", _stay("12:00:00", "13:00:00"))])
    assert len(counted(visits, 600, False)) == 1
    assert len(counted(visits, 600, True)) == 2


def test_grouping_by_day_month_year():
    visits = _visits(
        [
            ("2026-01-31", _stay("23:00:00", "23:59:59")),
            ("2026-02-01", _stay("00:00:00", "01:00:00")),
            ("2026-02-10", _stay("10:00:00", "12:00:00")),
        ]
    )
    month = summarize(visits, "month", ["person.alex"])
    rows = {r["period"]: r for r in month["rows"]}
    assert rows["2026-01"]["visits"] == 1 and rows["2026-01"]["seconds"] == 3599
    assert rows["2026-02"]["visits"] == 1 and rows["2026-02"]["days"] == 2 and rows["2026-02"]["seconds"] == 3601 + 7200
    assert month["totals"][0]["visits"] == 2 and month["totals"][0]["days"] == 3
    assert month["totals"][0]["longest"] == 7200
    year = summarize(visits, "year", ["person.alex"])
    assert len(year["rows"]) == 1 and year["rows"][0]["seconds"] == 3599 + 3601 + 7200
    assert len(summarize(visits, "day", ["person.alex"])["rows"]) == 3


def _run() -> Run:
    visits = _visits(
        [
            ("2026-03-01", _stay("22:00:00", "23:59:59", address="Straße (mit) Klammer\\ und „Anführung“")),
            ("2026-03-02", _stay("00:00:00", "01:30:00")),
            ("2026-03-05", _stay("10:00:00", "11:00:00", state="Work")),
        ]
    )
    params = {
        "persons": ["person.alex"],
        "from": "2026-03-01",
        "to": "2026-03-31",
        "latitude": SPOT[0],
        "longitude": SPOT[1],
        "radius": 100,
        "min_minutes": 10,
        "count_short": False,
    }
    return Run("abcdef012345", params, status="done", visits=visits, stamp="2026-03-31T12:00")


def test_excel_file():
    data = report(_run(), "month", {"person.alex": "Alex"}, "de")
    content = build_xlsx(data, "de")
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        names = set(archive.namelist())
        assert {"[Content_Types].xml", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet2.xml"} <= names
        visits = archive.read("xl/worksheets/sheet2.xml").decode()
        summary = archive.read("xl/worksheets/sheet1.xml").decode()
        workbook = archive.read("xl/workbook.xml").decode()
    assert "Übersicht" in workbook and "Besuche" in workbook
    assert "„Anführung“" in visits and "Work" in visits
    assert 'autoFilter ref="A1:E3"' in visits
    assert "März 2026" in summary and "Summe" in summary


def _texts(content: bytes) -> bytes:
    return b"".join(zlib.decompress(m) for m in re.findall(rb">>\nstream\n(.*?)\nendstream", content, re.S))


def test_pdf_file():
    data = report(_run(), "month", {"person.alex": "Alex"}, "de")
    content = build_pdf(data, "de")
    assert content.startswith(b"%PDF-1.4") and content.rstrip().endswith(b"%%EOF")
    assert b"/Count 1" in content
    texts = _texts(content)
    assert win_ansi("Seite 1 von 1") in texts
    assert win_ansi("Längster Besuch") in texts
    assert b"\\(mit\\)" in texts and b"\\\\" in texts  # brackets and backslash escaped


def test_pdf_many_visits_gives_pages_with_numbers():
    run = _run()
    run.visits = run.visits * 120
    content = build_pdf(report(run, "day", {"person.alex": "Alex"}, "en"), "en")
    count = int(content.split(b"/Count ")[1].split(b" ")[0])
    assert count >= 4
    assert b"Page 1 of" in _texts(content)


def test_characters_outside_win_ansi():
    assert win_ansi("Straße ő ł 東") == "Straße o ? ?".encode("cp1252")


def test_text_width():
    assert text_width("i", 10) < text_width("W", 10)
    assert text_width("Ä", 10, True) == 7.22


def _person(hass: HomeAssistant, key: str) -> None:
    hass.states.async_set(f"person.{key}", "home", {"friendly_name": key.title()})


async def _call(ws, n: int, **msg):
    await ws.send_json({"id": n, **msg})
    return await ws.receive_json()


async def _done(ws, n: int, group="month"):
    for i in range(500):
        answer = await _call(ws, n + i, type="whereabouts/analysis/status", group=group)
        if answer["result"]["status"] != "running":
            return answer["result"]
        await asyncio.sleep(0.01)
    raise AssertionError("evaluation did not end")


async def test_evaluation_over_websocket(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    runtime = hass.data["whereabouts"]
    runtime.storage.import_points(
        "alex",
        [
            Point("2026-02-27", "08:00:00", "not_home", *SPOT, end="09:00:00"),
            Point("2026-02-27", "10:00:00", "not_home", *FAR, end="11:00:00"),
            Point("2026-03-03", "08:00:00", "not_home", SPOT[0] + 0.0003, SPOT[1], end="08:30:00"),
        ],
    )
    ws = await hass_ws_client(hass)
    start = {
        "type": "whereabouts/analysis/start",
        "persons": ["person.alex"],
        "from": "2026-02-01",
        "to": "2026-03-31",
        "latitude": SPOT[0],
        "longitude": SPOT[1],
        "radius": 100,
    }
    answer = await _call(ws, 1, **start)
    assert answer["success"] and answer["result"]["total"] == 2
    result = await _done(ws, 10)
    assert result["status"] == "done" and result["visit_count"] == 2
    assert [r["period"] for r in result["table"]["rows"]] == ["2026-02", "2026-03"]
    assert result["visits"][0]["start"] == "08:00" and result["visits"][0]["seconds"] == 3600
    exported = await _call(ws, 600, type="whereabouts/analysis/export", format="xlsx", group="day", language="de")
    name = exported["result"]["file"]
    assert downloads.FILE_NAME.match(name) and name.endswith(".xlsx")
    path = os.path.join(downloads.exports_folder(hass), name)
    assert await hass.async_add_executor_job(os.path.isfile, path)
    pdf = await _call(ws, 601, type="whereabouts/analysis/export", format="pdf")
    assert pdf["result"]["file"].endswith(".pdf")
    # invalid input
    bad = await _call(ws, 700, **{**start, "radius": 5})
    assert not bad["success"]
    bad = await _call(ws, 701, **{**start, "from": "2026-04-01"})
    assert bad["error"]["code"] == "invalid_range"
    cancelled = await _call(ws, 702, type="whereabouts/analysis/cancel")
    assert cancelled["success"]


async def test_evaluation_needs_the_right_to_see_the_history(hass: HomeAssistant, hass_ws_client, hass_admin_user):
    _person(hass, "alex")
    await setup_integration(hass)
    ws = await hass_ws_client(hass)
    answer = await _call(
        ws,
        1,
        type="whereabouts/analysis/start",
        persons=["person.nobody"],
        **{"from": "2026-02-01", "to": "2026-02-02"},
        latitude=1,
        longitude=1,
        radius=100,
    )
    assert answer["error"]["code"] == "forbidden"
    export = await _call(ws, 2, type="whereabouts/analysis/export", format="pdf")
    assert export["error"]["code"] == "no_result"
