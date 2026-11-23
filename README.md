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

Set-up asks in two steps: first which persons Whereabouts works with (all are
ticked; everywhere else only these can be chosen later), whether you want an
entry in the sidebar and the address source; then whose history is recorded
(chosen from the first step). Then open **Whereabouts** in the
sidebar (German: **Standorte**) → **Settings**. Next to every setting an ⓘ explains
what it does; actions that delete or overwrite something ask first.

| Category | Who | What you can set |
|---|---|---|
| Views | every user | which views the Whereabouts dashboard shows, the start view (light or dark always follows Home Assistant) |
| Persons | every user | who appears, order, display name, colour, profile picture (drop or choose a picture, or load one from the internet, and crop it in a circle – stored as 256 × 256), in which card (both, only "Where is…?", only "Location history"); warnings for similar colours and colours that are hard to see on the map |
| Map | every user | map style (Esri, OpenStreetMap, CARTO, each with a link to examples; automatic fallback if a service fails), CARTO styles per map for light and dark mode (pick a dark style for light as well for an always dark map), the CARTO key ("API ✓" when it works), preferred map and – on phones and tablets – which map apps are offered (default: Apple Maps and Google Maps; never Apple Maps on Android; one app left = opens directly) |
| Zones, "Where is…?" display, "Location history" display | every user (advanced) | in which card zones are shown, zone colours, choose and colour single zones, recalculating the zones in the stored data (administrators), info bar, status bar, accuracy circle, following, start view (route, heat map or table), start period (today, last 3 or 7 days, last 4 weeks), legend, hiding the points of long routes (from 400 entries), automatic refresh and refresh interval |
| Persons in Whereabouts | administrators | which Home Assistant persons Whereabouts works with at all |
| Users | administrators, only when there are other users | one table: rules for everybody (see live / see history / delete history: all persons, own person, nobody), own rights per user, settings view, synchronising, "Edit" for the standard or a user; technical users (e.g. the MQTT user) hidden |
| Dashboard | administrators | hide in the sidebar, name, icon |
| Recording | administrators | recorded persons; accuracy and keeping: store interval (60 s), "same place" radius (50 m), deleting old history (default: never; the confirmation says how many days disappear tonight) |
| Addresses | administrators | address source: Companion app, otherwise OpenStreetMap (default) · only Companion app · only OpenStreetMap · none; distance up to which the phone's address is used; address sensor per person (found automatically, a warning when there is none) |
| Import and export | export: everybody (own rights), import: administrators | "Export data" (day or period, persons, CSV/GPX, several files as ZIP); import that merges into gaps of existing days (or skips or replaces them) with a preview per day, format help and a prompt for converting other apps' data (also Google Maps Timeline) with an AI assistant; "Maintain stored data" (administrators): adapt data to the recording rules, fetch missing addresses |
| Diagnostics | administrators | trackers, geocoded-location sensor and stored days per person |

**Own values and the standard:** a blue dot marks a setting with an own value
(hovering shows what the standard would be); the arrow next to it goes back to
the standard, and for 30 seconds **Restore** brings the value back. **Reset to
standard** sets a whole category to the built-in values (greyed out when there is
nothing to reset; afterwards 30 seconds **Restore own values**).

**More users:** everything about other users only appears when there is at least
one user who is not an administrator. Then the category **Users** shows one table
with the rules and settings for all users (the standard) and every user: rights,
what applies (standard, own settings, synchronised, fixed settings), whether they
see the settings view and whether they are **synchronised with the
administrator's settings**. **Edit** switches the page to that user's settings
(or the standard) until **Done**. **Set for all users** turns your values of a
category into the standard. A category can be fixed for all users (with
exceptions) or selected users; single settings can be fixed for one user. Fixed
settings are greyed out for the user. When a new user appears, the next
administrator who opens the settings is asked which settings the user starts with
(like mine once, like mine synchronised, the built-in values, or later – until
then like the administrator) and which rights they get.

**Always a way back to the settings:** the dashboard can be hidden in the sidebar
and administrators can hide the view **Settings**, too. The settings stay
reachable at `/whereabouts/settings`, under **Settings → Devices & services →
Whereabouts → Configure → Open settings**, and – for administrators, while the
dashboard or the settings view is hidden – with a gear above the zoom buttons in
both maps (also in cards on other dashboards).

Switches and selections save at once; text and number fields only with **Save** or
the Enter key. Leaving the page with unsaved fields asks first; unsaved values are
offered again on return. All categories can be folded.

**Note on "see live":** this limits what Whereabouts shows. Every logged-in user
can in principle see the persons' positions elsewhere in Home Assistant too; the
**history**, however, is only handed out to users who may see it.

All settings are stored in `.storage/whereabouts.settings` and are part of every
Home Assistant backup, like the history.

The options under **Settings → Devices & services → Whereabouts → Configure**
still work: open the settings, dashboard (hide in the sidebar, name, icon),
recording, addresses and import.

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
| Persons | as allowed and chosen on the settings page (or fewer); a tick per person on the map hides it until reload | same, only persons with a history you may see; the person buttons hide and show persons |
| Per person (this card only) | display name, colour, picture, address sensor | display name, colour, picture |
| Map | light/dark/like Home Assistant, Esri / OpenStreetMap / CARTO (own key), coordinates open in Google Maps (default), Apple Maps, OpenStreetMap, Waze or HERE; on phones and tablets a choice of apps | light/dark/like Home Assistant, Esri / OpenStreetMap / CARTO |
| Zones | on/off, colour of Home and of the other zones, names from zoom | same |
| Display | info bar with "Show everyone", status bar, GPS accuracy, follow at start, automatic refresh and interval | start with route, heat map or table, start period, legend (with a "Show zones" switch that changes the same setting as the settings page), "Export data" (also as map picture), hiding points of long routes (a note on the map says how many), automatic refresh and interval; a day or any period with grouped suggestions (suggestions without data are left out), route or heatmap |
| Height | automatic (full height in a panel view), full screen or fixed | same |

Without a colour, a person gets the same colour in both cards automatically.
In YAML the same looks like this:

```yaml
type: custom:whereabouts-live-card
persons: [person.alex, person.sam]
person_settings:
  person.alex: { color: "#378ADD" }
  person.sam: { name: Sam, color: "#D6409F", picture: /local/pictures/sam.jpg }
tiles: esri          # esri | osm | carto (key on the settings page)
carto_light: voyager # CARTO: voyager | positron | dark_matter (each also *_nolabels)
carto_dark: dark_matter
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
| Addresses from OpenStreetMap (default: only if the Companion app has none; can be switched off) | Home Assistant → `nominatim.openstreetmap.org` | coordinates of places on the way – also when an administrator starts "Fetch missing addresses" |
| Map tiles | **your browser / app** → Esri, OpenStreetMap or CARTO (as chosen in the card) | the visible map area (like any online map) |
| Map library (Leaflet) | Home Assistant itself | nothing – bundled, no CDN |

Without internet the recording and the history keep working; only the map
background stays empty.

### Import and export

Import: **Settings → Import and export** on the sidebar page (or **Configure →
Import history**). Supported are the Whereabouts CSV
format, GPX (tracks, routes, waypoints) and the daily files of the original
script version (single file or ZIP). By default existing days are merged: only
entries that fall into a gap (a time without a stored stay) are added. You can
also skip days that already have data (only new days are taken) or replace whole
days. Every point gets the Home Assistant zone it lies in (unless the file
already names one), and the recording rules apply to every format: points at the
same place (within the "same place" radius) become one stay, and points on the
way that are closer in time than the store interval are thinned out (a change of
zone is always kept). A preview shows per day what would happen – including how
many points from the file become how many stays and how many are thinned out –
and you tick the days to import. Days outside the period you keep history for
are marked and not ticked; a hint appears if recording is off for the person
(importing still works). What is merged or thinned out is gone for good and the
file itself is not stored, so keep the source file. If stays away have no
address afterwards, **Fetch addresses** gets them. The format is described in
[FORMAT.md](FORMAT.md#english). The prompt for an AI assistant ("Have data from
another app converted") also handles Google Maps Timeline exports (`Timeline.json`
from the phone, older Takeout exports "Semantic Location History" and
`Records.json`) and large files (via a short script).

**Maintain stored data** (administrators, in **Import and export**):

- **Adapt data to the recording rules** applies today's rules to stored days.
  You choose persons and a period; a preview says how many entries are merged or
  thinned out. This cannot be undone.
- **Fetch missing addresses** looks up stays away (`not_home`) without an
  address at OpenStreetMap Nominatim, in the background with exactly one request
  per second; places close together (within "same place") are asked only once.
  It shows its progress, can be paused, resumed or cancelled and continues after
  a restart of Home Assistant.

**Recalculate zones in the data** (administrators, **Settings → Zones → Choose
and colour zones**): every stored entry gets the zone it lies in with today's
zones (the smallest zone wins; an entry up to 100 m outside its previous zone
keeps it, because GPS is not exact). A renamed zone gives the entries the new
name; for a deleted zone they become away (`not_home`) and can then get an
address. You choose the zones (single ones or all, plus "Away" and "Zones that
no longer exist"), persons and period, with a preview. When zones were added,
changed, renamed or removed in Home Assistant, the settings page asks
administrators once when opened: **Recalculate**, **Later** (asks again next
time) or **Don't ask again** (for these changes; the button stays).

Export: **Export data** in the history card or on the settings page – a day or a
period, one or more persons, CSV or GPX, one file or a ZIP with one file per day
and/or person; in the history card also a picture of the map (JPG) and the
selected entries of the table. Directly:
`/api/whereabouts/export?persons=person.x,person.y&from=2026-01-01&to=2026-01-31&format=csv`
(optional `split_day=1`, `split_person=1`).

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

Die Einrichtung fragt in zwei Schritten: zuerst, mit welchen Personen
Whereabouts arbeitet (alle angehakt; überall sonst stehen später nur diese zur
Auswahl), ob es einen Eintrag in der Seitenleiste geben soll und nach der
Adressquelle; dann, wessen Verlauf aufgezeichnet wird (aus dem ersten Schritt).
Danach in der
Seitenleiste **Standorte** (englisch: **Whereabouts**) → **Einstellungen** öffnen.
Neben jeder Einstellung erklärt ein ⓘ, was sie bewirkt; alles, was etwas löscht
oder überschreibt, fragt vorher nach.

| Kategorie | Wer | Was man einstellt |
|---|---|---|
| Ansichten | jeder Benutzer | welche Ansichten das Whereabouts-Dashboard zeigt, die Startansicht (hell oder dunkel folgt immer Home Assistant) |
| Personen | jeder Benutzer | wer erscheint, Reihenfolge, Anzeigename, Farbe, Profilbild (Bild ablegen oder auswählen oder aus dem Internet laden und im Kreis zuschneiden – gespeichert als 256 × 256), in welcher Karte (beide, nur „Wo ist…?“, nur „Standortverlauf“); Hinweise bei ähnlichen und auf der Karte schlecht sichtbaren Farben |
| Karte | jeder Benutzer | Kartenstil (Esri, OpenStreetMap, CARTO, jeweils mit Link zu Beispielen; automatischer Ersatz, wenn ein Dienst ausfällt), CARTO-Stile je Karte für den hellen und dunklen Modus (für eine immer dunkle Karte auch bei „Hell“ einen dunklen Stil wählen), der CARTO-Schlüssel („API ✓“, wenn er funktioniert), bevorzugte Karte und – auf Handy und Tablet – welche Karten-Apps zur Wahl stehen (Standard: Apple Karten und Google Maps; auf Android nie Apple Karten; nur eine App übrig = öffnet direkt) |
| Zonen, Anzeige „Wo ist…?“, Anzeige „Standortverlauf“ | jeder Benutzer (erweitert) | in welcher Karte Zonen erscheinen, Zonenfarben, einzelne Zonen auswählen und einfärben, Zonen in den gespeicherten Daten neu berechnen (Administratoren), Infoleiste, Statusleiste, Genauigkeitskreis, Folgen, Startansicht (Route, Heatmap oder Tabelle), Startzeitraum (heute, letzte 3 oder 7 Tage, letzte 4 Wochen), Legende, Punkte langer Routen ausblenden (ab 400 Einträgen), automatisch aktualisieren und Aktualisierungsintervall |
| Personen in Whereabouts | Administratoren | mit welchen Personen aus Home Assistant Whereabouts überhaupt arbeitet |
| Benutzer | Administratoren, nur wenn es weitere Benutzer gibt | eine Tabelle: Regeln für alle (live sehen / Verlauf sehen / Verlauf löschen: alle Personen, eigene Person, niemand), eigene Rechte pro Benutzer, Ansicht Einstellungen, Synchronisieren, „Bearbeiten“ für den Standard oder einen Benutzer; technische Benutzer (z. B. der MQTT-Benutzer) ausgeblendet |
| Dashboard | Administratoren | in der Seitenleiste ausblenden, Name, Symbol |
| Aufzeichnung | Administratoren | aufgezeichnete Personen; Genauigkeit und Aufbewahrung: Speicherabstand (60 s), Umkreis „gleicher Ort“ (50 m), alten Verlauf löschen (Standard: nie; die Bestätigung nennt, wie viele Tage heute Nacht verschwinden) |
| Adressen | Administratoren | Adressquelle: Companion App, sonst OpenStreetMap (Standard) · nur Companion App · nur OpenStreetMap · keine; Abstand, bis zu dem die Handy-Adresse übernommen wird; Adress-Sensor je Person (automatisch gefunden, Hinweis, wenn keiner da ist) |
| Import und Export | Export: jeder (eigene Rechte), Import: Administratoren | „Daten exportieren“ (Tag oder Zeitraum, Personen, CSV/GPX, mehrere Dateien als ZIP); Import, der Lücken vorhandener Tage ergänzt (oder sie überspringt oder ersetzt), mit Vorschau pro Tag, Formathilfe und einem Text, mit dem ein KI-Assistent Daten anderer Apps (auch Google Maps Timeline) umwandelt; „Gespeicherte Daten pflegen“ (Administratoren): Daten an Aufzeichnungsregeln anpassen, Adressen nachholen |
| Diagnose | Administratoren | Tracker, Sensor „Geokodierter Standort“ und gespeicherte Tage pro Person |

**Eigene Werte und Standard:** Ein blauer Punkt kennzeichnet eine Einstellung mit
eigenem Wert (der Hinweis nennt, was Standard wäre); der Pfeil daneben geht zurück
zum Standard, 30 Sekunden lang holt **Wiederherstellen** den Wert zurück. **Auf
Standard zurücksetzen** stellt eine ganze Kategorie auf die Werte von Whereabouts
(ausgegraut, wenn es nichts zurückzusetzen gibt; danach 30 Sekunden **Eigene Werte
wiederherstellen**).

**Weitere Benutzer:** Alles zu anderen Benutzern erscheint erst, wenn es mindestens
einen Benutzer ohne Adminrechte gibt. Dann zeigt die Kategorie **Benutzer** eine
Tabelle mit den Regeln und Einstellungen für alle Benutzer (dem Standard) und jedem
Benutzer: Rechte, was gerade gilt (Standard, eigene Einstellungen, synchronisiert,
festgelegte Einstellungen), ob er die Ansicht Einstellungen sieht und ob er **mit
den Einstellungen des Administrators synchronisiert** ist. **Bearbeiten** schaltet
die Seite auf die Einstellungen dieses Benutzers (oder den Standard), bis
**Fertig**. **Für alle Benutzer festlegen** macht deine Werte einer Kategorie zum
Standard. Eine Kategorie lässt sich für alle Benutzer (mit Ausnahmen) oder
ausgewählte festlegen, einzelne Einstellungen für einen Benutzer. Festgelegtes
sieht der Benutzer ausgegraut. Kommt ein neuer Benutzer hinzu, fragt die Seite den
nächsten Administrator, der sie öffnet, womit er startet (wie meine Einstellungen
einmalig, wie meine Einstellungen synchron, Werkseinstellungen oder später – bis
dahin wie der Administrator) und welche Rechte er bekommt.

**Immer ein Weg zurück zu den Einstellungen:** Das Dashboard lässt sich in der
Seitenleiste ausblenden, Administratoren können auch die Ansicht **Einstellungen**
ausblenden. Die Einstellungen bleiben erreichbar unter `/whereabouts/settings`,
über **Einstellungen → Geräte & Dienste → Whereabouts → Konfigurieren →
Einstellungen öffnen** und – für Administratoren, solange Dashboard oder
Einstellungsansicht ausgeblendet sind – mit einem Zahnrad über den Zoomknöpfen in
beiden Karten (auch in Karten auf anderen Dashboards).

Schalter und Auswahlen speichern sofort, Text- und Zahlenfelder nur mit
**Speichern** oder der Eingabetaste. Wer die Seite mit ungespeicherten Feldern
verlässt, wird gefragt; nicht gespeicherte Werte werden beim nächsten Mal wieder
angeboten. Alle Kategorien lassen sich auf- und zuklappen.

**Hinweis zu „live sehen“:** Das begrenzt, was Whereabouts anzeigt. Jeder
angemeldete Benutzer kann die Positionen der Personen grundsätzlich auch anderswo
in Home Assistant sehen; den **Verlauf** gibt Whereabouts dagegen nur an
Berechtigte heraus.

Alle Einstellungen liegen in `.storage/whereabouts.settings` und sind – wie der
Verlauf – Teil jedes Home-Assistant-Backups.

Die Optionen unter **Einstellungen → Geräte & Dienste → Whereabouts →
Konfigurieren** funktionieren weiter: Einstellungen öffnen, Dashboard (in der
Seitenleiste ausblenden, Name, Symbol), Aufzeichnung, Adressen und Import.

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
| Personen | wie auf der Einstellungsseite erlaubt und gewählt (oder weniger); ein Häkchen pro Person blendet sie bis zum Neuladen auf der Karte aus | ebenso, nur Personen mit Verlauf, den man sehen darf; die Personenknöpfe blenden Personen aus und ein |
| Pro Person (nur diese Karte) | Anzeigename, Farbe, Bild, Adress-Sensor | Anzeigename, Farbe, Bild |
| Karte | hell/dunkel/wie Home Assistant, Esri / OpenStreetMap / CARTO (eigener Schlüssel), Koordinaten öffnen in Google Maps (Standard), Apple Karten, OpenStreetMap, Waze oder HERE; auf Handy und Tablet mit App-Auswahl | hell/dunkel/wie Home Assistant, Esri / OpenStreetMap / CARTO |
| Zonen | an/aus, Farbe von Zuhause und der übrigen Zonen, Namen ab Zoom | ebenso |
| Anzeige | Infoleiste mit „Alle einblenden“, Statusleiste, GPS-Genauigkeit, beim Start folgen, automatisch aktualisieren und Intervall | Start mit Route, Heatmap oder Tabelle, Startzeitraum, Legende (mit Schalter „Zonen zeigen“, der dieselbe Einstellung wie die Einstellungsseite ändert), „Daten exportieren“ (auch als Kartenbild), Punkte langer Routen ausblenden (ein Hinweis auf der Karte nennt die Zahl), automatisch aktualisieren und Intervall; ein Tag oder ein beliebiger Zeitraum mit gruppierten Vorschlägen (Vorschläge ohne Daten entfallen), Route oder Heatmap |
| Höhe | automatisch (ganze Höhe in einer Panel-Ansicht), ganze Bildschirmhöhe oder fest | ebenso |

Ohne eigene Farbe bekommt eine Person in beiden Karten automatisch dieselbe
Farbe. In YAML sieht das so aus:

```yaml
type: custom:whereabouts-live-card
persons: [person.alex, person.sam]
person_settings:
  person.alex: { color: "#378ADD" }
  person.sam: { name: Sam, color: "#D6409F", picture: /local/bilder/sam.jpg }
tiles: esri          # esri | osm | carto (Schlüssel auf der Einstellungsseite)
carto_light: voyager # CARTO: voyager | positron | dark_matter (jeweils auch *_nolabels)
carto_dark: dark_matter
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
| Adressen von OpenStreetMap (Standard: nur wenn die Companion App keine hat; abschaltbar) | Home Assistant → `nominatim.openstreetmap.org` | Koordinaten von Orten unterwegs – auch, wenn ein Administrator „Adressen nachholen“ startet |
| Kartenkacheln | **dein Browser / die App** → Esri, OpenStreetMap oder CARTO (je nach Karte) | den sichtbaren Kartenausschnitt (wie jede Online-Karte) |
| Kartenbibliothek (Leaflet) | Home Assistant selbst | nichts – eingebaut, kein CDN |

Ohne Internet laufen Aufzeichnung und Verlauf weiter; nur der Kartenhintergrund
bleibt leer.

### Import und Export

Import: **Einstellungen → Import und Export** auf der Seite in der Seitenleiste
(oder **Konfigurieren → Verlauf importieren**). Unterstützt werden das
Whereabouts-CSV-Format, GPX (Tracks, Routen, Wegpunkte) und die Tagesdateien
der ursprünglichen Skript-Version (einzeln oder als ZIP). Vorhandene Tage werden
standardmäßig abgeglichen: Nur Einträge, die in eine Lücke fallen (eine Zeit ohne
gespeicherten Aufenthalt), kommen dazu. Du kannst auch Tage mit Daten überspringen (nur neue Tage werden
übernommen) oder ganze Tage ersetzen. Jeder Punkt bekommt die Zone aus Home
Assistant, in der er liegt (außer die Datei nennt schon eine), und die
Aufzeichnungsregeln gelten für jedes Format: Punkte am selben Ort (im Umkreis
„gleicher Ort“) werden ein Aufenthalt, und Punkte unterwegs, die zeitlich enger
liegen als der Speicherabstand, werden ausgedünnt (ein Zonenwechsel bleibt immer
erhalten). Eine Vorschau zeigt pro Tag, was passieren würde – auch, wie viele
Punkte aus der Datei zu wie vielen Aufenthalten werden und wie viele wegfallen –,
und du hakst die Tage an. Tage außerhalb der Aufbewahrungszeit sind markiert und
nicht angehakt; ist die Aufzeichnung für die Person aus, erscheint ein Hinweis
(importieren geht trotzdem). Was zusammengefasst oder ausgedünnt wird, ist
endgültig weg, und die Datei selbst wird nicht gespeichert – heb die
Ausgangsdatei also auf. Haben Aufenthalte unterwegs danach keine Adresse, holt
**Adressen nachholen** sie. Das Format steht in [FORMAT.md](FORMAT.md#deutsch).
Der Text für einen KI-Assistenten („Daten aus einer anderen App umwandeln
lassen“) kann auch Exporte der Google Maps Timeline (`Timeline.json` vom Handy,
ältere Takeout-Exporte „Semantic Location History“ und `Records.json`) und
große Dateien (über ein kurzes Skript) umwandeln.

**Gespeicherte Daten pflegen** (Administratoren, unter **Import und Export**):

- **Daten an Aufzeichnungsregeln anpassen** wendet die heutigen Regeln auf
  gespeicherte Tage an. Du wählst Personen und Zeitraum; eine Vorschau nennt, wie
  viele Einträge zusammengefasst oder ausgedünnt werden. Das lässt sich nicht
  rückgängig machen.
- **Adressen nachholen** sucht für Aufenthalte unterwegs (`not_home`) ohne
  Adresse die Adresse bei OpenStreetMap Nominatim – im Hintergrund mit genau
  einer Anfrage pro Sekunde; nah beieinander liegende Orte (im Umkreis „gleicher
  Ort“) werden nur einmal abgefragt. Der Fortschritt wird angezeigt, du kannst
  pausieren, fortsetzen oder abbrechen, und nach einem Neustart von Home
  Assistant geht es weiter.

**Zonen in den Daten neu berechnen** (Administratoren, **Einstellungen → Zonen →
Zonen auswählen und einfärben**): Jeder gespeicherte Eintrag bekommt die Zone, in
der er mit den heutigen Zonen liegt (die kleinste Zone gewinnt; ein Eintrag bis
100 m außerhalb seiner bisherigen Zone behält sie, weil GPS ungenau ist). Bei
einer umbenannten Zone bekommen die Einträge den neuen Namen; bei einer
gelöschten Zone werden sie zu unterwegs (`not_home`) und können dann eine Adresse
bekommen. Du wählst die Zonen (einzelne oder alle, dazu „Unterwegs“ und „Nicht
mehr vorhandene Zonen“), Personen und Zeitraum, mit Vorschau. Wurden in Home
Assistant Zonen angelegt, geändert, umbenannt oder entfernt, fragt die
Einstellungsseite Administratoren beim Öffnen einmal: **Neu berechnen**,
**Später** (fragt beim nächsten Mal wieder) oder **Nicht mehr fragen** (für diese
Änderungen; die Schaltfläche bleibt).

Export: **Daten exportieren** in der Verlaufskarte oder auf der Einstellungsseite –
ein Tag oder ein Zeitraum, eine oder mehrere Personen, CSV oder GPX, eine Datei
oder ein ZIP mit einer Datei pro Tag und/oder Person; in der Verlaufskarte auch
ein Bild der Karte (JPG) und die ausgewählten Einträge der Tabelle. Direkt:
`/api/whereabouts/export?persons=person.x,person.y&from=2026-01-01&to=2026-01-31&format=csv`
(optional `split_day=1`, `split_person=1`).

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
