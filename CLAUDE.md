# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

ISS-Live-Tracker: zeigt die aktuelle Position der ISS live auf einer Leaflet-Karte
(Next.js App Router). Anforderungsquelle ist `ai_docs/PRD.md`, Feature-Specs liegen
unter `ai_docs/features/`.

## Befehle

```bash
npm install
npm run dev        # Dev-Server auf http://localhost:3000
npm run build      # Produktionsbuild - vor jedem Deploy laufen lassen
npm test           # alle Tests einmalig (vitest run)
npx vitest         # Tests im Watch-Modus

npx vitest run app/lib/track.test.js          # eine Testdatei
npx vitest run -t "begrenzt die Flugspur"     # ein einzelner Test
```

Ein Linter ist nicht konfiguriert; `next build` prüft nur Typen und Segment-Configs.

## Architektur

**Kein eigenes Backend.** Alle Komponenten sind Client-Komponenten (`"use client"`),
die die ISS-API direkt im Browser abfragen. Einzige Ausnahme ist der Route Handler
`app/api/astros/route.js` - siehe unten.

**Datenfluss:** `IssTracker.jsx` ist die einzige Quelle der Wahrheit. Es hält den
Zustand (`position`, `error`, `track`, `follow`, `showTrack`), pollt die API alle 5 s
und reicht alles als Props an `IssMap.jsx` weiter. `IssMap` hält selbst keinen
fachlichen Zustand, sondern spiegelt die Props über Refs auf imperative
Leaflet-Objekte (`setLatLng`, `setIcon`, `panTo`, LayerGroup).

**`app/lib/` enthält die testbare Logik** - bewusst als reine Funktionen
herausgezogen, damit Tests kein Leaflet und kein DOM brauchen:
- `position.js` - `isValidPosition`, `shouldRecenter(follow, position)`
- `track.js` - `appendTrackPoint` (Ringpuffer, `MAX_TRACK_POINTS = 20`) und
  `splitAtAntimeridian` (Sprung über die Datumsgrenze wird in mehrere Linien geteilt)
- `visibility.js` - `visibilityState` (`day` / `night` / `unknown`) und die Texte
- `markerIcon.js` - `buildIssIconHtml` erzeugt das divIcon inklusive Tag/Nacht-Badge

**Leaflet wird nur dynamisch geladen** (`await import("leaflet")` in `useEffect`),
niemals auf Modulebene - der Import greift auf `window` zu und würde beim
Server-Rendering brechen. Marker sind `L.divIcon` mit eigenem HTML/CSS, damit keine
Bilddateien nötig sind.

**`app/api/astros/route.js`** ist der serverseitige Proxy für die Besatzungsliste.
`api.open-notify.org` ist nur über HTTP erreichbar; eine HTTPS-Seite darf das nicht
direkt aufrufen (Mixed Content). Die Route filtert `craft === "ISS"`, setzt
Cache-Header und ist `force-dynamic`, damit eine Fehlerantwort nicht schon beim Build
eingefroren wird.

## Fallstricke

- **JSX-haltige Dateien müssen `.jsx` sein.** Next.js verdaut JSX auch in `.js`,
  Vitest (Vite/oxc-Pipeline) nicht - die Tests brechen sonst mit einem
  Parse-Fehler. Betrifft alle Dateien unter `app/components/`.
- **Segment-Configs von Next.js brauchen Literale:** `export const revalidate = 3600`,
  nicht `= CACHE_SECONDS`. Ein Bezeichner lässt `next build` (und damit Vercel)
  fehlschlagen.
- **Das Leaflet-Doppel in `IssMap.test.jsx`** muss aus `addTo()` das Objekt selbst
  zurückgeben - Leaflet tut das, und `IssMap` verlässt sich darauf
  (`const marker = L.marker(...).addTo(map)`).
- **Leaflet vereinfacht Polylinien** (`smoothFactor`). Die ISS-Bahn ist fast
  geradlinig, deshalb enthält das gerenderte SVG-Attribut `d` oft nur die
  Endpunkte. Die Länge von `d` ist kein Maß für die Anzahl der Track-Punkte;
  dafür den State prüfen.
- **`app/lib/track.js` hält maximal 20 Punkte** (~100 s). Wer die Spur verlängern
  will, ändert `MAX_TRACK_POINTS`.
- **Polling-Verhalten beibehalten:** 5 s Intervall, 12 s Timeout, Guard gegen
  überlappende Anfragen. Ein Fehler stoppt das Polling nicht; erst ein erfolgreicher
  Abruf räumt die Fehlermeldung weg.
- **Nichts von `open-notify.org` direkt im Browser abrufen** - nur über
  `/api/astros`. Ein Mixed-Content-Fehler ist ein Akzeptanzkriterium des PRD.

## Tests

Vitest + jsdom, Konfiguration in `vitest.config.mjs` und `vitest.setup.js`
(Testing Library räumt zwischen den Tests auf). Tests liegen neben dem Code:
`app/lib/*.test.js`, `app/components/*.test.jsx`.

- `app/api/astros/route.test.js` trägt `// @vitest-environment node` (die Route
  braucht `Response`, nicht jsdom).
- `IssMap.test.jsx` ersetzt Leaflet durch ein Doppel; `IssTracker.test.jsx` ersetzt
  `IssMap` und `AstronautList` und arbeitet mit Fake-Timern, um das Polling zu treiben.

## Deployment

Vercel (`npx vercel --prod`). `vercel.json` setzt `"framework": "nextjs"` - ohne das
sucht Vercel in der Vorlage "Other" nach einem `public`-Verzeichnis, das es in diesem
Projekt nicht gibt. Es gibt kein `public/`; Assets liegen unter `app/`.

## Konventionen

- Sprache im Code, in Kommentaren, Commit-Messages und Dokumentation: Deutsch.
- Feature-Specs: `ai_docs/features/NNN_<slug>.md`, fortlaufend nummeriert, eine Datei
  pro Feature, mit den Abschnitten Kontext, Anforderungen, Definition of Done,
  Betroffene Bereiche, Tests (Pflicht), optionale Hinweise und offene Fragen.
- `README.md` beschreibt den Stand vor den Bonus-Features und ist teils veraltet.
