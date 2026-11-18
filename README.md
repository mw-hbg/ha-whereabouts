# Whereabouts

[English](#english) · [Deutsch](#deutsch)

[![Open in the Marketplace](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=mw-hbg&repository=ha-whereabouts&category=integration)
[![Add integration](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=whereabouts)
[![Test](https://github.com/mw-hbg/ha-whereabouts/actions/workflows/test.yaml/badge.svg)](https://github.com/mw-hbg/ha-whereabouts/actions/workflows/test.yaml)
[![Release](https://img.shields.io/github/v/release/mw-hbg/ha-whereabouts?label=release)](https://github.com/mw-hbg/ha-whereabouts/releases)
![Marketplace: add from link](https://img.shields.io/badge/Marketplace-add%20from%20link-41BDF5)
![Stage: experimental](https://img.shields.io/badge/stage-experimental-orange)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/mwhbg)

## English

Live map and long-term location history for the persons in Home Assistant –
one integration with its own page in the sidebar and two dashboard cards,
everything set up in the UI.

> **Status: in development (0.x)** – experimental until version 1.0.

### What it does

| | |
|---|---|
| **Sidebar page** | "Where is…?", "Location history" and a settings page in one place – like the Energy or Logbook page. Each user chooses which tabs they see. |
| **"Where is…?" card** | All persons live on a full-screen map: place, "since", address when on the way, last fix. The map follows everyone until you move it yourself. |
| **"Location history" card** | Where a person was on a chosen day – as a route on the map or as a table. Stays instead of a cloud of points ("Home 08:00 – 15:03"), addresses for places on the way, deleting single entries. |
| **Recording** | Stores a stay whenever a recorded person moves; kept until *you* delete it – not only the 10 days of the Home Assistant recorder. |
| **Import and export** | CSV and GPX. Your history is never locked in. |

Both maps also exist as cards for your own dashboards. You can use Whereabouts
with or without the sidebar entry.

### Why Whereabouts?

There are good projects for parts of this – e.g. the
[Location Timeline Card](https://github.com/konewka17/timeline_card) (a timeline of
the recorder history), [GPS Timeline](https://github.com/iamyacin/gps-timeline)
(unlimited point storage) and [Dawarich](https://dawarich.app) (a separate
server). Whereabouts puts the whole thing into **one integration**:

- **Live map and history together** – one installation, the same look in both cards
  (a person gets the same colour automatically).
- **Stays instead of raw points** – consecutive points at the same place become
  one entry with a time span; inside a zone the exact position does not matter.
- **Addresses that are right** – the geocoded location of the Companion app is only
  used when its position matches the point; OpenStreetMap fills the gaps.
- **Settings per user, rights per user** – everybody chooses their own colours,
  names, pictures and views; the administrator sets defaults, locks categories
  and decides who may see and delete whose history (e.g. children only their own person).
- **Clean data** – plain CSV files in your configuration folder, part of every
  backup; import of CSV, GPX and old archives, export as CSV and GPX.
- **Privacy first** – nothing is recorded until you choose persons; nothing
  leaves Home Assistant except, for places on the way without an address from the
  Companion app, a request to OpenStreetMap (can be switched off).

### Installation

Requires Home Assistant **2026.11** or newer. Whereabouts is installed through the
**Marketplace** (built into Home Assistant since 2026.11). Click **Open in the Marketplace** above, or by hand:

1. **Settings → Marketplace → Add from link** → `https://github.com/mw-hbg/ha-whereabouts`.
   The first time, Home Assistant asks you to connect GitHub (a code you enter on GitHub; read-only).
2. Open **Whereabouts** → **Install**. A restart is usually not needed – if it is,
   a repair notice says so (**Settings → System → Repairs**).
3. Click **Add integration** above, or **Settings → Devices & services → + Add integration → Whereabouts**.

Updates appear in the Marketplace and under **Settings → Updates**; after an
update, restart Home Assistant when the repair notice asks for it.

### Set-up

**For addresses:** switch on the sensor **Geocoded location** in the Home Assistant
Companion app on every phone (app settings → Companion app → Sensors / Manage
sensors → Geocoded location). Without it, addresses come only from OpenStreetMap.

The first dialog asks for the cards, the persons whose history is recorded
(none by default) and the address source. Then open **Whereabouts** in the
sidebar (German: **Standorte**) → **Settings**. Next to every setting an ⓘ explains
what it does; actions that delete or overwrite something ask first.

| Category | Who | What you can set |
|---|---|---|
| Views | every user | which tabs are shown, which one opens first |
| Persons | every user | who appears, order, display name, colour, picture (address or upload); warning for similar colours |
| Map | every user | light/dark, map style with example maps (Esri, OpenStreetMap, CARTO; automatic fallback if a service fails), where coordinates open (Google Maps, Apple Maps, OpenStreetMap, Waze, HERE; choice of apps on phones) |
| Zones, "Where is…?" display, "Location history" display | every user (advanced) | zone colours, info bar, status bar, accuracy circle, following, start view, legend, reload |
| Users and rights | administrators | rules for everybody (see live / see history / delete history: all, own person, nobody) and own rights per user |
| Sidebar and cards | administrators | sidebar entry on/off, name, icon; cards on/off and their persons; CARTO key (free, [request here](https://carto.com/basemaps/apikey/); every installation uses its own key) |
| Recording | administrators | recorded persons, store interval (60 s), "same place" radius (50 m), deleting old history (default: never) |
| Addresses | administrators | Companion app (geocoded location), otherwise OpenStreetMap (default) · only Companion app · only OpenStreetMap · none; sensor per person |
| Import and export | export: everybody (own rights), import: administrators | CSV / GPX download for a period; import with preview |
| Diagnostics | administrators | trackers, geocoded-location sensor and stored days per person |

Administrators switch between **My settings** and **Default for everyone**. Each
personal category can be locked – for all non-admins (with exceptions) or for
selected users; locked users see it greyed out with the defaults.

**Note on "see live":** this limits what Whereabouts shows. Every logged-in user
can in principle see the persons' positions elsewhere in Home Assistant too; the
**history**, however, is only handed out to users who may see it.

All settings are stored in `.storage/whereabouts.settings` and are part of every
Home Assistant backup, like the history.

The options under **Settings → Devices & services → Whereabouts → Configure**
still work and link to the settings page.

**Wi-Fi trackers (optional):** A person in Home Assistant can have several
trackers, e.g. the Companion app (GPS) and a router or ARP-scan tracker for the
home network. Add them to the person under **Settings → People**; Home Assistant
then combines them (at home the stationary tracker answers faster, away the GPS).
Whereabouts uses exactly this person state, so no extra setting is needed. Only
watch your **own home network** this way and only add devices that also run the
Companion app – otherwise a phone lying at home makes the person "home".

### The cards

Add them like any other card: **Edit dashboard → + Add card → "Where is…?"** or
**"Location history"**. A card uses the viewer's settings from the settings page;
what you set in the card's editor applies to this card only and wins. For one card
filling the page use a view of type **Panel**.

| Setting | "Where is…?" | "Location history" |
|---|---|---|
| Title | optional | optional |
| Persons | as allowed and chosen on the settings page (or fewer) | same, only persons with a history you may see |
| Per person (this card only) | display name, colour, picture, address sensor | display name, colour, picture |
| Map | light/dark/like Home Assistant, Esri / OpenStreetMap / CARTO (own key), coordinates open in Google Maps (default), Apple Maps, OpenStreetMap, Waze or HERE; on phones and tablets a choice of apps | light/dark/like Home Assistant, Esri / OpenStreetMap / CARTO |
| Zones | on/off, colour of Home and of the other zones, names from zoom | same |
| Display | info bar, status bar, GPS accuracy, follow at start, reload interval | start with map or table, legend, download buttons, auto reload (today only) |
| Height | automatic (full height in a panel view), full screen or fixed | same |

Without a colour, a person gets the same colour in both cards automatically.
In YAML the same looks like this:

```yaml
type: custom:whereabouts-live-card
persons: [person.alex, person.sam]
person_settings:
  person.alex: { color: "#378ADD" }
  person.sam: { name: Sam, color: "#D6409F", picture: /local/pictures/sam.jpg }
tiles: esri          # esri | osm | carto (then carto_api_key: ...)
map_style: auto      # auto | light | dark
map_link: google     # google | apple | osm | waze | here | none
map_link_choice: true
zone_color_home: "#2E7D32"
zone_color: "#EF6C00"
```

### Privacy and security

- The history is stored only in `<config>/whereabouts/history/` – outside `www/`,
  so it is **not** reachable via `/local/` or any other web address.
- The cards read the history only through Home Assistant's authenticated
  connection; every request is checked against the logged-in user.
- Addresses come first from the Companion app. Only if it has no fitting address,
  the coordinates of that place are sent to `nominatim.openstreetmap.org` (max. one request per 1.5 s,
  results cached locally), as its
  [usage policy](https://operations.osmfoundation.org/policies/nominatim/) requires.
- The live map shows only what every Home Assistant user can see anyway.

### Connections to the outside

| What | From where | Sends |
|---|---|---|
| Recording, history, import, export | Home Assistant | nothing – works fully local |
| Addresses from the Companion app (geocoded location) | Home Assistant | nothing – the app already sent them |
| Addresses from OpenStreetMap (default: only if the Companion app has none; can be switched off) | Home Assistant → `nominatim.openstreetmap.org` | coordinates of places on the way |
| Map tiles | **your browser / app** → Esri, OpenStreetMap or CARTO (as chosen in the card) | the visible map area (like any online map) |
| Map library (Leaflet) | Home Assistant itself | nothing – bundled, no CDN |

Without internet the recording and the history keep working; only the map
background stays empty.

### Import and export

Import: **Configure → Import history**. Supported are the Whereabouts CSV
format, GPX (tracks, routes, waypoints) and the daily files of the original
script version (single file or ZIP). Existing entries are skipped, or whole days
replaced if you choose so. The format is described in [FORMAT.md](FORMAT.md#english).

Export: from the history card (CSV or GPX), or directly via
`/api/whereabouts/export?person=person.x&from=2026-01-01&to=2026-01-31&format=csv`.

### Uninstalling

Remove the integration under **Devices & services**, then in the **Marketplace**. The recorded
history is **kept on purpose** in `<config>/whereabouts/` – delete the folder if
you don't need it any more. If you add the integration again, the history is
there again.

### Languages

English and German. New languages: see [TRANSLATING.md](TRANSLATING.md).

### Support

Everything I build is free and stays free. If this project is useful to you, you're welcome to buy me a coffee – entirely voluntary, nothing in return, just a thank-you that keeps me motivated. ☕ Note: payments to a private person are not tax-deductible donations.

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy_me_a_coffee-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/mwhbg)

### License

MIT – see [LICENSE](LICENSE). Third-party software and services: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Map data © OpenStreetMap contributors.

## Deutsch

Live-Karte und dauerhafter Standortverlauf für die Personen in Home Assistant –
eine Integration mit eigener Seite in der Seitenleiste und zwei Dashboard-Karten,
alles in der Oberfläche eingerichtet.

> **Stand: in Entwicklung (0.x)** – experimentell bis Version 1.0.

### Was es kann

| | |
|---|---|
| **Seite in der Seitenleiste** | „Wo ist…?“, „Standortverlauf“ und eine Einstellungsseite an einem Ort – wie die Seiten Energie oder Logbuch. Jeder Benutzer wählt, welche Reiter er sieht. |
| **Karte „Wo ist…?“** | Alle Personen live auf einer bildschirmfüllenden Karte: Ort, „seit“, Adresse unterwegs, letzte Ortung. Die Karte folgt allen, bis man sie selbst verschiebt. |
| **Karte „Standortverlauf“** | Wo eine Person an einem gewählten Tag war – als Route auf der Karte oder als Tabelle. Aufenthalte statt Punktwolke („Zuhause 08:00 – 15:03“), Adressen für Orte unterwegs, einzelne Einträge löschen. |
| **Aufzeichnung** | Speichert einen Aufenthalt, sobald sich eine aufgezeichnete Person bewegt; bleibt erhalten, bis *du* ihn löschst – nicht nur die 10 Tage des Home-Assistant-Recorders. |
| **Import und Export** | CSV und GPX. Deine Daten sind nie eingesperrt. |

Beide Karten gibt es auch für eigene Dashboards. Whereabouts lässt sich mit oder
ohne Eintrag in der Seitenleiste nutzen.

### Warum Whereabouts?

Für Teile davon gibt es gute Projekte – z. B. die
[Location Timeline Card](https://github.com/konewka17/timeline_card) (Zeitachse aus dem
Recorder-Verlauf), [GPS Timeline](https://github.com/iamyacin/gps-timeline)
(unbegrenzte Punktspeicherung) und [Dawarich](https://dawarich.app) (eigener
Server). Whereabouts bringt das Ganze in **eine Integration**:

- **Live-Karte und Verlauf zusammen** – eine Installation, beide Karten im
  gleichen Stil (eine Person bekommt automatisch dieselbe Farbe).
- **Aufenthalte statt Rohpunkte** – aufeinanderfolgende Punkte am selben Ort
  werden ein Eintrag mit Zeitraum; in einer Zone zählt die genaue Position nicht.
- **Adressen, die stimmen** – der geokodierte Standort der Companion App wird nur
  genommen, wenn seine Position zum Punkt passt; OpenStreetMap füllt die Lücken.
- **Einstellungen und Rechte pro Benutzer** – jeder wählt seine eigenen Farben,
  Namen, Bilder und Ansichten; der Administrator legt Standards fest, sperrt
  Kategorien und bestimmt, wer wessen Verlauf sehen und löschen darf (z. B.
  Kinder nur ihre eigene Person).
- **Saubere Daten** – einfache CSV-Dateien im Konfigurationsordner, Teil jeder
  Sicherung; Import von CSV, GPX und alten Archiven, Export als CSV und GPX.
- **Datenschutz zuerst** – aufgezeichnet wird erst, wenn du Personen auswählst;
  nichts verlässt Home Assistant außer – für Orte unterwegs ohne Adresse aus der
  Companion App – eine Anfrage an OpenStreetMap (abschaltbar).

### Installation

Benötigt Home Assistant **2026.11** oder neuer. Whereabouts wird über den
**Marketplace** installiert (seit 2026.11 fest in Home Assistant eingebaut). Oben auf **Open in the Marketplace** klicken, oder von Hand:

1. **Einstellungen → Marketplace → Über Link hinzufügen** → `https://github.com/mw-hbg/ha-whereabouts`.
   Beim ersten Mal fragt Home Assistant nach einer Verbindung zu GitHub (ein Code, den du auf GitHub eingibst; nur lesend).
2. **Whereabouts** öffnen → **Installieren**. Ein Neustart ist meist nicht nötig – falls doch,
   meldet es ein Reparatur-Hinweis (**Einstellungen → System → Reparaturen**).
3. Oben auf **Add integration** klicken, oder **Einstellungen → Geräte & Dienste → + Integration hinzufügen → Whereabouts**.

Updates erscheinen im Marketplace und unter **Einstellungen → Updates**; nach einem
Update Home Assistant neu starten, wenn der Reparatur-Hinweis darum bittet.

### Einrichtung

**Für Adressen:** In der Home-Assistant-Companion-App auf jedem Smartphone den
Sensor **Geokodierter Standort** einschalten (Einstellungen der App → Companion App
→ Sensoren bzw. Sensoren verwalten → Geokodierter Standort). Ohne ihn kommen
Adressen nur von OpenStreetMap.

Der erste Dialog fragt nach den Karten, den Personen, deren Verlauf
aufgezeichnet wird (standardmäßig keine), und der Adressquelle. Danach in der
Seitenleiste **Standorte** (englisch: **Whereabouts**) → **Einstellungen** öffnen.
Neben jeder Einstellung erklärt ein ⓘ, was sie bewirkt; alles, was etwas löscht
oder überschreibt, fragt vorher nach.

| Kategorie | Wer | Was man einstellt |
|---|---|---|
| Ansichten | jeder Benutzer | welche Reiter angezeigt werden, welcher zuerst erscheint |
| Personen | jeder Benutzer | wer erscheint, Reihenfolge, Anzeigename, Farbe, Bild (Adresse oder hochladen); Warnung bei ähnlichen Farben |
| Karte | jeder Benutzer | hell/dunkel, Kartenstil mit Beispielkarten (Esri, OpenStreetMap, CARTO; automatischer Ersatz, wenn ein Dienst ausfällt), wohin Koordinaten führen (Google Maps, Apple Karten, OpenStreetMap, Waze, HERE; am Handy mit App-Auswahl) |
| Zonen, Anzeige „Wo ist…?“, Anzeige „Standortverlauf“ | jeder Benutzer (erweitert) | Zonenfarben, Infoleiste, Statusleiste, Genauigkeitskreis, Folgen, Startansicht, Legende, Neuladen |
| Benutzer und Rechte | Administratoren | Regeln für alle (live sehen / Verlauf sehen / Verlauf löschen: alle, eigene Person, niemand) und eigene Rechte pro Benutzer |
| Seitenleiste und Karten | Administratoren | Eintrag an/aus, Name, Symbol; Karten an/aus und ihre Personen; CARTO-Schlüssel (kostenlos, [hier beantragen](https://carto.com/basemaps/apikey/); jede Installation nutzt ihren eigenen) |
| Aufzeichnung | Administratoren | aufgezeichnete Personen, Speicherabstand (60 s), Umkreis „derselbe Ort“ (50 m), alten Verlauf löschen (Standard: nie) |
| Adressen | Administratoren | Companion App (Geokodierter Standort), sonst OpenStreetMap (Standard) · nur Companion App · nur OpenStreetMap · keine; Sensor pro Person |
| Import und Export | Export: jeder (eigene Rechte), Import: Administratoren | CSV-/GPX-Download für einen Zeitraum; Import mit Vorschau |
| Diagnose | Administratoren | Tracker, Sensor „Geokodierter Standort“ und gespeicherte Tage pro Person |

Administratoren wechseln zwischen **Meine Einstellungen** und **Standard für
alle**. Jede persönliche Kategorie lässt sich sperren – für alle Nicht-Admins
(mit Ausnahmen) oder für ausgewählte Benutzer; gesperrte Benutzer sehen sie
ausgegraut mit den Standardwerten.

**Hinweis zu „live sehen“:** Das begrenzt, was Whereabouts anzeigt. Jeder
angemeldete Benutzer kann die Positionen der Personen grundsätzlich auch anderswo
in Home Assistant sehen; den **Verlauf** gibt Whereabouts dagegen nur an
Berechtigte heraus.

Alle Einstellungen liegen in `.storage/whereabouts.settings` und sind – wie der
Verlauf – Teil jedes Home-Assistant-Backups.

Die Optionen unter **Einstellungen → Geräte & Dienste → Whereabouts →
Konfigurieren** funktionieren weiter und verweisen auf die Einstellungsseite.

**WLAN-Tracker (optional):** Eine Person in Home Assistant kann mehrere Tracker
haben, z. B. die Companion App (GPS) und einen Router- oder ARP-Scan-Tracker fürs
Heimnetz. Sie werden unter **Einstellungen → Personen** der Person zugeordnet;
Home Assistant führt sie dann zusammen (zu Hause meldet der feste Tracker
schneller, unterwegs zählt GPS). Whereabouts nutzt genau diesen Personenstatus,
eine eigene Einstellung ist nicht nötig. Auf diese Weise nur das **eigene
Heimnetz** überwachen und nur Geräte eintragen, auf denen auch die Companion App
läuft – sonst gilt eine Person als „zu Hause“, nur weil ihr Handy dort liegt.

### Die Karten

Hinzufügen wie jede andere Karte: **Dashboard bearbeiten → + Karte hinzufügen →
„Wo ist…?“** oder **„Standortverlauf“**. Eine Karte nutzt die Einstellungen
des Betrachters von der Einstellungsseite; was man im Editor der Karte einstellt,
gilt nur für diese Karte und hat Vorrang. Für eine Karte, die die ganze Seite
füllt, eine Ansicht vom Typ **Panel** verwenden.

| Einstellung | „Wo ist…?“ | „Standortverlauf“ |
|---|---|---|
| Titel | optional | optional |
| Personen | wie auf der Einstellungsseite erlaubt und gewählt (oder weniger) | ebenso, nur Personen mit Verlauf, den man sehen darf |
| Pro Person (nur diese Karte) | Anzeigename, Farbe, Bild, Adress-Sensor | Anzeigename, Farbe, Bild |
| Karte | hell/dunkel/wie Home Assistant, Esri / OpenStreetMap / CARTO (eigener Schlüssel), Koordinaten öffnen in Google Maps (Standard), Apple Karten, OpenStreetMap, Waze oder HERE; auf Handy und Tablet mit App-Auswahl | hell/dunkel/wie Home Assistant, Esri / OpenStreetMap / CARTO |
| Zonen | an/aus, Farbe von Zuhause und der übrigen Zonen, Namen ab Zoom | ebenso |
| Anzeige | Infoleiste, Statusleiste, GPS-Genauigkeit, beim Start folgen, Neuladen | Start mit Karte oder Tabelle, Legende, Download-Knöpfe, automatisch neu laden (nur heute) |
| Höhe | automatisch (ganze Höhe in einer Panel-Ansicht), ganze Bildschirmhöhe oder fest | ebenso |

Ohne eigene Farbe bekommt eine Person in beiden Karten automatisch dieselbe
Farbe. In YAML sieht das so aus:

```yaml
type: custom:whereabouts-live-card
persons: [person.alex, person.sam]
person_settings:
  person.alex: { color: "#378ADD" }
  person.sam: { name: Sam, color: "#D6409F", picture: /local/bilder/sam.jpg }
tiles: esri          # esri | osm | carto (dann carto_api_key: ...)
map_style: auto      # auto | light | dark
map_link: google     # google | apple | osm | waze | here | none
map_link_choice: true
zone_color_home: "#2E7D32"
zone_color: "#EF6C00"
```

### Datenschutz und Sicherheit

- Der Verlauf liegt nur in `<config>/whereabouts/history/` – außerhalb von `www/`,
  also **nicht** über `/local/` oder eine andere Web-Adresse erreichbar.
- Die Karten lesen den Verlauf nur über die angemeldete Home-Assistant-Verbindung;
  jede Anfrage wird gegen den angemeldeten Benutzer geprüft.
- Adressen kommen zuerst aus der Companion App. Nur wenn sie keine passende hat,
  werden die Koordinaten dieses Ortes an `nominatim.openstreetmap.org` geschickt (höchstens eine Anfrage
  pro 1,5 s, Ergebnisse lokal zwischengespeichert), wie es die
  [Nutzungsregeln](https://operations.osmfoundation.org/policies/nominatim/) verlangen.
- Die Live-Karte zeigt nur, was jeder Home-Assistant-Benutzer ohnehin sehen kann.

### Verbindungen nach außen

| Was | Von wo | Sendet |
|---|---|---|
| Aufzeichnung, Verlauf, Import, Export | Home Assistant | nichts – läuft komplett lokal |
| Adressen aus der Companion App (Geokodierter Standort) | Home Assistant | nichts – die App hat sie schon geschickt |
| Adressen von OpenStreetMap (Standard: nur wenn die Companion App keine hat; abschaltbar) | Home Assistant → `nominatim.openstreetmap.org` | Koordinaten von Orten unterwegs |
| Kartenkacheln | **dein Browser / die App** → Esri, OpenStreetMap oder CARTO (je nach Karte) | den sichtbaren Kartenausschnitt (wie jede Online-Karte) |
| Kartenbibliothek (Leaflet) | Home Assistant selbst | nichts – eingebaut, kein CDN |

Ohne Internet laufen Aufzeichnung und Verlauf weiter; nur der Kartenhintergrund
bleibt leer.

### Import und Export

Import: **Konfigurieren → Verlauf importieren**. Unterstützt werden das
Whereabouts-CSV-Format, GPX (Tracks, Routen, Wegpunkte) und die Tagesdateien
der ursprünglichen Skript-Version (einzeln oder als ZIP). Vorhandene Einträge
werden übersprungen oder auf Wunsch ganze Tage ersetzt. Das Format steht in
[FORMAT.md](FORMAT.md#deutsch).

Export: aus der Verlaufskarte (CSV oder GPX) oder direkt über
`/api/whereabouts/export?person=person.x&from=2026-01-01&to=2026-01-31&format=csv`.

### Deinstallieren

Integration unter **Geräte & Dienste** entfernen, danach im **Marketplace**. Der
aufgezeichnete Verlauf bleibt **bewusst erhalten** in `<config>/whereabouts/` –
lösche den Ordner, wenn du ihn nicht mehr brauchst. Fügst du die Integration
wieder hinzu, ist der Verlauf wieder da.

### Sprachen

Englisch und Deutsch. Neue Sprachen: siehe [TRANSLATING.md](TRANSLATING.md).

### Unterstützen

Alles, was ich baue, ist kostenlos und bleibt es auch. Wenn dir dieses Projekt nützt, kannst du mir gern einen Kaffee ausgeben – völlig freiwillig und ohne Gegenleistung, einfach als Dankeschön, das motiviert. ☕ Hinweis: Zahlungen an eine Privatperson sind keine steuerlich absetzbaren Spenden.

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Kaffee_ausgeben-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/mwhbg)

### Lizenz

MIT – siehe [LICENSE](LICENSE). Fremde Software und Dienste: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Kartendaten © OpenStreetMap-Mitwirkende.
