import { describe, expect, it } from "vitest";
import { formatVisibility, visibilityAriaLabel, visibilityState } from "./visibility";

describe("visibilityState", () => {
  it("erkennt die beiden bekannten Werte der API", () => {
    expect(visibilityState("daylight")).toBe("day");
    expect(visibilityState("eclipsed")).toBe("night");
  });

  it("behandelt unbekannte oder fehlende Werte als unbekannt, ohne zu werfen", () => {
    expect(visibilityState("unknown")).toBe("unknown");
    expect(visibilityState(undefined)).toBe("unknown");
    expect(visibilityState(null)).toBe("unknown");
    expect(visibilityState("")).toBe("unknown");
    expect(visibilityState(42)).toBe("unknown");
  });
});

describe("formatVisibility", () => {
  it("behält den gewohnten Klartext für die Werte-Liste (Regressionsschutz)", () => {
    expect(formatVisibility("daylight")).toBe("Tag (von der Sonne beleuchtet)");
    expect(formatVisibility("eclipsed")).toBe("Nacht (im Erdschatten)");
  });

  it("zeigt bei unbekannten Werten einen Platzhalter", () => {
    expect(formatVisibility(undefined)).toBe("–");
  });
});

describe("visibilityAriaLabel", () => {
  it("liefert für jeden Zustand einen vorlesbaren Text", () => {
    expect(visibilityAriaLabel("daylight")).toBe("Sichtbarkeit: Tag");
    expect(visibilityAriaLabel("eclipsed")).toBe("Sichtbarkeit: Nacht");
    expect(visibilityAriaLabel(undefined)).toBe("Sichtbarkeit: unbekannt");
  });
});
