import type { ActivityEntry } from "../../hooks/useActivityLog";
import { useReactions } from "../../hooks/useReactions";
import { CommentThread } from "./CommentThread";
import { ACTIVITY_ICONS } from "../../config";
import { getConnection } from "../../spacetime/connection";

const EMOJIS = ["🔥", "💪", "🌊", "🎉", "😮", "❤️"];

interface Props { entry: ActivityEntry; }

export function ActivityCard({ entry }: Props) {
  const { reactionsFor } = useReactions();
  const reactionList = reactionsFor(entry.id);

  function handleReact(emoji: string) {
    const name = window.prompt("Your name?");
    if (!name?.trim()) return;
    getConnection().reducers.addReaction({ logId: entry.id, emoji, reactedBy: name.trim() });
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
            <button key={e} className="reaction-btn" onClick={() => handleReact(e)}>
              {e}{count > 0 && <span className="reaction-count">{count}</span>}
            </button>
          );
        })}
      </div>
      <CommentThread logId={entry.id} />
    </li>
  );
}
