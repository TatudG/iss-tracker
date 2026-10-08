// Wertet die Antwort von /api/geocode aus. Die Route ist die eigene, aber ein
// Fehlerfall liefert ein Objekt statt eines Arrays - deshalb wird hier nie
// einfach durchiteriert, sondern geprüft.

import { normalizeUserLocation } from "./userLocation";

export function parseGeocodeResults(payload) {
  const list = Array.isArray(payload?.results) ? payload.results : [];

  return list
    .map((entry) => {
      const location = normalizeUserLocation(entry);
      if (!location || typeof entry?.label !== "string") return null;
      return { label: entry.label, ...location };
    })
    .filter(Boolean);
}
