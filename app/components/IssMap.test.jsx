import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import IssMap from "./IssMap";

// Leaflet braucht ein echtes Layout und einen echten Browser; für die Logik
// der Karte (Folgen, Spur, Badge) genügt ein Doppel.
const h = vi.hoisted(() => {
  const handlers = {};
  const map = {
    setView: vi.fn(),
    panTo: vi.fn(),
    invalidateSize: vi.fn(),
    remove: vi.fn(),
    on: vi.fn((event, handler) => {
      handlers[event] = handler;
    }),
    off: vi.fn(),
  };
  // addTo liefert in Leaflet das Objekt selbst zurück - IssMap verlässt sich
  // darauf (`const marker = L.marker(...).addTo(map)`).
  const marker = { setLatLng: vi.fn(), setIcon: vi.fn() };
  marker.addTo = vi.fn(() => marker);
  const groups = [];
  const polyline = {};
  polyline.addTo = vi.fn(() => polyline);
  const circle = {};
  circle.addTo = vi.fn(() => circle);
  const circleMarker = {};
  circleMarker.addTo = vi.fn(() => circleMarker);
  const L = {
    map: vi.fn(() => map),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    marker: vi.fn(() => marker),
    divIcon: vi.fn((options) => options),
    // Jede Ebene bekommt eine eigene Gruppe - wie bei Leaflet. `group` zeigt
    // auf die erste (die Flugspur), damit die bestehenden Erwartungen halten.
    layerGroup: vi.fn(() => {
      const group = { clearLayers: vi.fn() };
      group.addTo = vi.fn(() => group);
      groups.push(group);
      return group;
    }),
    polyline: vi.fn(() => polyline),
    circle: vi.fn(() => circle),
    circleMarker: vi.fn(() => circleMarker),
  };

  return {
    handlers,
    map,
    marker,
    polyline,
    circle,
    circleMarker,
    groups,
    // Erste Gruppe = Flugspur, zweite = Nutzerstandort.
    get group() {
      return groups[0];
    },
    get userGroup() {
      return groups[1];
    },
    L,
  };
});

vi.mock("leaflet", () => ({ default: h.L }));

const position = (latitude, longitude) => ({ latitude, longitude, visibility: "daylight" });

async function mount(props = {}) {
  const view = render(<IssMap {...props} />);
  await waitFor(() => expect(h.L.map).toHaveBeenCalled());
  return view;
}

describe("IssMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.groups.length = 0;
    for (const event of Object.keys(h.handlers)) delete h.handlers[event];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("zoomt beim ersten Fix auf die ISS und folgt danach der Bewegung", async () => {
    const { rerender } = await mount({ position: null, follow: true });

    await act(async () => {
      rerender(<IssMap position={position(10, 20)} follow />);
    });

    expect(h.marker.setLatLng).toHaveBeenCalledWith([10, 20]);
    expect(h.map.setView).toHaveBeenCalledWith([10, 20], expect.any(Number));
    expect(h.map.panTo).not.toHaveBeenCalled();

    await act(async () => {
      rerender(<IssMap position={position(11, 21)} follow />);
    });

    expect(h.map.panTo).toHaveBeenCalledTimes(1);
    expect(h.map.panTo).toHaveBeenCalledWith([11, 21], expect.objectContaining({ animate: true }));
    // Die Zoomstufe bleibt in der Hand des Nutzers.
    expect(h.map.setView).toHaveBeenCalledTimes(1);
  });

  it("zentriert nicht mehr, wenn der Follow-Modus aus ist", async () => {
    const { rerender } = await mount({ position: null, follow: false });

    await act(async () => {
      rerender(<IssMap position={position(10, 20)} follow={false} />);
    });
    await act(async () => {
      rerender(<IssMap position={position(11, 21)} follow={false} />);
    });

    expect(h.map.panTo).not.toHaveBeenCalled();
    // Der Marker wird trotzdem weiter aktualisiert.
    expect(h.marker.setLatLng).toHaveBeenCalledTimes(2);
  });

  it("zentriert nicht, solange keine gültige Position vorliegt", async () => {
    const { rerender } = await mount({ position: null, follow: true });

    await act(async () => {
      rerender(<IssMap position={null} follow />);
    });

    expect(h.map.panTo).not.toHaveBeenCalled();
    expect(h.map.setView).not.toHaveBeenCalled();
  });

  it("meldet dem Elternteil, wenn der Nutzer die Karte selbst verschiebt", async () => {
    const onUserDrag = vi.fn();
    await mount({ position: position(10, 20), onUserDrag });

    expect(typeof h.handlers.dragstart).toBe("function");

    act(() => {
      h.handlers.dragstart();
    });

    expect(onUserDrag).toHaveBeenCalledTimes(1);
  });

  it("setzt das Tag/Nacht-Badge nur, wenn sich der Zustand ändert", async () => {
    const { rerender } = await mount({ position: position(10, 20) });

    // Beim Aufbau wird das Icon einmal erzeugt, aber nicht nachträglich gesetzt.
    expect(h.marker.setIcon).not.toHaveBeenCalled();

    await act(async () => {
      rerender(<IssMap position={{ ...position(11, 21), visibility: "daylight" }} />);
    });

    expect(h.marker.setIcon).not.toHaveBeenCalled();

    await act(async () => {
      rerender(<IssMap position={{ ...position(12, 22), visibility: "eclipsed" }} />);
    });

    expect(h.marker.setIcon).toHaveBeenCalledTimes(1);
    expect(h.marker.setIcon.mock.calls[0][0].html).toContain("iss-icon__badge--night");

    await act(async () => {
      rerender(<IssMap position={{ ...position(13, 23), visibility: "eclipsed" }} />);
    });

    expect(h.marker.setIcon).toHaveBeenCalledTimes(1);
  });

  it("zeichnet die Flugspur und blendet sie über den Schalter aus", async () => {
    const track = [position(10, 20), position(11, 21), position(12, 22)];
    const { rerender } = await mount({ position: track[0], track: [], showTrack: true });

    await act(async () => {
      rerender(<IssMap position={track[0]} track={track} showTrack />);
    });

    expect(h.L.polyline).toHaveBeenCalledTimes(1);
    expect(h.polyline.addTo).toHaveBeenCalledWith(h.group);

    await act(async () => {
      rerender(<IssMap position={track[0]} track={track} showTrack={false} />);
    });

    expect(h.group.clearLayers).toHaveBeenCalled();
    // Keine neue Linie, die Punkte bleiben im Zustand erhalten.
    expect(h.L.polyline).toHaveBeenCalledTimes(1);
  });

  it("zeichnet einen Sprung über die Datumsgrenze als zwei Linien statt quer über die Karte", async () => {
    const track = [position(10, 178), position(10, 179), position(11, -179), position(11, -178)];
    const { rerender } = await mount({ position: track[0], track: [] });

    await act(async () => {
      rerender(<IssMap position={track[3]} track={track} />);
    });

    expect(h.L.polyline).toHaveBeenCalledTimes(2);
    expect(h.L.polyline.mock.calls[0][0]).toEqual([
      [10, 178],
      [10, 179],
    ]);
    expect(h.L.polyline.mock.calls[1][0]).toEqual([
      [11, -179],
      [11, -178],
    ]);
  });

  it("erzeugt für einen einzelnen Punkt keine Linie", async () => {
    const { rerender } = await mount({ position: null, track: [] });

    await act(async () => {
      rerender(<IssMap position={position(10, 20)} track={[position(10, 20)]} />);
    });

    expect(h.L.polyline).not.toHaveBeenCalled();
  });

  it("zeichnet den Nutzerstandort samt Radius-Kreis", async () => {
    const { rerender } = await mount({ position: position(10, 20) });

    await act(async () => {
      rerender(
        <IssMap position={position(10, 20)} userLocation={{ latitude: 52.52, longitude: 13.405 }} radiusKm={250} />,
      );
    });

    expect(h.L.circle).toHaveBeenCalledTimes(1);
    // Leaflet erwartet den Radius in Metern, nicht in Kilometern.
    expect(h.L.circle.mock.calls[0][1]).toEqual(
      expect.objectContaining({ radius: 250000, interactive: false }),
    );
    expect(h.L.circleMarker).toHaveBeenCalledWith(
      [52.52, 13.405],
      expect.objectContaining({ interactive: false }),
    );
    expect(h.circle.addTo).toHaveBeenCalledWith(h.userGroup);
  });

  it("zeichnet den Kreis bei geändertem Radius neu und räumt den alten weg", async () => {
    const { rerender } = await mount({ position: position(10, 20) });
    const userLocation = { latitude: 52.52, longitude: 13.405 };

    await act(async () => {
      rerender(<IssMap position={position(10, 20)} userLocation={userLocation} radiusKm={250} />);
    });
    await act(async () => {
      rerender(<IssMap position={position(10, 20)} userLocation={userLocation} radiusKm={500} />);
    });

    expect(h.L.circle).toHaveBeenCalledTimes(2);
    expect(h.userGroup.clearLayers).toHaveBeenCalled();
    expect(h.L.circle.mock.calls[1][1].radius).toBe(500000);
  });

  it("zeichnet nichts, solange kein Standort gesetzt ist", async () => {
    await mount({ position: position(10, 20) });

    expect(h.L.circle).not.toHaveBeenCalled();
    expect(h.L.circleMarker).not.toHaveBeenCalled();
  });

  it("meldet dem Elternteil einen Klick auf die Karte mit den Koordinaten", async () => {
    const onMapClick = vi.fn();
    await mount({ position: position(10, 20), onMapClick });

    expect(typeof h.handlers.click).toBe("function");

    act(() => {
      h.handlers.click({ latlng: { lat: 52.52, lng: 13.405 } });
    });

    expect(onMapClick).toHaveBeenCalledWith({ lat: 52.52, lng: 13.405 });
  });

  it("lässt den Follow-Modus bei einem Kartenklick unangetastet", async () => {
    const onUserDrag = vi.fn();
    const onMapClick = vi.fn();
    await mount({ position: position(10, 20), onUserDrag, onMapClick });

    act(() => {
      h.handlers.click({ latlng: { lat: 52.52, lng: 13.405 } });
    });

    expect(onMapClick).toHaveBeenCalledTimes(1);
    expect(onUserDrag).not.toHaveBeenCalled();
  });

  it("setzt nach einem Verschieben keinen Standort durch den Folgeklick", async () => {
    const onMapClick = vi.fn();
    await mount({ position: position(10, 20), onMapClick });

    act(() => {
      h.handlers.dragstart();
      h.handlers.click({ latlng: { lat: 52.52, lng: 13.405 } });
    });

    expect(onMapClick).not.toHaveBeenCalled();
  });

  it("räumt Karte und Event-Listener beim Unmount auf", async () => {
    const { unmount } = await mount({ position: position(10, 20) });

    unmount();

    expect(h.map.off).toHaveBeenCalledWith("dragstart", expect.any(Function));
    expect(h.map.off).toHaveBeenCalledWith("dragend", expect.any(Function));
    expect(h.map.off).toHaveBeenCalledWith("click", expect.any(Function));
    expect(h.map.remove).toHaveBeenCalled();
  });
});
