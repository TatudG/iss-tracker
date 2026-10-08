// Die beiden Alarmmittel - Ton und Browser-Benachrichtigung. Beide sind
// Seiteneffekte der Umgebung, deshalb werden sie hier über injizierte Objekte
// angesprochen und werfen nie: ein fehlendes oder verweigertes Notification
// darf die App nicht stören, der In-App-Hinweis bleibt als Rückfallebene.

import { formatDistanceKm } from "./userLocation";

const BEEP_DURATION_S = 0.18;
const BEEP_PAUSE_S = 0.12;
const BEEP_FREQUENCY_HZ = 880;
const BEEP_GAIN = 0.15;
const BEEP_COUNT = 3;

// Erzeugt den Ton direkt im Browser statt aus einer Audiodatei - das Projekt
// hat kein public/-Verzeichnis, in dem eine Datei liegen könnte.
export function playAlarmBeep(context, { frequency = BEEP_FREQUENCY_HZ, beeps = BEEP_COUNT } = {}) {
  if (!context || typeof context.createOscillator !== "function") return;

  try {
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    // Kurze Ein- und Ausblendung: harte Pegelsprünge würden knacken.
    for (let index = 0; index < beeps; index += 1) {
      const from = start + index * (BEEP_DURATION_S + BEEP_PAUSE_S);
      gain.gain.setValueAtTime(0, from);
      gain.gain.linearRampToValueAtTime(BEEP_GAIN, from + 0.02);
      gain.gain.setValueAtTime(BEEP_GAIN, from + BEEP_DURATION_S - 0.02);
      gain.gain.linearRampToValueAtTime(0, from + BEEP_DURATION_S);
    }

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + beeps * (BEEP_DURATION_S + BEEP_PAUSE_S));
  } catch {
    // Audio ist Beiwerk - wenn der Browser nicht mitspielt, bleibt es still.
  }
}

export function notificationSupport(NotificationCtor) {
  if (typeof NotificationCtor !== "function") return "unsupported";
  if (NotificationCtor.permission === "granted") return "granted";
  if (NotificationCtor.permission === "denied") return "denied";
  return "default";
}

export function showProximityNotification(NotificationCtor, { distanceKm, radiusKm } = {}) {
  if (notificationSupport(NotificationCtor) !== "granted") return false;

  try {
    // Fester Tag: eine neue Meldung ersetzt die alte, statt sich zu stapeln.
    new NotificationCtor("Die ISS ist in deiner Nähe", {
      body: `Aktuelle Entfernung: ${formatDistanceKm(distanceKm)} (Radius ${formatDistanceKm(radiusKm)}).`,
      tag: "iss-naehe",
    });
    return true;
  } catch {
    return false;
  }
}
