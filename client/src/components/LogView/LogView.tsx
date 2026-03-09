import { LogForm } from "./LogForm";
import { ActivityFeed } from "./ActivityFeed";
import "./LogView.css";

export function LogView() {
  return (
    <div className="log-view">
      <LogForm />
      <ActivityFeed />
    </div>
  );
}
