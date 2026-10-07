import { describe, expect, it } from "vitest";
import { isValidPosition, shouldRecenter } from "./position";

describe("isValidPosition", () => {
  it("akzeptiert Positionen mit zwei endlichen Zahlen", () => {
    expect(isValidPosition({ latitude: 0, longitude: 0 })).toBe(true);
    expect(isValidPosition({ latitude: -51.6, longitude: 179.9 })).toBe(true);
  });

  it("lehnt fehlende oder unbrauchbare Werte ab", () => {
    expect(isValidPosition(null)).toBe(false);
    expect(isValidPosition(undefined)).toBe(false);
    expect(isValidPosition({})).toBe(false);
    expect(isValidPosition({ latitude: NaN, longitude: 5 })).toBe(false);
    expect(isValidPosition({ latitude: 5, longitude: Infinity })).toBe(false);
  });
});

describe("shouldRecenter", () => {
  it("zentriert nur bei aktivem Follow und vorhandener Position", () => {
    const position = { latitude: 10, longitude: 20 };

    expect(shouldRecenter(true, position)).toBe(true);
    expect(shouldRecenter(false, position)).toBe(false);
  });

  it("zentriert nicht, solange noch keine Position vorliegt", () => {
    expect(shouldRecenter(true, null)).toBe(false);
    expect(shouldRecenter(true, undefined)).toBe(false);
  });
});
