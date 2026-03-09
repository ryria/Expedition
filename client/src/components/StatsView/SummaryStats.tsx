import { useActivityLog } from "../../hooks/useActivityLog";
import { LANDMARKS } from "../../data/route";
import { ROUTE_TOTAL_KM } from "../../config";

export function SummaryStats() {
  const { entries } = useActivityLog();
  const totalKm = entries.reduce((s, e) => s + e.distanceKm, 0);
  const pct = ((totalKm / ROUTE_TOTAL_KM) * 100).toFixed(2);
  const remaining = (ROUTE_TOTAL_KM - totalKm).toFixed(1);
  const next = LANDMARKS.find((l) => l.km > totalKm);
  return (
    <div className="summary-stats">
      <div className="stat"><span className="stat-value">{totalKm.toFixed(1)}</span><span className="stat-label">km logged</span></div>
      <div className="stat"><span className="stat-value">{pct}%</span><span className="stat-label">complete</span></div>
      <div className="stat"><span className="stat-value">{remaining}</span><span className="stat-label">km to Sydney</span></div>
      {next && <div className="stat"><span className="stat-value">{next.name}</span><span className="stat-label">next landmark in {(next.km - totalKm).toFixed(0)} km</span></div>}
    </div>
  );
}
