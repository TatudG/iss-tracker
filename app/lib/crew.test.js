import { describe, expect, it } from "vitest";
import { GUEST_NAME, crewCount, withGuest } from "./crew";

const crew = [{ name: "Oleg Kononenko" }, { name: "Tracy Dyson" }];

describe("withGuest", () => {
  it("lässt die Liste bei ausgeschaltetem Schalter unverändert", () => {
    const result = withGuest(crew, false);

    expect(result).toEqual(crew);
    expect(result).toHaveLength(2);
  });

  it("hängt den Gast hinten an und kennzeichnet ihn", () => {
    const result = withGuest(crew, true);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: "Oleg Kononenko" });
    expect(result.at(-1)).toEqual({ name: GUEST_NAME, guest: true });
  });

  it("verändert die übergebene Liste nicht", () => {
    const original = [...crew];

    withGuest(crew, true);

    expect(crew).toEqual(original);
    expect(crew).toHaveLength(2);
  });

  it("verträgt fehlende oder unbrauchbare Werte", () => {
    expect(withGuest(null, false)).toEqual([]);
    expect(withGuest(undefined, false)).toEqual([]);
    expect(withGuest(null, true)).toEqual([{ name: GUEST_NAME, guest: true }]);
    expect(withGuest("kaputt", true)).toEqual([{ name: GUEST_NAME, guest: true }]);
  });

  it("liefert bei jedem Aufruf eine neue Liste, damit React neu rendert", () => {
    expect(withGuest(crew, true)).not.toBe(withGuest(crew, true));
  });
});

describe("crewCount", () => {
  it("zählt die echte Besatzung", () => {
    expect(crewCount(crew)).toBe(2);
    expect(crewCount([])).toBe(0);
  });

  it("zählt einen eingeblendeten Gast nicht mit", () => {
    const eingeblendet = withGuest(crew, true);

    // Die Anzeige enthält den Gast ...
    expect(eingeblendet).toHaveLength(3);
    // ... die Zählung speist sich aber aus der Rohliste, wie in der Komponente.
    expect(crewCount(crew)).toBe(2);
  });

  it("verträgt fehlende Werte", () => {
    expect(crewCount(null)).toBe(0);
    expect(crewCount(undefined)).toBe(0);
  });
});
