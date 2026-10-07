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

  it("zeigt den Gast standardmäßig nicht an", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 1, people: [{ name: "Tracy Dyson" }] }));

    render(<AstronautList />);
    await screen.findByText("Tracy Dyson");

    expect(screen.queryByText(/Marcus/)).toBeNull();
    expect(screen.getByLabelText("Gast anzeigen").checked).toBe(false);
  });

  it("blendet den Gast über den Schalter als letzten Eintrag ein und wieder aus", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ count: 2, people: [{ name: "Oleg Kononenko" }, { name: "Tracy Dyson" }] }),
    );

    render(<AstronautList />);
    await screen.findByText("Oleg Kononenko");

    fireEvent.click(screen.getByLabelText("Gast anzeigen"));

    const mitGast = screen.getAllByRole("listitem");
    expect(mitGast).toHaveLength(3);
    expect(mitGast.at(-1).textContent).toMatch(/Marcus\s*\(Gast\)/);
    expect(mitGast[0].textContent).toBe("Oleg Kononenko");

    fireEvent.click(screen.getByLabelText("Gast anzeigen"));

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(/Marcus/)).toBeNull();
  });

  it("zählt den Gast nicht zur Besatzung (Regressionstest)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ count: 2, people: [{ name: "Oleg Kononenko" }, { name: "Tracy Dyson" }] }),
    );

    render(<AstronautList />);
    await screen.findByText("2 Personen an Bord");

    fireEvent.click(screen.getByLabelText("Gast anzeigen"));

    expect(screen.getByText(/2 Personen an Bord/)).toBeTruthy();
    expect(screen.getByText(/1 Gast/)).toBeTruthy();
    expect(screen.queryByText(/3 Personen an Bord/)).toBeNull();
  });

  it("bleibt beim Aktualisieren eingeblendet", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ count: 1, people: [{ name: "Tracy Dyson" }] }));

    render(<AstronautList />);
    await screen.findByText("Tracy Dyson");

    fireEvent.click(screen.getByLabelText("Gast anzeigen"));
    fireEvent.click(screen.getByRole("button", { name: "Aktualisieren" }));

    expect(await screen.findByText("Tracy Dyson")).toBeTruthy();
    expect(screen.getAllByRole("listitem").at(-1).textContent).toMatch(/Marcus\s*\(Gast\)/);
  });

  it("unterscheidet den Gast von einer gleichnamigen Person aus der API", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(jsonResponse({ count: 1, people: [{ name: "Marcus" }] }));

    render(<AstronautList />);
    await screen.findByText("1 Personen an Bord");

    fireEvent.click(screen.getByLabelText("Gast anzeigen"));

    const eintraege = screen.getAllByRole("listitem");
    expect(eintraege).toHaveLength(2);
    expect(eintraege[0].textContent).toBe("Marcus");
    expect(eintraege[1].textContent).toMatch(/Marcus\s*\(Gast\)/);
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/same key|unique "key"/i);

    consoleError.mockRestore();
  });

  it("zeigt bei einem Fehler keine Liste mit nur dem Gast", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "kaputt" }, false, 502));

    render(<AstronautList />);
    await screen.findByText(/Fehler 502/);

    fireEvent.click(screen.getByLabelText("Gast anzeigen"));

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText(/Marcus/)).toBeNull();
    expect(screen.getByText(/Fehler 502/)).toBeTruthy();
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
