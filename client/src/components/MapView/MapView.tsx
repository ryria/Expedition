import { useState } from "react";
import { MapLeaflet } from "./MapLeaflet";
import { ModeToggle } from "./ModeToggle";
import { PersonLegend } from "./PersonLegend";
import { useActivityLog } from "../../hooks/useActivityLog";
import { useMembers } from "../../hooks/useMembers";
import { getTrailSegments } from "../../data/route";
import { useRoadRoute } from "../../hooks/useRoadRoute";
import "./MapView.css";

type ViewMode = "asRan" | "contribution";
type Theme = "dark" | "light";

interface MapViewProps {
  theme: Theme;
}

export function MapView({ theme }: MapViewProps) {
  const { entries } = useActivityLog();
  const { members } = useMembers();
  const { waypoints, routeTotalKm } = useRoadRoute();
  const [mode, setMode] = useState<ViewMode>("asRan");

  const totalKm = entries.reduce((s, e) => s + e.distanceKm, 0);
  const orderedForTrail = [...entries].sort(
    (a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime()
  );
  const segments = getTrailSegments(orderedForTrail, members, mode);

  return (
    <div className="map-view">
      <div className="map-stats-bar">
        <span>{totalKm.toFixed(1)} km logged</span>
        <span>{((totalKm / routeTotalKm) * 100).toFixed(1)}% complete</span>
        <span>{Math.max(routeTotalKm - totalKm, 0).toFixed(1)} km remaining</span>
      </div>
      <MapLeaflet segments={segments} totalKm={totalKm} waypoints={waypoints} theme={theme} />
      <div className="map-controls">
        <ModeToggle mode={mode} onChange={setMode} />
        <PersonLegend />
      </div>
    </div>
  );
}
