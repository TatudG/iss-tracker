// Adresssuche für den eigenen Standort. Der Browser darf Nominatim nicht direkt
// abfragen: die Nutzungsbedingungen verlangen einen identifizierenden
// User-Agent, und der lässt sich aus einer Seite heraus nicht setzen. Deshalb
// läuft die Suche - wie schon die Besatzungsliste - über einen Route Handler.

import { normalizeUserLocation } from "../../lib/userLocation";

const UPSTREAM_URL = "https://nominatim.openstreetmap.org/search";
const UPSTREAM_TIMEOUT_MS = 5000;
const CACHE_SECONDS = 86400;
const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 200;

// Nominatim verlangt laut Nutzungsbedingungen eine Angabe, die die Anwendung
// identifiziert - ein generischer User-Agent wird mit 403 abgewiesen. Wer die
// App unter eigener Adresse betreibt, sollte hier seine eigene URL eintragen.
const USER_AGENT = "iss-tracker/0.1 (https://github.com/TatudG/iss-tracker)";

// Adressen ändern sich praktisch nicht - ein Tag Cache ist reichlich. Next.js
// verlangt in Segment-Konfigurationen einen Literal-Wert (keine Konstante),
// deshalb steht die Zahl hier bewusst doppelt.
export const revalidate = 86400;

// Bewusst dynamisch: sonst würde die Route schon beim Build einmal ausgeführt
// und eine eventuelle Fehlerantwort für einen Tag eingefroren. Der Cache sitzt
// stattdessen am Upstream-Abruf (siehe `next.revalidate` unten).
export const dynamic = "force-dynamic";

function errorResponse(status, message) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  // Absichtlich Submit-basiert statt "Suche beim Tippen": das schont das
  // Rate-Limit von Nominatim (rund eine Anfrage pro Sekunde).
  if (query.length < MIN_QUERY_LENGTH) {
    return errorResponse(400, `Bitte gib eine Adresse mit mindestens ${MIN_QUERY_LENGTH} Zeichen an.`);
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return errorResponse(400, "Die Suchanfrage ist zu lang.");
  }

  const url =
    `${UPSTREAM_URL}?q=${encodeURIComponent(query)}` +
    "&format=jsonv2&limit=5&addressdetails=0&accept-language=de";

  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      next: { revalidate: CACHE_SECONDS },
    });
  } catch {
    // Netzwerkfehler oder Zeitüberschreitung: kein unbehandelter Throw.
    return errorResponse(502, "Die Adresssuche ist derzeit nicht verfügbar.");
  }

  if (!response.ok) {
    return errorResponse(
      502,
      `Die Adresssuche ist derzeit nicht verfügbar (Quelle antwortet mit ${response.status}).`,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return errorResponse(502, "Die Quelle hat eine unlesbare Antwort geliefert.");
  }

  // Einträge ohne brauchbare Koordinaten werden verworfen statt weitergereicht:
  // der Nutzer soll keinen Standort am Nullpunkt gesetzt bekommen.
  const results = (Array.isArray(data) ? data : [])
    .map((entry) => {
      const location = normalizeUserLocation({ latitude: entry?.lat, longitude: entry?.lon });
      if (!location || typeof entry?.display_name !== "string") return null;
      return { label: entry.display_name, ...location };
    })
    .filter(Boolean);

  return Response.json(
    { results },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`,
      },
    },
  );
}
