# Changelog

## 0.5.2

- Light or dark: the choice is gone – the dashboard and the maps always follow Home
  Assistant. Under CARTO only the styles per map for light and dark mode remain
  (for an always dark map, pick a dark style under "Light" as well). Stored values
  of the former choice are removed.
- Settings: "Reset to standard" is greyed out in the administration categories
  (sidebar, recording, addresses) too when everything has its built-in value;
  afterwards "Restore own values" for 30 s, as in the personal categories.

---

- Hell oder dunkel: Die Auswahl entfällt – das Dashboard und die Karten folgen immer
  Home Assistant. Unter CARTO bleiben nur die Stile je Karte für den hellen und den
  dunklen Modus (für eine immer dunkle Karte auch bei „Hell“ einen dunklen Stil
  wählen). Gespeicherte Werte der bisherigen Auswahl werden entfernt.
- Einstellungen: „Auf Standard zurücksetzen“ ist auch in den Verwaltungskategorien
  (Seitenleiste, Aufzeichnung, Adressen) ausgegraut, wenn alles dem eingebauten Wert
  entspricht; danach 30 s „Eigene Werte wiederherstellen“ wie bei den persönlichen
  Kategorien.

## 0.5.1

- Phone: the height of the dashboard is measured as in 0.4.4 again (0.5.0 left a gap
  at the bottom and still shifted); the status bars no longer add room for the
  home bar.
- Light or dark: one choice under Views for the whole view of the dashboard (light,
  dark, like the system, or custom per view); under each map service (Esri,
  OpenStreetMap, CARTO) the map follows the view or is always light or dark. The
  former "light or dark" of the map is taken over.
- Settings: the CARTO key is a sub-area under CARTO (closed while the key works);
  all controls sit centred in their row and all fields look like Home Assistant's;
  ⓘ texts with one paragraph per choice; "Import into person" no longer shows an
  empty field; address sensor per person shows the sensor in use, with a switch
  "Use own sensor".
- Profile picture: the crop circle fills the crop area.
- Maps: with only one map app left, the app opens (not the browser); start and end
  of a route look alike.

---

- Handy: Die Höhe des Dashboards wird wieder wie in 0.4.4 gemessen (0.5.0 ließ unten
  eine Lücke und verschob sich trotzdem); die Statusleisten lassen keinen Platz mehr
  für den Home-Balken.
- Hell oder dunkel: eine Auswahl unter Ansichten für die ganze Ansicht des Dashboards
  (hell, dunkel, wie System oder benutzerdefiniert je Ansicht); unter jedem
  Kartendienst (Esri, OpenStreetMap, CARTO) folgt die Karte der Ansicht oder ist immer
  hell bzw. dunkel. Das bisherige „Hell oder dunkel“ der Karte wird übernommen.
- Einstellungen: Der CARTO-Schlüssel ist ein Unterbereich unter CARTO (zugeklappt,
  solange der Schlüssel funktioniert); alle Bedienelemente sitzen mittig in ihrer
  Zeile und alle Felder sehen aus wie in Home Assistant; ⓘ-Texte mit einem Absatz je
  Möglichkeit; „Import gehört zu“ zeigt kein leeres Feld mehr; der Adress-Sensor je
  Person zeigt den genutzten Sensor, mit Schalter „Eigenen Sensor nutzen“.
- Profilbild: Der Zuschneide-Kreis füllt das Zuschneidefenster.
- Karten: Ist nur eine Karten-App übrig, öffnet sich die App (nicht der Browser);
  Start und Ende einer Route sehen gleich aus.

## 0.5.0

- Phone: the dashboard no longer shifts at the home bar; the status bars keep clear
  of rounded screen corners and the home bar; date picker and export window fit a
  phone in landscape (buttons always visible, the rest scrolls).
- Date picker: suggestions in groups, with "Last 3 days"; the chosen one is
  marked; suggestions without data are left out; the period and its number of
  days are shown next to the buttons; on phones the suggestions are a bar above
  the calendar.
- Maps: overview button above the zoom buttons (the legend alone at the bottom
  left); dark controls, licence line, legend and start symbol on a dark map;
  "Where is…?" says "No person selected"; countdown at a fixed place next to the
  refresh button; the same separators in both status bars; names in colours that
  would be hard to read are drawn readable.
- "Location history": start with route, heat map or table and with today, the last
  3 or 7 days or the last 4 weeks ("Today" clicked again returns there); the heat
  map includes home; a "Show zones" switch in the legend (the same setting as on
  the settings page); points of long routes are hidden from 400 entries (setting,
  0 = always shown) with a note on the map that zooms in.
- Settings: a blue dot marks own values, an arrow goes back to the standard and
  "Restore" brings them back for 30 seconds; "Reset to standard" means the
  built-in values (greyed out when there is nothing to reset; also for all users);
  a value equal to the standard is no longer stored as an own value; the table of
  contents follows clicks; diagnostics only load on request; less space at the
  top; structured ⓘ texts.
- Settings: profile pictures by dropping or choosing a file or from the internet,
  cropped in a circle and stored small (256 × 256); replaced pictures are deleted
  when nobody uses them any more; warnings for person and zone colours that are
  hard to see on the map.
- Settings: CARTO styles, zone list, accuracy and keeping, and the address sensor
  per person as sub-areas that open and close; CARTO key shows "API ✓"; choice of
  map apps on phones (default Apple Maps and Google Maps, never Apple Maps on
  Android, one app opens directly); addresses explained and the sensor per person
  pre-filled; the retention confirmation says how many days disappear tonight.
- Users: everything about other users only appears when there are users who are
  not administrators; one table "Users" with rules, rights, settings view,
  synchronising and "Edit" (for the standard, too, with "Done"); "Set for all
  users"; new users are offered to the next administrator (like mine, synchronised,
  built-in values or later) together with their rights.
- Dashboard: terms as in Home Assistant (dashboard, views); "Hide in the sidebar";
  the integration's options get "Open settings" and "Dashboard"; administrators get
  a gear in both maps while the dashboard or the settings view is hidden.

---

- Handy: Das Dashboard verschiebt sich nicht mehr am Home-Balken; die Statusleisten
  halten Abstand zu runden Bildschirmecken und zum Home-Balken; Datumsauswahl und
  Export-Fenster passen aufs Handy im Querformat (Knöpfe immer sichtbar, der Rest
  scrollt).
- Datumsauswahl: Vorschläge in Gruppen, mit „Letzte 3 Tage“; der gewählte ist
  markiert; Vorschläge ohne Daten entfallen; Zeitraum und Anzahl der Tage stehen
  neben den Knöpfen; am Handy sind die Vorschläge eine Leiste über dem Kalender.
- Karten: Gesamtübersicht über den Zoomknöpfen (unten links nur noch die Legende);
  dunkle Knöpfe, Lizenzzeile, Legende und Startsymbol auf dunkler Karte; „Wo
  ist…?“ zeigt „Keine Person ausgewählt“; Countdown an fester Stelle neben dem
  Aktualisieren-Knopf; gleiche Trenner in beiden Statusleisten; Namen in schwer
  lesbaren Farben werden lesbar gezeichnet.
- „Standortverlauf“: Start mit Route, Heatmap oder Tabelle und mit heute, den
  letzten 3 oder 7 Tagen oder den letzten 4 Wochen („Heute“ ein zweites Mal führt
  dorthin zurück); die Heatmap bezieht Zuhause ein; Schalter „Zonen zeigen“ in der
  Legende (dieselbe Einstellung wie auf der Einstellungsseite); Punkte langer
  Routen werden ab 400 Einträgen ausgeblendet (Einstellung, 0 = immer zeigen), mit
  Hinweis auf der Karte, der hineinzoomt.
- Einstellungen: Ein blauer Punkt kennzeichnet eigene Werte, ein Pfeil führt zurück
  zum Standard, „Wiederherstellen“ holt sie 30 Sekunden lang zurück; „Auf Standard
  zurücksetzen“ heißt Werkseinstellung (ausgegraut, wenn nichts zurückzusetzen ist;
  auch für alle Benutzer); ein Wert gleich dem Standard wird nicht mehr als eigener
  Wert gespeichert; das Inhaltsverzeichnis folgt dem Klick; die Diagnose lädt nur
  auf Wunsch; weniger Platz oben; strukturierte ⓘ-Texte.
- Einstellungen: Profilbilder per Ablegen, Auswählen oder aus dem Internet, im Kreis
  zugeschnitten und klein gespeichert (256 × 256); ersetzte Bilder werden gelöscht,
  wenn sie niemand mehr nutzt; Hinweise bei Personen- und Zonenfarben, die auf der
  Karte schlecht zu sehen sind.
- Einstellungen: CARTO-Stile, Zonenliste, Genauigkeit und Aufbewahrung sowie der
  Adress-Sensor je Person als auf- und zuklappbare Unterbereiche; der CARTO-Schlüssel
  zeigt „API ✓“; Auswahl der Karten-Apps am Handy (Standard Apple Karten und Google
  Maps, auf Android nie Apple Karten, eine App öffnet direkt); Adressen erklärt und
  der Sensor je Person vorbelegt; die Bestätigung zum Löschen nennt, wie viele Tage
  heute Nacht verschwinden.
- Benutzer: Alles zu anderen Benutzern erscheint nur noch, wenn es Benutzer ohne
  Adminrechte gibt; eine Tabelle „Benutzer“ mit Regeln, Rechten, Ansicht
  Einstellungen, Synchronisieren und „Bearbeiten“ (auch für den Standard, mit
  „Fertig“); „Für alle Benutzer festlegen“; neue Benutzer werden dem nächsten
  Administrator angeboten (wie meine, synchron, Werkseinstellungen oder später),
  gleich mit ihren Rechten.
- Dashboard: Begriffe wie in Home Assistant (Dashboard, Ansichten); „In der
  Seitenleiste ausblenden“; die Optionen der Integration bekommen „Einstellungen
  öffnen“ und „Dashboard“; Administratoren bekommen in beiden Karten ein Zahnrad,
  solange Dashboard oder Einstellungsansicht ausgeblendet sind.

## 0.4.4

- Sidebar page: the height follows the visible area only (zooming the browser no
  longer needs a reload); maps without rounded corners, border and shadow, flush
  to the edges; the page is no longer pulled back while scrolling (no more
  jerking on the iPhone).
- "Location history": controls with words in one row if they fit, otherwise
  compact with symbols in one row (phone in landscape) or two – never three; the
  status bar shows words only if they fit in one row; on low screens the map
  takes exactly what is left and the legend is smaller.
- "Where is…?" on low screens (phone in landscape): flat tiles side by side.

---

- Seite in der Seitenleiste: Die Höhe richtet sich nur noch nach dem sichtbaren
  Bereich (nach dem Zoomen im Browser kein Neuladen mehr nötig); Karten ohne
  runde Ecken, Rand und Schatten, bündig bis an den Rand; beim Scrollen wird die
  Seite nicht mehr zurückgezogen (kein Ruckeln mehr am iPhone).
- „Standortverlauf“: Bedienelemente mit Texten in einer Zeile, wenn sie passen,
  sonst kompakt mit Symbolen in einer Zeile (Handy quer) oder zwei – nie drei;
  die Statusleiste zeigt Texte nur, wenn sie in eine Zeile passen; bei wenig Höhe
  nimmt die Karte genau den restlichen Platz und die Legende ist kleiner.
- „Wo ist…?“ bei wenig Höhe (Handy quer): flache Kacheln nebeneinander.

## 0.4.3

- Phone: the page around the sidebar page no longer moves (also not when jumping
  to a settings area); after turning the phone the height is measured again until
  it fits; date row in the history without "Today" and with buttons of equal
  height; person buttons show the name as long as there is room.

---

- Handy: Die Seite um die Seitenleisten-Ansicht verschiebt sich nicht mehr (auch
  nicht beim Sprung zu einem Einstellungsbereich); nach dem Drehen wird die Höhe
  so lange nachgemessen, bis sie passt; Datumszeile im Verlauf ohne „Heute“ und
  mit gleich hohen Knöpfen; Personenknöpfe zeigen den Namen, solange Platz ist.

## 0.4.2

- Phone and narrow windows: the sidebar page fits the visible area exactly
  (no more scrolling of the whole page; the tab bar stays, the status bars are
  visible again); status bars in one line with symbols only (no countdown, no
  times); "Location history" with two compact rows: person buttons with picture
  and eye (when even tighter only the picture), date, arrows and "Today" as one
  group, symbols for route, heatmap, table and map; "Show everyone" as an eye
  symbol in the same row; licence line without "Leaflet", legend and overview
  button above it.
- "Where is…?": the detail window appears right at the pin without animation,
  its tip always points to the pin; from four persons the tiles are shown in two
  columns without pictures on narrow screens.
- Settings page: person rows on narrow screens with picture and order on the
  left and all fields in full width; colour fields small instead of across the
  whole width; jumping to an area keeps its heading visible; the explanations at
  the top are behind an ⓘ.
- Status bar of the history: names as bold as in "Where is…?".

---

- Handy und schmale Fenster: Die Seite in der Seitenleiste passt genau in den
  sichtbaren Bereich (kein Verschieben der ganzen Seite mehr, die Reiterleiste
  bleibt stehen, die Statusleisten sind wieder sichtbar); Statusleisten einzeilig
  nur mit Symbolen (ohne Countdown und Uhrzeiten); „Standortverlauf“ mit zwei
  kompakten Zeilen: Personenknöpfe mit Bild und Auge (wird es noch enger, nur das
  Bild), Datum, Pfeile und „Heute“ als eine Gruppe, Symbole für Route, Heatmap,
  Tabelle und Karte; „Alle einblenden“ als Augen-Symbol in derselben Zeile;
  Lizenzzeile ohne „Leaflet“, Legende und Gesamtübersicht-Knopf darüber.
- „Wo ist…?“: Das Detailfenster erscheint ohne Animation direkt an der
  Stecknadel, sein Pfeil zeigt immer auf die Stecknadel; ab vier Personen stehen
  die Kacheln auf schmalen Bildschirmen in zwei Spalten ohne Bild.
- Einstellungsseite: Personenzeilen auf schmalen Bildschirmen mit Bild und
  Reihenfolge links und allen Feldern in voller Breite; Farbfelder klein statt
  über die ganze Breite; beim Springen zu einem Bereich bleibt seine Überschrift
  sichtbar; die Erklärungen oben liegen hinter einem ⓘ.
- Statusleiste des Verlaufs: Namen so fett wie bei „Wo ist…?“.

## 0.4.1

- Both maps: new button "Show everything" bottom left (back to everybody, or to
  all points of the period). Coming back to a map – tab on the sidebar page or
  dashboard view – now really resets zoom and position (the history did not do
  it at all, "Where is…?" tried before the map had its size again).
- "Location history": "Today" can always be clicked – from a period it jumps to
  today; if only today is shown it resets everything as after opening the page.
  Heatmap also for a single day. Colons in the status bar in the person's colour.
- "Export data": the date picker did not open (only the dimming was shown).
- Import: new choice "Skip" for existing days (only days without data are
  taken); "1 entry", "1 day" in singular; the tick in the header is no longer set
  when nothing can be chosen.
- Settings page: "Discard" next to "Save" for unsaved fields; resetting an area
  also throws away its unsaved changes; coming back within a minute keeps
  position and open areas, later the page starts at the top as when opened
  (areas with unsaved changes stay open); the page no longer jumps up after
  saving the sidebar name or icon; a field reached from a link flashes only once;
  "Settings of", "Use my settings for everybody", "Make default" and the users
  table only appear when there are users besides administrators.

---

- Beide Karten: neuer Knopf „Gesamtübersicht“ unten links (zurück auf alle bzw.
  auf alle Punkte des Zeitraums). Beim Zurückkehren zu einer Karte – Reiter auf der
  Seite in der Seitenleiste oder Dashboard-Ansicht – werden Zoom und Position jetzt
  wirklich zurückgesetzt (der Verlauf tat es gar nicht, „Wo ist…?“ zu früh, bevor
  die Karte wieder ihre Größe hatte).
- „Standortverlauf“: „Heute“ ist immer klickbar – aus einem Zeitraum springt es auf
  heute; wird nur heute gezeigt, setzt es alles zurück wie beim Öffnen der Seite.
  Heatmap auch für einen einzelnen Tag. Doppelpunkte in der Statusleiste in der
  Farbe der Person.
- „Daten exportieren“: Die Datumsauswahl öffnete sich nicht (nur die Abdunklung
  war zu sehen).
- Import: neue Wahl „Überspringen“ für vorhandene Tage (nur Tage ohne Daten werden
  übernommen); „1 Eintrag“, „1 Tag“ in der Einzahl; der Haken in der Kopfzeile ist
  nicht mehr gesetzt, wenn nichts gewählt werden kann.
- Einstellungsseite: „Verwerfen“ neben „Speichern“ bei ungespeicherten Feldern;
  Zurücksetzen eines Bereichs verwirft auch dessen ungespeicherte Änderungen;
  Rückkehr innerhalb einer Minute behält Position und offene Bereiche, später
  beginnt die Seite oben wie beim Öffnen (Bereiche mit ungespeicherten Änderungen
  bleiben offen); die Seite springt nach dem Speichern von Name oder Symbol in der
  Seitenleiste nicht mehr hoch; ein über einen Link angesprungenes Feld leuchtet
  nur einmal auf; „Einstellungen von“, „Meine Einstellungen für alle übernehmen“,
  „Als Standard übernehmen“ und die Benutzertabelle erscheinen nur, wenn es
  außer Administratoren weitere Benutzer gibt.

## 0.4.0

- Settings page: "fix" instead of "lock" throughout; the page keeps its position
  after every change (also when Home Assistant rebuilds it); text and number
  fields show "Saved ✓" in green; an emptied text field really goes back to the
  default; "Reset" in Sidebar, Recording (numbers only) and Addresses; the
  "Unsaved changes" window and the drafts hint link to the fields; in person rows
  name, colour, picture and "Show in" are saved together; a green confirmation
  box after synchronising, "Use my settings for everybody" and "Make default".
- Administrators: role shown at the top; "Settings of" me, the default for all
  users or a single user; table "Users and their settings" (what applies, settings
  tab on/off, synchronise with me – per user or for all, new users included,
  edit); single settings or whole categories can be fixed for one user.
  Switching synchronisation off keeps the administrator's settings (for everybody
  they become the default and own settings of users are removed; for one user
  they become that user's own).
- Map: CARTO styles per card and light/dark (Voyager, Positron, Dark Matter, each
  also without labels); CARTO key hidden behind dots with an eye button (shown
  for 10 seconds); "Show zones" per card (both, only one, not at all).
- "Where is…?": "Show everyone"; every hiding/showing zooms to everybody shown;
  coming back to the map (tab, dashboard) shows everybody and follows again;
  zoom buttons in the same place as in the history; a hidden person can be
  shown again by clicking the tile.
- "Location history": person buttons with picture and eye; date picker like the
  energy dashboard with suggestions (today, yesterday, this week, this month, last
  month, this year, last year, last 7 days, last 4 weeks, since recording began),
  days without data greyed out, any length (long periods are loaded month by
  month with a warning); route or heatmap (weighted by time spent, home optional;
  Leaflet.heat bundled); "Select entries" to export (CSV/GPX) or delete them;
  link to the map app next to the place; "Export data" at the bottom left, also
  as map picture (JPG, current view or the whole route/heatmap).
- New installations: only administrators delete history by default.
- Import: "Import belongs to"; export and import as separate sections; existing
  days are merged (only entries in gaps) or replaced, with a preview per day to
  tick the days.
- Card editor: empty colour warning hidden; selections start with "As in the
  settings (…)" and keep what is chosen (Esri could not be chosen while the
  settings said OpenStreetMap); CARTO styles.
- "Full screen height" measures where the card starts, so a sections view does not
  scroll; the sidebar page is only registered again when entry, name or icon
  change (other options no longer rebuild an open page).

---

- Einstellungsseite: durchgehend „festlegen“ statt „sperren“; die Seite bleibt
  nach jeder Änderung an ihrer Stelle (auch wenn Home Assistant sie neu aufbaut);
  Text- und Zahlenfelder zeigen grün „Gespeichert ✓“; ein geleertes Textfeld geht
  wirklich auf den Standard zurück; „Zurücksetzen“ in Seitenleiste, Aufzeichnung
  (nur die Zahlen) und Adressen; das Fenster „Ungespeicherte Änderungen“ und der
  Entwurf-Hinweis verlinken auf die Felder; in Personenzeilen werden Name, Farbe,
  Bild und „Anzeigen in“ gemeinsam gespeichert; ein grüner Bestätigungskasten nach
  Synchronisieren, „Meine Einstellungen für alle übernehmen“ und „Als Standard
  festlegen“.
- Administratoren: Rolle oben sichtbar; „Einstellungen von“ mir, dem Standard für
  alle Benutzer oder einem einzelnen Benutzer; Tabelle „Benutzer und ihre
  Einstellungen“ (was gilt, Einstellungen-Reiter an/aus, mit mir synchronisieren –
  pro Benutzer oder für alle, auch neue –, bearbeiten); einzelne Einstellungen oder
  ganze Kategorien lassen sich für einen Benutzer festlegen. Beim Ausschalten der
  Synchronisierung bleiben die Einstellungen des Administrators (für alle werden
  sie zum Standard und eigene Einstellungen der Benutzer werden gelöscht; für einen
  Benutzer werden sie zu dessen eigenen).
- Karte: CARTO-Stile pro Karte und hell/dunkel (Voyager, Positron, Dark Matter,
  jeweils auch ohne Beschriftung); CARTO-Schlüssel hinter Punkten mit Augen-Knopf
  (10 Sekunden sichtbar); „Zonen zeigen“ pro Karte (beide, nur eine, gar nicht).
- „Wo ist…?“: „Alle einblenden“; jedes Aus-/Einblenden zoomt auf alle Sichtbaren;
  beim Zurückkommen auf die Karte (Reiter, Dashboard) sind wieder alle sichtbar und
  die Karte folgt; Zoomknöpfe an derselben Stelle wie im Verlauf; eine
  ausgeblendete Person lässt sich per Klick auf die Kachel wieder einblenden.
- „Standortverlauf“: Personenknöpfe mit Bild und Auge; Datumswähler wie im
  Energie-Dashboard mit Vorschlägen (heute, gestern, diese Woche, dieser Monat,
  letzter Monat, dieses Jahr, letztes Jahr, letzte 7 Tage, letzte 4 Wochen, seit
  Beginn der Aufzeichnung), Tage ohne Daten ausgegraut, beliebig lange Zeiträume
  (lange werden Monat für Monat geladen, mit Hinweis); Route oder Heatmap
  (gewichtet nach Aufenthaltsdauer, Zuhause wahlweise; Leaflet.heat mitgeliefert);
  „Einträge auswählen“ zum Exportieren (CSV/GPX) oder Löschen; Link zur Karten-App
  neben dem Ort; „Daten exportieren“ unten links, auch als Kartenbild (JPG,
  aktueller Ausschnitt oder ganze Route/Heatmap).
- Neue Installationen: Verlauf löschen standardmäßig nur Administratoren.
- Import: „Import gehört zu“; Export und Import als getrennte Abschnitte;
  vorhandene Tage werden abgeglichen (nur Einträge in Lücken) oder ersetzt, mit
  Vorschau pro Tag zum Anhaken.
- Karteneditor: leere Farbwarnung ausgeblendet; Auswahlfelder beginnen mit „Wie in
  den Einstellungen (…)“ und behalten, was gewählt ist (Esri ließ sich nicht wählen,
  solange in den Einstellungen OpenStreetMap stand); CARTO-Stile.
- „Ganze Bildschirmhöhe“ misst, wo die Karte beginnt, sodass eine Abschnitte-Ansicht
  nicht mehr scrollt; die Seite in der Seitenleiste wird nur neu angemeldet, wenn
  sich Eintrag, Name oder Symbol ändern (andere Optionen bauen eine offene Seite
  nicht mehr neu auf).

## 0.3.0

- Set-up in two steps: first the persons Whereabouts works with (all ticked) and
  whether you want a sidebar entry (with a hint where the settings are), then
  whose history is recorded. Everywhere else – cards, card editor, rights,
  recording, addresses, import, download, diagnostics – only these persons can
  be chosen, as ticks instead of Home Assistant's entity picker.
- "Where is…?": a tick on each person tile hides the person on the map until
  reload (tile greyed).
- "Location history": person buttons in their colours hide and show persons (no
  "All" button any more; nobody shown = empty map with a hint); names in the
  status bar in the person's colour; zoom buttons at the bottom right; toggle
  "Day | Period" for up to 31 days (arrows move by the period's length, "Today"
  goes back, one continuous route, date column in the table); new entry window
  (name with colour dot, place large, time and duration small, red "Delete
  entry" button).
- "Download location data" (history card and settings page): day or period,
  persons, CSV or GPX, one file per day and/or person – several files come as a
  ZIP.
- Settings page: tabs "For me" / "Default for all users" with a coloured banner
  and a "default"/"own" badge per setting; "Make default" per category and "Use
  my settings for everybody"; administrators can synchronise their settings with
  all users (non-admins get them live and no settings tab, their own values are
  kept); explanation of locks and the lock's state as tooltip; every category
  can be folded (General open, the rest closed, short info in the header,
  "Expand all").
- Persons: "Show in" both cards / only "Where is…?" / only "Location history".
- Map: map styles without preview images, with a description and a link to
  examples; the CARTO key directly under CARTO (administrators; a pasted URL is
  fine, the key is checked once after saving, "Remove" button); OpenStreetMap
  tiles no longer blocked ("403") because Home Assistant sends no referrer.
- Zones: hide single zones and give single zones their own colour.
- "Refresh interval" and "Refresh automatically" instead of "reload"; the
  interval is greyed out while automatic refresh is off (also in the card
  editor).
- Administration: new category "Persons in Whereabouts"; "Sidebar" only has the
  entry, name and icon (the cards are always available); "Users and rights": new
  installations allow all persons by default, technical users (e.g. the MQTT
  user) hidden unless switched on, rights chips blue also when they follow the
  rule; "Addresses": shows which sensor was found automatically and lists only
  sensors that deliver addresses.
- Import: consistent controls with ⓘ, "What must the file look like?" and a
  copyable prompt for converting other apps' data with an AI assistant.
- Text and number fields save only with "Save" or Enter; switches, selections,
  ticks and colours save at once. Leaving the settings with unsaved fields asks
  first; unsaved values are offered again on return.

---

- Einrichtung in zwei Schritten: zuerst die Personen, mit denen Whereabouts
  arbeitet (alle angehakt), und ob es einen Eintrag in der Seitenleiste geben
  soll (mit Hinweis, wo die Einstellungen sind), dann wessen Verlauf
  aufgezeichnet wird. Überall sonst – Karten, Karteneditor, Rechte, Aufzeichnung,
  Adressen, Import, Download, Diagnose – stehen nur diese Personen zur Auswahl,
  als Häkchen statt der Entitätsauswahl von Home Assistant.
- „Wo ist…?“: Ein Häkchen an jeder Personenkachel blendet die Person bis zum
  Neuladen auf der Karte aus (Kachel ausgegraut).
- „Standortverlauf“: Personenknöpfe in ihren Farben blenden Personen aus und ein
  (kein „Alle“-Knopf mehr; niemand gewählt = leere Karte mit Hinweis); Namen in
  der Statusleiste in der Farbe der Person; Zoomknöpfe unten rechts; Umschalter
  „Tag | Zeitraum“ für bis zu 31 Tage (Pfeile springen um die Länge des
  Zeitraums, „Heute“ führt zurück, eine durchgehende Route, Datumsspalte in der
  Tabelle); neues Eintragsfenster (Name mit Farbpunkt, Ort groß, Zeit und Dauer
  klein, roter Knopf „Eintrag löschen“).
- „Standortdaten herunterladen“ (Verlaufskarte und Einstellungsseite): Tag oder
  Zeitraum, Personen, CSV oder GPX, eine Datei pro Tag und/oder Person – mehrere
  Dateien kommen als ZIP.
- Einstellungsseite: Reiter „Für mich“ / „Standard für alle Benutzer“ mit
  farbigem Hinweis und Kennzeichen „Standard“/„eigene“ an jeder Einstellung;
  „Als Standard festlegen“ pro Kategorie und „Meine Einstellungen für alle
  übernehmen“; Administratoren können ihre Einstellungen mit allen Benutzern
  synchronisieren (Nicht-Admins bekommen sie laufend und keinen
  Einstellungen-Reiter, ihre eigenen Werte bleiben erhalten); Erklärung der
  Sperren und Zustand des Schlosses als Tooltip; alle Kategorien auf- und
  zuklappbar (Allgemein offen, der Rest zu, Kurzinfo im Kopf, „Alle
  aufklappen“).
- Personen: „Anzeigen in“ beiden Karten / nur „Wo ist…?“ / nur
  „Standortverlauf“.
- Karte: Kartenstile ohne Vorschaubilder, mit Beschreibung und Link zu
  Beispielen; der CARTO-Schlüssel direkt unter CARTO (Administratoren; eine
  eingefügte URL geht auch, der Schlüssel wird nach dem Speichern einmal
  geprüft, Knopf „Entfernen“); OpenStreetMap-Kacheln nicht mehr gesperrt („403“),
  weil Home Assistant keinen Referrer schickt.
- Zonen: einzelne Zonen ausblenden und einzelnen Zonen eine eigene Farbe geben.
- „Aktualisierungsintervall“ und „Automatisch aktualisieren“ statt „neu laden“;
  das Intervall ist ausgegraut, solange das automatische Aktualisieren aus ist
  (auch im Karteneditor).
- Verwaltung: neue Kategorie „Personen in Whereabouts“; „Seitenleiste“ hat nur
  noch Eintrag, Name und Symbol (die Karten gibt es immer); „Benutzer und
  Rechte“: neue Installationen erlauben standardmäßig alle Personen, technische
  Benutzer (z. B. der MQTT-Benutzer) ausgeblendet, solange nicht eingeschaltet,
  Rechte-Chips auch nach Regel blau; „Adressen“: zeigt, welcher Sensor
  automatisch gefunden wurde, und bietet nur Sensoren an, die Adressen liefern.
- Import: einheitliche Bedienelemente mit ⓘ, „Wie muss die Datei aussehen?“ und
  ein kopierbarer Text, mit dem ein KI-Assistent Daten anderer Apps umwandelt.
- Text- und Zahlenfelder speichern nur mit „Speichern“ oder der Eingabetaste;
  Schalter, Auswahlen, Häkchen und Farben sofort. Wer die Einstellungen mit
  ungespeicherten Feldern verlässt, wird gefragt; nicht gespeicherte Werte werden
  beim nächsten Mal wieder angeboten.

## 0.2.1

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
