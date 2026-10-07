# Astronauten-Liste (Bonus B4)

## Kontext & Problemstellung
Die App zeigt nur technische Bahndaten. Interessant ist auch, wer aktuell an Bord ist. `http://api.open-notify.org/astros.json` liefert diese Liste, ist aber **nur über HTTP** erreichbar. Eine HTTPS-Seite darf diese Anfrage nicht direkt stellen ("Mixed Content") - der Browser würde sie blockieren. Deshalb ist für dieses Feature ein schmaler Proxy nötig.

## Anforderungen
- [ ] Als Nutzer möchte ich die Namen aller Personen an Bord sehen, damit ich weiß, wer gerade auf der ISS ist.
- [ ] Die Liste wird getrennt von den ISS-Positionsdaten geladen (eigener Request, eigener Fehlerzustand).
- [ ] Der Zugriff erfolgt über eine eigene Route `GET /api/astros` im App Router, die serverseitig `http://api.open-notify.org/astros.json` abruft.
- [ ] Die Route filtert das Feld `craft === "ISS"` heraus und liefert eine schlanke JSON-Antwort (`{ count, people: [{ name, craft }] }`).
- [ ] Die Route antwortet mit Cache-Headern (`Cache-Control: s-maxage=3600`) - die Liste ändert sich nur bei Crew-Wechsel.
- [ ] Die Route liefert bei Fehlern des Upstreams einen definierten Status (502) mit JSON-Fehlerobjekt, niemals eine HTML-Fehlerseite.
- [ ] Das Frontend zeigt bei Fehler einen verständlichen Hinweis und die Positionsanzeige läuft unabhängig weiter.
- [ ] Der Proxy wird **nicht** von der Positions-Polling-Schleife aufgerufen (eigener Ladezyklus, z. B. einmal beim Start plus manueller Refresh).
- [ ] Mitigation des Upstream-Fehlers in `craft`-Feld: Der Feldname ist in der Open-Notify-Antwort ein bekannter Sonderfall und wird beim Parsen explizit behandelt, nicht implizit.
- [ ] In der Browser-Konsole darf kein Mixed-Content-Fehler auftauchen.

## Definition of Done
- [ ] `GET /api/astros` liefert lokal JSON mit `count` und `people`.
- [ ] Browser: Liste zeigt Namen und Anzahl, ohne Konsolenfehler.
- [ ] Bei simuliertem Upstream-Ausfall (z. B. Proxy-Test mit ungültiger URL) erscheint der Fehlerhinweis und die Positionsanzeige bleibt intakt.
- [ ] Automatisierte Tests vorhanden und grün (siehe Abschnitt "Tests").
- [ ] Review: keine Secrets/Keys im Code, keine HTTP-Anfrage aus dem Browser an Open Notify.

## Betroffene Bereiche & Technik
- Neu: `app/api/astros/route.js` (Route Handler, App Router). Nutzt `fetch` mit `cache: "no-store"` optional bzw. Next-Cache-Revalidierung; Response via `Response.json(...)`.
- Neu: `app/components/AstronautList.js` (Client-Komponente): lädt `/api/astros`, zeigt Lade-, Fehler- und Erfolgszustand.
- `app/components/IssTracker.js`: Komponente einbinden; Fehlerbehandlung sauber trennen, damit ein Astronauten-Fehler den Polling-Timer nicht beeinflusst.
- `app/globals.css`: Listen-Styling.
- Architektur-Hinweis aus dem PRD: Der Proxy ist die ausdrücklich erlaubte Ausnahme vom "kein Backend"-Grundsatz.

## Tests
Runner: Vitest (Einführung siehe Feature 001; Konvention `app/**/*.test.js(x)`; Route-Handler direkt als Funktion importieren und mit gemocktem globalem `fetch` testen).
- [ ] Unit (Route, Happy Path): Gemockte Upstream-Antwort mit drei Personen, davon zwei `craft: "ISS"` -> Antwort enthält `count: 2` und nur ISS-Personen.
- [ ] Unit (Route, Edge): Gemockte Antwort mit leerem `people`-Array -> `count: 0`, Status 200, kein Fehler.
- [ ] Unit (Route, Edge): Unbekannter `craft`-Wert wird nicht als ISS gezählt.
- [ ] Unit (Route, Fehlerfall): Upstream antwortet 500 -> Proxy liefert 502 mit JSON-Fehlerobjekt (kein HTML).
- [ ] Unit (Route, Fehlerfall): `fetch` wirft (Netzwerkfehler) -> 502, kein unbehandelter Throw (Regressionstest für die Fehlerbehandlung).
- [ ] Komponente: Fehlerantwort der eigenen Route -> Fehlerhinweis sichtbar, Liste leer, kein Crash.
- [ ] Komponente: Erfolgsantwort -> alle Namen gerendert, Anzahl stimmt mit `count` überein.

## Umsetzungsideen / Hinweise (optional)
- Route Handler ist in Next.js 15 standardmäßig dynamisch, wenn `Request` genutzt wird; für statisches Caching explizit `export const revalidate = 3600;` setzen.
- Upstream-Timeout mit `AbortSignal.timeout(5000)` absichern, damit die Route nicht hängt.
- Antwortform bewusst klein halten (nur `name`), um keine unnötigen Daten an den Client zu schicken.
- Anzahl der Astronauten als kleiner Zähler im UI ("5 Personen an Bord") - sofort erfassbar.

## Offene Fragen / Abhängigkeiten (optional)
- Soll die Liste automatisch aktualisiert werden (z. B. stündlich) oder nur mit manuellem Refresh? Annahme: einmal beim Laden plus manueller Refresh-Button.
- Wird die Route im Deployment (Vercel) durch das kostenlose Kontingent abgedeckt? Annahme: ja, ein Request pro Seitenaufruf.
- Kein Ersatz-Endpunkt bekannt, falls Open Notify dauerhaft ausfällt; der Fehlerhinweis muss also eigenständig verständlich sein.
