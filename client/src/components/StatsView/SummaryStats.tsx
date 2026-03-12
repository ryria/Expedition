import { useActivityLog } from "../../hooks/useActivityLog";
import { LANDMARKS } from "../../data/route";
import { ROUTE_TOTAL_KM } from "../../config";

interface SummaryStatsProps {
  activeExpeditionId?: bigint;
}

export function SummaryStats({ activeExpeditionId }: SummaryStatsProps) {
  const { entries } = useActivityLog(activeExpeditionId);
  const totalKm = entries.reduce((s, e) => s + e.distanceKm, 0);
  const pctRaw = (totalKm / ROUTE_TOTAL_KM) * 100;
  const pct = pctRaw > 0 && pctRaw < 0.1 ? "<0.1" : pctRaw.toFixed(1);
  const next = LANDMARKS.find((l) => l.km > totalKm);
  const remainingToNext = next ? (next.km - totalKm).toFixed(1) : "0.0";
  return (
    <div className="summary-stats">
      <div className="stat"><span className="stat-value">{totalKm.toFixed(1)}</span><span className="stat-label">km logged</span></div>
      <div className="stat"><span className="stat-value">{pct}%</span><span className="stat-label">complete</span></div>
      {next && <div className="stat"><span className="stat-value">{remainingToNext}</span><span className="stat-label">km to {next.name}</span></div>}
      {next && <div className="stat"><span className="stat-value">{next.name}</span><span className="stat-label">next landmark</span></div>}
    </div>
  );
}
