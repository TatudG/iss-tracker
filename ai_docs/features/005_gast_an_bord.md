# Gast an Bord

## Kontext & Problemstellung
Die Besatzungsliste zeigt ausschließlich die echte Crew der ISS. Für Vorführungen und zum Spaß soll zusätzlich ein Gast auftauchen können - ohne die Anzeige der echten Daten zu verfälschen und ohne den Proxy oder die API anzufassen. Der Gast ist reine Client-Kosmetik: er wird nie als echte Besatzung gezählt.

## Anforderungen
- [ ] Als Nutzer möchte ich per Schalter einen Gast namens "Marcus" in die Besatzungsliste einblenden, damit ich ihn für Vorführungen dazuschalten kann.
- [ ] Der Schalter steht im Besatzungs-Bereich ("Gast anzeigen") und ist **standardmäßig aus**.
- [ ] Bei aktivem Schalter erscheint "Marcus (Gast)" als **letzter** Eintrag der Liste.
- [ ] Der Gast wird visuell vom echten Personal unterschieden ("(Gast)" als Klartext, nicht nur über Farbe).
- [ ] Die Zeile "N Personen an Bord" zählt **nur die echte Crew**. Der Gast erscheint zusätzlich als "· 1 Gast".
- [ ] Der Gast wird nicht vom Proxy `/api/astros` geliefert und nicht dorthin gemeldet (kein Request, keine Änderung an `app/api/astros/route.js`).
- [ ] Der Gast bleibt in der Liste, wenn über "Aktualisieren" neue echte Daten geholt werden.
- [ ] Es dürfen keine doppelten React-Keys entstehen, falls die API selbst eine Person namens "Marcus" meldet.
- [ ] Bei einem Fehler beim Laden der Besatzung bleibt die Fehlermeldung sichtbar; der Schalter erzeugt dann keine verwaiste Ein-Eintrag-Liste.
- [ ] Die Einblendung funktioniert unabhängig vom ISS-Polling (kein Einfluss auf Karte und Messwerte).

## Definition of Done
- [ ] Schalter ein/aus blendet "Marcus (Gast)" ein und aus, ohne Neuladen.
- [ ] Die Anzahl der echten Crew ändert sich durch den Gast nicht.
- [ ] `GET /api/astros` liefert weiterhin ausschließlich echte ISS-Besatzung.
- [ ] Automatisierte Tests vorhanden und grün (siehe Abschnitt "Tests").
- [ ] Review: keine neuen Konsolenfehler, kein Mixed-Content-Fehler.

## Betroffene Bereiche & Technik
- Neu: `app/lib/crew.js` - reine Funktionen, damit nichts an Leaflet oder Netz hängt:
  - `GUEST_NAME = "Marcus"`
  - `withGuest(people, showGuest)` -> gibt die Liste unverändert zurück, wenn der Schalter aus ist, sonst eine **neue** Liste mit dem Gast als letztem Eintrag (`{ name, guest: true }`). Eingabe wird nicht mutiert.
  - `crewCount(people)` -> zählt nur echte Crew; bewusst ohne Schalter-Parameter, damit der Gast nicht versehentlich mitgezählt werden kann.
- `app/components/AstronautList.jsx`: Zustand `showGuest` (Default `false`), Schalter als Checkbox unter der Liste, Eintrag mit Zusatz "(Gast)".
- React-Keys: `key={`${person.name}-${person.guest ? "guest" : "crew"}`}`, damit eine echte Person gleichen Namens keinen Konflikt erzeugt.
- `app/globals.css`: kleine Auszeichnung für den Gast-Zusatz (`.crew__guest`).
- Kein Backend, kein API-Call, keine Änderung an `app/api/astros/route.js`.

## Tests
Runner: Vitest, Konvention `app/**/*.test.js(x)` wie in den Features 001-004; Komponententests mit `@testing-library/react`.
- [ ] Unit `app/lib/crew.test.js`: `withGuest(crew, false)` gibt die Liste unverändert (gleiche Reihenfolge, gleiche Länge).
- [ ] Unit: `withGuest(crew, true)` hängt den Gast **hinten** an und markiert ihn als `guest: true`.
- [ ] Unit: Die Eingabeliste wird nicht verändert (kein `push`/`push`-Mutation) - Ausgangsarray bleibt nach dem Aufruf gleich.
- [ ] Unit: `withGuest(null, true)` / `withGuest(undefined, false)` werfen nicht und liefern sinnvolle Listen.
- [ ] Unit: `crewCount(crew)` liefert die Zahl der echten Crew; ein per `withGuest(crew, true)` erzeugter Gast erhöht sie nicht.
- [ ] Komponente: Standardzustand - "Marcus" ist **nicht** sichtbar, Schalter ist aus.
- [ ] Komponente: Klick auf "Gast anzeigen" -> "Marcus (Gast)" erscheint als letzter `listitem`; erneuter Klick -> verschwindet wieder.
- [ ] Komponente (Regressionstest): Die Zeile "N Personen an Bord" zeigt bei eingeschaltetem Gast weiterhin die Zahl der echten Crew.
- [ ] Komponente (Edge): Liefert die API selbst eine Person "Marcus", entstehen zwei unterscheidbare Einträge ohne Key-Warnung.
- [ ] Komponente (Edge): Fehlerstatus der Route -> Fehlermeldung sichtbar, Schalter erzeugt keine Liste.

## Umsetzungsideen / Hinweise (optional)
- Der Gast ist bewusst nur eine Anzeige-Konstante im Client. Wer ihn ändern will, ändert `GUEST_NAME` an einer Stelle.
- Schalter als Checkbox im Stil der bestehenden `.switch`-Klassen aus `globals.css`, damit kein neues Layout nötig ist.
- Nicht in `localStorage` speichern: der Zustand ist eine Vorführ-Hilfe, kein Nutzerprofil.

## Offene Fragen / Abhängigkeiten (optional)
- Soll der Gast auch bei API-Fehler sichtbar bleiben? Annahme: nein - der Fehlerzustand zeigt nur den Hinweis, sonst stünde ein Gast ohne Crew da.
- Soll der Gastname konfigurierbar sein (z. B. per Umgebungsvariable)? Annahme: nein, eine Konstante reicht.
