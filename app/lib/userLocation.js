// Nutzerstandort und Alarm-Radius: Validierung, Normalisierung und die
// Anzeigetexte. Reine Funktionen, damit weder Karte noch Netz nötig sind.

export const RADIUS_OPTIONS = [100, 250, 500];
export const DEFAULT_RADIUS_KM = 250;

const coordinate = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const distance = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Nimmt Zahlen oder numerische Strings (z. B. aus einem Eingabefeld) und prüft
// den gültigen Bereich. Bewusst kein stilles Raten: was nicht eindeutig ist,
// wird abgelehnt, sonst stünde der Nutzer plötzlich am Nullpunkt.
export function normalizeUserLocation(input) {
  if (!input) return null;

  const latitude = toNumber(input.latitude);
  const longitude = toNumber(input.longitude);

  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

export function isRadiusOption(km) {
  return RADIUS_OPTIONS.includes(km);
}

export function radiusLabel(km) {
  return Number.isFinite(km) ? `${distance.format(km)} km` : "–";
}

export function formatDistanceKm(km) {
  return Number.isFinite(km) ? `${distance.format(km)} km` : "–";
}

export function formatUserLocation(location) {
  const normalized = normalizeUserLocation(location);
  if (!normalized) return "–";

  const hemisphereLatitude = normalized.latitude >= 0 ? "N" : "S";
  const hemisphereLongitude = normalized.longitude >= 0 ? "O" : "W";

  return `${coordinate.format(Math.abs(normalized.latitude))}° ${hemisphereLatitude} · ${coordinate.format(Math.abs(normalized.longitude))}° ${hemisphereLongitude}`;
}
