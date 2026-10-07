import { isValidPosition } from "./position";

// Begrenzung der Spur: ca. 20 Polls à 5 s, also gut eineinhalb Minuten Flug.
export const MAX_TRACK_POINTS = 20;

// Hängt einen Punkt an und wirft den ältesten weg, sobald die Maximallänge
// erreicht ist. Ungültige Punkte (fehlgeschlagener Abruf) verändern nichts.
export function appendTrackPoint(points, nextPoint, maxLength = MAX_TRACK_POINTS) {
  const current = Array.isArray(points) ? points : [];
  if (!isValidPosition(nextPoint)) return current;

  const next = [...current, { latitude: nextPoint.latitude, longitude: nextPoint.longitude }];
  return next.length > maxLength ? next.slice(next.length - maxLength) : next;
}

// Ein Sprung über die Datumsgrenze (z. B. von +179° auf −179°) würde als eine
// quer über die ganze Karte laufende Linie gezeichnet. Deshalb wird die Spur
// dort in einzelne Segmente getrennt.
export function splitAtAntimeridian(points, threshold = 180) {
  const segments = [];
  let current = [];

  for (const point of Array.isArray(points) ? points : []) {
    const previous = current[current.length - 1];
    if (previous && Math.abs(point.longitude - previous.longitude) > threshold) {
      segments.push(current);
      current = [];
    }
    current.push(point);
  }

  if (current.length > 0) segments.push(current);
  return segments;
}
