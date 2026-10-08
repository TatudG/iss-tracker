"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AstronautList from "./AstronautList";
import IssMap from "./IssMap";
import { notificationSupport, playAlarmBeep, showProximityNotification } from "../lib/alert";
import { parseGeocodeResults } from "../lib/geocode";
import { evaluateProximity } from "../lib/geo";
import { appendTrackPoint } from "../lib/track";
import {
  DEFAULT_RADIUS_KM,
  RADIUS_OPTIONS,
  formatDistanceKm,
  formatUserLocation,
  isRadiusOption,
  normalizeUserLocation,
  radiusLabel,
} from "../lib/userLocation";
import { formatVisibility } from "../lib/visibility";

const API_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const REFRESH_MS = 5000;
// Etwas länger als das Intervall, damit eine hängende Anfrage das Polling
// nicht dauerhaft blockiert.
const REQUEST_TIMEOUT_MS = 12000;
const GEOCODE_MIN_LENGTH = 3;
// Eigener Schlüssel mit Versionsnummer, damit ein späteres Format die alten
// Daten nicht falsch deutet.
const STORAGE_KEY = "iss-tracker:standort:v1";

const decimal = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const whole = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

function formatCoordinate(value, positive, negative) {
  if (!Number.isFinite(value)) return "–";
  const direction = value >= 0 ? positive : negative;
  return `${decimal.format(Math.abs(value))}° ${direction}`;
}

function formatAltitude(km) {
  return Number.isFinite(km) ? `${decimal.format(km)} km` : "–";
}

function formatVelocity(kmh) {
  return Number.isFinite(kmh) ? `${whole.format(kmh)} km/h` : "–";
}

function formatTime(timestampSeconds) {
  if (!Number.isFinite(timestampSeconds)) return "–";
  return new Date(timestampSeconds * 1000).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Übersetzt technische Fehler in einen Satz, der ohne Vorwissen verständlich ist.
function describeError(error) {
  if (error instanceof TypeError) {
    return "Die ISS-Daten konnten nicht geladen werden. Möglicherweise besteht keine Internetverbindung oder die API api.wheretheiss.at ist gerade nicht erreichbar.";
  }
  return error?.message || "Unbekannter Fehler beim Laden der ISS-Daten.";
}

export default function IssTracker() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [track, setTrack] = useState([]);
  const [follow, setFollow] = useState(true);
  const [showTrack, setShowTrack] = useState(true);

  const [userLocation, setUserLocation] = useState(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [picking, setPicking] = useState(false);
  const [address, setAddress] = useState("");
  const [geocodeStatus, setGeocodeStatus] = useState("idle");
  const [geocodeError, setGeocodeError] = useState(null);
  const [geocodeResults, setGeocodeResults] = useState([]);
  const [distanceKm, setDistanceKm] = useState(null);
  const [alarm, setAlarm] = useState(null);
  const [notifyPermission, setNotifyPermission] = useState("unsupported");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  // Erst nach dem Wiederherstellen darf gespeichert werden, sonst würden die
  // Standardwerte die gespeicherten überschreiben.
  const [storageReady, setStorageReady] = useState(false);

  const requestRef = useRef(null);
  // Ob die ISS beim letzten Poll innerhalb des Radius war. Nur der Übergang
  // von außen nach innen löst einen Alarm aus.
  const insideRadiusRef = useRef(false);
  const audioContextRef = useRef(null);
  // Spiegel der Werte, die die Polling-Schleife braucht: sie läuft in einem
  // Effekt mit leerer Abhängigkeitsliste und sähe sonst nur den Startzustand.
  const userLocationRef = useRef(userLocation);
  const radiusKmRef = useRef(radiusKm);
  const soundEnabledRef = useRef(soundEnabled);
  const notifyEnabledRef = useRef(notifyEnabled);
  const notifyPermissionRef = useRef(notifyPermission);
  const pickingRef = useRef(picking);

  userLocationRef.current = userLocation;
  radiusKmRef.current = radiusKm;
  soundEnabledRef.current = soundEnabled;
  notifyEnabledRef.current = notifyEnabled;
  notifyPermissionRef.current = notifyPermission;
  pickingRef.current = picking;

  // Ton und Benachrichtigung dürfen erst nach einer Nutzergeste starten. Der
  // AudioContext wird deshalb hier angelegt und nicht beim Laden der Seite.
  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (typeof AudioContextCtor !== "function") return;

    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
      audioContextRef.current?.resume?.();
    } catch {
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;

    function triggerAlarm(km) {
      setAlarm({ distanceKm: km });

      if (soundEnabledRef.current) playAlarmBeep(audioContextRef.current);

      if (notifyEnabledRef.current && notifyPermissionRef.current === "granted") {
        showProximityNotification(typeof Notification === "function" ? Notification : undefined, {
          distanceKm: km,
          radiusKm: radiusKmRef.current,
        });
      }
    }

    async function load() {
      // Überlappende Anfragen vermeiden, falls eine Antwort länger als 5 s braucht.
      if (inFlight || stopped) return;
      inFlight = true;

      const controller = new AbortController();
      requestRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(API_URL, {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(
            `Die API antwortete mit dem Fehler ${response.status} (${response.statusText}).`,
          );
        }

        const data = await response.json();
        const latitude = Number(data?.latitude);
        const longitude = Number(data?.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          throw new Error("Die API hat eine unerwartete Antwort geliefert (keine gültige Position).");
        }

        if (stopped) return;

        setPosition({
          latitude,
          longitude,
          altitude: Number(data.altitude),
          velocity: Number(data.velocity),
          visibility: data.visibility,
          timestamp: Number(data.timestamp),
        });
        // Nur erfolgreiche Abrufe erweitern die Flugspur.
        setTrack((previous) => appendTrackPoint(previous, { latitude, longitude }));

        // Die Entscheidung über den Alarm liegt vollständig in dieser reinen
        // Funktion - hier werden nur noch die Seiteneffekte ausgelöst.
        const proximity = evaluateProximity(
          insideRadiusRef.current,
          { latitude, longitude },
          userLocationRef.current,
          radiusKmRef.current,
        );
        insideRadiusRef.current = proximity.inside;
        setDistanceKm(proximity.distanceKm);
        if (proximity.entered) triggerAlarm(proximity.distanceKm);

        // Ein erfolgreicher Abruf räumt die Fehlermeldung wieder weg.
        setError(null);
      } catch (caught) {
        // Beim Verlassen der Seite wird die Anfrage bewusst abgebrochen: kein Fehler.
        if (stopped) return;
        setError(
          caught?.name === "AbortError"
            ? "Die API hat nicht rechtzeitig geantwortet (Zeitüberschreitung)."
            : describeError(caught),
        );
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        requestRef.current = null;
      }
    }

    load();
    // Nach einem Fehler läuft das Polling weiter, bis die API wieder antwortet.
    const timer = setInterval(load, REFRESH_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
      requestRef.current?.abort();
    };
  }, []);

  // Berechtigung erst beim Betreten der Seite ablesen: auf dem Server gibt es
  // kein `Notification`, das würde sonst zu einer Abweichung beim Hydrieren führen.
  useEffect(() => {
    const NotificationCtor = typeof Notification === "function" ? Notification : undefined;
    setNotifyPermission(notificationSupport(NotificationCtor));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        const storedLocation = normalizeUserLocation(stored);
        if (storedLocation) setUserLocation(storedLocation);
        if (isRadiusOption(stored?.radiusKm)) setRadiusKm(stored.radiusKm);
      }
    } catch {
      // Privater Modus oder kaputter Eintrag: dann eben mit Standardwerten.
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...userLocation, radiusKm }));
    } catch {
      // Speichern ist Komfort, kein Muss - ein Fehler darf nichts kaputt machen.
    }
  }, [storageReady, userLocation, radiusKm]);

  // Ein neuer Standort ist ein neues Ziel: die ISS muss erst wieder von außen
  // hereinkommen, damit eine alte Annäherung nicht sofort Alarm auslöst.
  const applyLocation = useCallback(
    (candidate) => {
      const normalized = normalizeUserLocation(candidate);
      if (!normalized) return;

      insideRadiusRef.current = false;
      setUserLocation(normalized);
      setDistanceKm(null);
      setAlarm(null);
      // Der Klick bzw. das Absenden der Adresse ist eine Nutzergeste - hier
      // darf der Ton entsperrt werden.
      unlockAudio();
    },
    [unlockAudio],
  );

  // Wird ausgelöst, wenn der Nutzer die Karte selbst verschiebt: eigene
  // Absicht hat Vorrang, der Follow-Modus schaltet sich ab.
  const handleUserDrag = useCallback(() => setFollow(false), []);

  // Der Standort wird nur im ausdrücklich aktivierten Modus gesetzt, damit ein
  // versehentlicher Klick beim Bedienen der Karte nichts verstellt.
  const handleMapClick = useCallback(
    (latlng) => {
      if (!pickingRef.current) return;

      setPicking(false);
      applyLocation({ latitude: latlng?.lat, longitude: latlng?.lng });
    },
    [applyLocation],
  );

  async function handleAddressSubmit(event) {
    event.preventDefault();
    const query = address.trim();

    if (query.length < GEOCODE_MIN_LENGTH) {
      setGeocodeStatus("error");
      setGeocodeError(`Bitte gib eine Adresse mit mindestens ${GEOCODE_MIN_LENGTH} Zeichen an.`);
      return;
    }

    setGeocodeStatus("loading");
    setGeocodeError(null);
    setGeocodeResults([]);

    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          `Die Adresssuche antwortete mit dem Fehler ${response.status} (${response.statusText}).`,
        );
      }

      const results = parseGeocodeResults(await response.json());

      if (results.length === 0) {
        setGeocodeStatus("error");
        setGeocodeError("Zu dieser Adresse wurde nichts gefunden.");
        return;
      }

      setGeocodeStatus("idle");

      // Nur bei mehreren Treffern muss der Nutzer auswählen.
      if (results.length === 1) {
        applyLocation(results[0]);
        setAddress("");
        return;
      }

      setGeocodeResults(results);
    } catch (caught) {
      setGeocodeStatus("error");
      setGeocodeError(caught?.message || "Die Adresssuche ist derzeit nicht verfügbar.");
    }
  }

  function handleChooseResult(result) {
    applyLocation(result);
    setGeocodeResults([]);
    setAddress("");
  }

  function handleRadiusChange(event) {
    const next = Number(event.target.value);
    if (!isRadiusOption(next)) return;

    // Der Radius bestimmt, was "nahe" heißt: der bisherige Zustand gilt nicht
    // mehr, aber ein Wechsel soll keinen Ton auslösen.
    insideRadiusRef.current = false;
    setRadiusKm(next);
    setAlarm(null);
  }

  async function handleEnableNotifications() {
    unlockAudio();

    if (typeof Notification !== "function") {
      setNotifyPermission("unsupported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotifyPermission(
        permission === "granted" ? "granted" : permission === "denied" ? "denied" : "default",
      );
    } catch {
      setNotifyPermission("default");
    }
  }

  const rows = [
    { label: "Breitengrad", value: position ? formatCoordinate(position.latitude, "N", "S") : "–" },
    { label: "Längengrad", value: position ? formatCoordinate(position.longitude, "O", "W") : "–" },
    { label: "Höhe", value: position ? formatAltitude(position.altitude) : "–" },
    { label: "Geschwindigkeit", value: position ? formatVelocity(position.velocity) : "–" },
    { label: "Sichtbarkeit", value: position ? formatVisibility(position.visibility) : "–" },
    { label: "Stand der Messung", value: position ? `${formatTime(position.timestamp)} Uhr` : "–" },
  ];

  if (userLocation) {
    rows.push({ label: "Entfernung zur ISS", value: formatDistanceKm(distanceKm), testId: "distance" });
  }

  return (
    <section className="tracker">
      <div className="tracker__map">
        <IssMap
          position={position}
          track={track}
          follow={follow}
          showTrack={showTrack}
          onUserDrag={handleUserDrag}
          userLocation={userLocation}
          radiusKm={radiusKm}
          onMapClick={handleMapClick}
          picking={picking}
        />
        {position ? (
          <p className="badge">
            <span className="badge__dot" aria-hidden="true" />
            Live · Aktualisierung alle 5 s
          </p>
        ) : null}
      </div>

      <aside className="panel">
        {alarm ? (
          <div className="alert alert--alarm" role="alert">
            <strong>Die ISS ist in deiner Nähe!</strong>
            <p>
              Aktuelle Entfernung: {formatDistanceKm(alarm.distanceKm)} (Radius{" "}
              {radiusLabel(radiusKm)}).
            </p>
            <button type="button" className="alert__dismiss" onClick={() => setAlarm(null)}>
              Schließen
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="alert" role="alert">
            <strong>Keine aktuellen ISS-Daten</strong>
            <p>{error}</p>
            <p className="alert__hint">
              Die App versucht es automatisch weiter und zeigt wieder Werte an, sobald die API
              antwortet.
              {position ? " Angezeigt wird bis dahin die zuletzt empfangene Position." : ""}
            </p>
          </div>
        ) : null}

        {!position && !error ? (
          <p className="panel__hint">Warte auf die erste Positionsmeldung …</p>
        ) : null}

        <dl className="facts">
          {rows.map((row) => (
            <div className="facts__row" key={row.label}>
              <dt>{row.label}</dt>
              <dd data-testid={row.testId}>{row.value}</dd>
            </div>
          ))}
        </dl>

        <fieldset className="switches">
          <legend className="switches__legend">Kartenoptionen</legend>

          <label className="switch">
            <input
              type="checkbox"
              checked={follow}
              onChange={(event) => setFollow(event.target.checked)}
            />
            <span>Karte folgt ISS</span>
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={showTrack}
              onChange={(event) => setShowTrack(event.target.checked)}
            />
            <span>Flugspur anzeigen</span>
          </label>

          <p className="switches__hint">
            Verschiebst du die Karte selbst, schaltet sich das Folgen automatisch ab.
          </p>
        </fieldset>

        <section className="standort" aria-labelledby="standort-heading">
          <h2 id="standort-heading">Mein Standort</h2>

          <form className="standort__form" onSubmit={handleAddressSubmit}>
            <label className="standort__label" htmlFor="standort-adresse">
              Adresse
            </label>
            <div className="standort__row">
              <input
                id="standort-adresse"
                type="text"
                value={address}
                placeholder="z. B. Berlin"
                autoComplete="off"
                onChange={(event) => setAddress(event.target.value)}
              />
              <button type="submit" className="standort__submit" disabled={geocodeStatus === "loading"}>
                {geocodeStatus === "loading" ? "Sucht …" : "Suchen"}
              </button>
            </div>
          </form>

          <div className="standort__row">
            <button
              type="button"
              className="standort__pick"
              aria-pressed={picking}
              onClick={() => {
                unlockAudio();
                setPicking((previous) => !previous);
              }}
            >
              {picking ? "Auswahl abbrechen" : "Standort auf Karte wählen"}
            </button>
          </div>

          {picking ? (
            <p className="standort__hint standort__hint--active">
              Klicke jetzt auf die Karte, um deinen Standort zu setzen.
            </p>
          ) : (
            <p className="standort__hint">
              Suche eine Adresse oder setze deinen Standort per Klick auf der Karte.
            </p>
          )}

          {geocodeError ? (
            <p className="standort__error" role="status">
              {geocodeError}
            </p>
          ) : null}

          {geocodeResults.length > 0 ? (
            <ul className="standort__results">
              {geocodeResults.map((result) => (
                <li key={`${result.label}-${result.latitude}-${result.longitude}`}>
                  <button type="button" className="standort__result" onClick={() => handleChooseResult(result)}>
                    {result.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="standort__current">
            Gesetzter Standort: <strong>{formatUserLocation(userLocation)}</strong>
          </p>

          <label className="standort__select">
            <span>Alarm-Radius</span>
            <select value={radiusKm} onChange={handleRadiusChange}>
              {RADIUS_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  {radiusLabel(km)}
                </option>
              ))}
            </select>
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(event) => setSoundEnabled(event.target.checked)}
            />
            <span>Alarmton</span>
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={notifyEnabled}
              onChange={(event) => setNotifyEnabled(event.target.checked)}
            />
            <span>Browser-Benachrichtigung</span>
          </label>

          {notifyPermission === "default" ? (
            <button type="button" className="standort__notify" onClick={handleEnableNotifications}>
              Benachrichtigung aktivieren
            </button>
          ) : null}

          {notifyPermission === "denied" ? (
            <p className="switches__hint">
              Benachrichtigungen sind im Browser blockiert – der Alarm erscheint nur in der App.
            </p>
          ) : null}
        </section>

        <AstronautList />

        <p className="panel__source">
          Datenquelle: <a href="https://wheretheiss.at">wheretheiss.at</a> (Satellit 25544) ·
          Besatzung: <a href="https://open-notify.org">Open Notify</a> · Ortssuche:{" "}
          <a href="https://nominatim.openstreetmap.org">Nominatim</a> · Karten: OpenStreetMap
        </p>
      </aside>
    </section>
  );
}
