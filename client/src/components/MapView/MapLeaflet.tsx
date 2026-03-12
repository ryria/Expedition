import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { TrailsPolyline } from "./TrailsPolyline";
import { LandmarksMarkers } from "./LandmarksMarkers";
import type { Landmark, RouteWaypoint, TrailSegment } from "../../data/route";

interface Props {
  segments: TrailSegment[];
  totalKm: number;
  waypoints: RouteWaypoint[];
  landmarks: Landmark[];
  theme: "dark" | "light";
  hubOpen: boolean;
}

// Australia bounds
const BOUNDS: [[number, number], [number, number]] = [
  [-44, 112],
  [-10, 154],
];

export function MapLeaflet({ segments, totalKm, waypoints, landmarks, theme, hubOpen }: Props) {
  const tileUrl =
    theme === "light"
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      bounds={BOUNDS}
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
      <MapResizeSync hubOpen={hubOpen} />
      <TrailsPolyline segments={segments} totalKm={totalKm} waypoints={waypoints} />
      <LandmarksMarkers totalKm={totalKm} landmarks={landmarks} />
    </MapContainer>
  );
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
