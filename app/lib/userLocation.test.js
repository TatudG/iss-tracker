import { describe, expect, it } from "vitest";
import {
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS,
  formatDistanceKm,
  formatUserLocation,
  isRadiusOption,
  normalizeUserLocation,
  radiusLabel,
} from "./userLocation";

describe("normalizeUserLocation", () => {
  it("übernimmt gültige Zahlen", () => {
    expect(normalizeUserLocation({ latitude: 52.52, longitude: 13.405 })).toEqual({
      latitude: 52.52,
      longitude: 13.405,
    });
  });

  it("akzeptiert numerische Strings, wie sie aus einem Eingabefeld kommen", () => {
    expect(normalizeUserLocation({ latitude: "52.52", longitude: "13.405" })).toEqual({
      latitude: 52.52,
      longitude: 13.405,
    });
  });

  it("erlaubt die Randwerte des gültigen Bereichs", () => {
    expect(normalizeUserLocation({ latitude: 90, longitude: 180 })).toEqual({
      latitude: 90,
      longitude: 180,
    });
    expect(normalizeUserLocation({ latitude: -90, longitude: -180 })).toEqual({
      latitude: -90,
      longitude: -180,
    });
  });

  it("verändert die Eingabe nicht", () => {
    const input = { latitude: 52.52, longitude: 13.405 };

    normalizeUserLocation(input);

    expect(input).toEqual({ latitude: 52.52, longitude: 13.405 });
  });

  it("lehnt Werte außerhalb des gültigen Bereichs ab", () => {
    expect(normalizeUserLocation({ latitude: 90.1, longitude: 0 })).toBeNull();
    expect(normalizeUserLocation({ latitude: 0, longitude: 180.1 })).toBeNull();
  });

  it("lehnt unbrauchbare Eingaben ab, statt sie zu erraten", () => {
    expect(normalizeUserLocation(null)).toBeNull();
    expect(normalizeUserLocation(undefined)).toBeNull();
    expect(normalizeUserLocation({ latitude: NaN, longitude: 2 })).toBeNull();
    expect(normalizeUserLocation({ latitude: Infinity, longitude: 2 })).toBeNull();
    expect(normalizeUserLocation({ latitude: "52,52", longitude: "13,405" })).toBeNull();
    expect(normalizeUserLocation({ latitude: "", longitude: "  " })).toBeNull();
    expect(normalizeUserLocation({})).toBeNull();
  });
});

describe("Radius", () => {
  it("kennt nur die angebotenen Werte", () => {
    expect(RADIUS_OPTIONS).toContain(DEFAULT_RADIUS_KM);
    expect(isRadiusOption(100)).toBe(true);

    for (const option of RADIUS_OPTIONS) {
      expect(isRadiusOption(option)).toBe(true);
    }

    expect(isRadiusOption(0)).toBe(false);
    expect(isRadiusOption(300)).toBe(false);
    expect(isRadiusOption("100")).toBe(false);
  });

  it("beschriftet den Radius", () => {
    expect(radiusLabel(250)).toBe("250 km");
    expect(radiusLabel(NaN)).toBe("–");
  });
});

describe("formatDistanceKm", () => {
  it("formatiert die Distanz mit deutschem Trennzeichen", () => {
    expect(formatDistanceKm(1234)).toBe("1.234 km");
    expect(formatDistanceKm(38.4)).toBe("38 km");
  });

  it("zeigt einen Gedankenstrich, solange keine Distanz vorliegt", () => {
    expect(formatDistanceKm(null)).toBe("–");
    expect(formatDistanceKm(NaN)).toBe("–");
  });
});

describe("formatUserLocation", () => {
  it("formatiert die Himmelsrichtungen in beide Richtungen", () => {
    expect(formatUserLocation({ latitude: 52.52, longitude: 13.41 })).toBe("52,52° N · 13,41° O");
    expect(formatUserLocation({ latitude: -33.87, longitude: -70.67 })).toBe("33,87° S · 70,67° W");
  });

  it("zeigt einen Gedankenstrich ohne gültigen Standort", () => {
    expect(formatUserLocation(null)).toBe("–");
    expect(formatUserLocation({ latitude: 200, longitude: 0 })).toBe("–");
  });
});
