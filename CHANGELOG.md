# Changelog

## Unreleased

- Fix: the settings page (and sometimes the whole sidebar page) stayed empty
  when Home Assistant created the page before its code was ready.
- Sidebar page fills the whole height; tab names in normal spelling; no page
  title next to the tabs.
- "Where is…?": the button "show everyone and follow" is gone.
- "Location history": reload button at the bottom right with "Reload in … s",
  like "Where is…?". Both maps reload every 30 seconds by default; the interval
  can be changed and automatic reloading switched off. Then the bottom shows how
  current the data is ("2 minutes ago", "14:05", "yesterday 14:05", date and
  time); the button still reloads on click.

---

- Fehler behoben: Die Einstellungsseite (manchmal die ganze Seite in der
  Seitenleiste) blieb leer, wenn Home Assistant die Seite anlegte, bevor ihr Code
  bereit war.
- Die Seite in der Seitenleiste füllt die ganze Höhe; Reiternamen in normaler
  Schreibweise; kein Seitentitel mehr neben den Reitern.
- „Wo ist…?“: Der Knopf „Alle zeigen und mitverfolgen“ ist weg.
- „Standortverlauf“: Neu-laden-Knopf unten rechts mit „Neu laden in … s“, wie bei
  „Wo ist…?“. Beide Karten laden standardmäßig alle 30 Sekunden neu; der Abstand
  lässt sich ändern und das automatische Neuladen abschalten. Dann steht unten,
  auf welchem Stand die Daten sind („vor 2 Minuten“, „14:05 Uhr“, „gestern
  14:05 Uhr“, Datum und Uhrzeit); der Knopf lädt weiterhin auf Klick neu.

## 0.2.0

- New page in the sidebar ("Whereabouts", German "Standorte") with the tabs
  "Where is…?", "Location history" and "Settings". Tab names turn into symbols
  when there is little room. The sidebar entry can be switched off; the cards
  for dashboards stay.
- New settings page instead of the options dialog: table of contents, an ⓘ with
  an explanation next to every setting, confirmation before anything is deleted
  or overwritten. Native Home Assistant controls, follows the theme.
- Personal settings per user (views, persons with order, name, colour, picture
  upload, map, zones, display). Administrators set the defaults and can lock each
  category for all non-admins (with exceptions) or for selected users.
- Rights per user: who sees whom live, whose history they may see and delete;
  rules for everybody plus own rights per user. The former option "Who may see
  and delete the history" is taken over.
- Cards in dashboards use the viewer's personal settings; what is set in a card
  still wins for that card. Their look is unchanged.
- Import with preview and confirmation, export of a period, diagnostics per
  person (trackers, geocoded-location sensor, stored days).
- Settings are stored in `.storage/whereabouts.settings` (part of every backup).
- Map style chosen with small example maps (Stuttgart); link to request a free
  CARTO key next to the key field. If a map service delivers no map at all (e.g.
  the CARTO key was blocked), the maps switch by themselves: CARTO → Esri →
  OpenStreetMap; administrators see a short hint on the map.

---

- Neue Seite in der Seitenleiste („Standorte“, englisch „Whereabouts“) mit den
  Reitern „Wo ist…?“, „Standortverlauf“ und „Einstellungen“. Bei wenig Platz
  werden die Reiternamen zu Symbolen. Der Eintrag lässt sich abschalten; die
  Karten für Dashboards bleiben.
- Neue Einstellungsseite statt des Optionsdialogs: Inhaltsverzeichnis, neben jeder
  Einstellung ein ⓘ mit Erklärung, Bestätigung vor allem, was etwas löscht oder
  überschreibt. Bedienelemente von Home Assistant, folgt dem Theme.
- Persönliche Einstellungen pro Benutzer (Ansichten, Personen mit Reihenfolge,
  Name, Farbe, Bild-Upload, Karte, Zonen, Anzeige). Administratoren legen den
  Standard fest und können jede Kategorie für alle Nicht-Admins (mit Ausnahmen)
  oder für ausgewählte Benutzer sperren.
- Rechte pro Benutzer: wer wen live sieht, wessen Verlauf sehen und löschen darf;
  Regeln für alle plus eigene Rechte pro Benutzer. Die bisherige Option „Wer den
  Verlauf sehen und löschen darf“ wird übernommen.
- Karten in Dashboards nutzen die persönlichen Einstellungen des Betrachters; was
  in einer Karte eingestellt ist, hat für diese Karte weiter Vorrang. Ihr
  Aussehen bleibt gleich.
- Import mit Vorschau und Bestätigung, Export eines Zeitraums, Diagnose pro Person
  (Tracker, Sensor „Geokodierter Standort“, gespeicherte Tage).
- Die Einstellungen liegen in `.storage/whereabouts.settings` (Teil jedes Backups).
- Kartenstil mit kleinen Beispielkarten (Stuttgart) wählen; neben dem
  Schlüsselfeld ein Link, um einen kostenlosen CARTO-Schlüssel zu beantragen.
  Liefert ein Kartendienst gar keine Karte mehr (z. B. CARTO-Schlüssel gesperrt),
  wechseln die Karten von selbst: CARTO → Esri → OpenStreetMap; Administratoren
  sehen einen kurzen Hinweis auf der Karte.

## 0.1.1

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
