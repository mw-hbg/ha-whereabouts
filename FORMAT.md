# Whereabouts file formats / Dateiformate

[English](#english) · [Deutsch](#deutsch)

## English

### Whereabouts CSV (import and export)

UTF-8, first row is the header, separator `,` (`;` is also accepted on import),
values with a separator inside are quoted as usual in CSV.

```csv
person,date,start,end,state,latitude,longitude,address,utc_offset,end_utc_offset,time_zone
alex,2026-06-24,00:05:06,08:12:40,home,52.528526,13.406622,,+02:00,,
alex,2026-06-24,08:20:11,08:20:11,not_home,52.531,13.421,"Main Street 1, Springfield",+02:00,,
alex,2026-06-24,08:41:02,16:58:30,Work,52.509,13.388,,+02:00,,
```

| Column | Content |
|---|---|
| `person` | Object ID of the person entity (`person.alex` → `alex`): lower-case letters, digits, `_` |
| `date` | Local date `YYYY-MM-DD` |
| `start`, `end` | Local time `HH:MM:SS`; `end` may be empty (= `start`) |
| `state` | State of the person: `home`, `not_home` or the name of a zone; empty or `not_home` → on import the Home Assistant zone the point lies in (otherwise `not_home`) |
| `latitude`, `longitude` | Decimal degrees (WGS84) |
| `address` | Only for `not_home`, optional |
| `utc_offset` | Optional: offset of `start` from UTC, e.g. `+01:00`. A time with another offset than Home Assistant's (recorded abroad) is converted to Home Assistant's time and day on import. Empty or missing → Home Assistant's time zone (in the hour that occurs twice in autumn the order of the rows decides) |
| `end_utc_offset` | Optional: offset of `end`, only when it differs (the clocks changed during the stay) |
| `time_zone` | Written by the export: time zone of the place when it is not Home Assistant's (e.g. `America/New_York`). On import it is always taken from the coordinates |

One row is one stay. On import, the person in the file is used unless you
choose a target person.

On import of every format, the recording rules apply: consecutive points within
the "same place" radius become one stay, and points on the way that are closer
in time than the store interval are thinned out (a change of zone is always
kept).

### GPX

Tracks (`trkpt`), routes (`rtept`) and waypoints (`wpt`) with a `<time>` are
imported; points without a time are skipped. Each point gets the zone it lies
in (or `not_home`); then the recording rules apply (see above). A GPX
file does not say whose track it is, so you choose the person when importing.

GPX times are UTC; on import they become Home Assistant's time with the right
offset. The export writes one waypoint per stay and one track per day, with
exact UTC times (also in the hour that occurs twice in autumn).

### Daily files (original script version)

One file per person and day, named `<person>_<YYYY-MM-DD>.csv`, separator `;`,
no header:

```text
start;state;latitude;longitude[;address[;end[;utc_offset[;end_utc_offset[;time_zone]]]]]
```

Import a single file or many at once as a ZIP. This is also how Whereabouts
stores the history internally (`<config>/whereabouts/history/`).

## Deutsch

### Whereabouts-CSV (Import und Export)

UTF-8, erste Zeile ist die Kopfzeile, Trennzeichen `,` (beim Import geht auch
`;`), Werte mit Trennzeichen darin stehen wie üblich in Anführungszeichen.

```csv
person,date,start,end,state,latitude,longitude,address,utc_offset,end_utc_offset,time_zone
alex,2026-06-24,00:05:06,08:12:40,home,52.528526,13.406622,,+02:00,,
alex,2026-06-24,08:20:11,08:20:11,not_home,52.531,13.421,"Hauptstraße 1, Musterstadt",+02:00,,
alex,2026-06-24,08:41:02,16:58:30,Arbeit,52.509,13.388,,+02:00,,
```

| Spalte | Inhalt |
|---|---|
| `person` | Objekt-ID der Personen-Entität (`person.alex` → `alex`): Kleinbuchstaben, Ziffern, `_` |
| `date` | Lokales Datum `JJJJ-MM-TT` |
| `start`, `end` | Lokale Uhrzeit `HH:MM:SS`; `end` darf leer sein (= `start`) |
| `state` | Zustand der Person: `home`, `not_home` oder der Name einer Zone; leer oder `not_home` → beim Import die Zone aus Home Assistant, in der der Punkt liegt (sonst `not_home`) |
| `latitude`, `longitude` | Dezimalgrad (WGS84) |
| `address` | Nur bei `not_home`, optional |
| `utc_offset` | Optional: Abweichung von `start` von UTC, z. B. `+01:00`. Eine Uhrzeit mit anderer Abweichung als in Home Assistant (im Ausland aufgezeichnet) wird beim Import in Uhrzeit und Tag von Home Assistant umgerechnet. Leer oder fehlt → Zeitzone von Home Assistant (in der Stunde, die es im Herbst zweimal gibt, entscheidet die Reihenfolge der Zeilen) |
| `end_utc_offset` | Optional: Abweichung von `end`, nur wenn sie anders ist (Zeitumstellung während des Aufenthalts) |
| `time_zone` | Schreibt der Export: Zeitzone des Orts, wenn es nicht die von Home Assistant ist (z. B. `America/New_York`). Beim Import wird sie immer aus den Koordinaten bestimmt |

Eine Zeile ist ein Aufenthalt. Beim Import gilt die Person aus der Datei, außer
du wählst eine Ziel-Person.

Beim Import gelten für jedes Format die Aufzeichnungsregeln: Aufeinanderfolgende
Punkte im Umkreis „gleicher Ort“ werden ein Aufenthalt, und Punkte unterwegs, die
zeitlich enger liegen als der Speicherabstand, werden ausgedünnt (ein
Zonenwechsel bleibt immer erhalten).

### GPX

Importiert werden Tracks (`trkpt`), Routen (`rtept`) und Wegpunkte (`wpt`) mit
`<time>`; Punkte ohne Zeit werden übersprungen. Jeder Punkt bekommt die Zone,
in der er liegt (sonst `not_home`); danach gelten die Aufzeichnungsregeln
(siehe oben). Eine GPX-Datei sagt nicht, wessen Track es ist – die
Person wählst du beim Import.

GPX-Zeiten sind UTC; beim Import werden sie zur Uhrzeit von Home Assistant mit
der richtigen Abweichung. Der Export schreibt pro Aufenthalt einen Wegpunkt und
pro Tag einen Track, mit exakten UTC-Zeiten (auch in der Stunde, die es im
Herbst zweimal gibt).

### Tagesdateien (ursprüngliche Skript-Version)

Eine Datei pro Person und Tag, Name `<person>_<JJJJ-MM-TT>.csv`, Trennzeichen
`;`, keine Kopfzeile:

```text
start;state;latitude;longitude[;address[;end[;utc_offset[;end_utc_offset[;time_zone]]]]]
```

Eine einzelne Datei oder viele auf einmal als ZIP importieren. So speichert
Whereabouts den Verlauf auch intern (`<config>/whereabouts/history/`).
