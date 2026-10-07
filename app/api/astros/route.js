// Open Notify liefert die Besatzungsliste nur über HTTP. Eine HTTPS-Seite darf
// diese Anfrage nicht direkt stellen ("Mixed Content"), deshalb holt sie dieser
// Route Handler serverseitig ab. Das ist die im PRD erlaubte Ausnahme vom
// "kein Backend"-Grundsatz.

const UPSTREAM_URL = "http://api.open-notify.org/astros.json";
const UPSTREAM_TIMEOUT_MS = 5000;
const CACHE_SECONDS = 3600;

// Die Besatzung wechselt nur alle paar Monate - eine Stunde Cache reicht.
// Next.js verlangt in Segment-Konfigurationen einen Literal-Wert (keine
// Konstante), deshalb steht die Zahl hier bewusst doppelt.
export const revalidate = 3600;

// Bewusst dynamisch: sonst würde die Route schon beim Build einmal ausgeführt
// und eine eventuelle Fehlerantwort für eine Stunde eingefroren. Der Cache
// sitzt stattdessen am Upstream-Abruf (siehe `next.revalidate` unten).
export const dynamic = "force-dynamic";

function errorResponse(status, message) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  let response;

  try {
    response = await fetch(UPSTREAM_URL, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      next: { revalidate: CACHE_SECONDS },
    });
  } catch {
    // Netzwerkfehler oder Zeitüberschreitung: kein unbehandelter Throw.
    return errorResponse(502, "Die Besatzungsliste ist derzeit nicht abrufbar.");
  }

  if (!response.ok) {
    return errorResponse(
      502,
      `Die Besatzungsliste ist derzeit nicht abrufbar (Quelle antwortet mit ${response.status}).`,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return errorResponse(502, "Die Quelle hat eine unlesbare Antwort geliefert.");
  }

  // Explizit auf das Feld `craft` filtern statt es implizit zu erwarten: die
  // Quelle liefert dort je nach Version unterschiedliche Schreibweisen, und
  // ein unbekannter Wert darf nicht als ISS-Besatzung durchgehen.
  const people = (Array.isArray(data?.people) ? data.people : [])
    .filter((person) => person?.craft === "ISS" && typeof person?.name === "string")
    .map((person) => ({ name: person.name }));

  return Response.json(
    { count: people.length, people },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=300`,
      },
    },
  );
}
