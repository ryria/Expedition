import { useActivityLog } from "../../hooks/useActivityLog";
import { useExpeditionRouteTemplate } from "../../hooks/useExpeditionRouteTemplate";
import { useRoadRoute } from "../../hooks/useRoadRoute";
import { distanceUnitLabel, formatDistance, type DistanceUnit } from "../../config";

interface SummaryStatsProps {
  activeExpeditionId?: bigint;
  distanceUnit?: DistanceUnit;
}

export function SummaryStats({ activeExpeditionId, distanceUnit = "km" }: SummaryStatsProps) {
  const { entries } = useActivityLog(activeExpeditionId);
  const routeTemplate = useExpeditionRouteTemplate(activeExpeditionId);
  const { routeTotalKm } = useRoadRoute(routeTemplate.waypoints, routeTemplate.key);
  const totalKm = entries.reduce((s, e) => s + e.distanceKm, 0);
  const pctRaw = (totalKm / routeTotalKm) * 100;
  const pct = pctRaw > 0 && pctRaw < 0.1 ? "<0.1" : pctRaw.toFixed(1);
  const next = routeTemplate.landmarks.find((l) => l.km > totalKm);
  const remainingToNext = next ? formatDistance(next.km - totalKm, distanceUnit) : "0.0";
  const unit = distanceUnitLabel(distanceUnit);
  return (
    <div className="summary-stats">
      <div className="stat"><span className="stat-value">{formatDistance(totalKm, distanceUnit)}</span><span className="stat-label">{unit} logged</span></div>
      <div className="stat"><span className="stat-value">{pct}%</span><span className="stat-label">complete</span></div>
      {next && <div className="stat"><span className="stat-value">{remainingToNext}</span><span className="stat-label">{unit} to {next.name}</span></div>}
      {next && <div className="stat"><span className="stat-value">{next.name}</span><span className="stat-label">next landmark</span></div>}
    </div>
  );
}
