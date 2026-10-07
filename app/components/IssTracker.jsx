"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AstronautList from "./AstronautList";
import IssMap from "./IssMap";
import { appendTrackPoint } from "../lib/track";
import { formatVisibility } from "../lib/visibility";

const API_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const REFRESH_MS = 5000;
// Etwas länger als das Intervall, damit eine hängende Anfrage das Polling
// nicht dauerhaft blockiert.
const REQUEST_TIMEOUT_MS = 12000;

const decimal = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const whole = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

function formatCoordinate(value, positive, negative) {
  if (!Number.isFinite(value)) return "–";
  const direction = value >= 0 ? positive : negative;
  return `${decimal.format(Math.abs(value))}° ${direction}`;
}

function formatAltitude(km) {
  return Number.isFinite(km) ? `${decimal.format(km)} km` : "–";
}

function formatVelocity(kmh) {
  return Number.isFinite(kmh) ? `${whole.format(kmh)} km/h` : "–";
}

function formatTime(timestampSeconds) {
  if (!Number.isFinite(timestampSeconds)) return "–";
  return new Date(timestampSeconds * 1000).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Übersetzt technische Fehler in einen Satz, der ohne Vorwissen verständlich ist.
function describeError(error) {
  if (error instanceof TypeError) {
    return "Die ISS-Daten konnten nicht geladen werden. Möglicherweise besteht keine Internetverbindung oder die API api.wheretheiss.at ist gerade nicht erreichbar.";
  }
  return error?.message || "Unbekannter Fehler beim Laden der ISS-Daten.";
}

export default function IssTracker() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [track, setTrack] = useState([]);
  const [follow, setFollow] = useState(true);
  const [showTrack, setShowTrack] = useState(true);
  const requestRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;

    async function load() {
      // Überlappende Anfragen vermeiden, falls eine Antwort länger als 5 s braucht.
      if (inFlight || stopped) return;
      inFlight = true;

      const controller = new AbortController();
      requestRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(API_URL, {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(
            `Die API antwortete mit dem Fehler ${response.status} (${response.statusText}).`,
          );
        }

        const data = await response.json();
        const latitude = Number(data?.latitude);
        const longitude = Number(data?.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw new Error("Die API hat eine unerwartete Antwort geliefert (keine gültige Position).");
        }

        if (stopped) return;

        setPosition({
          latitude,
          longitude,
          altitude: Number(data.altitude),
          velocity: Number(data.velocity),
          visibility: data.visibility,
          timestamp: Number(data.timestamp),
        });
        // Nur erfolgreiche Abrufe erweitern die Flugspur.
        setTrack((previous) => appendTrackPoint(previous, { latitude, longitude }));
        // Ein erfolgreicher Abruf räumt die Fehlermeldung wieder weg.
        setError(null);
      } catch (caught) {
        // Beim Verlassen der Seite wird die Anfrage bewusst abgebrochen: kein Fehler.
        if (stopped) return;
        setError(
          caught?.name === "AbortError"
            ? "Die API hat nicht rechtzeitig geantwortet (Zeitüberschreitung)."
            : describeError(caught),
        );
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        requestRef.current = null;
      }
    }

    load();
    // Nach einem Fehler läuft das Polling weiter, bis die API wieder antwortet.
    const timer = setInterval(load, REFRESH_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
      requestRef.current?.abort();
    };
  }, []);

  // Wird ausgelöst, wenn der Nutzer die Karte selbst verschiebt: eigene
  // Absicht hat Vorrang, der Follow-Modus schaltet sich ab.
  const handleUserDrag = useCallback(() => setFollow(false), []);

  const rows = [
    { label: "Breitengrad", value: position ? formatCoordinate(position.latitude, "N", "S") : "–" },
    { label: "Längengrad", value: position ? formatCoordinate(position.longitude, "O", "W") : "–" },
    { label: "Höhe", value: position ? formatAltitude(position.altitude) : "–" },
    { label: "Geschwindigkeit", value: position ? formatVelocity(position.velocity) : "–" },
    { label: "Sichtbarkeit", value: position ? formatVisibility(position.visibility) : "–" },
    { label: "Stand der Messung", value: position ? `${formatTime(position.timestamp)} Uhr` : "–" },
  ];

  return (
    <section className="tracker">
      <div className="tracker__map">
        <IssMap
          position={position}
          track={track}
          follow={follow}
          showTrack={showTrack}
          onUserDrag={handleUserDrag}
        />
        {position ? (
          <p className="badge">
            <span className="badge__dot" aria-hidden="true" />
            Live · Aktualisierung alle 5 s
          </p>
        ) : null}
      </div>

      <aside className="panel">
        {error ? (
          <div className="alert" role="alert">
            <strong>Keine aktuellen ISS-Daten</strong>
            <p>{error}</p>
            <p className="alert__hint">
              Die App versucht es automatisch weiter und zeigt wieder Werte an, sobald die API
              antwortet.
              {position ? " Angezeigt wird bis dahin die zuletzt empfangene Position." : ""}
            </p>
          </div>
        ) : null}

        {!position && !error ? (
          <p className="panel__hint">Warte auf die erste Positionsmeldung …</p>
        ) : null}

        <dl className="facts">
          {rows.map((row) => (
            <div className="facts__row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <fieldset className="switches">
          <legend className="switches__legend">Kartenoptionen</legend>

          <label className="switch">
            <input
              type="checkbox"
              checked={follow}
              onChange={(event) => setFollow(event.target.checked)}
            />
            <span>Karte folgt ISS</span>
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={showTrack}
              onChange={(event) => setShowTrack(event.target.checked)}
            />
            <span>Flugspur anzeigen</span>
          </label>

          <p className="switches__hint">
            Verschiebst du die Karte selbst, schaltet sich das Folgen automatisch ab.
          </p>
        </fieldset>

        <AstronautList />

        <p className="panel__source">
          Datenquelle: <a href="https://wheretheiss.at">wheretheiss.at</a> (Satellit 25544) ·
          Besatzung: <a href="https://open-notify.org">Open Notify</a> · Karten: OpenStreetMap
        </p>
      </aside>
    </section>
  );
}
