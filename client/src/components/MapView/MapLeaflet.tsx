import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { TrailsPolyline } from "./TrailsPolyline";
import { LandmarksMarkers } from "./LandmarksMarkers";
import type { RouteWaypoint, TrailSegment } from "../../data/route";

interface Props {
  segments: TrailSegment[];
  totalKm: number;
  waypoints: RouteWaypoint[];
}

// Australia bounds
const BOUNDS: [[number, number], [number, number]] = [
  [-44, 112],
  [-10, 154],
];

export function MapLeaflet({ segments, totalKm, waypoints }: Props) {
  return (
    <MapContainer
      bounds={BOUNDS}
      className="map-leaflet"
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <TrailsPolyline segments={segments} totalKm={totalKm} waypoints={waypoints} />
      <LandmarksMarkers totalKm={totalKm} />
    </MapContainer>
  );
}
