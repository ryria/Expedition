import { useActivityLog } from "../../hooks/useActivityLog";
import { ActivityCard } from "./ActivityCard";

interface ActivityFeedProps {
  activeExpeditionId?: bigint;
}

export function ActivityFeed({ activeExpeditionId }: ActivityFeedProps) {
  const { entries } = useActivityLog(activeExpeditionId);
  if (!entries.length) return <p className="empty">No activities yet — log the first one!</p>;
  return (
    <ul className="activity-feed">
      {entries.map((e) => <ActivityCard key={String(e.id)} entry={e} />)}
    </ul>
  );
}
