// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const UPSTREAM_URL = "http://api.open-notify.org/astros.json";

function upstreamResponse(people) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ message: "success", number: people.length, people }),
  };
}

describe("GET /api/astros", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ruft die HTTP-Quelle serverseitig ab", async () => {
    fetchMock.mockResolvedValue(upstreamResponse([]));

    await GET();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(UPSTREAM_URL);
  });

  it("liefert nur ISS-Besatzung samt Anzahl", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse([
        { name: "Oleg Kononenko", craft: "ISS" },
        { name: "Ye Guangfu", craft: "Tiangong" },
        { name: "Tracy Dyson", craft: "ISS" },
      ]),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(2);
    expect(body.people).toEqual([{ name: "Oleg Kononenko" }, { name: "Tracy Dyson" }]);
  });

  it("zählt unbekannte craft-Werte nicht als ISS-Besatzung", async () => {
    fetchMock.mockResolvedValue(
      upstreamResponse([
        { name: "Unbekannt", craft: "iss" },
        { name: "Ohne Angabe" },
        { name: "Echt", craft: "ISS" },
      ]),
    );

    const body = await (await GET()).json();

    expect(body.count).toBe(1);
    expect(body.people).toEqual([{ name: "Echt" }]);
  });

  it("antwortet auch bei leerer Liste mit Erfolg", async () => {
    fetchMock.mockResolvedValue(upstreamResponse([]));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ count: 0, people: [] });
  });

  it("setzt Cache-Header, damit die Liste nicht bei jedem Aufruf neu geholt wird", async () => {
    fetchMock.mockResolvedValue(upstreamResponse([]));

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });

  it("liefert bei einem Upstream-Fehlerstatus 502 als JSON statt HTML", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(typeof body.error).toBe("string");
  });

  it("liefert bei einem Netzwerkfehler 502 statt zu werfen (Regressionstest)", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain("nicht abrufbar");
  });

  it("liefert bei unlesbarer Antwort 502 statt zu werfen", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });

    const response = await GET();

    expect(response.status).toBe(502);
  });
});
