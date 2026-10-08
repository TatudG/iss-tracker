// Entfernungen und Nähe-Erkennung: bewusst ohne Leaflet und ohne DOM, damit
// die Alarmlogik ohne Browser prüfbar bleibt.

import { isValidPosition } from "./position";

export const EARTH_RADIUS_KM = 6371.0088;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Haversine-Distanz. Gibt null zurück, wenn eine der Positionen unbrauchbar
// ist - so wird "unbekannt" nicht als "0 km, also direkt über mir" gelesen.
export function distanceKm(a, b) {
  if (!isValidPosition(a) || !isValidPosition(b)) return null;

  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  // Math.min begrenzt Rundungsfehler nahe der Gegenpole auf 1.
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

// Gültig ist ein Radius nur als endliche, positive Zahl. Die Distanz genau auf
// der Grenze zählt als "innerhalb" - der Nutzer erwartet beim eingestellten
// Wert noch einen Alarm.
export function isWithinRadius(position, center, radiusKm) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return false;

  const distance = distanceKm(position, center);
  return distance !== null && distance <= radiusKm;
}

// Zustandsmaschine für den Alarm: entschieden wird hier, ausgeführt (Banner,
// Ton, Benachrichtigung) wird in der Komponente. `entered` ist der einzige
// Anlass für einen Alarm, deshalb löst ein Daueraufenthalt im Radius keinen
// zweiten aus; erst `left` schaltet für die nächste Annäherung wieder scharf.
export function evaluateProximity(previousInside, position, center, radiusKm) {
  const distance = distanceKm(position, center);

  // Ohne brauchbare Daten bleibt der bisherige Zustand bestehen: ein
  // fehlgeschlagener Poll darf weder Alarm auslösen noch die Scharfschaltung
  // verlieren.
  if (distance === null) {
    return { inside: Boolean(previousInside), distanceKm: null, entered: false, left: false };
  }

  const inside = isWithinRadius(position, center, radiusKm);

  return {
    inside,
    distanceKm: distance,
    entered: inside && !previousInside,
    left: !inside && Boolean(previousInside),
  };
}
