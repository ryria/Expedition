import { useState } from "react";
import { MapView } from "./MapView";
import { LogForm } from "../LogView/LogForm";
import { ActivityFeed } from "../LogView/ActivityFeed";
import { SummaryStats } from "../StatsView/SummaryStats";
import { ActivityTypeChart } from "../StatsView/ActivityTypeChart";
import { PersonBreakdown } from "../StatsView/PersonBreakdown";
import { LandmarksPassed } from "../StatsView/LandmarksPassed";
import "../LogView/LogView.css";
import "../StatsView/StatsView.css";
import "./MapJournalView.css";

type ProgressMode = "progress" | "insights";
type HubTab = "progress" | "activity" | "social";
type Theme = "dark" | "light";
type MapMode = "asRan" | "contribution";

interface MapJournalViewProps {
  theme: Theme;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  activeExpeditionId: bigint;
}

export function MapJournalView({ theme, mapMode, onMapModeChange, activeExpeditionId }: MapJournalViewProps) {
  const [progressMode, setProgressMode] = useState<ProgressMode>("progress");
  const [open, setOpen] = useState(true);
  const [hubTab, setHubTab] = useState<HubTab>("progress");

  return (
    <div className={`map-journal-layout ${open ? "" : "hub-collapsed"}`.trim()}>
      <div className="map-hero">
        <MapView
          theme={theme}
          mode={mapMode}
          onModeChange={onMapModeChange}
          hubOpen={open}
          activeExpeditionId={activeExpeditionId}
        />
      </div>

      <aside className={`journal-drawer ${open ? "open" : "collapsed"}`}>
        <div className="drawer-handle" aria-hidden="true" />
        <div className="drawer-header">
          <div className="drawer-header-title">
            <h2>Team Hub</h2>
            {open && <p>Your expedition control center</p>}
          </div>
          <div className="drawer-header-actions">
            <button className="drawer-toggle" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {open && (
          <div className="drawer-content">
            <div className="hub-tabs" role="tablist" aria-label="Hub sections">
              <button type="button" className={hubTab === "progress" ? "active" : ""} onClick={() => setHubTab("progress")}>
                Progress
              </button>
              <button type="button" className={hubTab === "activity" ? "active" : ""} onClick={() => setHubTab("activity")}>
                Add Activity
              </button>
              <button type="button" className={hubTab === "social" ? "active" : ""} onClick={() => setHubTab("social")}>
                Social
              </button>
            </div>

            {hubTab === "progress" && (
              <section className="drawer-section hub-panel">
                <div className="panel-head">
                  <h3>{progressMode === "progress" ? "Progress" : "Insights"}</h3>
                  <p>Track milestones, landmarks, and contribution trends.</p>
                </div>
                <div className="drawer-tabs">
                  <button
                    className={progressMode === "progress" ? "active" : ""}
                    onClick={() => setProgressMode("progress")}
                  >
                    Progress
                  </button>
                  <button
                    className={progressMode === "insights" ? "active" : ""}
                    onClick={() => setProgressMode("insights")}
                  >
                    Insights
                  </button>
                </div>
                <div className="accordion-body">
                  {progressMode === "progress" ? (
                    <>
                      <SummaryStats activeExpeditionId={activeExpeditionId} />
                      <LandmarksPassed activeExpeditionId={activeExpeditionId} />
                    </>
                  ) : (
                    <>
                      <ActivityTypeChart activeExpeditionId={activeExpeditionId} />
                      <PersonBreakdown activeExpeditionId={activeExpeditionId} />
                    </>
                  )}
                </div>
              </section>
            )}

            {hubTab === "activity" && (
              <section className="drawer-section hub-panel">
                <div className="panel-head">
                  <h3>Add Activity</h3>
                  <p>Log distance and notes to move the expedition forward.</p>
                </div>
                <div className="accordion-body">
                  <LogForm activeExpeditionId={activeExpeditionId} />
                </div>
              </section>
            )}

            {hubTab === "social" && (
              <section className="drawer-section hub-panel">
                <div className="panel-head">
                  <h3>Social Feed</h3>
                  <p>See team updates, reactions, and comments in one place.</p>
                </div>
                <div className="accordion-body">
                  <ActivityFeed activeExpeditionId={activeExpeditionId} />
                </div>
              </section>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
