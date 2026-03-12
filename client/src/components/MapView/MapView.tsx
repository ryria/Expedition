import { useMemo } from "react";
import { MapLeaflet } from "./MapLeaflet";
import { ModeToggle } from "./ModeToggle";
import { PersonLegend } from "./PersonLegend";
import { useActivityLog } from "../../hooks/useActivityLog";
import { useMembers } from "../../hooks/useMembers";
import { getTrailSegments } from "../../data/route";
import { useRoadRoute } from "../../hooks/useRoadRoute";
import { useExpeditionRouteTemplate } from "../../hooks/useExpeditionRouteTemplate";
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
  const routeTemplate = useExpeditionRouteTemplate(activeExpeditionId);
  const { waypoints, routeTotalKm } = useRoadRoute(routeTemplate.waypoints, routeTemplate.key);

  const totalKm = useMemo(() => entries.reduce((s, e) => s + e.distanceKm, 0), [entries]);
  const percentComplete = completionPercent(totalKm, routeTotalKm);
  const orderedForTrail = useMemo(
    () => [...entries].sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime()),
    [entries],
  );
  const segments = useMemo(() => getTrailSegments(orderedForTrail, members, mode), [orderedForTrail, members, mode]);
  const nextLandmark = useMemo(
    () => routeTemplate.landmarks.find((landmark) => landmark.km > totalKm) ?? routeTemplate.landmarks[routeTemplate.landmarks.length - 1],
    [routeTemplate.landmarks, totalKm],
  );
  const completionLabel =
    percentComplete > 0 && percentComplete < 0.1 ? "<0.1% complete" : `${percentComplete.toFixed(1)}% complete`;

  return (
    <div className="map-view">
      <div className="map-stats-bar">
        <span>{totalKm.toFixed(1)} km logged</span>
        <span>{completionLabel}</span>
        <span>{Math.max(routeTotalKm - totalKm, 0).toFixed(1)} km remaining</span>
      </div>
      <div className="map-overlay-chips">
        <div className="map-overlay-chip progress">
          <strong>{totalKm.toFixed(1)} / {routeTotalKm.toFixed(0)} km</strong>
          <span>{completionLabel}</span>
        </div>
        <div className="map-overlay-chip milestone">
          <strong>Next: {nextLandmark.name}</strong>
          <span>{Math.max(nextLandmark.km - totalKm, 0).toFixed(1)} km away</span>
        </div>
        <div className="map-overlay-chip activity">
          <strong>{entries.length} total activities</strong>
          <span>{members.length} contributors</span>
        </div>
      </div>
      <MapLeaflet
        segments={segments}
        totalKm={totalKm}
        waypoints={waypoints}
        landmarks={routeTemplate.landmarks}
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
