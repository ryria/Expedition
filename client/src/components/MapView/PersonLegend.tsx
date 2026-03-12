import { useMembers } from "../../hooks/useMembers";
import { useActivityLog } from "../../hooks/useActivityLog";
import { distanceUnitLabel, formatDistance, type DistanceUnit } from "../../config";

interface PersonLegendProps {
  activeExpeditionId: bigint;
  distanceUnit: DistanceUnit;
}

export function PersonLegend({ activeExpeditionId, distanceUnit }: PersonLegendProps) {
  const { members } = useMembers(activeExpeditionId);
  const { entries } = useActivityLog(activeExpeditionId);
  return (
    <div className="person-legend">
      {members.map((m) => {
        const km = entries
          .filter((e) => e.memberId === m.id)
          .reduce((s, e) => s + e.distanceKm, 0);
        return (
          <div key={String(m.id)} className="legend-row">
            <span className="legend-swatch" style={{ background: m.colorHex }} />
            <span className="legend-name">{m.name}</span>
            <span className="legend-km">{formatDistance(km, distanceUnit)} {distanceUnitLabel(distanceUnit)}</span>
          </div>
        );
      })}
    </div>
  );
}
