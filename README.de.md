# Whereabouts

[English](README.md) · **Deutsch**

Live-Karte und dauerhafter Standortverlauf für die Personen in Home Assistant –
eine Integration, zwei Karten, alles in der Oberfläche eingerichtet.

> **Stand: in Entwicklung (0.x).** Aufzeichnung, Verlaufs-Schnittstelle sowie Import
> und Export sind fertig und getestet; die beiden Karten folgen in den nächsten Schritten.

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

- **Live-Karte und Verlauf zusammen** – Personen, Namen und Farben einmal
  einstellen, beide Karten sehen gleich aus.
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

1. HACS → ⋮ → **Benutzerdefinierte Repositories** → `https://github.com/mw-hbg/ha-whereabouts`, Typ **Integration**.
2. **Whereabouts** herunterladen, Home Assistant neu starten.
3. **Einstellungen → Geräte & Dienste → Integration hinzufügen → Whereabouts**.

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

## Datenschutz und Sicherheit

- Der Verlauf liegt nur in `<config>/whereabouts/history/` – außerhalb von `www/`,
  also **nicht** über `/local/` erreichbar. Die Dateien kann nur Home Assistant lesen.
- Die Karten lesen den Verlauf nur über die angemeldete Home-Assistant-Verbindung;
  jede Anfrage wird gegen den angemeldeten Benutzer geprüft.
- OpenStreetMap ist standardmäßig aus. Eingeschaltet werden die Koordinaten von
  Orten unterwegs an `nominatim.openstreetmap.org` geschickt (höchstens eine Anfrage
  pro 1,5 s, Ergebnisse lokal zwischengespeichert), wie es die
  [Nutzungsregeln](https://operations.osmfoundation.org/policies/nominatim/) verlangen.
- Die Live-Karte zeigt nur, was jeder Home-Assistant-Benutzer ohnehin sehen kann.

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

MIT – siehe [LICENSE](LICENSE). Kartendaten © OpenStreetMap-Mitwirkende.
