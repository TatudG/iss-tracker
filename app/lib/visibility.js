// Das Feld `visibility` der API kennt genau zwei Werte. Alles andere wird
// bewusst als "unbekannt" behandelt, damit eine unerwartete Antwort kein
// leeres oder kaputtes Badge erzeugt.

const LABELS = {
  day: { short: "Tag", long: "Tag (von der Sonne beleuchtet)" },
  night: { short: "Nacht", long: "Nacht (im Erdschatten)" },
  unknown: { short: "unbekannt", long: "–" },
};

export function visibilityState(visibility) {
  if (visibility === "daylight") return "day";
  if (visibility === "eclipsed") return "night";
  return "unknown";
}

export function visibilityShortLabel(visibility) {
  return LABELS[visibilityState(visibility)].short;
}

export function visibilityAriaLabel(visibility) {
  return `Sichtbarkeit: ${visibilityShortLabel(visibility)}`;
}

// Klartext für die Werte-Liste (bewusst unverändert zum bisherigen Verhalten).
export function formatVisibility(visibility) {
  return LABELS[visibilityState(visibility)].long;
}
