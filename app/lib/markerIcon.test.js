import { describe, expect, it } from "vitest";
import { buildIssIconHtml } from "./markerIcon";

describe("buildIssIconHtml", () => {
  it("enthält weiterhin die Marker-Grundform", () => {
    const html = buildIssIconHtml("daylight");

    expect(html).toContain("iss-icon__ring");
    expect(html).toContain("iss-icon__dot");
  });

  it("hängt das Badge passend zum Tag/Nacht-Zustand an", () => {
    expect(buildIssIconHtml("daylight")).toContain("iss-icon__badge--day");
    expect(buildIssIconHtml("eclipsed")).toContain("iss-icon__badge--night");
    expect(buildIssIconHtml(undefined)).toContain("iss-icon__badge--unknown");
  });

  it("transportiert die Information nicht allein über die Farbe", () => {
    const day = buildIssIconHtml("daylight");
    const night = buildIssIconHtml("eclipsed");

    // Symbol und Klartext unterscheiden sich, nicht nur die CSS-Klasse.
    expect(day).toContain("☀");
    expect(day).toContain("Tag");
    expect(night).toContain("☾");
    expect(night).toContain("Nacht");
  });

  it("beschriftet das Badge für Screenreader", () => {
    expect(buildIssIconHtml("eclipsed")).toContain('aria-label="Sichtbarkeit: Nacht"');
    expect(buildIssIconHtml(null)).toContain('aria-label="Sichtbarkeit: unbekannt"');
  });

  it("wirft bei unerwarteten Werten nicht", () => {
    expect(() => buildIssIconHtml({})).not.toThrow();
    expect(buildIssIconHtml({})).toContain("iss-icon__badge--unknown");
  });
});
