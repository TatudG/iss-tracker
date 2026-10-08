import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationSupport, playAlarmBeep, showProximityNotification } from "./alert";

// Doppel eines AudioContext: es wird nur geprüft, dass der Ton aufgebaut und
// wieder abgeräumt wird - echten Klang kann ein Test nicht hören.
function audioContextDouble() {
  const oscillator = {
    type: "",
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };

  return {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    oscillator,
    gain,
  };
}

function notificationDouble(permission) {
  function Notification(title, options) {
    Notification.calls.push({ title, options });
  }
  Notification.calls = [];
  Notification.permission = permission;
  return Notification;
}

describe("playAlarmBeep", () => {
  let context;

  beforeEach(() => {
    context = audioContextDouble();
  });

  it("baut einen Ton auf und räumt ihn wieder ab", () => {
    playAlarmBeep(context);

    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    expect(context.createGain).toHaveBeenCalledTimes(1);
    expect(context.oscillator.start).toHaveBeenCalledTimes(1);
    expect(context.oscillator.stop).toHaveBeenCalledTimes(1);
  });

  it("blendet den Pegel weich ein und aus, statt hart zu schalten", () => {
    playAlarmBeep(context);

    expect(context.gain.gain.linearRampToValueAtTime).toHaveBeenCalled();
    expect(context.gain.gain.setValueAtTime).toHaveBeenCalled();
  });

  it("schweigt ohne AudioContext, statt zu werfen", () => {
    expect(() => playAlarmBeep(null)).not.toThrow();
    expect(() => playAlarmBeep(undefined)).not.toThrow();
    expect(() => playAlarmBeep({})).not.toThrow();
  });

  it("bleibt still, wenn der Browser die Tonerzeugung verweigert", () => {
    const broken = {
      createOscillator() {
        throw new Error("AudioContext ist gesperrt");
      },
    };

    expect(() => playAlarmBeep(broken)).not.toThrow();
  });
});

describe("notificationSupport", () => {
  it("erkennt fehlende Unterstützung", () => {
    expect(notificationSupport(undefined)).toBe("unsupported");
    expect(notificationSupport(null)).toBe("unsupported");
    expect(notificationSupport({})).toBe("unsupported");
  });

  it("liest den Berechtigungszustand aus", () => {
    expect(notificationSupport(notificationDouble("granted"))).toBe("granted");
    expect(notificationSupport(notificationDouble("denied"))).toBe("denied");
    expect(notificationSupport(notificationDouble("default"))).toBe("default");
  });
});

describe("showProximityNotification", () => {
  it("erzeugt bei erteilter Berechtigung genau eine Benachrichtigung", () => {
    const Notification = notificationDouble("granted");

    expect(showProximityNotification(Notification, { distanceKm: 42, radiusKm: 100 })).toBe(true);
    expect(Notification.calls).toHaveLength(1);
    expect(Notification.calls[0].title).toContain("ISS");
    expect(Notification.calls[0].options.body).toContain("42 km");
    expect(Notification.calls[0].options.tag).toBe("iss-naehe");
  });

  it("meldet keinen Erfolg, wenn die Berechtigung fehlt oder verweigert ist", () => {
    const denied = notificationDouble("denied");
    const pending = notificationDouble("default");

    expect(showProximityNotification(denied, { distanceKm: 42, radiusKm: 100 })).toBe(false);
    expect(showProximityNotification(pending, { distanceKm: 42, radiusKm: 100 })).toBe(false);
    expect(denied.calls).toHaveLength(0);
    expect(pending.calls).toHaveLength(0);
  });

  it("wirft ohne Notification-Konstruktor nicht", () => {
    expect(() => showProximityNotification(undefined, { distanceKm: 42 })).not.toThrow();
    expect(showProximityNotification(undefined, { distanceKm: 42 })).toBe(false);
  });

  it("verträgt einen Konstruktor, der beim Erzeugen scheitert", () => {
    const throwing = function ThrowingNotification() {
      throw new Error("nicht erlaubt");
    };
    throwing.permission = "granted";

    expect(() => showProximityNotification(throwing, { distanceKm: 42 })).not.toThrow();
    expect(showProximityNotification(throwing, { distanceKm: 42 })).toBe(false);
  });
});
