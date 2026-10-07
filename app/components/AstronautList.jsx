"use client";

import { useCallback, useEffect, useState } from "react";

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

      {status === "loading" && people.length === 0 ? (
        <p className="crew__hint">Besatzungsliste wird geladen …</p>
      ) : null}

      {status !== "error" && people.length > 0 ? (
        <>
          <p className="crew__count">{people.length} Personen an Bord</p>
          <ul className="crew__list">
            {people.map((person) => (
              <li key={person.name}>{person.name}</li>
            ))}
          </ul>
        </>
      ) : null}

      {status === "ready" && people.length === 0 ? (
        <p className="crew__hint">Zurzeit ist keine Besatzung gemeldet.</p>
      ) : null}
    </section>
  );
}
