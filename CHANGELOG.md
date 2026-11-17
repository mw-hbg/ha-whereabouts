# Changelog

## Unreleased

- Addresses: default is now "Companion app (geocoded location), otherwise
  OpenStreetMap". Clearer names for all choices; set-up, options and README say
  that the sensor "Geocoded location" must be switched on in the Companion app.
- New option "Show these persons in the cards" in the integration: applies to
  both cards, open cards follow changes at once (no reload). Each card can still
  show fewer persons. Hiding a person keeps their history.
- Only entries the user may delete can be selected in the table.

---

- Adressen: Standard ist jetzt „Companion App (Geokodierter Standort), sonst
  OpenStreetMap“. Klarere Namen für alle Möglichkeiten; Einrichtung, Optionen
  und README sagen, dass in der Companion App der Sensor „Geokodierter Standort“
  eingeschaltet sein muss.
- Neue Option „Diese Personen in den Karten anzeigen“ in der Integration: gilt
  für beide Karten, offene Karten übernehmen Änderungen sofort (ohne Neuladen).
  Jede Karte kann weiterhin weniger Personen zeigen. Ausblenden behält den Verlauf.
- In der Tabelle lassen sich nur Einträge auswählen, die man löschen darf.

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
