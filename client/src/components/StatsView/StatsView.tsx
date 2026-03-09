import { SummaryStats } from "./SummaryStats";
import { PersonBreakdown } from "./PersonBreakdown";
import { ActivityTypeChart } from "./ActivityTypeChart";
import { LandmarksPassed } from "./LandmarksPassed";
import "./StatsView.css";

export function StatsView() {
  return (
    <div className="stats-view">
      <SummaryStats />
      <PersonBreakdown />
      <ActivityTypeChart />
      <LandmarksPassed />
    </div>
  );
}
