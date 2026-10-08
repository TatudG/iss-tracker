// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const UPSTREAM_PREFIX = "https://nominatim.openstreetmap.org/search";

function request(query) {
  return new Request(`http://localhost/api/geocode?q=${encodeURIComponent(query)}`);
}

function upstreamResponse(entries) {
  return {
    ok: true,
    status: 200,
    json: async () => entries,
  };
}

describe("GET /api/geocode", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fragt Nominatim mit der Adresse ab", async () => {
    fetchMock.mockResolvedValue(upstreamResponse([]));

    await GET(request("Berlin"));

    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl.startsWith(UPSTREAM_PREFIX)).toBe(true);
    expect(calledUrl).toContain("q=Berlin");
    expect(calledUrl).toContain("format=jsonv2");
  });

  it("sendet einen identifizierenden User-Agent, wie es die Nutzungsbedingungen verlangen", async () => {
    fetchMock.mockResolvedValue(upstreamResponse([]));

    await GET(request("Berlin"));

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(typeof headers["User-Agent"]).toBe("string");
    expect(headers["User-Agent"].length).toBeGreaterThan(0);
  });

  it("bildet Treffer auf Label und Koordinaten ab", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse([{ display_name: "Berlin, Deutschland", lat: "52.5170365", lon: "13.3888599" }]),
    );

    const body = await (await GET(request("Berlin"))).json();

    expect(body.results).toEqual([
      { label: "Berlin, Deutschland", latitude: 52.5170365, longitude: 13.3888599 },
    ]);
  });

  it("verwirft Treffer mit unbrauchbaren Koordinaten", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse([
        { display_name: "Kaputt", lat: "abc", lon: "13" },
        { display_name: "Gültig", lat: "52", lon: "13" },
        { lat: "50", lon: "10" },
      ]),
    );

    const body = await (await GET(request("Test"))).json();

    expect(body.results).toEqual([{ label: "Gültig", latitude: 52, longitude: 13 }]);
  });

  it("antwortet auch ohne Treffer mit Erfolg", async () => {
    fetchMock.mockResolvedValue(upstreamResponse([]));

    const response = await GET(request("Xyzzy"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [] });
  });

  it("lehnt eine zu kurze Anfrage ab, ohne die Quelle zu belasten", async () => {
    const response = await GET(request("ab"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lehnt eine leere Anfrage ab", async () => {
    const response = await GET(new Request("http://localhost/api/geocode"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lehnt eine überlange Anfrage ab", async () => {
    const response = await GET(request("a".repeat(201)));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("setzt Cache-Header, damit dieselbe Adresse nicht ständig neu gesucht wird", async () => {
    fetchMock.mockResolvedValue(upstreamResponse([]));

    const response = await GET(request("Berlin"));

    expect(response.headers.get("Cache-Control")).toContain("s-maxage=86400");
  });

  it("liefert bei einem Fehlerstatus der Quelle 502 als JSON statt HTML", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const response = await GET(request("Berlin"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(typeof body.error).toBe("string");
  });

  it("liefert bei einem Netzwerkfehler 502 statt zu werfen", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await GET(request("Berlin"));

    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("nicht verfügbar");
  });

  it("liefert bei unlesbarer Antwort 502 statt zu werfen", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });

    const response = await GET(request("Berlin"));

    expect(response.status).toBe(502);
  });

  it("verträgt eine Antwort, die kein Array ist", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ error: "nope" }) });

    const body = await (await GET(request("Berlin"))).json();

    expect(body).toEqual({ results: [] });
  });
});
