# Changelog

## Unreleased

- Addresses: default is now "Companion app (geocoded location), otherwise
  OpenStreetMap". Clearer names for all choices; set-up, options and README say
  that the sensor "Geocoded location" must be switched on in the Companion app.
- Options: one section per card ("Where is…?", "Location history", each with
  on/off and shown persons) plus "Recording". Open cards follow changes at once
  (no reload). Hiding a person keeps their history.
- Cards: per person also a picture (URL); zones with their own colours in both
  cards.
- "Where is…?": tapping a pin no longer moves or zooms the map; an info window
  slides from the info bar to the pin (place, since, last seen, coordinates).
  Pins lying on top of each other become one pin with all pictures. Coordinates
  open in Google Maps (default), Apple Maps, OpenStreetMap, Waze or HERE; on
  phones and tablets a choice of apps. Clearer "show everyone and follow" button.
- "Location history": zones on the map, reload button with countdown ring
  (automatic reload for today), entry window in two rows with the delete button
  at the bottom right.
- Only entries the user may delete can be selected in the table.
- Options of each card show which persons the other card shows, for comparison.
  The recording options explain Wi-Fi trackers (home network only).
- Card editor warns when two persons have (nearly) the same colour.
- Fix: the first position update of a person after start could be skipped.

---

- Adressen: Standard ist jetzt „Companion App (Geokodierter Standort), sonst
  OpenStreetMap“. Klarere Namen für alle Möglichkeiten; Einrichtung, Optionen
  und README sagen, dass in der Companion App der Sensor „Geokodierter Standort“
  eingeschaltet sein muss.
- Optionen: ein Bereich je Karte („Wo ist…?“, „Standortverlauf“, jeweils an/aus
  und angezeigte Personen) sowie „Aufzeichnung“. Offene Karten übernehmen
  Änderungen sofort (ohne Neuladen). Ausblenden behält den Verlauf.
- Karten: pro Person zusätzlich ein Bild (URL); Zonen mit eigenen Farben in
  beiden Karten.
- „Wo ist…?“: Ein Tipp auf eine Stecknadel bewegt und zoomt die Karte nicht mehr;
  ein Infofenster gleitet von der Infoleiste zur Stecknadel (Ort, seit, zuletzt
  gesehen, Koordinaten). Übereinanderliegende Stecknadeln werden eine mit allen
  Bildern. Koordinaten öffnen in Google Maps (Standard), Apple Karten,
  OpenStreetMap, Waze oder HERE; auf Handy und Tablet mit App-Auswahl.
  Klarerer Knopf „Alle zeigen und mitverfolgen“.
- „Standortverlauf“: Zonen auf der Karte, Neu-laden-Knopf mit Countdown-Ring
  (automatisch neu laden für heute), Eintragsfenster zweizeilig mit dem
  Löschknopf unten rechts.
- In der Tabelle lassen sich nur Einträge auswählen, die man löschen darf.
- Die Optionen jeder Karte zeigen zum Vergleich, welche Personen die andere
  Karte anzeigt. Die Aufzeichnungs-Optionen erklären WLAN-Tracker (nur Heimnetz).
- Der Karten-Editor warnt, wenn zwei Personen (fast) dieselbe Farbe haben.
- Fehler behoben: Die erste Positionsmeldung einer Person nach dem Start konnte
  übersprungen werden.

## 0.1.0

- First version: recording of the location history (stays, addresses from the
  phone or OpenStreetMap, day change at midnight), WebSocket API with permissions
  per user, import (Whereabouts CSV, GPX, daily files of the original script
  version, also as ZIP) and export (CSV, GPX), set-up and options in the UI,
  English and German.
- The two cards "Where is…?" (live map) and "Location history" (route and
  table, delete, download as CSV/GPX) with a visual editor: persons, names,
  colours, map style, display options, height. Leaflet is bundled – nothing is
  loaded from a CDN.

---

- Erste Version: Aufzeichnung des Standortverlaufs (Aufenthalte, Adressen vom
  Handy oder von OpenStreetMap, Tageswechsel um Mitternacht), WebSocket-Schnittstelle
  mit Rechten pro Benutzer, Import (Whereabouts-CSV, GPX, Tagesdateien der
  ursprünglichen Skript-Version, auch als ZIP) und Export (CSV, GPX), Einrichtung
  und Optionen in der Oberfläche, Englisch und Deutsch.
- Die beiden Karten „Wo ist…?“ (Live-Karte) und „Standortverlauf“ (Route und
  Tabelle, Löschen, Download als CSV/GPX) mit grafischem Editor: Personen, Namen,
  Farben, Kartenstil, Anzeige-Optionen, Höhe. Leaflet ist eingebaut – nichts wird
  von einem CDN geladen.
