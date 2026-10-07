import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AstronautList from "./AstronautList";

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe("AstronautList", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fragt die eigene Route ab, nicht die Quelle im Ausland (kein Mixed Content)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 0, people: [] }));

    render(<AstronautList />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/astros");
    expect(fetchMock.mock.calls[0][0]).not.toContain("open-notify.org");
  });

  it("zeigt die Namen und die Anzahl an", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        count: 3,
        people: [{ name: "Oleg Kononenko" }, { name: "Tracy Dyson" }, { name: "Nikolai Chub" }],
      }),
    );

    render(<AstronautList />);

    expect(await screen.findByText("Oleg Kononenko")).toBeTruthy();
    expect(screen.getByText("Tracy Dyson")).toBeTruthy();
    expect(screen.getByText("Nikolai Chub")).toBeTruthy();
    expect(screen.getByText("3 Personen an Bord")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("zeigt einen verständlichen Hinweis, wenn die Route einen Fehler liefert", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "kaputt" }, false, 502));

    render(<AstronautList />);

    expect(await screen.findByText(/Fehler 502/)).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("fängt Netzwerkfehler ab und stürzt nicht ab", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    render(<AstronautList />);

    expect(await screen.findByText(/keine Internetverbindung/)).toBeTruthy();
  });

  it("erholt sich über den Aktualisieren-Knopf", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "kaputt" }, false, 502))
      .mockResolvedValueOnce(jsonResponse({ count: 1, people: [{ name: "Tracy Dyson" }] }));

    render(<AstronautList />);

    expect(await screen.findByText(/Fehler 502/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Aktualisieren" }));

    expect(await screen.findByText("Tracy Dyson")).toBeTruthy();
    expect(screen.queryByText(/Fehler 502/)).toBeNull();
  });
});
