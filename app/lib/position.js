// Gemeinsame Positions-Prüfung: eine Position gilt nur als brauchbar, wenn
// beide Koordinaten echte Zahlen sind.

export function isValidPosition(position) {
  return (
    Boolean(position) &&
    Number.isFinite(position.latitude) &&
    Number.isFinite(position.longitude)
  );
}

// Zentriert wird nur, wenn der Follow-Modus aktiv ist UND eine gültige
// Position vorliegt (vor der ersten Antwort gibt es nichts zu zentrieren).
export function shouldRecenter(follow, position) {
  return Boolean(follow) && isValidPosition(position);
}
