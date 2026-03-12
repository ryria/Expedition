import { useMemo } from "react";
import { MapLeaflet } from "./MapLeaflet";
import { ModeToggle } from "./ModeToggle";
import { PersonLegend } from "./PersonLegend";
import { useActivityLog } from "../../hooks/useActivityLog";
import { useMembers } from "../../hooks/useMembers";
import { getTrailSegments } from "../../data/route";
import { useRoadRoute } from "../../hooks/useRoadRoute";
import { useExpeditionRouteTemplate } from "../../hooks/useExpeditionRouteTemplate";
import { distanceUnitLabel, formatDistance, type DistanceUnit } from "../../config";
import "./MapView.css";

type ViewMode = "asRan" | "contribution";
type Theme = "dark" | "light";

interface MapViewProps {
  theme: Theme;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  hubOpen: boolean;
  activeExpeditionId: bigint;
  distanceUnit: DistanceUnit;
}

export function completionPercent(totalKm: number, routeTotalKm: number): number {
  if (!Number.isFinite(routeTotalKm) || routeTotalKm <= 0) return 0;
  const raw = (totalKm / routeTotalKm) * 100;
  if (!Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(raw, 100);
}

export function MapView({ theme, mode, onModeChange, hubOpen, activeExpeditionId, distanceUnit }: MapViewProps) {
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
  const unit = distanceUnitLabel(distanceUnit);

  return (
    <div className="map-view">
      <div className="map-stats-bar">
        <span>{formatDistance(totalKm, distanceUnit)} {unit} logged</span>
        <span>{completionLabel}</span>
        <span>{formatDistance(Math.max(routeTotalKm - totalKm, 0), distanceUnit)} {unit} remaining</span>
      </div>
      <div className="map-overlay-chips">
        <div className="map-overlay-chip progress">
          <strong>{formatDistance(totalKm, distanceUnit)} / {formatDistance(routeTotalKm, distanceUnit, 0)} {unit}</strong>
          <span>{completionLabel}</span>
        </div>
        <div className="map-overlay-chip milestone">
          <strong>Next: {nextLandmark.name}</strong>
          <span>{formatDistance(Math.max(nextLandmark.km - totalKm, 0), distanceUnit)} {unit} away</span>
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
        distanceUnit={distanceUnit}
        theme={theme}
        hubOpen={hubOpen}
      />
      <div className="map-controls">
        <ModeToggle mode={mode} onChange={onModeChange} />
        <PersonLegend activeExpeditionId={activeExpeditionId} distanceUnit={distanceUnit} />
      </div>
    </div>
  );
}
