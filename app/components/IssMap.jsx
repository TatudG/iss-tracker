"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { buildIssIconHtml } from "../lib/markerIcon";
import { isValidPosition, shouldRecenter } from "../lib/position";
import { splitAtAntimeridian } from "../lib/track";
import { visibilityState } from "../lib/visibility";

// Leaflet greift beim Import auf `window` zu und darf deshalb nicht auf dem
// Server geladen werden. Der Import passiert darum erst in useEffect.

const START_CENTER = [20, 0];
const START_ZOOM = 2;
const FOCUS_ZOOM = 4;
// Kurze Animation, damit die Karte beim Folgen ruhig wirkt und sich
// aufeinanderfolgende Zentrierungen nicht stapeln.
const FOLLOW_DURATION_S = 0.6;

const TRACK_STYLE = { color: "#1d4ed8", weight: 2, opacity: 0.7 };

function createIssIcon(L, visibility) {
  // Eigene Marker-Grafik als divIcon: umgeht die bekannte Icon-Pfad-Problematik
  // von Leaflet mit Bundlern (fehlende marker-icon.png). Das Badge zeigt
  // gleichzeitig den Tag/Nacht-Zustand der Station.
  return L.divIcon({
    className: "iss-icon",
    html: buildIssIconHtml(visibility),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function applyPosition(map, marker, position, focusedRef, followRef) {
  if (!isValidPosition(position)) return;

  const latlng = [position.latitude, position.longitude];
  marker.setLatLng(latlng);

  // Nur beim ersten Fix auf die ISS zoomen. Danach bleibt die Zoomstufe in der
  // Hand des Nutzers.
  if (!focusedRef.current) {
    map.setView(latlng, FOCUS_ZOOM);
    focusedRef.current = true;
    return;
  }

  if (shouldRecenter(followRef.current, position)) {
    map.panTo(latlng, { animate: true, duration: FOLLOW_DURATION_S });
  }
}

// Das Icon wird nur neu gesetzt, wenn sich der Zustand wirklich ändert -
// sonst würde bei jedem Poll (alle 5 s) die Pulse-Animation neu starten.
function applyVisibility(L, marker, iconStateRef, visibility) {
  const state = visibilityState(visibility);
  if (iconStateRef.current === state) return;

  iconStateRef.current = state;
  marker.setIcon(createIssIcon(L, visibility));
}

function applyTrack(L, group, track, showTrack) {
  group.clearLayers();
  if (!showTrack) return;

  for (const segment of splitAtAntimeridian(track)) {
    if (segment.length < 2) continue;
    L.polyline(
      segment.map((point) => [point.latitude, point.longitude]),
      TRACK_STYLE,
    ).addTo(group);
  }
}

export default function IssMap({ position, track = [], follow = true, showTrack = true, onUserDrag }) {
  const containerRef = useRef(null);
  const leafletRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const trackGroupRef = useRef(null);
  const focusedRef = useRef(false);
  const iconStateRef = useRef("unknown");
  const followRef = useRef(follow);
  const showTrackRef = useRef(showTrack);
  const positionRef = useRef(position);
  const trackRef = useRef(track);
  const onUserDragRef = useRef(onUserDrag);

  // Neueste Werte vorhalten, damit die Karte sie direkt nach dem
  // (asynchronen) Aufbau anwenden kann.
  positionRef.current = position;
  trackRef.current = track;
  followRef.current = follow;
  showTrackRef.current = showTrack;
  onUserDragRef.current = onUserDrag;

  useEffect(() => {
    let disposed = false;
    let handleDragStart = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: START_CENTER,
        zoom: START_ZOOM,
        worldCopyJump: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende',
      }).addTo(map);

      const marker = L.marker(START_CENTER, {
        icon: createIssIcon(L, positionRef.current?.visibility),
        keyboard: false,
        title: "ISS",
      }).addTo(map);

      const trackGroup = L.layerGroup().addTo(map);

      // Verschiebt der Nutzer die Karte selbst, hat das Vorrang vor dem
      // Follow-Modus. panTo/setView lösen kein dragstart aus, deshalb kann
      // hier direkt auf die Nutzerabsicht geschlossen werden.
      handleDragStart = () => onUserDragRef.current?.();
      map.on("dragstart", handleDragStart);

      leafletRef.current = L;
      mapRef.current = map;
      markerRef.current = marker;
      trackGroupRef.current = trackGroup;
      iconStateRef.current = visibilityState(positionRef.current?.visibility);

      // Falls die erste Antwort schon vor dem Kartenaufbau eingetroffen ist.
      applyPosition(map, marker, positionRef.current, focusedRef, followRef);
      applyTrack(L, trackGroup, trackRef.current, showTrackRef.current);

      // Der Container kann beim Aufbau noch keine Höhe gehabt haben.
      map.invalidateSize();
    })();

    return () => {
      disposed = true;
      if (mapRef.current) {
        if (handleDragStart) mapRef.current.off("dragstart", handleDragStart);
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        trackGroupRef.current = null;
      }
      leafletRef.current = null;
      focusedRef.current = false;
      iconStateRef.current = "unknown";
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    applyPosition(mapRef.current, markerRef.current, position, focusedRef, followRef);

    const L = leafletRef.current;
    if (L) applyVisibility(L, markerRef.current, iconStateRef, position?.visibility);
  }, [position]);

  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !trackGroupRef.current) return;
    applyTrack(L, trackGroupRef.current, track, showTrack);
  }, [track, showTrack]);

  return <div className="map" ref={containerRef} aria-label="Weltkarte mit der ISS-Position" />;
}
