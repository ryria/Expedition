import { useMembers } from "../../hooks/useMembers";
import { useActivityLog } from "../../hooks/useActivityLog";

export function PersonLegend() {
  const { members } = useMembers();
  const { entries } = useActivityLog();
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
            <span className="legend-km">{km.toFixed(1)} km</span>
          </div>
        );
      })}
    </div>
  );
}
