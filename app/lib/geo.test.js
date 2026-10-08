import { describe, expect, it } from "vitest";
import { distanceKm, evaluateProximity, isWithinRadius } from "./geo";

const berlin = { latitude: 52.52, longitude: 13.405 };
const paris = { latitude: 48.8566, longitude: 2.3522 };

describe("distanceKm", () => {
  it("berechnet die bekannte Distanz zwischen Berlin und Paris", () => {
    expect(distanceKm(berlin, paris)).toBeCloseTo(878, -1);
  });

  it("liefert 0 für identische Punkte", () => {
    expect(distanceKm(berlin, berlin)).toBeCloseTo(0, 5);
  });

  it("rechnet über die Datumsgrenze korrekt statt einmal um die Erde", () => {
    const distance = distanceKm({ latitude: 10, longitude: 179 }, { latitude: 10, longitude: -179 });

    // Zwei Längengrade Abstand auf demselben Breitengrad - nicht der halbe Erdumfang.
    expect(distance).toBeGreaterThan(200);
    expect(distance).toBeLessThan(240);
  });

  it("liefert ungefähr den halben Erdumfang für Gegenpole", () => {
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })).toBeCloseTo(
      20015,
      -2,
    );
  });

  it("liefert null statt 0 km, wenn eine Position unbrauchbar ist", () => {
    expect(distanceKm(null, paris)).toBeNull();
    expect(distanceKm(berlin, undefined)).toBeNull();
    expect(distanceKm(berlin, { latitude: "abc", longitude: 2 })).toBeNull();
    expect(distanceKm(berlin, { latitude: NaN, longitude: 2 })).toBeNull();
  });
});

describe("isWithinRadius", () => {
  it("erkennt einen Punkt innerhalb des Radius", () => {
    expect(isWithinRadius(paris, berlin, 1000)).toBe(true);
  });

  it("erkennt einen Punkt außerhalb des Radius", () => {
    expect(isWithinRadius(paris, berlin, 100)).toBe(false);
  });

  it("wertet die Distanz genau auf der Grenze als innerhalb", () => {
    const exact = distanceKm(berlin, paris);

    expect(isWithinRadius(paris, berlin, exact)).toBe(true);
  });

  it("lehnt einen unbrauchbaren Radius ab", () => {
    expect(isWithinRadius(paris, berlin, 0)).toBe(false);
    expect(isWithinRadius(paris, berlin, -5)).toBe(false);
    expect(isWithinRadius(paris, berlin, NaN)).toBe(false);
    expect(isWithinRadius(paris, berlin, null)).toBe(false);
  });

  it("lehnt eine unbrauchbare Position ab", () => {
    expect(isWithinRadius(null, berlin, 1000)).toBe(false);
    expect(isWithinRadius({ latitude: 10, longitude: null }, berlin, 1000)).toBe(false);
  });
});

describe("evaluateProximity", () => {
  it("meldet den Eintritt, wenn die ISS von außen in den Radius kommt", () => {
    const result = evaluateProximity(false, paris, berlin, 1000);

    expect(result.inside).toBe(true);
    expect(result.entered).toBe(true);
    expect(result.left).toBe(false);
    expect(result.distanceKm).toBeGreaterThan(800);
  });

  it("meldet keinen zweiten Alarm, solange die ISS im Radius bleibt", () => {
    const result = evaluateProximity(true, paris, berlin, 1000);

    expect(result.inside).toBe(true);
    expect(result.entered).toBe(false);
    expect(result.left).toBe(false);
  });

  it("meldet das Verlassen des Radius und schaltet damit wieder scharf", () => {
    const result = evaluateProximity(true, paris, berlin, 100);

    expect(result.inside).toBe(false);
    expect(result.entered).toBe(false);
    expect(result.left).toBe(true);
  });

  it("meldet nichts, solange die ISS außerhalb bleibt", () => {
    const result = evaluateProximity(false, paris, berlin, 100);

    expect(result.inside).toBe(false);
    expect(result.entered).toBe(false);
    expect(result.left).toBe(false);
  });

  it("behält bei einer unbrauchbaren Position den Zustand und löst keinen Alarm aus", () => {
    const result = evaluateProximity(true, { latitude: NaN, longitude: 2 }, berlin, 1000);

    expect(result.inside).toBe(true);
    expect(result.entered).toBe(false);
    expect(result.left).toBe(false);
    expect(result.distanceKm).toBeNull();
  });

  it("löst ohne gesetzten Standort nie einen Alarm aus", () => {
    const result = evaluateProximity(false, paris, null, 1000);

    expect(result.inside).toBe(false);
    expect(result.entered).toBe(false);
    expect(result.distanceKm).toBeNull();
  });
});
