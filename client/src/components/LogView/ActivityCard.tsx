import { useState } from "react";
import type { ActivityEntry } from "../../hooks/useActivityLog";
import { useReactions } from "../../hooks/useReactions";
import { useMembers } from "../../hooks/useMembers";
import { CommentThread } from "./CommentThread";
import { ACTIVITY_ICONS } from "../../config";
import { getConnection } from "../../spacetime/connection";
import { useAuth } from "react-oidc-context";

const EMOJIS = ["🔥", "💪", "🌊", "🎉", "😮", "❤️"];

interface Props { entry: ActivityEntry; }

export function ActivityCard({ entry }: Props) {
  const auth = useAuth();
  const { members } = useMembers();
  const { reactionsFor } = useReactions();
  const [actionError, setActionError] = useState("");
  const reactionList = reactionsFor(entry.id);
  const sub = auth.user?.profile?.sub as string | undefined;
  const linkedMember = members.find((m) => sub != null && m.ownerSub === sub) ?? null;

  function handleReact(emoji: string) {
    if (!linkedMember) return;
    setActionError("");
    try {
      getConnection().reducers.addReaction({
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
        <strong>{entry.personName}</strong>
        <span className="km">{entry.distanceKm.toFixed(1)} km</span>
        <span className="ts">{entry.timestamp.toDate().toLocaleString()}</span>
      </div>
      {entry.note && <p className="note">{entry.note}</p>}
      {entry.aiResponse && <p className="ai-response">{entry.aiResponse}</p>}
      <div className="reaction-bar">
        {EMOJIS.map((e) => {
          const count = reactionList.filter((r) => r.emoji === e).length;
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
      <CommentThread logId={entry.id} />
    </li>
  );
}
