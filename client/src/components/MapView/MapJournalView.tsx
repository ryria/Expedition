import { useMemo, useState } from "react";
import { MapView } from "./MapView";
import { LogForm } from "../LogView/LogForm";
import { ActivityFeed } from "../LogView/ActivityFeed";
import { SummaryStats } from "../StatsView/SummaryStats";
import { ActivityTypeChart } from "../StatsView/ActivityTypeChart";
import { PersonBreakdown } from "../StatsView/PersonBreakdown";
import { LandmarksPassed } from "../StatsView/LandmarksPassed";
import { useActivityLog } from "../../hooks/useActivityLog";
import "../LogView/LogView.css";
import "../StatsView/StatsView.css";
import "./MapJournalView.css";

type DrawerTab = "today" | "journey" | "highlights";

export function MapJournalView() {
  const [tab, setTab] = useState<DrawerTab>("today");
  const [open, setOpen] = useState(true);
  const { entries } = useActivityLog();

  const latest = useMemo(() => entries[0], [entries]);

  return (
    <div className="map-journal-layout">
      <div className="map-hero">
        <MapView />
      </div>

      <aside className={`journal-drawer ${open ? "open" : "collapsed"}`}>
        <div className="drawer-header">
          <h2>Expedition Journal</h2>
          <button className="drawer-toggle" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Show"}
          </button>
        </div>

        <div className="drawer-tabs">
          <button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Today</button>
          <button className={tab === "journey" ? "active" : ""} onClick={() => setTab("journey")}>Journey</button>
          <button className={tab === "highlights" ? "active" : ""} onClick={() => setTab("highlights")}>Highlights</button>
        </div>

        {open && (
          <div className="drawer-content">
            {tab === "today" && (
              <div className="drawer-section">
                <LogForm />
                {latest && (
                  <div className="today-latest">
                    <h3>Latest Entry</h3>
                    <p>
                      <strong>{latest.personName}</strong> logged {latest.distanceKm.toFixed(1)} km {latest.activityType}.
                    </p>
                  </div>
                )}
              </div>
            )}

            {tab === "journey" && (
              <div className="drawer-section">
                <ActivityFeed />
                <LandmarksPassed />
              </div>
            )}

            {tab === "highlights" && (
              <div className="drawer-section">
                <SummaryStats />
                <ActivityTypeChart />
                <PersonBreakdown />
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
