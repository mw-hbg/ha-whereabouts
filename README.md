# Whereabouts

**English** · [Deutsch](README.de.md)

Live map and long-term location history for the persons in Home Assistant –
one integration, two cards, everything set up in the UI.

> **Status: in development (0.x).** The recording, the history API and import/export
> are done and tested; the two cards follow in the next steps.

## What it does

| | |
|---|---|
| **"Where is…?" card** | All persons live on a full-screen map: place, "since", address when on the way, last fix. The map follows everyone until you move it yourself. |
| **"Location history" card** | Where a person was on a chosen day – as a route on the map or as a table. Stays instead of a cloud of points ("Home 08:00 – 15:03"), addresses for places on the way, deleting single entries. |
| **Recording** | Stores a stay whenever a recorded person moves; kept until *you* delete it – not only the 10 days of the Home Assistant recorder. |
| **Import and export** | CSV and GPX. Your history is never locked in. |

Both cards can be switched on or off individually; titles, persons and colours
are set per card.

## Why Whereabouts?

There are good projects for parts of this – e.g. the
[Location Timeline Card](https://github.com/konewka17/timeline_card) (a timeline of
the recorder history), [GPS Timeline](https://github.com/iamyacin/gps-timeline)
(unlimited point storage) and [Dawarich](https://dawarich.app) (a separate
server). Whereabouts puts the whole thing into **one integration**:

- **Live map and history together** – persons, names and colours are set once and
  look the same in both cards.
- **Stays instead of raw points** – consecutive points at the same place become
  one entry with a time span; inside a zone the exact position does not matter.
- **Addresses that are right** – the phone's own geocoding is only used when its
  position matches the point; optionally OpenStreetMap fills the gaps.
- **Permissions per user** – who may see and delete whose history (e.g. children
  only their own person).
- **Clean data** – plain CSV files in your configuration folder, part of every
  backup; import of CSV, GPX and old archives, export as CSV and GPX.
- **Privacy first** – nothing is recorded until you choose persons; nothing
  leaves Home Assistant unless you switch on OpenStreetMap.

## Installation

1. HACS → ⋮ → **Custom repositories** → `https://github.com/mw-hbg/ha-whereabouts`, type **Integration**.
2. Download **Whereabouts**, restart Home Assistant.
3. **Settings → Devices & services → Add integration → Whereabouts**.

## Set-up

The first dialog asks for the cards, the persons whose history is recorded
(none by default) and the address source. Everything else is under
**Configure**:

| Menu | What you can set |
|---|---|
| Cards and recording | Cards on/off, recorded persons, store interval at the same place (60 s), "same place" radius on the way (50 m), deleting old history (default: never) |
| Addresses | Phone, phone + OpenStreetMap, OpenStreetMap or none; per person the phone's geocoded location sensor (found automatically) |
| Who may see and delete the history | Administrators and own person (default), administrators only, all users |
| Import history | Upload a file (see below) |

## Privacy and security

- The history is stored only in `<config>/whereabouts/history/` – outside `www/`,
  so it is **not** reachable via `/local/`. Files are readable by Home Assistant only.
- The cards read the history only through Home Assistant's authenticated
  connection; every request is checked against the logged-in user.
- OpenStreetMap is off by default. When switched on, the coordinates of places
  on the way are sent to `nominatim.openstreetmap.org` (max. one request per 1.5 s,
  results cached locally), as its
  [usage policy](https://operations.osmfoundation.org/policies/nominatim/) requires.
- The live map shows only what every Home Assistant user can see anyway.

## Import and export

Import: **Configure → Import history**. Supported are the Whereabouts CSV
format, GPX (tracks, routes, waypoints) and the daily files of the original
script version (single file or ZIP). Existing entries are skipped, or whole days
replaced if you choose so. The format is described in [FORMAT.md](FORMAT.md).

Export: from the history card (CSV or GPX), or directly via
`/api/whereabouts/export?person=person.x&from=2026-01-01&to=2026-01-31&format=csv`.

## Uninstalling

Remove the integration under **Devices & services**, then in HACS. The recorded
history is **kept on purpose** in `<config>/whereabouts/` – delete the folder if
you don't need it any more. If you add the integration again, the history is
there again.

## Languages

English and German. New languages: see [TRANSLATING.md](TRANSLATING.md).

## License

MIT – see [LICENSE](LICENSE). Map data © OpenStreetMap contributors.
