# Eigener Standort und Alarm bei ISS-Nähe

## Kontext & Problemstellung
Die App zeigt die ISS, kennt aber keinen Bezug zum Nutzer. Wer wissen will, wann die Station "über mir" ist, muss selbst Koordinaten mit der Karte vergleichen. Dieses Feature lässt den Nutzer seinen eigenen Standort angeben - per Adresseingabe oder per Klick auf der Karte - und alarmiert ihn, sobald die ISS in einen einstellbaren Radius eintritt.

Das Feature ist kein Punkt des PRD (F1-F4, B1-B4) und ergänzt die App um einen persönlichen Bezug. Es bleibt reine Client-Logik; das Backend wächst nur um einen Geocoding-Proxy, weil die Adresssuche serverseitig erfolgen muss (siehe unten).

## Anforderungen
- [ ] Als Nutzer möchte ich meinen Standort per Adresse eingeben können, damit ich keine Koordinaten kennen muss.
- [ ] Als Nutzer möchte ich meinen Standort alternativ durch einen Klick auf der Karte setzen können, damit ich ohne Adresse auskomme.
- [ ] Der Kartenklick setzt den Standort **nur in einem eigenen Modus** ("Standort auf Karte wählen"), damit normales Verschieben/Zoomen der Karte nichts verstellt.
- [ ] Als Nutzer möchte ich einen Alarm-Radius wählen können (100/250/500 km), damit ich Nähe selbst definiere.
- [ ] Als Nutzer möchte ich alarmiert werden, wenn die ISS in diesen Radius **eintritt** - per Hinweis in der App, per Ton und (mit Erlaubnis) per Browser-Benachrichtigung.
- [ ] Der Alarm wird **einmal pro Annäherung** ausgelöst, nicht bei jedem Poll. Verlässt die ISS den Radius, wird für die nächste Annäherung wieder scharfgeschaltet.
- [ ] Als Nutzer möchte ich die aktuelle Entfernung zur ISS sehen, solange ein Standort gesetzt ist.
- [ ] Standort und Radius überleben einen Reload (localStorage).
- [ ] Das Setzen des Standorts beeinflusst den Follow-Modus der Karte **nicht**.
- [ ] Die Browser-Benachrichtigung wird nur nach ausdrücklicher Erlaubnis (Button) angefordert; bei verweigerter oder fehlender Berechtigung bleibt der In-App-Hinweis als Rückfallebene. Es gibt nie einen unbehandelten Fehler.
- [ ] Die Adresssuche läuft über einen serverseitigen Proxy; der Browser ruft Nominatim nicht direkt auf.
- [ ] Das bestehende Polling-Verhalten (5 s Intervall, 12 s Timeout, Schutz vor überlappenden Anfragen) bleibt unverändert.

## Definition of Done
- [ ] Adresse eingeben und suchen setzt einen Standort (Kreis + Standortpunkt auf der Karte, Entfernungszeile im Panel).
- [ ] Der Kartenklick-Modus setzt den Standort; außerhalb des Modus ändert ein Klick nichts.
- [ ] Eintritt in den Radius erzeugt genau einen Alarm; weitere Polls im Radius erzeugen keinen zweiten.
- [ ] Verlassen und erneuter Eintritt erzeugt einen zweiten Alarm.
- [ ] Radiuswechsel zeichnet den Kreis neu und löst selbst keinen Ton aus.
- [ ] Ohne Berechtigung erscheint der Alarm nur in der App, ohne Konsolenfehler.
- [ ] Nach einem Reload sind Standort und Radius wiederhergestellt.
- [ ] Automatisierte Tests vorhanden und grün (siehe Abschnitt "Tests").
- [ ] Review: keine neuen Konsolenfehler, kein Mixed-Content-Fehler.

## Betroffene Bereiche & Technik

**Neu: `app/lib/geo.js`** - Distanz und Nähe-Erkennung, Leaflet-frei:
- `distanceKm(a, b)` - Haversine-Distanz in km, `null` bei ungültiger Eingabe (damit "unbekannt" nicht als 0 km missverstanden wird).
- `isWithinRadius(position, center, radiusKm)` - `false` bei ungültiger Position, fehlendem Zentrum oder `radiusKm <= 0`; Distanz genau gleich Radius gilt als innerhalb.
- `evaluateProximity(previousInside, position, center, radiusKm)` -> `{ inside, distanceKm, entered, left }`. Reine Zustandsmaschine mit Flankenerkennung: `entered` nur beim Übergang außen->innen, `left` nur innen->außen. Ungültige Position oder fehlendes Zentrum lassen den Zustand unverändert und liefern `entered: false` - ein fehlgeschlagener Poll darf weder Alarm auslösen noch die Scharfschaltung verlieren.

**Neu: `app/lib/userLocation.js`** - `RADIUS_OPTIONS = [100, 250, 500]`, `DEFAULT_RADIUS_KM = 250`, `normalizeUserLocation` (prüft lat ∈ [-90, 90], lon ∈ [-180, 180], gibt eine neue Kopie oder `null`), `isRadiusOption`, `radiusLabel`, `formatDistanceKm` und `formatUserLocation` (de-DE).

**Neu: `app/lib/alert.js`** - Alarmmittel, über injizierte Konstruktoren testbar, wirft nie:
- `playAlarmBeep(context, options)` - WebAudio-Oszillator + Gain-Rampe. Bewusst **keine Audiodatei**: Es gibt kein `public/`-Verzeichnis.
- `notificationSupport(NotificationCtor)` -> `"unsupported" | "default" | "granted" | "denied"`.
- `showProximityNotification(NotificationCtor, options)` -> `boolean`; nur bei "granted" eine Benachrichtigung, sonst `false` (Rückfall auf den In-App-Hinweis).

**Neu: `app/lib/geocode.js`** - `parseGeocodeResults(payload)` filtert die Antwort der Route auf `{ label, latitude, longitude }` und verträgt `null`/Nicht-Arrays, ohne zu werfen.

**Neu: `app/api/geocode/route.js`** - Proxy zur Ortssuche, gebaut nach dem Muster von `app/api/astros/route.js`:
- Fragt `https://nominatim.openstreetmap.org/search` mit `q`, `format=jsonv2`, `limit=5`, `addressdetails=0`, `accept-language=de` ab.
- Nominatim verlangt einen identifizierenden `User-Agent` - hartkodiert im Modul, siehe `CLAUDE.md`.
- Nur Submit-basiert (kein "Suchen während des Tippens"), um das Rate-Limit (~1 Anfrage/s) zu schonen; zusätzlich Cache-Header (`s-maxage=86400`, `stale-while-revalidate=300`) und Upstream-Cache.
- Zu kurze (< 3 Zeichen) oder überlange (> 200 Zeichen) Anfragen werden mit 400 beantwortet, **ohne** Upstream-Aufruf.
- `export const revalidate = 86400;` als Literal (Segment-Config) und `export const dynamic = "force-dynamic";`.

**`app/components/IssMap.jsx`** - neue Props `userLocation`, `radiusKm`, `onMapClick`, `picking` (inkl. gespiegelter Refs). Neuer Modul-Helfer `applyUserLocation` zeichnet einen `L.circle` (Radius in **Metern**, also `km * 1000`) und einen `L.circleMarker`; beide `interactive: false`, damit sie keine Klicks schlucken. Neuer `map.on("click", ...)`-Handler mit Cleanup, der nach einem Drag nicht auslöst (`draggedRef`-Guard). Der Kartenklick ruft `onUserDrag` **nicht** auf - der Follow-Modus bleibt unangetastet.

**`app/components/IssTracker.jsx`** - neue Zustände (Standort, Radius, Klick-Modus, Adresse, Geocoding-Status/-Fehler/-Treffer, Entfernung, Alarm, Benachrichtigungs-Berechtigung, Ton-/Benachrichtigungs-Schalter). Nach jedem erfolgreichen Poll entscheidet `evaluateProximity`; nur bei `entered` läuft `triggerAlarm` (Banner, Ton, Benachrichtigung). Persistenz unter `"iss-tracker:standort:v1"` in `localStorage`, Wiederherstellung im `useEffect` (nicht beim Rendern) und durchgängig in `try/catch`, weil Private Mode werfen kann.

**`app/globals.css`** - neue Klassen `.standort*`, `.alert--alarm`, `.alert__dismiss`, `.map--picking`; wiederverwendet werden `--accent`, `--danger-*`, `.alert`, `.switch`, `.switches`, `.facts`, `.panel`.

## Tests
Runner: Vitest, Konvention `app/**/*.test.js(x)` wie in den Features 001-005; Komponententests mit `@testing-library/react`.
- [ ] Unit `app/lib/geo.test.js`: bekannte Distanz (Berlin-Paris ca. 878 km) mit Toleranz; identische Punkte = 0; Antimeridian-Paar (+179/-179) ergibt eine kleine Distanz; antipodale Punkte ca. 20015 km; ungültige Eingaben liefern `null`.
- [ ] Unit: `isWithinRadius` innen, außen, exakt auf der Grenze, bei `radiusKm <= 0` und bei ungültiger Position.
- [ ] Unit `app/lib/geo.test.js`: alle vier Übergänge von `evaluateProximity` - außen->innen (`entered`), innen->innen (kein Flag), innen->außen (`left`), außen->außen (kein Flag).
- [ ] Unit: `evaluateProximity` behält bei ungültiger Position den vorherigen Zustand bei und liefert `entered: false`; ohne Zentrum nie `entered`.
- [ ] Unit `app/lib/userLocation.test.js`: `normalizeUserLocation` akzeptiert Zahlen und numerische Strings, lehnt out-of-range, `null`, `NaN` und Komma-Strings ab; Randwerte ±90/±180 sind gültig; keine Mutation der Eingabe.
- [ ] Unit: `formatDistanceKm` (de-DE) und `formatUserLocation` liefern bei ungültiger Eingabe "–"; `isRadiusOption`/`radiusLabel` verhalten sich wie festgelegt.
- [ ] Unit `app/lib/geocode.test.js`: gültige Treffer werden gemappt, Einträge mit ungültigen Koordinaten verworfen, `null`/Nicht-Array ergibt `[]`, kein Throw.
- [ ] Unit `app/lib/alert.test.js`: `playAlarmBeep` startet/stoppt Oszillator und Gain an einem Doppel und wirft bei `null`-Context nicht; `notificationSupport` liefert für alle vier Fälle den richtigen Wert; `showProximityNotification` erzeugt nur bei "granted" eine Benachrichtigung und wirft sonst nie.
- [ ] Route `app/api/geocode/route.test.js` (`// @vitest-environment node`): Aufruf der Nominatim-URL mit `q`-Parameter; **nicht-leerer `User-Agent`-Header**; Mapping auf `{ label, latitude, longitude }`; Verwerfen ungültiger Treffer; leerer/zu kurzer `q` -> 400 ohne Upstream-Aufruf; Upstream-Fehlerstatus -> 502; Netzwerkfehler -> 502 statt Throw; unlesbare Antwort -> 502; `Cache-Control` enthält `s-maxage=86400`.
- [ ] Komponente `IssMap.test.jsx`: `map.on("click")` ist registriert; ein ausgelöster Klick ruft `onMapClick` mit den Koordinaten; `userLocation` gesetzt zeichnet `L.circle` mit `radius: km * 1000` und `interactive: false`; ein Radiuswechsel zeichnet neu (`clearLayers`); ohne Standort kein Kreis; Unmount meldet `click` wieder ab; der Klick ruft `onUserDrag` nicht.
- [ ] Komponente `IssTracker.test.jsx`: Adresseingabe + Submit setzt den Standort (Fetch mit kodierter Adresse); 0 Treffer zeigt einen Fehlertext; mehrere Treffer erscheinen zur Auswahl; Kartenklick setzt Standort und Entfernungszeile; die Entfernungszeile aktualisiert sich über die Polls.
- [ ] Komponente (Flanke): ISS erst außerhalb -> kein Alarm; nach weiteren Polls innerhalb -> Alarmbanner genau einmal; weitere Polls innen -> weiterhin genau einmal; verlassen und erneut eintreten -> zweiter Alarm.
- [ ] Komponente: Bei Berechtigung "granted" wird beim Alarm eine Benachrichtigung erzeugt; bei "denied" gibt es keinen Fehler und der Banner erscheint trotzdem; ohne Ton-Schalter wird kein Beep gespielt; ein Radiuswechsel löst keinen Beep aus.
- [ ] Komponente: localStorage - gespeicherter Standort/Radius wird beim Mount wiederhergestellt; Änderungen werden gespeichert; ein werfendes `getItem` lässt die App mit Defaults starten.
- [ ] Komponente (Regression): Unmount stoppt das Polling weiterhin.

## Umsetzungsideen / Hinweise (optional)
- Der Alarm hängt bewusst an **einer** reinen Funktion (`evaluateProximity`); die Komponente macht nur noch Seiteneffekte. Dadurch ist "einmal pro Annäherung" ohne Browser prüfbar.
- Kein `navigator.geolocation`: Der Standort kommt aus Adresse oder Kartenklick. Das vermeidet eine zusätzliche Berechtigungsabfrage und passt zu einer Übung ohne Backend.
- Der `AudioContext` wird erst in einer Nutzergeste erzeugt und `resume()`t (Autoplay-Policy); der Ton wird ohne Audiodatei erzeugt, weil es kein `public/` gibt.
- Radius und Standort sind echte Nutzereinstellungen und werden deshalb - anders als der Gast aus Feature 005 - in `localStorage` gehalten.
- Bekannte Grenze: Die ISS fliegt rund 7,7 km/s; bei 5-Sekunden-Polling kann der Alarm bis etwa 38 km "früh" oder "spät" liegen. Für einen Hinweis ist das ausreichend.

## Offene Fragen / Abhängigkeiten (optional)
- Soll die Adresse zusätzlich als Text gespeichert und angezeigt werden? Annahme: nein - gespeichert werden nur Koordinaten und Radius, kein Verlauf.
- Soll ein Radiuswechsel einen laufenden Alarm neu bewerten? Annahme: Der Flankenzustand wird zurückgesetzt, aber kein Ton ausgelöst; der nächste Poll alarmiert nur, wenn die ISS weiterhin innerhalb ist.
- Soll der Standort auch per Tastatureingabe von Koordinaten setzbar sein? Annahme: nein, Adresse und Karte genügen.
