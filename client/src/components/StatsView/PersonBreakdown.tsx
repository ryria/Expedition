import { useMembers } from "../../hooks/useMembers";
import { useActivityLog } from "../../hooks/useActivityLog";
import { ACTIVITY_TYPES, ACTIVITY_ICONS } from "../../config";

interface PersonBreakdownProps {
  activeExpeditionId?: bigint;
}

export function PersonBreakdown({ activeExpeditionId }: PersonBreakdownProps) {
  const { members } = useMembers(activeExpeditionId);
  const { entries } = useActivityLog(activeExpeditionId);
  return (
    <div className="person-breakdown">
      <h3>Per Person</h3>
      {members.map((m) => {
        const myEntries = entries.filter((e) => e.memberId === m.id);
        const totalKm = myEntries.reduce((s, e) => s + e.distanceKm, 0);
        return (
          <div key={String(m.id)} className="person-stat">
            <div className="person-stat-header">
              <span className="swatch" style={{ background: m.colorHex }} />
              <strong>{m.name}</strong>
              <span>{totalKm.toFixed(1)} km · {myEntries.length} activities</span>
            </div>
            <div className="act-breakdown">
              {ACTIVITY_TYPES.map((t) => {
                const km = myEntries.filter((e) => e.activityType === t).reduce((s, e) => s + e.distanceKm, 0);
                if (km === 0) return null;
                return <span key={t}>{ACTIVITY_ICONS[t]} {km.toFixed(1)} km</span>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
