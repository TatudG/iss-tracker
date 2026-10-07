"use client";

import { useCallback, useEffect, useState } from "react";
import { crewCount, withGuest } from "../lib/crew";

// Läuft unabhängig vom Positions-Polling: ein Fehler hier darf die Karte und
// die Messwerte nicht beeinflussen.

function describeError(error) {
  if (error instanceof TypeError) {
    return "Die Besatzungsliste konnte nicht geladen werden. Möglicherweise besteht keine Internetverbindung.";
  }
  return error?.message || "Unbekannter Fehler beim Laden der Besatzungsliste.";
}

export default function AstronautList() {
  const [people, setPeople] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [showGuest, setShowGuest] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/astros", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Die Besatzungsliste konnte nicht geladen werden (Fehler ${response.status}).`);
      }

      const data = await response.json();
      setPeople(Array.isArray(data?.people) ? data.people : []);
      setStatus("ready");
    } catch (caught) {
      setPeople([]);
      setError(describeError(caught));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = withGuest(people, showGuest);

  return (
    <section className="crew" aria-labelledby="crew-heading">
      <div className="crew__head">
        <h2 id="crew-heading">Besatzung an Bord</h2>
        <button type="button" className="crew__refresh" onClick={load} disabled={status === "loading"}>
          {status === "loading" ? "Lädt …" : "Aktualisieren"}
        </button>
      </div>

      {status === "error" ? (
        <p className="crew__error" role="status">
          {error}
        </p>
      ) : null}

      {status === "loading" && shown.length === 0 ? (
        <p className="crew__hint">Besatzungsliste wird geladen …</p>
      ) : null}

      {status !== "error" && shown.length > 0 ? (
        <>
          <p className="crew__count">
            {crewCount(people)} Personen an Bord
            {showGuest ? " · 1 Gast" : ""}
          </p>
          <ul className="crew__list">
            {shown.map((person) => (
              // Der Zusatz im Key unterscheidet den Gast von einer echten
              // Person gleichen Namens.
              <li key={`${person.name}-${person.guest ? "guest" : "crew"}`}>
                {person.name}
                {person.guest ? <span className="crew__guest">{" (Gast)"}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {status === "ready" && shown.length === 0 ? (
        <p className="crew__hint">Zurzeit ist keine Besatzung gemeldet.</p>
      ) : null}

      <label className="switch crew__switch">
        <input
          type="checkbox"
          checked={showGuest}
          onChange={(event) => setShowGuest(event.target.checked)}
        />
        <span>Gast anzeigen</span>
      </label>
    </section>
  );
}
