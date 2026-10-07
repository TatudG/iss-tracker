import { describe, expect, it } from "vitest";
import { MAX_TRACK_POINTS, appendTrackPoint, splitAtAntimeridian } from "./track";

const point = (latitude, longitude) => ({ latitude, longitude });

describe("appendTrackPoint", () => {
  it("hängt bei jedem erfolgreichen Abruf einen Punkt an", () => {
    const afterFirst = appendTrackPoint([], point(10, 20));
    const afterSecond = appendTrackPoint(afterFirst, point(11, 21));

    expect(afterFirst).toHaveLength(1);
    expect(afterSecond).toHaveLength(2);
    expect(afterSecond[1]).toEqual(point(11, 21));
  });

  it("behält nur die letzten Punkte, sobald die Maximallänge erreicht ist", () => {
    let track = [];
    for (let index = 0; index < MAX_TRACK_POINTS; index += 1) {
      track = appendTrackPoint(track, point(index, index));
    }

    expect(track).toHaveLength(MAX_TRACK_POINTS);

    const grown = appendTrackPoint(track, point(999, 999));

    expect(grown).toHaveLength(MAX_TRACK_POINTS);
    // Der älteste Punkt (0,0) ist herausgefallen, der neueste ist angekommen.
    expect(grown[0]).toEqual(point(1, 1));
    expect(grown[grown.length - 1]).toEqual(point(999, 999));
  });

  it("übernimmt nur die Koordinaten, keine Zusatzfelder", () => {
    const track = appendTrackPoint([], { ...point(1, 2), velocity: 27000, visibility: "daylight" });

    expect(track[0]).toEqual(point(1, 2));
  });

  it("verändert die Spur nicht, wenn der Abruf fehlgeschlagen ist (keine gültige Position)", () => {
    const existing = [point(1, 1), point(2, 2)];

    expect(appendTrackPoint(existing, null)).toBe(existing);
    expect(appendTrackPoint(existing, { latitude: NaN, longitude: 5 })).toBe(existing);
    expect(appendTrackPoint(existing, { latitude: 5 })).toBe(existing);
  });
});

describe("splitAtAntimeridian", () => {
  it("lässt eine normale Flugspur als ein Segment zusammen", () => {
    const segments = splitAtAntimeridian([point(10, 10), point(11, 12), point(12, 14)]);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveLength(3);
  });

  it("teilt beim Sprung über die Datumsgrenze in zwei Segmente", () => {
    const segments = splitAtAntimeridian([point(10, 179), point(11, -179), point(12, -177)]);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual([point(10, 179)]);
    expect(segments[1]).toEqual([point(11, -179), point(12, -177)]);
  });

  it("teilt auch bei mehreren Sprüngen korrekt", () => {
    const segments = splitAtAntimeridian([
      point(0, 179),
      point(1, -179),
      point(2, -178),
      point(3, 178),
    ]);

    expect(segments).toHaveLength(3);
  });

  it("liefert für leere Eingaben eine leere Liste", () => {
    expect(splitAtAntimeridian([])).toEqual([]);
    expect(splitAtAntimeridian(undefined)).toEqual([]);
  });
});
