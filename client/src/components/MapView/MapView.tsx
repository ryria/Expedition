import { useMemo } from "react";
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
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  hubOpen: boolean;
  activeExpeditionId: bigint;
}

export function completionPercent(totalKm: number, routeTotalKm: number): number {
  if (!Number.isFinite(routeTotalKm) || routeTotalKm <= 0) return 0;
  const raw = (totalKm / routeTotalKm) * 100;
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(raw, 100);
}

export function MapView({ theme, mode, onModeChange, hubOpen, activeExpeditionId }: MapViewProps) {
  const { entries } = useActivityLog(activeExpeditionId);
  const { members } = useMembers(activeExpeditionId);
  const { waypoints, routeTotalKm } = useRoadRoute();

  const totalKm = useMemo(() => entries.reduce((s, e) => s + e.distanceKm, 0), [entries]);
  const percentComplete = completionPercent(totalKm, routeTotalKm);
  const orderedForTrail = useMemo(
    () => [...entries].sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime()),
    [entries],
  );
  const segments = useMemo(() => getTrailSegments(orderedForTrail, members, mode), [orderedForTrail, members, mode]);

  return (
    <div className="map-view">
      <div className="map-stats-bar">
        <span>{totalKm.toFixed(1)} km logged</span>
        <span>{percentComplete.toFixed(1)}% complete</span>
        <span>{Math.max(routeTotalKm - totalKm, 0).toFixed(1)} km remaining</span>
      </div>
      <MapLeaflet
        segments={segments}
        totalKm={totalKm}
        waypoints={waypoints}
        theme={theme}
        hubOpen={hubOpen}
      />
      <div className="map-controls">
        <ModeToggle mode={mode} onChange={onModeChange} />
        <PersonLegend activeExpeditionId={activeExpeditionId} />
      </div>
    </div>
  );
}
