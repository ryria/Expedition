import { useState } from "react";
import { MapLeaflet } from "./MapLeaflet";
import { ModeToggle } from "./ModeToggle";
import { PersonLegend } from "./PersonLegend";
import { useActivityLog } from "../../hooks/useActivityLog";
import { useMembers } from "../../hooks/useMembers";
import { getTrailSegments } from "../../data/route";
import { ROUTE_TOTAL_KM } from "../../config";
import "./MapView.css";

type ViewMode = "asRan" | "contribution";

export function MapView() {
  const { entries } = useActivityLog();
  const { members } = useMembers();
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
        <span>{((totalKm / ROUTE_TOTAL_KM) * 100).toFixed(1)}% complete</span>
        <span>{(ROUTE_TOTAL_KM - totalKm).toFixed(1)} km remaining</span>
      </div>
      <MapLeaflet segments={segments} totalKm={totalKm} />
      <div className="map-controls">
        <ModeToggle mode={mode} onChange={setMode} />
        <PersonLegend />
      </div>
    </div>
  );
}
