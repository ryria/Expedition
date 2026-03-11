import { useActivityLog } from "../../hooks/useActivityLog";
import { ACTIVITY_TYPES, ACTIVITY_ICONS } from "../../config";

const COLORS: Record<string, string> = {
  run: "#c0392b", row: "#2980b9", walk: "#27ae60", cycle: "#f39c12",
};

interface ActivityTypeChartProps {
  activeExpeditionId?: bigint;
}

export function ActivityTypeChart({ activeExpeditionId }: ActivityTypeChartProps) {
  const { entries } = useActivityLog(activeExpeditionId);
  const totalKm = entries.reduce((s, e) => s + e.distanceKm, 0);
  if (totalKm === 0) return <p>No data yet.</p>;
  return (
    <div className="act-type-chart">
      <h3>By Activity Type</h3>
      <div className="stacked-bar">
        {ACTIVITY_TYPES.map((t) => {
          const km = entries.filter((e) => e.activityType === t).reduce((s, e) => s + e.distanceKm, 0);
          const pct = ((km / totalKm) * 100).toFixed(1);
          if (km === 0) return null;
          return (
            <div key={t} className="bar-segment" style={{ width: `${pct}%`, background: COLORS[t] }}
              title={`${ACTIVITY_ICONS[t]} ${t}: ${km.toFixed(1)} km (${pct}%)`} />
          );
        })}
      </div>
      <div className="act-legend">
        {ACTIVITY_TYPES.map((t) => {
          const km = entries.filter((e) => e.activityType === t).reduce((s, e) => s + e.distanceKm, 0);
          if (km === 0) return null;
          return (
            <span key={t} className="act-legend-item">
              <span className="act-dot" style={{ background: COLORS[t] }} />
              {ACTIVITY_ICONS[t]} {t}: {km.toFixed(1)} km
            </span>
          );
        })}
      </div>
    </div>
  );
}
