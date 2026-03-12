import { useMemo, useState } from "react";
import type { ActivityEntry } from "../../hooks/useActivityLog";
import { useReactions } from "../../hooks/useReactions";
import { useMembers } from "../../hooks/useMembers";
import { CommentThread } from "./CommentThread";
import { ACTIVITY_ICONS } from "../../config";
import { useAuth } from "react-oidc-context";
import { useSpacetimeDB } from "spacetimedb/react";
import { DbConnection } from "../../spacetime/generated";
import { distanceUnitLabel, formatDistance, type DistanceUnit } from "../../config";

const EMOJIS = ["🔥", "💪", "🌊", "🎉", "😮", "❤️"];

interface Props {
  entry: ActivityEntry;
  distanceUnit: DistanceUnit;
}

export function ActivityCard({ entry, distanceUnit }: Props) {
  const auth = useAuth();
  const connectionState = useSpacetimeDB();
  const { members } = useMembers(entry.expeditionId);
  const { reactionsFor } = useReactions(entry.expeditionId);
  const [actionError, setActionError] = useState("");
  const reactionList = reactionsFor(entry.id);
  const reactionCounts = useMemo(() => {
    return reactionList.reduce<Record<string, number>>((acc, reaction) => {
      acc[reaction.emoji] = (acc[reaction.emoji] ?? 0) + 1;
      return acc;
    }, {});
  }, [reactionList]);
  const displayName = members.find((m) => m.id === entry.memberId)?.name ?? entry.personName;
  const sub = auth.user?.profile?.sub as string | undefined;
  const linkedMember = members.find((m) => sub != null && m.ownerSub === sub) ?? null;

  function handleReact(emoji: string) {
    if (!linkedMember) return;
    setActionError("");
    try {
      const conn = connectionState.getConnection() as DbConnection | null;
      if (!conn) throw new Error("SpacetimeDB not connected");
      conn.reducers.addReaction({
        logId: entry.id,
        emoji,
        reactedBy: linkedMember.name,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <li className="activity-card">
      <div className="card-header">
        <span className="act-icon">
          {ACTIVITY_ICONS[entry.activityType as keyof typeof ACTIVITY_ICONS] ?? "🏅"}
        </span>
        <strong>{displayName}</strong>
        <span className="km">{formatDistance(entry.distanceKm, distanceUnit)} {distanceUnitLabel(distanceUnit)}</span>
        <span className="ts">{entry.timestamp.toDate().toLocaleString()}</span>
      </div>
      {entry.note && <p className="note">{entry.note}</p>}
      {entry.aiResponse && <p className="ai-response">{entry.aiResponse}</p>}
      <div className="reaction-bar">
        {EMOJIS.map((e) => {
          const count = reactionCounts[e] ?? 0;
          return (
            <button
              key={e}
              className="reaction-btn"
              onClick={() => handleReact(e)}
              disabled={!linkedMember}
              title={linkedMember ? "React" : "Create your member profile to react"}
            >
              {e}{count > 0 && <span className="reaction-count">{count}</span>}
            </button>
          );
        })}
      </div>
      {actionError && <p className="field-error">{actionError}</p>}
      <CommentThread logId={entry.id} expeditionId={entry.expeditionId} />
    </li>
  );
}
