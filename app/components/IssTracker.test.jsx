import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import IssTracker from "./IssTracker";
import { notificationSupport, playAlarmBeep, showProximityNotification } from "../lib/alert";

// Karte und Besatzungsliste werden ersetzt: hier geht es um die Verdrahtung
// der Zustände (Polling, Flugspur, Follow-Modus, Standort), nicht um Leaflet
// oder Netz.
vi.mock("./IssMap", () => ({
  default: ({ follow, showTrack, track, onUserDrag, position, userLocation, radiusKm, onMapClick, picking }) => (
    <div data-testid="map">
      <span data-testid="map-position">{position ? `${position.latitude},${position.longitude}` : "leer"}</span>
      <span data-testid="map-follow">{String(follow)}</span>
      <span data-testid="map-show-track">{String(showTrack)}</span>
      <span data-testid="map-track-length">{track.length}</span>
      <span data-testid="map-user">
        {userLocation ? `${userLocation.latitude},${userLocation.longitude}` : "leer"}
      </span>
      <span data-testid="map-radius">{String(radiusKm)}</span>
      <span data-testid="map-picking">{String(picking)}</span>
      <button type="button" onClick={onUserDrag}>
        Karte verschieben
      </button>
      <button type="button" onClick={() => onMapClick({ lat: 52.52, lng: 13.405 })}>
        Karte klicken
      </button>
    </div>
  ),
}));

vi.mock("./AstronautList", () => ({
  default: () => <div data-testid="crew" />,
}));

// Ton und Benachrichtigung sind Seiteneffekte der Umgebung; hier zählt nur,
// ob und wie oft sie ausgelöst werden.
vi.mock("../lib/alert", () => ({
  playAlarmBeep: vi.fn(),
  notificationSupport: vi.fn(() => "unsupported"),
  showProximityNotification: vi.fn(() => true),
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

function geocodeResponse(results) {
  return { ok: true, status: 200, statusText: "OK", json: async () => ({ results }) };
}

const berlin = { label: "Berlin, Deutschland", latitude: 52.52, longitude: 13.405 };

// Lässt das Polling-Intervall weiterlaufen und wartet, bis die Antwort
// verarbeitet ist.
async function poll(times = 1) {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
  }
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

// Setzt den Standort über den Kartenklick-Modus - der einzige Weg, der ohne
// Adresssuche auskommt.
async function setLocationByClick() {
  fireEvent.click(screen.getByRole("button", { name: "Standort auf Karte wählen" }));
  fireEvent.click(screen.getByRole("button", { name: "Karte klicken" }));
  await flush();
}

describe("IssTracker", () => {
  let fetchMock;
  let originalFetch;
  let issAt;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    notificationSupport.mockReturnValue("unsupported");
    issAt = { latitude: 10, longitude: 20 };

    originalFetch = global.fetch;
    fetchMock = vi.fn((url) => {
      if (String(url).startsWith("/api/geocode")) {
        return Promise.resolve(geocodeResponse([berlin]));
      }
      return Promise.resolve(issResponse(issAt));
    });
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    global.fetch = originalFetch;
    delete global.Notification;
  });

  it("zeigt nach der ersten Antwort die Messwerte an", async () => {
    render(<IssTracker />);
    await flush();

    expect(screen.getByTestId("map-position").textContent).toBe("10,20");
    expect(screen.getByText("420,00 km")).toBeTruthy();
    expect(screen.getByText("27.500 km/h")).toBeTruthy();
    expect(screen.getByText("Tag (von der Sonne beleuchtet)")).toBeTruthy();
  });

  it("baut die Flugspur mit jedem erfolgreichen Abruf auf", async () => {
    render(<IssTracker />);
    await flush();

    expect(screen.getByTestId("map-track-length").textContent).toBe("1");

    await poll(2);

    expect(screen.getByTestId("map-track-length").textContent).toBe("3");
  });

  it("begrenzt die Flugspur auf 20 Punkte", async () => {
    render(<IssTracker />);
    await flush();

    await poll(25);

    expect(screen.getByTestId("map-track-length").textContent).toBe("20");
  });

  it("erweitert die Spur nicht, wenn ein Abruf fehlschlägt", async () => {
    fetchMock.mockResolvedValueOnce(issResponse());
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));

    render(<IssTracker />);
    await flush();
    await poll(2);

    expect(screen.getByTestId("map-track-length").textContent).toBe("1");
    expect(screen.getByText(/keine Internetverbindung/)).toBeTruthy();
  });

  it("startet mit aktivem Follow-Modus und erlaubt das Abschalten", async () => {
    render(<IssTracker />);
    await flush();

    expect(screen.getByTestId("map-follow").textContent).toBe("true");

    fireEvent.click(screen.getByLabelText("Karte folgt ISS"));

    expect(screen.getByTestId("map-follow").textContent).toBe("false");
  });

  it("schaltet den Follow-Modus ab, sobald der Nutzer die Karte selbst verschiebt", async () => {
    render(<IssTracker />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Karte verschieben" }));

    expect(screen.getByTestId("map-follow").textContent).toBe("false");
    expect(screen.getByLabelText("Karte folgt ISS").checked).toBe(false);
  });

  it("blendet die Flugspur über den Schalter aus, ohne die Punkte zu verlieren", async () => {
    render(<IssTracker />);
    await flush();
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
    await flush();

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
    await flush();

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByTestId("map-position").textContent).toBe("leer");
  });

  it("räumt beim Verlassen auf (kein Fehler, kein weiterer Abruf)", async () => {
    const { unmount } = render(<IssTracker />);
    await flush();

    const callsBefore = fetchMock.mock.calls.length;
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it("sucht eine Adresse und setzt den Standort", async () => {
    render(<IssTracker />);
    await flush();

    fireEvent.change(screen.getByLabelText("Adresse"), { target: { value: "Berlin" } });
    fireEvent.submit(screen.getByRole("button", { name: "Suchen" }).form);
    await flush();

    const geocodeCall = fetchMock.mock.calls.find(([url]) => String(url).startsWith("/api/geocode"));
    expect(geocodeCall[0]).toBe("/api/geocode?q=Berlin");
    expect(screen.getByTestId("map-user").textContent).toBe("52.52,13.405");
  });

  it("zeigt einen Hinweis, wenn die Adresse nicht gefunden wird", async () => {
    fetchMock.mockImplementation((url) =>
      String(url).startsWith("/api/geocode")
        ? Promise.resolve(geocodeResponse([]))
        : Promise.resolve(issResponse(issAt)),
    );

    render(<IssTracker />);
    await flush();

    fireEvent.change(screen.getByLabelText("Adresse"), { target: { value: "Xyzzy" } });
    fireEvent.submit(screen.getByRole("button", { name: "Suchen" }).form);
    await flush();

    expect(screen.getByText("Zu dieser Adresse wurde nichts gefunden.")).toBeTruthy();
    expect(screen.getByTestId("map-user").textContent).toBe("leer");
  });

  it("bietet bei mehreren Treffern eine Auswahl an", async () => {
    const hamburg = { label: "Hamburg, Deutschland", latitude: 53.55, longitude: 9.99 };
    fetchMock.mockImplementation((url) =>
      String(url).startsWith("/api/geocode")
        ? Promise.resolve(geocodeResponse([berlin, hamburg]))
        : Promise.resolve(issResponse(issAt)),
    );

    render(<IssTracker />);
    await flush();

    fireEvent.change(screen.getByLabelText("Adresse"), { target: { value: "Berlin" } });
    fireEvent.submit(screen.getByRole("button", { name: "Suchen" }).form);
    await flush();

    expect(screen.getByTestId("map-user").textContent).toBe("leer");

    fireEvent.click(screen.getByRole("button", { name: "Hamburg, Deutschland" }));

    expect(screen.getByTestId("map-user").textContent).toBe("53.55,9.99");
  });

  it("setzt den Standort nur im dafür aktivierten Modus", async () => {
    render(<IssTracker />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Karte klicken" }));

    expect(screen.getByTestId("map-user").textContent).toBe("leer");
    expect(screen.getByTestId("map-picking").textContent).toBe("false");

    await setLocationByClick();

    expect(screen.getByTestId("map-user").textContent).toBe("52.52,13.405");
    // Nach dem Setzen verlässt der Modus sich selbst.
    expect(screen.getByTestId("map-picking").textContent).toBe("false");
  });

  it("lässt den Follow-Modus beim Setzen des Standorts unangetastet", async () => {
    render(<IssTracker />);
    await flush();

    await setLocationByClick();

    expect(screen.getByTestId("map-follow").textContent).toBe("true");
  });

  it("zeigt die Entfernung zur ISS und aktualisiert sie mit jedem Poll", async () => {
    render(<IssTracker />);
    await flush();
    await setLocationByClick();

    await poll(1);
    const far = screen.getByTestId("distance").textContent;
    expect(far).toMatch(/km$/);

    // Die ISS zieht über den Standort hinweg.
    issAt = { latitude: 52.5, longitude: 13.4 };
    await poll(1);

    expect(screen.getByTestId("distance").textContent).not.toBe(far);
  });

  it("alarmiert genau einmal pro Annäherung", async () => {
    render(<IssTracker />);
    await flush();
    await setLocationByClick();

    // Weit weg: kein Alarm.
    await poll(1);
    expect(playAlarmBeep).not.toHaveBeenCalled();

    // ISS zieht in den Radius ein.
    issAt = { latitude: 52.5, longitude: 13.4 };
    await poll(1);

    expect(playAlarmBeep).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Die ISS ist in deiner Nähe!")).toBeTruthy();

    // Sie bleibt im Radius - kein Dauer-Alarm.
    await poll(2);
    expect(playAlarmBeep).toHaveBeenCalledTimes(1);

    // Verlassen und erneut eintreten: wieder genau ein Alarm.
    issAt = { latitude: 10, longitude: 20 };
    await poll(1);
    issAt = { latitude: 52.5, longitude: 13.4 };
    await poll(1);

    expect(playAlarmBeep).toHaveBeenCalledTimes(2);
  });

  it("zeigt ohne Ton-Schalter keinen Alarm, aber den Hinweis", async () => {
    render(<IssTracker />);
    await flush();

    fireEvent.click(screen.getByLabelText("Alarmton"));
    await setLocationByClick();

    issAt = { latitude: 52.5, longitude: 13.4 };
    await poll(1);

    expect(playAlarmBeep).not.toHaveBeenCalled();
    expect(screen.getByText("Die ISS ist in deiner Nähe!")).toBeTruthy();
  });

  it("löst beim Wechsel des Radius keinen Alarm aus", async () => {
    render(<IssTracker />);
    await flush();
    await setLocationByClick();
    await poll(1);

    fireEvent.change(screen.getByLabelText("Alarm-Radius"), { target: { value: "500" } });

    expect(screen.getByTestId("map-radius").textContent).toBe("500");
    expect(playAlarmBeep).not.toHaveBeenCalled();
  });

  it("fordert die Benachrichtigung erst auf Klick an und nutzt sie dann im Alarm", async () => {
    notificationSupport.mockReturnValue("default");
    const requestPermission = vi.fn(() => Promise.resolve("granted"));
    // Bewusst als Funktion: so sieht es der Browser ebenfalls.
    global.Notification = Object.assign(function Notification() {}, {
      permission: "default",
      requestPermission,
    });

    render(<IssTracker />);
    await flush();

    expect(requestPermission).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Benachrichtigung aktivieren" }));
    await flush();

    expect(requestPermission).toHaveBeenCalledTimes(1);

    await setLocationByClick();
    issAt = { latitude: 52.5, longitude: 13.4 };
    await poll(1);

    expect(showProximityNotification).toHaveBeenCalledTimes(1);
  });

  it("bleibt bei verweigerter Benachrichtigung beim Hinweis in der App", async () => {
    notificationSupport.mockReturnValue("denied");

    render(<IssTracker />);
    await flush();

    expect(screen.queryByRole("button", { name: "Benachrichtigung aktivieren" })).toBeNull();
    expect(screen.getByText(/blockiert/)).toBeTruthy();

    await setLocationByClick();
    issAt = { latitude: 52.5, longitude: 13.4 };
    await poll(1);

    expect(showProximityNotification).not.toHaveBeenCalled();
    expect(screen.getByText("Die ISS ist in deiner Nähe!")).toBeTruthy();
  });

  it("stellt Standort und Radius nach dem Laden wieder her", async () => {
    window.localStorage.setItem(
      "iss-tracker:standort:v1",
      JSON.stringify({ latitude: 52.52, longitude: 13.405, radiusKm: 500 }),
    );

    render(<IssTracker />);
    await flush();

    expect(screen.getByTestId("map-user").textContent).toBe("52.52,13.405");
    expect(screen.getByTestId("map-radius").textContent).toBe("500");
  });

  it("speichert einen neu gesetzten Standort", async () => {
    render(<IssTracker />);
    await flush();
    await setLocationByClick();

    const stored = JSON.parse(window.localStorage.getItem("iss-tracker:standort:v1"));

    expect(stored).toEqual({ latitude: 52.52, longitude: 13.405, radiusKm: 250 });
  });

  it("startet mit Standardwerten, wenn der Speicher nicht lesbar ist", async () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("Speicher gesperrt");
    });

    render(<IssTracker />);
    await flush();

    expect(screen.getByTestId("map-user").textContent).toBe("leer");
    expect(screen.getByTestId("map-radius").textContent).toBe("250");
    expect(screen.getByTestId("map-position").textContent).toBe("10,20");
  });
});
