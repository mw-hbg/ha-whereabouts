# Whereabouts-Dateiformate

[English](FORMAT.md) · **Deutsch**

## Whereabouts-CSV (Import und Export)

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
| `state` | Zustand der Person: `home`, `not_home` oder der Name einer Zone |
| `latitude`, `longitude` | Dezimalgrad (WGS84) |
| `address` | Nur bei `not_home`, optional |

Eine Zeile ist ein Aufenthalt. Beim Import gilt die Person aus der Datei, außer
du wählst eine Ziel-Person.

## GPX

Importiert werden Tracks (`trkpt`), Routen (`rtept`) und Wegpunkte (`wpt`) mit
`<time>`; Punkte ohne Zeit werden übersprungen. Jeder Punkt bekommt die Zone,
in der er liegt (sonst `not_home`), aufeinanderfolgende Punkte am selben Ort
werden ein Aufenthalt. Eine GPX-Datei sagt nicht, wessen Track es ist – die
Person wählst du beim Import.

Der Export schreibt pro Aufenthalt einen Wegpunkt und pro Tag einen Track.

## Tagesdateien (ursprüngliche Skript-Version)

Eine Datei pro Person und Tag, Name `<person>_<JJJJ-MM-TT>.csv`, Trennzeichen
`;`, keine Kopfzeile:

```text
start;state;latitude;longitude[;address[;end]]
```

Eine einzelne Datei oder viele auf einmal als ZIP importieren. So speichert
Whereabouts den Verlauf auch intern (`<config>/whereabouts/history/`).
