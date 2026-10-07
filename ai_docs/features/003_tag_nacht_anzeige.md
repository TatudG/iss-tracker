# Tag/Nacht-Anzeige (Bonus B3)

## Kontext & Problemstellung
Das Feld `visibility` der API liefert, ob die ISS gerade von der Sonne beleuchtet ist oder im Erdschatten fliegt. Aktuell erscheint der Wert nur als Textzeile ("Sichtbarkeit: Tag (von der Sonne beleuchtet)"). Der Zustand ist damit schlecht auf einen Blick erfassbar.

## Anforderungen
- [ ] Als Nutzer möchte ich auf einen Blick erkennen, ob die ISS gerade beleuchtet ist oder nicht, damit ich den Zustand nicht aus einem Satz herauslesen muss.
- [ ] Der Zustand wird als visuelles Badge am ISS-Marker dargestellt (Sonne bzw. Mond, farblich unterschieden).
- [ ] Zusätzlich bleibt die textliche Ausgabe in der Werte-Liste erhalten (Redundanz für Barrierefreiheit, nicht nur Farbe als Informationsträger).
- [ ] Farbe ist nicht das einzige Unterscheidungsmerkmal (Icon + Text zusätzlich).
- [ ] Unbekannte oder fehlende Werte (`visibility` weder `daylight` noch `eclipsed`) werden als "unbekannt" dargestellt und dürfen keinen Fehler werfen.
- [ ] Der Marker aktualisiert das Badge bei jedem erfolgreichen Poll (innerhalb von ca. 5 s).
- [ ] Der Zustand ist auch bei kleinen Bildschirmbreiten lesbar.

## Definition of Done
- [ ] Badge wechselt sichtbar zwischen Tag- und Nachtzustand, sobald die API den Wert ändert (manuell mit gemockter Antwort prüfbar).
- [ ] Werte-Liste zeigt weiterhin den Klartext ("Tag"/"Nacht").
- [ ] Unbekannter Wert führt zu "unbekannt", nicht zu einem leeren oder kaputten Badge.
- [ ] Automatisierte Tests vorhanden und grün (siehe Abschnitt "Tests").
- [ ] Review: Kontrastverhältnis der Badge-Farben ausreichend (WCAG AA für Text auf Badge).

## Betroffene Bereiche & Technik
- `app/components/IssTracker.js`: `formatVisibility()` existiert bereits (Zeile ~33) und liefert den Klartext. Erweiterung um eine Funktion `visibilityState(visibility)` -> `"day" | "night" | "unknown"`.
- `app/components/IssMap.js`: `createIssIcon()` erweitern oder ein zweites Icon erzeugen; Position/Badge am Marker anhängen, Umschalten per `marker.setIcon(...)`.
- `app/globals.css`: Badge-Styling (Farbe, Form, Abstand), Klassen für Tag/Nacht/Unbekannt.
- Kein Backend, kein zusätzlicher API-Call - `visibility` ist bereits Teil der bestehenden Antwort.

## Tests
Runner: Vitest (Einführung siehe Feature 001; Konvention `app/**/*.test.js(x)`).
- [ ] Unit: `visibilityState("daylight") === "day"`.
- [ ] Unit: `visibilityState("eclipsed") === "night"`.
- [ ] Unit: `visibilityState("unknown")`, `visibilityState(undefined)` und `visibilityState(null)` liefern `"unknown"` (kein Throw).
- [ ] Unit: `formatVisibility` behält den bestehenden Klartext für `daylight`/`eclipsed` (Regressionsschutz).
- [ ] Komponente (Leaflet-Mock): Bei Wechsel `daylight -> eclipsed` wird `setIcon` genau einmal mit dem Nacht-Icon aufgerufen.

## Umsetzungsideen / Hinweise (optional)
- Icon-Aufbau: kleiner Kreis mit Sonnen-/Mondsymbol aus `icon.svg`-Stil oder Unicode (☀/☾) als Text im Badge - spart Assets.
- Zustand farbcodiert: warmes Gelborange für Tag, dunkles Blau/Violett für Nacht, Grau für unbekannt; zusätzlich Textlabel.
- `aria-label` am Badge setzen (z. B. "Sichtbarkeit: Tag"), damit Screenreader den Zustand vorlesen.

## Offene Fragen / Abhängigkeiten (optional)
- Soll das Badge am Marker hängen oder zusätzlich im Werte-Panel erscheinen? Annahme: am Marker, das Panel behält den Klartext.
- Ist eine Unterscheidung "beleuchtet, aber nicht sichtbar von der Erde" nötig? Das liefert die API nicht - daher nicht im Scope.
