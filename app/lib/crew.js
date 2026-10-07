// Der Gast ist reine Anzeige-Kosmetik im Client: er kommt nicht von der API,
// wird nicht an den Proxy gemeldet und zählt nie als Besatzung.

export const GUEST_NAME = "Marcus";

// Hängt den Gast hinten an. Die übergebene Liste bleibt unverändert, damit
// React weiterhin mit unveränderlichen Werten arbeitet.
export function withGuest(people, showGuest) {
  const crew = Array.isArray(people) ? people : [];
  if (!showGuest) return crew;

  return [...crew, { name: GUEST_NAME, guest: true }];
}

// Zählt ausschließlich die echte Besatzung. Bewusst ohne Schalter-Parameter:
// der Gast darf hier gar nicht erst hineingerechnet werden können.
export function crewCount(people) {
  return Array.isArray(people) ? people.length : 0;
}
