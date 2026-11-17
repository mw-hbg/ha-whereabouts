# Whereabouts

[English](README.md) · **Deutsch**

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=mw-hbg&repository=ha-whereabouts&category=integration)
[![Add integration](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=whereabouts)
[![Test](https://github.com/mw-hbg/ha-whereabouts/actions/workflows/test.yaml/badge.svg)](https://github.com/mw-hbg/ha-whereabouts/actions/workflows/test.yaml)
[![Release](https://img.shields.io/github/v/release/mw-hbg/ha-whereabouts?label=release)](https://github.com/mw-hbg/ha-whereabouts/releases)
[![HACS: custom](https://img.shields.io/badge/HACS-custom-41BDF5)](https://hacs.xyz)
![Stage: experimental](https://img.shields.io/badge/stage-experimental-orange)

Live-Karte und dauerhafter Standortverlauf für die Personen in Home Assistant –
eine Integration, zwei Karten, alles in der Oberfläche eingerichtet.

> **Stand: in Entwicklung (0.x)** – experimentell bis Version 1.0.

## Was es kann

| | |
|---|---|
| **Karte „Wo ist…?“** | Alle Personen live auf einer bildschirmfüllenden Karte: Ort, „seit“, Adresse unterwegs, letzte Ortung. Die Karte folgt allen, bis man sie selbst verschiebt. |
| **Karte „Standortverlauf“** | Wo eine Person an einem gewählten Tag war – als Route auf der Karte oder als Tabelle. Aufenthalte statt Punktwolke („Zuhause 08:00 – 15:03“), Adressen für Orte unterwegs, einzelne Einträge löschen. |
| **Aufzeichnung** | Speichert einen Aufenthalt, sobald sich eine aufgezeichnete Person bewegt; bleibt erhalten, bis *du* ihn löschst – nicht nur die 10 Tage des Home-Assistant-Recorders. |
| **Import und Export** | CSV und GPX. Deine Daten sind nie eingesperrt. |

Beide Karten lassen sich einzeln ein- und ausschalten; Titel, Personen und
Farben stellt man pro Karte ein.

## Warum Whereabouts?

Für Teile davon gibt es gute Projekte – z. B. die
[Location Timeline Card](https://github.com/konewka17/timeline_card) (Zeitachse aus dem
Recorder-Verlauf), [GPS Timeline](https://github.com/iamyacin/gps-timeline)
(unbegrenzte Punktspeicherung) und [Dawarich](https://dawarich.app) (eigener
Server). Whereabouts bringt das Ganze in **eine Integration**:

- **Live-Karte und Verlauf zusammen** – eine Installation, beide Karten im
  gleichen Stil (eine Person bekommt automatisch dieselbe Farbe).
- **Aufenthalte statt Rohpunkte** – aufeinanderfolgende Punkte am selben Ort
  werden ein Eintrag mit Zeitraum; in einer Zone zählt die genaue Position nicht.
- **Adressen, die stimmen** – die Geokodierung des Handys wird nur genommen,
  wenn ihre Position zum Punkt passt; auf Wunsch füllt OpenStreetMap die Lücken.
- **Rechte pro Benutzer** – wer wessen Verlauf sehen und löschen darf (z. B.
  Kinder nur ihre eigene Person).
- **Saubere Daten** – einfache CSV-Dateien im Konfigurationsordner, Teil jeder
  Sicherung; Import von CSV, GPX und alten Archiven, Export als CSV und GPX.
- **Datenschutz zuerst** – aufgezeichnet wird erst, wenn du Personen auswählst;
  nichts verlässt Home Assistant, außer du schaltest OpenStreetMap ein.

## Installation

Oben auf **Open in HACS** klicken, oder von Hand:

1. HACS → ⋮ (oben rechts) → **Benutzerdefinierte Repositories** → Repository `https://github.com/mw-hbg/ha-whereabouts`, Typ **Integration** → **Hinzufügen**.
2. In HACS nach **Whereabouts** suchen → **Herunterladen** → Home Assistant neu starten (Einstellungen → System → ⏻).
3. Oben auf **Add integration** klicken, oder **Einstellungen → Geräte & Dienste → + Integration hinzufügen → Whereabouts**.

## Einrichtung

Der erste Dialog fragt nach den Karten, den Personen, deren Verlauf
aufgezeichnet wird (standardmäßig keine), und der Adressquelle. Alles Weitere
steht unter **Konfigurieren**:

| Menü | Was man einstellt |
|---|---|
| Karten und Aufzeichnung | Karten an/aus, aufgezeichnete Personen, Speicherabstand am selben Ort (60 s), Umkreis „derselbe Ort“ unterwegs (50 m), alten Verlauf löschen (Standard: nie) |
| Adressen | Handy, Handy + OpenStreetMap, OpenStreetMap oder keine; pro Person der Sensor „Geokodierter Standort“ des Handys (wird automatisch gefunden) |
| Wer den Verlauf sehen und löschen darf | Administratoren und eigene Person (Standard), nur Administratoren, alle Benutzer |
| Verlauf importieren | Datei hochladen (siehe unten) |

## Die Karten

Hinzufügen wie jede andere Karte: **Dashboard bearbeiten → + Karte hinzufügen →
„Wo ist…?“** oder **„Standortverlauf“**. Alles wird im grafischen Editor
eingestellt; für eine Karte, die die ganze Seite füllt, eine Ansicht vom Typ
**Panel** verwenden.

| Einstellung | „Wo ist…?“ | „Standortverlauf“ |
|---|---|---|
| Titel | optional | optional |
| Personen | alle (oder die gewählten) | alle, die man sehen darf (oder die gewählten) |
| Pro Person | Anzeigename, Farbe, Adress-Sensor | Anzeigename, Farbe |
| Karte | hell/dunkel/wie Home Assistant, Esri / OpenStreetMap / CARTO (eigener Schlüssel), Link für Koordinaten (Google, Apple, OpenStreetMap) | hell/dunkel/wie Home Assistant, Esri / OpenStreetMap / CARTO |
| Anzeige | Infoleiste, Statusleiste, Zonen, GPS-Genauigkeit, beim Start folgen, Zonennamen ab Zoom, Neuladen | Start mit Karte oder Tabelle, Legende, Download-Knöpfe, Aktualisieren |
| Höhe | automatisch (ganze Höhe in einer Panel-Ansicht), ganze Bildschirmhöhe oder fest | ebenso |

Ohne eigene Farbe bekommt eine Person in beiden Karten automatisch dieselbe
Farbe. In YAML sieht das so aus:

```yaml
type: custom:whereabouts-live-card
persons: [person.alex, person.sam]
person_settings:
  person.alex: { color: "#378ADD" }
  person.sam: { name: Sam, color: "#D6409F" }
tiles: esri          # esri | osm | carto (dann carto_api_key: ...)
map_style: auto      # auto | light | dark
map_link: google     # google | apple | osm | none
```

## Datenschutz und Sicherheit

- Der Verlauf liegt nur in `<config>/whereabouts/history/` – außerhalb von `www/`,
  also **nicht** über `/local/` oder eine andere Web-Adresse erreichbar.
- Die Karten lesen den Verlauf nur über die angemeldete Home-Assistant-Verbindung;
  jede Anfrage wird gegen den angemeldeten Benutzer geprüft.
- OpenStreetMap ist standardmäßig aus. Eingeschaltet werden die Koordinaten von
  Orten unterwegs an `nominatim.openstreetmap.org` geschickt (höchstens eine Anfrage
  pro 1,5 s, Ergebnisse lokal zwischengespeichert), wie es die
  [Nutzungsregeln](https://operations.osmfoundation.org/policies/nominatim/) verlangen.
- Die Live-Karte zeigt nur, was jeder Home-Assistant-Benutzer ohnehin sehen kann.

## Verbindungen nach außen

| Was | Von wo | Sendet |
|---|---|---|
| Aufzeichnung, Verlauf, Import, Export | Home Assistant | nichts – läuft komplett lokal |
| Adressen vom Handy (Standard) | Home Assistant | nichts – die Companion-App hat sie schon geschickt |
| Adressen von OpenStreetMap (standardmäßig aus) | Home Assistant → `nominatim.openstreetmap.org` | Koordinaten von Orten unterwegs |
| Kartenkacheln | **dein Browser / die App** → Esri, OpenStreetMap oder CARTO (je nach Karte) | den sichtbaren Kartenausschnitt (wie jede Online-Karte) |
| Kartenbibliothek (Leaflet) | Home Assistant selbst | nichts – eingebaut, kein CDN |

Ohne Internet laufen Aufzeichnung und Verlauf weiter; nur der Kartenhintergrund
bleibt leer.

## Import und Export

Import: **Konfigurieren → Verlauf importieren**. Unterstützt werden das
Whereabouts-CSV-Format, GPX (Tracks, Routen, Wegpunkte) und die Tagesdateien
der ursprünglichen Skript-Version (einzeln oder als ZIP). Vorhandene Einträge
werden übersprungen oder auf Wunsch ganze Tage ersetzt. Das Format steht in
[FORMAT.de.md](FORMAT.de.md).

Export: aus der Verlaufskarte (CSV oder GPX) oder direkt über
`/api/whereabouts/export?person=person.x&from=2026-01-01&to=2026-01-31&format=csv`.

## Deinstallieren

Integration unter **Geräte & Dienste** entfernen, danach in HACS. Der
aufgezeichnete Verlauf bleibt **bewusst erhalten** in `<config>/whereabouts/` –
lösche den Ordner, wenn du ihn nicht mehr brauchst. Fügst du die Integration
wieder hinzu, ist der Verlauf wieder da.

## Sprachen

Englisch und Deutsch. Neue Sprachen: siehe [TRANSLATING.md](TRANSLATING.md).

## Lizenz

MIT – siehe [LICENSE](LICENSE). Fremde Software und Dienste: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Kartendaten © OpenStreetMap-Mitwirkende.
