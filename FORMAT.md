# Whereabouts file formats / Dateiformate

[English](#english) · [Deutsch](#deutsch)

## English

### Whereabouts CSV (import and export)

UTF-8, first row is the header, separator `,` (`;` is also accepted on import),
values with a separator inside are quoted as usual in CSV.

```csv
person,date,start,end,state,latitude,longitude,address
alex,2026-06-24,00:05:06,08:12:40,home,52.528526,13.406622,
alex,2026-06-24,08:20:11,08:20:11,not_home,52.531,13.421,"Main Street 1, Springfield"
alex,2026-06-24,08:41:02,16:58:30,Work,52.509,13.388,
```

| Column | Content |
|---|---|
| `person` | Object ID of the person entity (`person.alex` → `alex`): lower-case letters, digits, `_` |
| `date` | Local date `YYYY-MM-DD` |
| `start`, `end` | Local time `HH:MM:SS`; `end` may be empty (= `start`) |
| `state` | State of the person: `home`, `not_home` or the name of a zone; empty or `not_home` → on import the Home Assistant zone the point lies in (otherwise `not_home`) |
| `latitude`, `longitude` | Decimal degrees (WGS84) |
| `address` | Only for `not_home`, optional |

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

The export writes one waypoint per stay and one track per day.

### Daily files (original script version)

One file per person and day, named `<person>_<YYYY-MM-DD>.csv`, separator `;`,
no header:

```text
start;state;latitude;longitude[;address[;end]]
```

Import a single file or many at once as a ZIP. This is also how Whereabouts
stores the history internally (`<config>/whereabouts/history/`).

## Deutsch

### Whereabouts-CSV (Import und Export)

UTF-8, erste Zeile ist die Kopfzeile, Trennzeichen `,` (beim Import geht auch
`;`), Werte mit Trennzeichen darin stehen wie üblich in Anführungszeichen.

```csv
person,date,start,end,state,latitude,longitude,address
alex,2026-06-24,00:05:06,08:12:40,home,52.528526,13.406622,
alex,2026-06-24,08:20:11,08:20:11,not_home,52.531,13.421,"Hauptstraße 1, Musterstadt"
alex,2026-06-24,08:41:02,16:58:30,Arbeit,52.509,13.388,
```

| Spalte | Inhalt |
|---|---|
| `person` | Objekt-ID der Personen-Entität (`person.alex` → `alex`): Kleinbuchstaben, Ziffern, `_` |
| `date` | Lokales Datum `JJJJ-MM-TT` |
| `start`, `end` | Lokale Uhrzeit `HH:MM:SS`; `end` darf leer sein (= `start`) |
| `state` | Zustand der Person: `home`, `not_home` oder der Name einer Zone; leer oder `not_home` → beim Import die Zone aus Home Assistant, in der der Punkt liegt (sonst `not_home`) |
| `latitude`, `longitude` | Dezimalgrad (WGS84) |
| `address` | Nur bei `not_home`, optional |

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

Der Export schreibt pro Aufenthalt einen Wegpunkt und pro Tag einen Track.

### Tagesdateien (ursprüngliche Skript-Version)

Eine Datei pro Person und Tag, Name `<person>_<JJJJ-MM-TT>.csv`, Trennzeichen
`;`, keine Kopfzeile:

```text
start;state;latitude;longitude[;address[;end]]
```

Eine einzelne Datei oder viele auf einmal als ZIP importieren. So speichert
Whereabouts den Verlauf auch intern (`<config>/whereabouts/history/`).
