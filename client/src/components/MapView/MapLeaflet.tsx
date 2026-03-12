import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { TrailsPolyline } from "./TrailsPolyline";
import { LandmarksMarkers } from "./LandmarksMarkers";
import type { Landmark, RouteWaypoint, TrailSegment } from "../../data/route";
import type { DistanceUnit } from "../../config";

interface Props {
  segments: TrailSegment[];
  totalKm: number;
  waypoints: RouteWaypoint[];
  landmarks: Landmark[];
  distanceUnit: DistanceUnit;
  theme: "dark" | "light";
  hubOpen: boolean;
}

function computeBounds(waypoints: RouteWaypoint[]): [[number, number], [number, number]] {
  if (waypoints.length === 0) {
    return [[-60, -180], [75, 180]];
  }

  let minLat = waypoints[0][0];
  let maxLat = waypoints[0][0];
  let minLng = waypoints[0][1];
  let maxLng = waypoints[0][1];

  for (const [lat, lng] of waypoints) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  const latPad = Math.max((maxLat - minLat) * 0.08, 0.3);
  const lngPad = Math.max((maxLng - minLng) * 0.08, 0.3);

  return [
    [minLat - latPad, minLng - lngPad],
    [maxLat + latPad, maxLng + lngPad],
  ];
}

export function MapLeaflet({ segments, totalKm, waypoints, landmarks, distanceUnit, theme, hubOpen }: Props) {
  const bounds = computeBounds(waypoints);
  const tileUrl =
    theme === "light"
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      bounds={bounds}
      className="map-leaflet"
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <TileLayer
        url={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <MapRouteFocus bounds={bounds} />
      <MapResizeSync hubOpen={hubOpen} />
      <TrailsPolyline segments={segments} totalKm={totalKm} waypoints={waypoints} distanceUnit={distanceUnit} />
      <LandmarksMarkers totalKm={totalKm} landmarks={landmarks} />
    </MapContainer>
  );
}

function MapRouteFocus({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, {
      padding: [24, 24],
      animate: false,
    });
  }, [map, bounds]);

  return null;
}

function MapResizeSync({ hubOpen }: { hubOpen: boolean }) {
  const map = useMap();

  useEffect(() => {
    const resize = () => map.invalidateSize(false);
    resize();
    const timer = setTimeout(resize, 220);
    return () => clearTimeout(timer);
  }, [map, hubOpen]);

  return null;
}
