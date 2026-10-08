import { describe, expect, it } from "vitest";
import { parseGeocodeResults } from "./geocode";

describe("parseGeocodeResults", () => {
  it("übernimmt gültige Treffer", () => {
    const payload = {
      results: [{ label: "Berlin, Deutschland", latitude: 52.52, longitude: 13.405 }],
    };

    expect(parseGeocodeResults(payload)).toEqual([
      { label: "Berlin, Deutschland", latitude: 52.52, longitude: 13.405 },
    ]);
  });

  it("verwirft Treffer ohne brauchbare Koordinaten", () => {
    const payload = {
      results: [
        { label: "Kaputt", latitude: "abc", longitude: 13 },
        { label: "Zu weit", latitude: 200, longitude: 13 },
        { label: "Gültig", latitude: 52, longitude: 13 },
      ],
    };

    expect(parseGeocodeResults(payload)).toEqual([
      { label: "Gültig", latitude: 52, longitude: 13 },
    ]);
  });

  it("verwirft Treffer ohne Beschriftung", () => {
    const payload = { results: [{ latitude: 52, longitude: 13 }] };

    expect(parseGeocodeResults(payload)).toEqual([]);
  });

  it("liefert eine leere Liste statt zu werfen, wenn die Antwort unbrauchbar ist", () => {
    expect(parseGeocodeResults(null)).toEqual([]);
    expect(parseGeocodeResults(undefined)).toEqual([]);
    expect(parseGeocodeResults({})).toEqual([]);
    expect(parseGeocodeResults({ error: "Die Adresssuche ist nicht verfügbar." })).toEqual([]);
    expect(parseGeocodeResults({ results: "kaputt" })).toEqual([]);
  });
});
