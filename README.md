# iss-tracker

Das ist unser Repo für die ISS-Tracker App.

Live-Karte mit der aktuellen Position der ISS (Next.js App Router + Leaflet).
Es werden Breite, Länge, Höhe, Geschwindigkeit und die Tag/Nacht-Sichtbarkeit
angezeigt; die Daten werden alle 5 Sekunden neu geladen.

## Voraussetzungen

- Node.js 18.18 oder neuer (getestet werden muss die App lokal). Auf diesem
  Rechner war Node.js zum Zeitpunkt der Erstellung **nicht installiert**.

## Starten

```bash
npm install
npm run dev
```

Danach <http://localhost:3000> im Browser öffnen.

## Quellcode

```
app/
  layout.js               Grundgerüst und Metadaten
  page.js                 Einstiegsseite (Server-Komponente)
  globals.css             Layout und Gestaltung
  components/
    IssTracker.js         Abruf der API, 5-Sekunden-Polling, Werteanzeige
    IssMap.js             Leaflet-Karte (wird nur im Browser geladen)
```

## Datenquelle

`https://api.wheretheiss.at/v1/satellites/25544` (HTTPS, kein API-Key).
Kartenkacheln von OpenStreetMap.
