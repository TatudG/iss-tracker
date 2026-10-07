# Flugspur der ISS (Bonus B1)

## Kontext & Problemstellung
Die App zeigt nur den aktuellen Punkt der ISS. Nutzer können nicht erkennen, woher die Station kam und wohin sie fliegt. Eine sichtbare Spur der letzten Positionen macht die Bewegung nachvollziehbar (Richtung, Geschwindigkeit, Überflug-Muster).

## Anforderungen
- [ ] Als Nutzer möchte ich die zuletzt abgerufenen Positionen als zusammenhängende Linie auf der Karte sehen, damit ich die Flugrichtung erkenne.
- [ ] Die Spur wächst mit jedem erfolgreichen Poll (alle ca. 5 s) um einen Punkt.
- [ ] Die Spur ist auf eine feste Maximallänge begrenzt (z. B. letzte 20 Punkte), damit sie nicht über viele Stunden unbegrenzt weiterläuft.
- [ ] Beim Überschreiten der Maximallänge fällt der älteste Punkt weg (Sliding Window).
- [ ] Ein Datumsgrenzen-Wechsel (Sprung von +180° auf −180°) darf keine quer über die Karte laufende Linie erzeugen.
- [ ] Die Spur wird nur aus erfolgreichen API-Antworten gespeist; Fehlversuche erzeugen keine Punkte.
- [ ] Ein Schalter (Checkbox/Button) blendet die Spur ein und aus.
- [ ] Verhalten bei Reload ist dokumentiert (Standard: Spur startet leer).

## Definition of Done
- [ ] Nach ca. 1 Minute Laufzeit ist eine Linie mit mehreren Segmenten sichtbar und folgt dem Marker.
- [ ] Beim Überschreiten der Maximallänge bleibt die Länge konstant.
- [ ] Kein Segment kreuzt die Karte bei einem Datumsgrenzen-Wechsel (oder die Lücke ist bewusst und dokumentiert).
- [ ] Aus-/Einschalten funktioniert ohne Neuladen und ohne Fehler in der Konsole.
- [ ] Automatisierte Tests vorhanden und grün (siehe Abschnitt "Tests").
- [ ] Review: keine neuen Konsolenfehler, kein Mixed-Content-Fehler.

## Betroffene Bereiche & Technik
- `app/components/IssTracker.js`: Punkte-Historie im State/Ref führen (z. B. `trackRef`), Max-Länge erzwingen, an `IssMap` durchreichen.
- `app/components/IssMap.js`: `L.polyline` zusätzlich zum Marker; Polyline bei jedem Update per `setLatLngs` aktualisieren statt neu zu erzeugen; Aufräumen beim Unmount.
- Datumsgrenzen-Behandlung: Punkt in mehrere Segmente splitten, wenn `|Δlng| > 180`, statt eine durchgehende Polyline zu zeichnen.
- Kein Backend, kein neuer API-Call - reine Client-Logik.

## Tests
Runner: Vitest (im Projekt noch nicht vorhanden -> als Teil dieses Features einführen, `frontend`-Konvention hier: `app/**/*.test.js(x)`, Konfiguration über `vitest.config.mjs`).
- [ ] Unit: Historie fügt bei jedem Poll einen Punkt hinzu.
- [ ] Unit: Bei 20 Punkten bleibt die Länge nach dem 21. Poll bei 20, ältester Punkt ist entfernt.
- [ ] Unit: Fehlgeschlagener Poll (abgelehnte Promise) erzeugt keinen Punkt und lässt die bestehende Spur unverändert.
- [ ] Unit: Zwei Punkte mit Längengraden +179 und −179 erzeugen zwei Segmente statt eines Karten-überspannenden Segments (Happy-Path: +10 und +12 erzeugen ein Segment).
- [ ] Unit: Schalter aus -> Polyline hat keine sichtbaren Pfade; Schalter ein -> bestehende Punkte werden sofort wieder gezeichnet.

## Umsetzungsideen / Hinweise (optional)
- Reine Hilfsfunktion `appendTrackPoint(points, nextPoint, maxLength)` und `splitAtAntimeridian(points)` auslegen, damit sie ohne Leaflet testbar sind.
- Leaflet-Objekte in `useRef` halten, um Re-Render-Flackern zu vermeiden.
- Farbe/Deckkraft so wählen, dass die Spur auf OpenStreetMap-Kacheln lesbar ist.

## Offene Fragen / Abhängigkeiten (optional)
- Maximallänge: 20 Punkte (ca. 100 s) oder zeitbasiert (z. B. letzte 10 Minuten)? Annahme: 20 Punkte.
- Soll die Spur im LocalStorage überleben oder nach Reload leer starten? Annahme: leer.
