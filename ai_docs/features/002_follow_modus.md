# Karte folgt der ISS (Bonus B2)

## Kontext & Problemstellung
Die Karte bleibt beim Standard-Zoom auf einem großen Ausschnitt stehen. Bei höherem Zoom wandert der Marker nach wenigen Sekunden aus dem sichtbaren Bereich, und der Nutzer muss ständig manuell nachziehen. Ein Follow-Modus hält die ISS automatisch im Blick.

## Anforderungen
- [ ] Als Nutzer möchte ich per Schalter aktivieren, dass die Karte automatisch zur aktuellen ISS-Position schwenkt, damit der Marker nicht aus dem Bild läuft.
- [ ] Follow ist standardmäßig **aktiv** (die App startet zentriert auf der ISS).
- [ ] Bei aktivem Follow zentriert die Karte nach jedem erfolgreichen Poll auf die neue Position.
- [ ] Die Zentrierung erfolgt ohne Zoom-Änderung (Zoom bleibt nutzerkontrolliert).
- [ ] Sobald der Nutzer die Karte selbst per Drag verschiebt, schaltet Follow automatisch **aus** (Nutzerabsicht hat Vorrang), der Schalter spiegelt das wider.
- [ ] Die automatische Zentrierung nutzt kein `setView` mit Animation-Konflikt: laufende Animationen dürfen sich nicht stapeln.
- [ ] Ausschalten von Follow verändert die Karte nicht mehr (Position bleibt stehen).
- [ ] Beim Deaktivieren darf die Seite nicht springen oder flackern.

## Definition of Done
- [ ] Bei aktivem Follow bleibt der Marker über 60 s bei Zoom 8 sichtbar im Bild.
- [ ] Manuelles Verschieben deaktiviert Follow erkennbar (Schalterstellung + Verhalten).
- [ ] Erneutes Aktivieren zentriert beim nächsten Poll wieder auf die ISS.
- [ ] Automatisierte Tests vorhanden und grün (siehe Abschnitt "Tests").
- [ ] Review: kein Speicherleck durch Event-Listener (Listener werden beim Unmount entfernt).

## Betroffene Bereiche & Technik
- `app/components/IssMap.js`: `focus`-Logik erweitern; `focusedRef` existiert bereits in `applyPosition` und ist der natürliche Anknüpfungspunkt.
- `app/components/IssTracker.js`: State `follow` (Default `true`) und Übergabe als Prop; Schalter im UI-Bereich neben den Messwerten.
- Leaflet: `map.setView(latlng, map.getZoom(), { animate: true, duration: 0.5 })` bzw. `map.panTo`.
- Drag-Detektion: `map.on("dragstart", ...)` -> `setFollow(false)`; Listener in `useEffect`-Cleanup entfernen.
- Gegenrichtung (Programmatik vs. Nutzerinteraktion): eine laufende Animation darf das `dragstart`-Event nicht selbst auslösen; ggf. Flag `isAutoPanning` setzen und im Handler prüfen.

## Tests
Runner: Vitest (Einführung siehe Feature 001; Konvention `app/**/*.test.js(x)`).
- [ ] Unit: `shouldRecenter(follow, hasPosition)` liefert `true` nur bei aktivem Follow und vorhandener Position.
- [ ] Unit: `dragstart`-Handler setzt `follow` auf `false`.
- [ ] Unit: Bei `follow === false` wird `setView`/`panTo` nicht aufgerufen (Leaflet-Mock mit Spion).
- [ ] Unit/Komponente (jsdom + Leaflet-Mock): Prop-Wechsel `follow: true -> false` löst keinen weiteren Zentrier-Aufruf aus.
- [ ] Edge: `follow === true`, aber noch keine Position (`position === null`) -> kein Zentrier-Aufruf, kein Fehler.

## Umsetzungsideen / Hinweise (optional)
- Schalter als Checkbox mit Label "Karte folgt ISS" im bestehenden Werte-Panel, damit kein neues Layout nötig ist.
- Falls der automatische Zoom-Fit beim ersten Laden gewünscht ist: einmalig `fitBounds`/`setView` mit fester Zoomstufe, danach nur noch `panTo`.

## Offene Fragen / Abhängigkeiten (optional)
- Soll Follow nach manuellem Drag automatisch wieder angehen, wenn der Nutzer den Schalter erneut aktiviert? Annahme: ja, nur explizit per Schalter.
- Startzoom: Annahme 4 (Weltüberblick), die ISS muss beim ersten Poll sichtbar sein.
