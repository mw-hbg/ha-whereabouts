# Changelog

## 0.8.0

- New: evaluation of a place in the history card (button "Evaluate"): choose a circle on the map (tap to set the centre, drag the centre or the edge), a period (default: the last 12 months) and persons. The table shows visits, days with a visit, total time and the longest visit per day, month or year, with a total per person, and below every visit (date, from–to, duration, place). Stays less than 15 minutes apart count as one visit (also across midnight); visits shorter than the minimum duration (default 10 minutes) are passing through and only counted with the switch "Count passing through". Everyone may evaluate the persons whose history they may see; the calculation runs month by month on the server and does not block the data maintenance.
- New: the evaluation as an Excel file (.xlsx, sheets "Summary" and "Visits", durations and dates as real values) or as a PDF (A4, selection in the header, "Page x of y"), through a signed link also in the Home Assistant apps ("Download", on iOS "Open"); in the browser also "Share" where the device can share files. The files stay for 24 hours.
- New: distance as the crow flies between consecutive stays ("approx. … km") per person in the status bar of the history card, and in the table a row per day with that day's distance. Hops under 50 m between two stays (GPS jitter) do not count; by road it is further, gaps and journeys count as a straight line.
- New: card option "Evaluate button" (`show_analysis`, on by default), also in the settings for all cards.
- Tests: the UI check opens the evaluation (window, choosing on the map, result, PDF link) and the table with its rows per day.
- Fixed: settings, "Tasks and progress": the content now keeps the same distance to the edges as the other categories; the progress of "Fetch missing addresses" is framed like the other tasks.

---

- Neu: Orts-Auswertung in der Verlaufskarte (Knopf „Auswertung“): Kreis auf der Karte wählen (Tippen setzt den Mittelpunkt, Mittelpunkt oder Rand ziehen), Zeitraum (Standard: die letzten 12 Monate) und Personen. Die Tabelle zeigt Besuche, Tage mit Besuch, Gesamtdauer und den längsten Besuch je Tag, Monat oder Jahr mit einer Summe je Person, darunter jeden Besuch (Datum, von–bis, Dauer, Ort). Aufenthalte mit weniger als 15 Minuten Abstand zählen als ein Besuch (auch über Mitternacht); Besuche unter der Mindestdauer (Standard 10 Minuten) gelten als Durchfahrt und werden nur mit dem Schalter „Durchfahrten zählen“ gezählt. Jede Person darf die Personen auswerten, deren Verlauf sie sehen darf; die Berechnung läuft Monat für Monat auf dem Server und blockiert die Datenpflege nicht.
- Neu: Die Auswertung als Excel-Datei (.xlsx, Blätter „Übersicht“ und „Besuche“, Dauer und Datum als echte Werte) oder als PDF (A4, Auswahl im Kopf, „Seite x von y“), über einen signierten Link auch in den Home-Assistant-Apps („Herunterladen“, auf iOS „Öffnen“); im Browser zusätzlich „Teilen“, wenn das Gerät Dateien teilen kann. Die Dateien bleiben 24 Stunden bereit.
- Neu: Strecke als Luftlinie zwischen aufeinanderfolgenden Aufenthalten („ca. … km“) je Person in der Statusleiste der Verlaufskarte, in der Tabelle eine Zeile pro Tag mit der Strecke des Tages. Sprünge unter 50 m zwischen zwei Aufenthalten (GPS-Zittern) zählen nicht; auf der Straße ist es weiter, Lücken und Reisen zählen als Luftlinie.
- Neu: Kartenoption „Knopf Auswertung“ (`show_analysis`, standardmäßig an), auch in den Einstellungen für alle Karten.
- Tests: Die UI-Prüfung öffnet die Auswertung (Fenster, Wahl auf der Karte, Ergebnis, PDF-Link) und die Tabelle mit ihren Tageszeilen.
- Behoben: Einstellungen, „Aufgaben und Fortschritt“: Der Inhalt hat jetzt denselben Abstand zum Rand wie die anderen Kategorien; der Fortschritt von „Fehlende Adressen nachladen“ ist wie die anderen Aufgaben eingerahmt.

## 0.7.10

- Changed: heatmap: the switch "Grade colours by total time per place" is off by default again (the stays add up as before 0.7.5). The switch stays in the legend.
- Improved: switching between route and heatmap keeps zoom and map position.
- New: group "Open tasks" in the settings (administrators): a running job with progress bar and "Cancel", the progress of "Fetch missing addresses", and what is still open (changed zones, missing addresses, the offer to import from the Home Assistant history).
- Changed: the long actions of the data maintenance (recording rules, zones, time zones, edges of days, coordinates) run as one background job with progress. It stops after the current day when cancelled, goes on after a restart of Home Assistant, and is logged with its trash as before. Only one job runs at a time (also not together with "Fetch missing addresses"). After "Recalculate zones" the job looks up the addresses itself, when asked for.
- New: export of a long period (more than about three months, administrators) as a background job: month by month into a ZIP file with one file per person and year (GPX: per month), then "Download". The limit of 10 years does not apply to it; the file stays for 24 hours. In the Home Assistant apps the file is handed out through a signed link ("Download", on iOS "Open").
- New: import from the Home Assistant history (recorder) as a second source in "Import and export" and as an offer after the installation (Import / Do not offer again / Later): one person and day per step, only gaps are filled, with a preview. Home Assistant keeps its history for ten days by default.
- Tests: the UI check now switches to the heatmap (both colour modes, by visits), checks that it is drawn and that zoom and position stay.

---

- Geändert: Heatmap: Der Schalter „Farben nach Gesamtzeit pro Ort abstufen“ ist wieder standardmäßig aus (die Aufenthalte addieren sich wie vor 0.7.5). Der Schalter bleibt in der Legende.
- Verbessert: Beim Umschalten zwischen Route und Heatmap bleiben Zoomstufe und Kartenausschnitt erhalten.
- Neu: Gruppe „Offene Aufgaben“ in den Einstellungen (Administratoren): ein laufender Auftrag mit Fortschrittsbalken und „Abbrechen“, der Fortschritt von „Fehlende Adressen nachladen“ und alles, was noch offen ist (geänderte Zonen, fehlende Adressen, das Angebot zum Import aus dem Verlauf von Home Assistant).
- Geändert: Die langen Aktionen der Datenpflege (Aufzeichnungsregeln, Zonen, Zeitzonen, Tagesränder, Koordinaten) laufen als ein Hintergrundauftrag mit Fortschritt. Beim Abbrechen stoppt er nach dem aktuellen Tag, er macht nach einem Neustart von Home Assistant weiter und steht wie bisher mit Papierkorb im Protokoll. Es läuft immer nur ein Auftrag (auch nicht zusammen mit „Fehlende Adressen nachladen“). Nach „Zonen neu berechnen“ holt der Auftrag die Adressen selbst, wenn gewünscht.
- Neu: Export eines langen Zeitraums (mehr als etwa drei Monate, Administratoren) als Hintergrundauftrag: Monat für Monat in eine ZIP-Datei mit einer Datei pro Person und Jahr (GPX: pro Monat), danach „Herunterladen“. Die Grenze von 10 Jahren gilt dafür nicht; die Datei bleibt 24 Stunden bereit. In den Home-Assistant-Apps wird die Datei über einen signierten Link angeboten („Herunterladen“, auf iOS „Öffnen“).
- Neu: Import aus dem Verlauf von Home Assistant (Recorder) als zweite Quelle unter „Import und Export“ und als Angebot nach der Installation (Importieren / Nicht mehr anbieten / Später): ein Tag und eine Person pro Schritt, es werden nur Lücken gefüllt, mit Vorschau. Home Assistant behält seinen Verlauf standardmäßig zehn Tage.
- Tests: Die UI-Prüfung schaltet jetzt auf die Heatmap (beide Farbmodi, nach Besuchen), prüft, dass sie gezeichnet wird und dass Zoom und Position erhalten bleiben.

## 0.7.9

- Changed: log and trash are now a settings category of their own (below the data maintenance).
- New: button "Download diagnostics" directly in the settings under Diagnostics.
- Improved: heatmap: the colour now shows the total time per place on a logarithmic scale (a few minutes blue, a day green, weeks red), so a place visited once no longer looks like home. Switch "Grade colours by total time per place"; switched off, the stays add up as before 0.7.5. The switch "By number of visits instead of duration" stays.

---

- Geändert: Protokoll und Papierkorb sind jetzt eine eigene Einstellungskategorie (unter der Datenpflege).
- Neu: Knopf „Diagnose herunterladen“ direkt in den Einstellungen unter Diagnose.
- Verbessert: Heatmap: Die Farbe zeigt jetzt die Gesamtzeit pro Ort auf einer logarithmischen Skala (wenige Minuten blau, ein Tag grün, Wochen rot). Ein einmal besuchter Ort sieht dadurch nicht mehr aus wie Zuhause. Schalter „Farben nach Gesamtzeit pro Ort abstufen“; ausgeschaltet addieren sich die Aufenthalte wie vor 0.7.5. Der Schalter „Nach Besuchen statt nach Dauer“ bleibt.

## 0.7.8

- Fixed: zoomed out, the heatmap was red everywhere – the scale is now worked out for every zoom level, so home stays stronger than a short holiday.

---

- Behoben: Weit herausgezoomt war die Heatmap überall rot – die Skalierung wird jetzt für jede Zoomstufe neu berechnet, Zuhause bleibt dadurch stärker als ein kurzer Urlaub.

## 0.7.7

- Fixed: the heatmap stayed empty since 0.7.5 – an error stopped it from being drawn.

---

- Behoben: Die Heatmap blieb seit 0.7.5 leer – ein Fehler verhinderte das Zeichnen.

## 0.7.6

- Fixed: the heatmap stayed almost empty since 0.7.5 – the scale did not take the zoom level into account.

---

- Behoben: Die Heatmap blieb seit 0.7.5 fast leer – die Skalierung berücksichtigte die Zoomstufe nicht.

## 0.7.5

- New: positions with a GPS accuracy worse than 100 m are no longer recorded (setting "Maximum GPS inaccuracy", 0–1000 m, 0 = off). A change of state (home / away / zone) is always recorded.
- Improved: after a deletion or a data change the cards reload only the changed days instead of the whole period; the live card asks for the "since" time of all persons in one request and corrects it after a restart of Home Assistant.
- Improved: the automatic deletion of old days (retention) now goes to the trash and appears in the log, and runs once a night.
- Improved: Nominatim: a pause requested by the server (Retry-After) is respected; the address cache is saved when Home Assistant stops.
- Improved: heatmap: short stays count little, from 2 hours fully; the radius is about 75 m at every zoom; the strongest place (home) no longer outshines the rest; new switch "By number of visits instead of duration".
- Improved: stored text can no longer break the CSV files (semicolons and quotation marks are cleaned).
- Changed: loading a picture from the internet (crop for the panel icon) is for administrators only.
- New: "Download diagnostics" (counts and settings only; persons, sensors and keys are redacted).
- Changed: the prompt for converting location data no longer asks to define a home.

---

- Neu: Positionen mit einer GPS-Genauigkeit schlechter als 100 m werden nicht mehr aufgezeichnet (Einstellung „Maximale GPS-Ungenauigkeit“, 0–1000 m, 0 = aus). Ein Wechsel des Zustands (Zuhause / unterwegs / Zone) wird immer gespeichert.
- Verbessert: Nach einem Löschen oder einer Datenänderung laden die Karten nur die geänderten Tage neu statt den ganzen Zeitraum; die Live-Karte fragt das „seit“ aller Personen in einer Anfrage ab und korrigiert es nach einem Neustart von Home Assistant.
- Verbessert: Das automatische Löschen alter Tage (Aufbewahrung) landet jetzt im Papierkorb, steht im Protokoll und läuft einmal pro Nacht.
- Verbessert: Nominatim: eine vom Server verlangte Pause (Retry-After) wird eingehalten; der Adress-Zwischenspeicher wird beim Beenden von Home Assistant gesichert.
- Verbessert: Heatmap: kurze Aufenthalte zählen wenig, ab 2 Stunden voll; der Radius beträgt bei jeder Zoomstufe etwa 75 m; der stärkste Ort (Zuhause) überstrahlt den Rest nicht mehr; neuer Schalter „Nach Besuchen statt nach Dauer“.
- Verbessert: Gespeicherter Text kann die CSV-Dateien nicht mehr durcheinanderbringen (Semikolon und Anführungszeichen werden bereinigt).
- Geändert: Das Laden eines Bildes aus dem Internet (Zuschnitt des Seitenleisten-Symbols) ist nur noch für Administratoren möglich.
- Neu: „Diagnose herunterladen“ (nur Zahlen und Einstellungen; Personen, Sensoren und Schlüssel sind geschwärzt).
- Geändert: Der Prompt zum Umwandeln von Standortdaten verlangt nicht mehr, ein Zuhause festzulegen.

## 0.7.4

- Fixed: the "Restore" button in the log had its icon on top of the text.
- Fixed: the log (intro, buttons, entries and dividers) now has the same side spacing as
  the other rows instead of running to the edge.

---

- Behoben: Der Knopf „Wiederherstellen“ im Protokoll hatte das Symbol über dem Text.
- Behoben: Das Protokoll (Einleitung, Knöpfe, Einträge und Trennlinien) hat jetzt den
  gleichen seitlichen Abstand wie die übrigen Zeilen und läuft nicht mehr bis zum Rand.

## 0.7.3

- New "Log and trash" at the bottom of "Data maintenance" (administrators only): every
  change of stored data – recording rules, zones, time zones, edges of days, missing
  coordinates, fetching addresses, import, deleting entries and restoring – gets an
  entry with time, person(s), period, numbers and user. Entries stay until you delete
  them (single ones or all older than a number of days); from 300 entries on a hint
  appears.
- Trash with "Restore": before an action writes, the days concerned are saved (only the
  changed day files). "Restore" puts the whole action back; days changed since are
  listed with a warning. Restoring is logged and saved too, so it can be undone.
  Fetching addresses is only logged.
- New option "Empty the trash after … days" (default 30, 0 = never) below the log, with
  the size of the trash.
- The size of the stored location history (in total and per person) is shown below
  "Delete history automatically after … days" and in the summary of "Accuracy and
  keeping".
- "Done: … addresses found" disappears 30 seconds after the end; "Cancelled" stays until
  it is hidden.

---

- Neu: „Protokoll und Papierkorb“ unten in der Datenpflege (nur Administratoren): Jede
  Änderung gespeicherter Daten – Aufzeichnungsregeln, Zonen, Zeitzonen, Tagesrand,
  fehlende Koordinaten, Adressen nachladen, Import, Löschen von Einträgen und
  Wiederherstellen – bekommt einen Eintrag mit Zeitpunkt, Person(en), Zeitraum, Zahlen
  und Benutzer. Einträge bleiben, bis du sie löschst (einzeln oder alle älter als eine
  Anzahl Tage); ab 300 Einträgen erscheint ein Hinweis.
- Papierkorb mit „Wiederherstellen“: Bevor eine Aktion schreibt, werden die betroffenen
  Tage gesichert (nur die geänderten Tagesdateien). „Wiederherstellen“ spielt den ganzen
  Vorgang zurück; seitdem geänderte Tage werden mit Warnung aufgelistet. Auch das
  Wiederherstellen wird protokolliert und gesichert und lässt sich rückgängig machen.
  „Adressen nachladen“ wird nur protokolliert.
- Neue Einstellung „Papierkorb leeren nach … Tagen“ (Standard 30, 0 = nie) unter dem
  Protokoll, mit der Größe des Papierkorbs.
- Die Größe des gespeicherten Standortverlaufs (gesamt und je Person) steht unter
  „Verlauf automatisch löschen nach … Tagen“ und in der Kurzzeile von „Genauigkeit und
  Aufbewahrung“.
- „Fertig: … Adressen gefunden“ verschwindet 30 Sekunden nach dem Ende; „Abgebrochen“
  bleibt stehen, bis es ausgeblendet wird.

## 0.7.2

- New action "Fill in missing coordinates" in "Data maintenance" (with preview): old
  rows without coordinates get a position – at a zone from the nearest entry at the
  same place that day, else the zone's centre; "away" from an entry with the same
  address. "Away" rows without address and without any reference are deleted; zones
  that no longer exist stay unchanged.
- Fix: "Adapt data to the recording rules" no longer hides time. Old archive rows
  without coordinates (e.g. from the Pyscript archive) are not shown anywhere; a later
  entry with coordinates used to be merged into such a row and vanished with it. Now a
  stay without a position takes the position of the entry and becomes visible.
- "Close the gaps at the edges of days" ignores rows without coordinates: a 00:00 row
  without a position no longer prevents closing the gap.
- Import preview: ticking or unticking single days no longer jumps the table back to
  the top; scroll position, opened details and focus are kept.

---

- Neue Aktion „Fehlende Koordinaten ergänzen“ in der Datenpflege (mit Vorschau): Alte
  Zeilen ohne Koordinaten bekommen eine Position – an einer Zone vom zeitlich nächsten
  Eintrag am selben Ort desselben Tages, sonst aus der Zonenmitte; „unterwegs“ von einem
  Eintrag mit gleicher Adresse. „Unterwegs“-Zeilen ohne Adresse und ohne Bezug werden
  gelöscht; Zonen, die es nicht mehr gibt, bleiben unverändert.
- Fehler behoben: „Daten an die Aufzeichnungsregeln anpassen“ lässt keine Zeit mehr
  verschwinden. Alte Archivzeilen ohne Koordinaten (z. B. aus dem Pyscript-Archiv)
  werden nirgends angezeigt; ein späterer Eintrag mit Koordinaten wurde früher in eine
  solche Zeile hineingefasst und verschwand mit ihr. Jetzt übernimmt ein Aufenthalt
  ohne Position die Position des Eintrags und wird sichtbar.
- „Lücken am Tagesrand schließen“ ignoriert Zeilen ohne Koordinaten: Eine 00:00-Zeile
  ohne Position verhindert das Schließen der Lücke nicht mehr.
- Import-Vorschau: Beim An- und Abhaken einzelner Tage springt die Tabelle nicht mehr
  nach oben; Scrollposition, aufgeklappte Details und Fokus bleiben erhalten.

## 0.7.1

- Import fix: a stay that crosses Home Assistant's midnight after converting its time
  zone (e.g. a night in Bangkok) is now split at midnight and goes on at 00:00 of the
  next day. Before, it was cut off at 23:59:59 and the rest was lost – please import
  affected journeys again.
- New "Close the gaps at the edges of days": a day begins at 00:00 at the last place of
  the day before, the last stay lasts until 23:59:59 – only when the neighbouring day is
  stored. As a tick in the import preview (on by default, with the number of gaps) and
  as a new action in "Data maintenance".
- After an import, a data maintenance action or deleting, open cards ("Location
  history" with its date picker) and the diagnostics load again by themselves – no more
  browser reload needed.
- Prompt for an AI assistant: the offset from UTC is always written into `utc_offset`
  when the data has it, for every source; Google "Semantic Location History" and
  "Records.json" are taken in UTC with `+00:00` instead of converted by the assistant.
- Settings: "Import and export", "Data maintenance" and "Diagnostics" now also show a
  short summary under their title.

---

- Fehler beim Import behoben: Ein Aufenthalt, der nach der Umrechnung der Zeitzone über
  Mitternacht von Home Assistant geht (z. B. eine Nacht in Bangkok), wird jetzt an
  Mitternacht geteilt und am nächsten Tag ab 00:00 fortgesetzt. Bisher wurde er um
  23:59:59 abgeschnitten und der Rest ging verloren – betroffene Reisen bitte erneut
  importieren.
- Neu „Lücken am Tagesrand schließen“: Ein Tag beginnt um 00:00 am letzten Ort des
  Vortags, der letzte Aufenthalt reicht bis 23:59:59 – nur, wenn der Nachbartag
  gespeichert ist. Als Haken in der Import-Vorschau (standardmäßig an, mit Anzahl der
  Lücken) und als neue Aktion „Tagesrand ergänzen“ in der „Datenpflege“.
- Nach einem Import, einer Aktion der Datenpflege oder dem Löschen laden offene Karten
  („Standortverlauf“ mit Tageswähler) und die Diagnose selbst neu – kein Neuladen des
  Browsers mehr nötig.
- Text für einen KI-Assistenten: Die Abweichung von UTC wird immer in `utc_offset`
  geschrieben, wenn sie in den Daten steht, für jede Quelle; Google „Semantic Location
  History“ und „Records.json“ werden in UTC mit `+00:00` übernommen statt vom Assistenten
  umgerechnet.
- Einstellungen: „Import und Export“, „Datenpflege“ und „Diagnose“ zeigen jetzt auch eine
  kurze Zusammenfassung unter dem Titel.

## 0.7.0

- Time zones: every time is now stored with its offset from UTC. The hour from 2 to 3
  o'clock that occurs twice when the clocks go back in autumn is no longer mixed up;
  stays over the clock change keep their real length.
- Journeys: the time zone of a place outside Home Assistant's is looked up offline from
  the coordinates (new requirement tzfpy). New setting "Time in another time zone"
  (Settings → Map): both times (default), only Home Assistant's or only the local time –
  in "Location history" and "Where is…?". Summer and winter time of every place are
  taken into account; if it is another day there, the date is added. Entries stay with
  Home Assistant's day.
- Import: times with their own offset (e.g. Google Maps Timeline, recorded abroad) are
  converted to Home Assistant's time and day; missing offsets and the time zone of every
  place are added right away. CSV export: new columns `utc_offset`, `end_utc_offset` and
  `time_zone`; GPX export with exact UTC times also in the doubled hour. The prompt for
  an AI assistant asks for `utc_offset`.
- New category "Data maintenance" (administrators) between "Import and export" and
  "Diagnostics": adapt data to the recording rules, recalculate zones in the data (still
  also under Zones), new "Add time zones" for older data, fetch missing addresses.

---

- Zeitzonen: Jede Uhrzeit wird jetzt mit ihrer Abweichung von UTC gespeichert. Die
  Stunde von 2 bis 3 Uhr, die es bei der Zeitumstellung im Herbst zweimal gibt, wird
  nicht mehr vermischt; Aufenthalte über die Umstellung behalten ihre echte Dauer.
- Reisen: Die Zeitzone eines Orts außerhalb der von Home Assistant wird offline aus den
  Koordinaten bestimmt (neue Abhängigkeit tzfpy). Neue Einstellung „Uhrzeit in anderer
  Zeitzone“ (Einstellungen → Karte): beide Zeiten (Standard), nur die von Home Assistant
  oder nur die Ortszeit – im „Standortverlauf“ und in „Wo ist…?“. Sommer- und Winterzeit
  jedes Orts werden berücksichtigt; ist dort ein anderer Tag, steht das Datum dabei.
  Einträge bleiben beim Tag von Home Assistant.
- Import: Uhrzeiten mit eigener Abweichung (z. B. Google Maps Zeitachse, im Ausland
  aufgezeichnet) werden in Uhrzeit und Tag von Home Assistant umgerechnet; fehlende
  Abweichungen und die Zeitzone jedes Orts werden gleich eingetragen. CSV-Export: neue
  Spalten `utc_offset`, `end_utc_offset` und `time_zone`; GPX-Export mit exakten
  UTC-Zeiten auch in der doppelten Stunde. Der Text für einen KI-Assistenten fragt
  `utc_offset` ab.
- Neue Kategorie „Datenpflege“ (Administratoren) zwischen „Import und Export“ und
  „Diagnose“: Daten an Aufzeichnungsregeln anpassen, Zonen in den Daten neu berechnen
  (weiterhin auch unter Zonen), neu „Zeitzonen ergänzen“ für ältere Daten, Adressen
  nachholen.

## 0.6.0

- Import: CSV entries that are away or have no state get the zone they lie in, like
  GPX. The recording rules ("Same place within … metres", "At the same place store at
  most every … seconds") are applied to every import; the preview shows per day how
  many points become how many stays and how many are thinned out. A warning says that
  this cannot be undone and that the source file should be kept. Days outside the
  retention are marked and not ticked; a hint appears when recording is off for the
  person. After the import, missing addresses can be fetched with one click.
- New part "Maintain stored data" (Settings → Import and export, administrators):
  "Adapt data to the recording rules" applies today's rules to stored days, with
  persons, period and a preview.
- "Fetch missing addresses": a background job looks up the address of stays away
  without one at OpenStreetMap – exactly one request per second, places close
  together only once, with progress, pause and cancel; it goes on after a restart of
  Home Assistant.
- Zones: "Recalculate zones in the data" (Settings → Zones → Choose and colour zones,
  administrators) gives every stored entry the zone it lies in today – choice of
  zones, persons and period, with a preview. A renamed zone gives its entries the new
  name; entries of a deleted zone become away and can get an address. When zones were
  added, changed, renamed or removed in Home Assistant, the settings page asks
  administrators once: "Recalculate", "Later" or "Don't ask again".
- The AI text ("Have data from another app converted") now also converts exports of
  the Google Maps Timeline (phone export Timeline.json, older Takeout exports
  "Semantic Location History" and Records.json) and large files (via a short script).

---

- Import: CSV-Einträge, die unterwegs sind oder keinen Zustand haben, bekommen wie bei
  GPX die Zone, in der sie liegen. Die Aufzeichnungsregeln („Gleicher Ort bis … Meter“,
  „Am selben Ort höchstens alle … Sekunden speichern“) gelten für jeden Import; die
  Vorschau zeigt pro Tag, aus wie vielen Punkten wie viele Aufenthalte werden und wie
  viele ausgedünnt werden. Ein Hinweis sagt, dass das unwiderruflich ist und die
  Quelldatei aufbewahrt werden sollte. Tage außerhalb der Aufbewahrung sind markiert
  und nicht angehakt; ist für die Person die Aufzeichnung aus, erscheint ein Hinweis.
  Nach dem Import lassen sich fehlende Adressen mit einem Klick nachholen.
- Neuer Teil „Gespeicherte Daten pflegen“ (Einstellungen → Import und Export,
  Administratoren): „Daten an Aufzeichnungsregeln anpassen“ wendet die heutigen Regeln
  auf gespeicherte Tage an – mit Personen, Zeitraum und Vorschau.
- „Adressen nachholen“: Ein Auftrag im Hintergrund schlägt für Aufenthalte unterwegs
  ohne Adresse die Adresse bei OpenStreetMap nach – genau eine Anfrage pro Sekunde,
  nahe Orte nur einmal, mit Fortschritt, Pause und Abbrechen; nach einem Neustart von
  Home Assistant geht es weiter.
- Zonen: „Zonen in den Daten neu berechnen“ (Einstellungen → Zonen → Zonen auswählen
  und einfärben, Administratoren) gibt jedem gespeicherten Eintrag die Zone, in der er
  heute liegt – Auswahl von Zonen, Personen und Zeitraum, mit Vorschau. Eine
  umbenannte Zone gibt ihren Einträgen den neuen Namen; Einträge einer gelöschten Zone
  werden „unterwegs“ und können eine Adresse bekommen. Wurden in Home Assistant Zonen
  angelegt, geändert, umbenannt oder gelöscht, fragt die Einstellungsseite
  Administratoren einmal: „Neu berechnen“, „Später“ oder „Nicht mehr fragen“.
- Der KI-Text („Daten aus einer anderen App umwandeln lassen“) wandelt jetzt auch
  Exporte der Google-Maps-Zeitachse um (Handy-Export Timeline.json, ältere
  Takeout-Exporte „Semantic Location History“ und Records.json) sowie große Dateien
  (über ein kurzes Skript).

## 0.5.3

- Settings, map: the CARTO key now comes before the CARTO styles. It is no longer
  marked as an own value (no dot, no arrow back to the standard) and has nothing to
  do with "Reset to standard"; only "Remove" next to it takes it away.
- Settings page split into several files, one per area (settings-*.js) – same
  behaviour, easier to maintain.
- Screenshot check on GitHub: every push photographs the sidebar page in a fake Home
  Assistant (computer, phone upright and sideways, light and dark), reports
  JavaScript errors and shows which pictures changed.

---

- Einstellungen, Karte: Der CARTO-Schlüssel steht jetzt vor den CARTO-Kartenstilen. Er
  gilt nicht mehr als eigener Wert (kein Punkt, kein Pfeil zurück zum Standard) und
  hat mit „Auf Standard zurücksetzen“ nichts zu tun; entfernt wird er nur über
  „Entfernen“ daneben.
- Einstellungsseite in mehrere Dateien je Bereich aufgeteilt (settings-*.js) – gleiches
  Verhalten, leichter zu pflegen.
- Bildschirmprüfung auf GitHub: Jeder Push fotografiert die Seitenleisten-Seite in einem
  nachgebauten Home Assistant (Computer, Handy hochkant und quer, hell und dunkel),
  meldet JavaScript-Fehler und zeigt, welche Bilder sich geändert haben.

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
