import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import IssTracker from "./IssTracker";

// Karte und Besatzungsliste werden ersetzt: hier geht es um die Verdrahtung
// der Zustände (Polling, Flugspur, Follow-Modus), nicht um Leaflet oder Netz.
vi.mock("./IssMap", () => ({
  default: ({ follow, showTrack, track, onUserDrag, position }) => (
    <div data-testid="map">
      <span data-testid="map-position">{position ? `${position.latitude},${position.longitude}` : "leer"}</span>
      <span data-testid="map-follow">{String(follow)}</span>
      <span data-testid="map-show-track">{String(showTrack)}</span>
      <span data-testid="map-track-length">{track.length}</span>
      <button type="button" onClick={onUserDrag}>
        Karte verschieben
      </button>
    </div>
  ),
}));

vi.mock("./AstronautList", () => ({
  default: () => <div data-testid="crew" />,
}));

function issResponse(overrides = {}) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      latitude: 10,
      longitude: 20,
      altitude: 420,
      velocity: 27500,
      visibility: "daylight",
      timestamp: 1700000000,
      ...overrides,
    }),
  };
}

// Lässt das Polling-Intervall weiterlaufen und wartet, bis die Antwort
// verarbeitet ist.
async function poll(times = 1) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
  }
}

describe("IssTracker", () => {
  let fetchMock;
  let originalFetch;

  beforeEach(() => {
    vi.useFakeTimers();
    originalFetch = global.fetch;
    fetchMock = vi.fn(() => Promise.resolve(issResponse()));
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("zeigt nach der ersten Antwort die Messwerte an", async () => {
    render(<IssTracker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("map-position").textContent).toBe("10,20");
    expect(screen.getByText("420,00 km")).toBeTruthy();
    expect(screen.getByText("27.500 km/h")).toBeTruthy();
    expect(screen.getByText("Tag (von der Sonne beleuchtet)")).toBeTruthy();
  });

  it("baut die Flugspur mit jedem erfolgreichen Abruf auf", async () => {
    render(<IssTracker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("map-track-length").textContent).toBe("1");

    await poll(2);

    expect(screen.getByTestId("map-track-length").textContent).toBe("3");
  });

  it("begrenzt die Flugspur auf 20 Punkte", async () => {
    render(<IssTracker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await poll(25);

    expect(screen.getByTestId("map-track-length").textContent).toBe("20");
  });

  it("erweitert die Spur nicht, wenn ein Abruf fehlschlägt", async () => {
    fetchMock.mockResolvedValueOnce(issResponse());
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));

    render(<IssTracker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await poll(2);

    expect(screen.getByTestId("map-track-length").textContent).toBe("1");
    expect(screen.getByText(/keine Internetverbindung/)).toBeTruthy();
  });

  it("startet mit aktivem Follow-Modus und erlaubt das Abschalten", async () => {
    render(<IssTracker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId("map-follow").textContent).toBe("true");

    fireEvent.click(screen.getByLabelText("Karte folgt ISS"));

    expect(screen.getByTestId("map-follow").textContent).toBe("false");
  });

  it("schaltet den Follow-Modus ab, sobald der Nutzer die Karte selbst verschiebt", async () => {
    render(<IssTracker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Karte verschieben" }));

    expect(screen.getByTestId("map-follow").textContent).toBe("false");
    expect(screen.getByLabelText("Karte folgt ISS").checked).toBe(false);
  });

  it("blendet die Flugspur über den Schalter aus, ohne die Punkte zu verlieren", async () => {
    render(<IssTracker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await poll(2);

    expect(screen.getByTestId("map-show-track").textContent).toBe("true");

    fireEvent.click(screen.getByLabelText("Flugspur anzeigen"));

    expect(screen.getByTestId("map-show-track").textContent).toBe("false");
    expect(screen.getByTestId("map-track-length").textContent).toBe("3");

    fireEvent.click(screen.getByLabelText("Flugspur anzeigen"));

    expect(screen.getByTestId("map-show-track").textContent).toBe("true");
    expect(screen.getByTestId("map-track-length").textContent).toBe("3");
  });

  it("zeigt bei API-Ausfall einen verständlichen Hinweis und pollt weiter", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));

    render(<IssTracker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/keine Internetverbindung/)).toBeTruthy();

    // Die Anzeige erholt sich, sobald die API wieder antwortet.
    fetchMock.mockImplementation(() => Promise.resolve(issResponse()));
    await poll(1);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("map-position").textContent).toBe("10,20");
  });

  it("meldet eine unbrauchbare Antwort als Fehler statt falsche Werte zu zeigen", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ...issResponse(), json: async () => ({ latitude: "abc", longitude: null }) }),
    );

    render(<IssTracker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByTestId("map-position").textContent).toBe("leer");
  });

  it("räumt beim Verlassen auf (kein Fehler, kein weiterer Abruf)", async () => {
    const { unmount } = render(<IssTracker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const callsBefore = fetchMock.mock.calls.length;
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});
