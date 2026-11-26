"""Files of the evaluation of a place (0.8.0): Excel (.xlsx) and PDF, without extra packages.

Both are written into the export folder and handed out by ``downloads.DownloadView``
(also in the Home Assistant apps, through a signed link). The texts of the files are
here in German and English (the language of the user who asks for the file).
"""

from __future__ import annotations

import io
import os
import re
import zipfile
from datetime import date as date_type
from typing import Any
from xml.sax.saxutils import escape

from . import downloads
from .analysis import Run, summarize
from .pdf import PAGE_HEIGHT, PAGE_WIDTH, PdfDocument, fit, wrap

LABELS: dict[str, dict[str, str]] = {
    "de": {
        "title": "Orts-Auswertung",
        "center": "Mittelpunkt",
        "radius": "Radius",
        "period": "Zeitraum",
        "persons": "Personen",
        "min_duration": "Mindestdauer",
        "passing_counted": "Durchfahrten werden gezählt",
        "stamp": "Stand",
        "summary": "Übersicht",
        "visits_list": "Besuche",
        "col_period_day": "Tag",
        "col_period_month": "Monat",
        "col_period_year": "Jahr",
        "col_person": "Person",
        "col_visits": "Besuche",
        "col_days": "Tage mit Besuch",
        "col_total": "Gesamtdauer",
        "col_longest": "Längster Besuch",
        "col_date": "Datum",
        "col_from": "Von",
        "col_to": "Bis",
        "col_duration": "Dauer",
        "col_place": "Ort",
        "total": "Summe",
        "home": "Zuhause",
        "away": "Unterwegs",
        "none": "Im gewählten Zeitraum gab es keine Besuche.",
        "truncated": "Nur die ersten {n} Besuche.",
        "page": "Seite {x} von {y}",
        "selection": "Auswahl",
        "months": "Januar,Februar,März,April,Mai,Juni,Juli,August,September,Oktober,November,Dezember",
    },
    "en": {
        "title": "Place evaluation",
        "center": "Centre",
        "radius": "Radius",
        "period": "Period",
        "persons": "Persons",
        "min_duration": "Minimum duration",
        "passing_counted": "Passing through is counted",
        "stamp": "As of",
        "summary": "Summary",
        "visits_list": "Visits",
        "col_period_day": "Day",
        "col_period_month": "Month",
        "col_period_year": "Year",
        "col_person": "Person",
        "col_visits": "Visits",
        "col_days": "Days with a visit",
        "col_total": "Total time",
        "col_longest": "Longest visit",
        "col_date": "Date",
        "col_from": "From",
        "col_to": "To",
        "col_duration": "Duration",
        "col_place": "Place",
        "total": "Total",
        "home": "Home",
        "away": "Away",
        "none": "There were no visits in the chosen period.",
        "truncated": "Only the first {n} visits.",
        "page": "Page {x} of {y}",
        "selection": "Selection",
        "months": "January,February,March,April,May,June,July,August,September,October,November,December",
    },
}


def labels(language: str) -> dict[str, str]:
    return LABELS["de" if str(language).lower().startswith("de") else "en"]


def _german(language: str) -> bool:
    return str(language).lower().startswith("de")


def date_text(day: str, language: str) -> str:
    if not day:
        return ""
    year, month, dom = day.split("-")
    return f"{dom}.{month}.{year}" if _german(language) else day


def period_text(period: str, group: str, language: str) -> str:
    if group == "day":
        return date_text(period, language)
    if group == "month":
        names = labels(language)["months"].split(",")
        return f"{names[int(period[5:7]) - 1]} {period[:4]}"
    return period


def duration_text(seconds: int) -> str:
    minutes = round(seconds / 60)
    return f"{minutes // 60}:{minutes % 60:02d} h"


def place_text(visit: dict[str, Any], language: str) -> str:
    lab = labels(language)
    state = visit.get("state") or ""
    if state == "home":
        return lab["home"]
    if state in ("not_home", ""):
        return visit.get("address") or lab["away"]
    return state


def until_text(visit: dict[str, Any], language: str) -> str:
    if visit["end_date"] != visit["date"]:
        return f"{date_text(visit['end_date'], language)} {visit['end']}"
    return visit["end"]


def report(run: Run, group: str, names: dict[str, str], language: str) -> dict[str, Any]:
    """Everything both files show, as texts and raw values."""
    lab = labels(language)
    params = run.params
    persons = params["persons"]
    table = summarize(run.visits, group, persons)
    several = len(persons) > 1
    stamp = run.stamp.replace("T", " ")[:16]
    if stamp and _german(language):
        stamp = f"{date_text(stamp[:10], language)} {stamp[11:]}"
    selection = [
        (lab["center"], f"{params['latitude']:.5f}, {params['longitude']:.5f}"),
        (lab["radius"], f"{int(params['radius'])} m"),
        (lab["period"], f"{date_text(params['from'], language)} – {date_text(params['to'], language)}"),
        (lab["persons"], ", ".join(names.get(p, p) for p in persons)),
        (
            lab["min_duration"],
            lab["passing_counted"] if params.get("count_short") else f"{int(params['min_minutes'])} min",
        ),
        (lab["stamp"], stamp),
    ]
    return {
        "title": f"Whereabouts – {lab['title']}",
        "selection": selection,
        "group": group,
        "several": several,
        "names": names,
        "table": table,
        "visits": [v.as_dict() for v in run.visits],
        "truncated": run.truncated,
    }


# --- Excel --------------------------------------------------------------------------------------------------

_BAD_XML = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]")
STYLE_BOLD, STYLE_DATE, STYLE_DURATION, STYLE_BOLD_DURATION = 1, 2, 3, 4
_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_PKG = "http://schemas.openxmlformats.org/package/2006"
_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_SML = "application/vnd.openxmlformats-officedocument.spreadsheetml"


def _col(index: int) -> str:
    name = ""
    index += 1
    while index:
        index, rest = divmod(index - 1, 26)
        name = chr(65 + rest) + name
    return name


def _cell(ref: str, value: Any, style: int = 0) -> str:
    """A cell: str -> inline text, int/float -> number, ("date", "YYYY-MM-DD"), ("duration", seconds)."""
    attr = f' s="{style}"' if style else ""
    if isinstance(value, tuple) and value[0] == "date":
        serial = (date_type.fromisoformat(value[1]) - date_type(1899, 12, 30)).days
        return f'<c r="{ref}" s="{style or STYLE_DATE}"><v>{serial}</v></c>'
    if isinstance(value, tuple) and value[0] == "duration":
        return f'<c r="{ref}" s="{style or STYLE_DURATION}"><v>{value[1] / 86400:.8f}</v></c>'
    if isinstance(value, bool) or value is None:
        value = "" if value is None else str(value)
    if isinstance(value, int | float):
        return f'<c r="{ref}"{attr}><v>{value}</v></c>'
    text = escape(_BAD_XML.sub("", str(value)))
    return f'<c r="{ref}" t="inlineStr"{attr}><is><t xml:space="preserve">{text}</t></is></c>'


def _sheet(rows: list[tuple[list[Any], int]], widths: list[int], header_row: int = 0, filter_cols: int = 0) -> str:
    """rows: (cells, style) - style 0 normal, STYLE_BOLD for a bold row; header_row: 1-based row to freeze under."""
    out = [f'{_XML}<worksheet xmlns="{_MAIN}">']
    if header_row:
        out.append(
            f'<sheetViews><sheetView workbookViewId="0"><pane ySplit="{header_row}" topLeftCell="A{header_row + 1}" '
            'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        )
    out.append(
        "<cols>"
        + "".join(f'<col min="{i + 1}" max="{i + 1}" width="{w}" customWidth="1"/>' for i, w in enumerate(widths))
        + "</cols>"
    )
    out.append("<sheetData>")
    for number, (cells, style) in enumerate(rows, start=1):
        out.append(f'<row r="{number}">')
        for index, value in enumerate(cells):
            if value == "" or value is None:
                continue
            cell_style = style
            if style == STYLE_BOLD and isinstance(value, tuple) and value[0] == "duration":
                cell_style = STYLE_BOLD_DURATION
            out.append(_cell(f"{_col(index)}{number}", value, cell_style))
        out.append("</row>")
    out.append("</sheetData>")
    if header_row and filter_cols and len(rows) > header_row:
        out.append(f'<autoFilter ref="A{header_row}:{_col(filter_cols - 1)}{len(rows)}"/>')
    out.append("</worksheet>")
    return "".join(out)


def _styles(language: str) -> str:
    date_format = "dd.mm.yyyy" if _german(language) else "yyyy-mm-dd"
    return (
        f'{_XML}<styleSheet xmlns="{_MAIN}">'
        '<numFmts count="2"><numFmt numFmtId="164" formatCode="[h]:mm"/>'
        f'<numFmt numFmtId="165" formatCode="{date_format}"/></numFmts>'
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="2"><fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="5">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
        '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
        '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
        '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>'
        "</cellXfs>"
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    )


def _sheet_name(text: str) -> str:
    return escape(re.sub(r"[\[\]:*?/\\]", "", text)[:31])


def build_xlsx(data: dict[str, Any], language: str) -> bytes:
    lab = labels(language)
    group, several, names = data["group"], data["several"], data["names"]
    # sheet 1: the selection, then the summary table
    summary: list[tuple[list[Any], int]] = [([data["title"]], STYLE_BOLD)]
    summary += [([label, value], 0) for label, value in data["selection"]]
    summary.append(([], 0))
    head = [lab[f"col_period_{group}"]] + ([lab["col_person"]] if several else [])
    head += [lab["col_visits"], lab["col_days"], lab["col_total"], lab["col_longest"]]
    summary.append((head, STYLE_BOLD))
    header_row = len(summary)
    for row in data["table"]["rows"]:
        cells = [period_text(row["period"], group, language)] + (
            [names.get(row["person"], row["person"])] if several else []
        )
        cells += [row["visits"], row["days"], ("duration", row["seconds"]), ("duration", row["longest"])]
        summary.append((cells, 0))
    for total in data["table"]["totals"]:
        cells = [lab["total"]] + ([names.get(total["person"], total["person"])] if several else [])
        cells += [total["visits"], total["days"], ("duration", total["seconds"]), ("duration", total["longest"])]
        summary.append((cells, STYLE_BOLD))
    widths = [18] + ([18] if several else []) + [10, 16, 14, 16]
    # sheet 2: every visit
    head = [lab["col_date"], lab["col_from"], lab["col_to"], lab["col_duration"]]
    head += ([lab["col_person"]] if several else []) + [lab["col_place"]]
    visits: list[tuple[list[Any], int]] = [(head, STYLE_BOLD)]
    for visit in data["visits"]:
        cells = [("date", visit["date"]), visit["start"], until_text(visit, language), ("duration", visit["seconds"])]
        cells += ([names.get(visit["person"], visit["person"])] if several else []) + [place_text(visit, language)]
        visits.append((cells, 0))
    visit_widths = [12, 8, 18, 10] + ([18] if several else []) + [60]

    sheets = ("sheet1", "sheet2")
    files = {
        "[Content_Types].xml": (
            f'{_XML}<Types xmlns="{_PKG}/content-types">'
            f'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            f'<Override PartName="/xl/workbook.xml" ContentType="{_SML}.sheet.main+xml"/>'
            f'<Override PartName="/xl/styles.xml" ContentType="{_SML}.styles+xml"/>'
            + "".join(
                f'<Override PartName="/xl/worksheets/{n}.xml" ContentType="{_SML}.worksheet+xml"/>' for n in sheets
            )
            + "</Types>"
        ),
        "_rels/.rels": (
            f'{_XML}<Relationships xmlns="{_PKG}/relationships">'
            f'<Relationship Id="rId1" Type="{_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>'
        ),
        "xl/workbook.xml": (
            f'{_XML}<workbook xmlns="{_MAIN}" xmlns:r="{_REL}"><sheets>'
            f'<sheet name="{_sheet_name(lab["summary"])}" sheetId="1" r:id="rId1"/>'
            f'<sheet name="{_sheet_name(lab["visits_list"])}" sheetId="2" r:id="rId2"/>'
            "</sheets></workbook>"
        ),
        "xl/_rels/workbook.xml.rels": (
            f'{_XML}<Relationships xmlns="{_PKG}/relationships">'
            + "".join(
                f'<Relationship Id="rId{i}" Type="{_REL}/worksheet" Target="worksheets/{n}.xml"/>'
                for i, n in enumerate(sheets, start=1)
            )
            + f'<Relationship Id="rId3" Type="{_REL}/styles" Target="styles.xml"/></Relationships>'
        ),
        "xl/styles.xml": _styles(language),
        "xl/worksheets/sheet1.xml": _sheet(summary, widths, header_row),
        "xl/worksheets/sheet2.xml": _sheet(visits, visit_widths, 1, len(head)),
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, text in files.items():
            archive.writestr(name, text)
    return buffer.getvalue()


# --- PDF ----------------------------------------------------------------------------------------------------

MARGIN = 42
TOP = 46
BOTTOM = PAGE_HEIGHT - 48
ROW = 15
SIZE = 8.5
GREY = (0.93, 0.93, 0.93)
TEXT_GREY = (0.4, 0.4, 0.4)


class _Layout:
    def __init__(self) -> None:
        self.doc = PdfDocument()
        self.page = self.doc.new_page()
        self.y = TOP

    def new_page(self) -> None:
        self.page = self.doc.new_page()
        self.y = TOP

    def room(self, height: float) -> bool:
        return self.y + height <= BOTTOM

    def heading(self, text: str) -> None:
        if not self.room(ROW * 3):
            self.new_page()
        self.y += 10
        self.page.text(MARGIN, self.y + 10, text, 12, bold=True)
        self.y += 20

    def table(self, columns: list[tuple[str, float, str]], rows: list[tuple[list[str], bool]]) -> None:
        """columns: (title, share of the width, "left"/"right"); rows: (cells, bold)."""
        width = PAGE_WIDTH - 2 * MARGIN
        widths = [share * width for _, share, _ in columns]

        def head() -> None:
            self.page.rect(MARGIN, self.y, width, ROW, GREY)
            self._cells([c[0] for c in columns], widths, columns, True)

        if not self.room(ROW * 2):
            self.new_page()
        head()
        for cells, bold in rows:
            if not self.room(ROW):
                self.new_page()
                head()
            self._cells(cells, widths, columns, bold)
            self.page.line(MARGIN, self.y, MARGIN + width, self.y)

    def _cells(self, cells, widths, columns, bold) -> None:
        x = MARGIN
        for text, cell_width, (_, _, align) in zip(cells, widths, columns, strict=False):
            shown = fit(text, cell_width - 8, SIZE, bold)
            self.page.text(x + cell_width - 4 if align == "right" else x + 4, self.y + 10.5, shown, SIZE, bold, align)
            x += cell_width
        self.y += ROW


def build_pdf(data: dict[str, Any], language: str) -> bytes:
    lab = labels(language)
    group, several, names = data["group"], data["several"], data["names"]
    layout = _Layout()
    page = layout.page
    page.text(MARGIN, layout.y + 14, data["title"], 16, bold=True)
    layout.y += 28
    for label, value in data["selection"]:
        lines = wrap(value, PAGE_WIDTH - 2 * MARGIN - 110, 9)
        for index, line in enumerate(lines):
            if index == 0:
                page.text(MARGIN, layout.y + 10, f"{label}:", 9, color=TEXT_GREY)
            page.text(MARGIN + 110, layout.y + 10, line, 9)
            layout.y += 13

    layout.heading(lab["summary"])
    if not data["table"]["rows"]:
        layout.page.text(MARGIN, layout.y + 10, lab["none"], 9)
        layout.y += ROW
    else:
        columns = [(lab[f"col_period_{group}"], 0.2, "left")]
        if several:
            columns.append((lab["col_person"], 0.18, "left"))
        rest = 0.62 if several else 0.8
        columns += [
            (lab["col_visits"], rest * 0.2, "right"),
            (lab["col_days"], rest * 0.26, "right"),
            (lab["col_total"], rest * 0.26, "right"),
            (lab["col_longest"], rest * 0.28, "right"),
        ]
        rows: list[tuple[list[str], bool]] = []
        for row in data["table"]["rows"]:
            cells = [period_text(row["period"], group, language)] + (
                [names.get(row["person"], row["person"])] if several else []
            )
            cells += [
                str(row["visits"]),
                str(row["days"]),
                duration_text(row["seconds"]),
                duration_text(row["longest"]),
            ]
            rows.append((cells, False))
        for total in data["table"]["totals"]:
            cells = [lab["total"]] + ([names.get(total["person"], total["person"])] if several else [])
            cells += [
                str(total["visits"]),
                str(total["days"]),
                duration_text(total["seconds"]),
                duration_text(total["longest"]),
            ]
            rows.append((cells, True))
        layout.table(columns, rows)

        layout.heading(f"{lab['visits_list']} ({len(data['visits'])})")
        columns = [
            (lab["col_date"], 0.13, "left"),
            (lab["col_from"], 0.08, "left"),
            (lab["col_to"], 0.17 if any(v["end_date"] != v["date"] for v in data["visits"]) else 0.08, "left"),
            (lab["col_duration"], 0.1, "right"),
        ]
        if several:
            columns.append((lab["col_person"], 0.15, "left"))
        columns.append((lab["col_place"], 1 - sum(c[1] for c in columns), "left"))
        rows = []
        for visit in data["visits"]:
            cells = [
                date_text(visit["date"], language),
                visit["start"],
                until_text(visit, language),
                duration_text(visit["seconds"]),
            ]
            cells += ([names.get(visit["person"], visit["person"])] if several else []) + [place_text(visit, language)]
            rows.append((cells, False))
        layout.table(columns, rows)
        if data["truncated"]:
            layout.page.text(MARGIN, layout.y + 12, lab["truncated"].format(n=len(data["visits"])), 8, color=TEXT_GREY)

    total = len(layout.doc.pages)
    for number, each in enumerate(layout.doc.pages, start=1):
        each.text(MARGIN, PAGE_HEIGHT - 26, f"Whereabouts · {lab['title']}", 7.5, color=TEXT_GREY)
        each.text(
            PAGE_WIDTH - MARGIN,
            PAGE_HEIGHT - 26,
            lab["page"].format(x=number, y=total),
            7.5,
            align="right",
            color=TEXT_GREY,
        )
    return layout.doc.build(data["title"], language)


def write_file(hass, run: Run, fmt: str, group: str, names: dict[str, str], language: str) -> str:
    """Build the file in the export folder (runs in the executor); returns its name for DownloadView."""
    data = report(run, group, names, language)
    content = build_xlsx(data, language) if fmt == "xlsx" else build_pdf(data, language)
    folder = downloads.exports_folder(hass)
    os.makedirs(folder, exist_ok=True)
    downloads.cleanup(folder)
    lab = "auswertung" if _german(language) else "evaluation"
    name = downloads.final_name(
        downloads.new_token(), f"whereabouts_{lab}_{run.params['from']}_{run.params['to']}", fmt
    )
    path = os.path.join(folder, name)
    with open(path + ".part", "wb") as file:
        file.write(content)
    os.replace(path + ".part", path)
    return name


__all__ = ["build_pdf", "build_xlsx", "report", "write_file"]
