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
type Theme = "dark" | "light";
type MapMode = "asRan" | "contribution";
type HubSectionId = "progressInsights" | "addActivity" | "social";

interface MapJournalViewProps {
  theme: Theme;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  activeExpeditionId: bigint;
}

const INITIAL_ORDER: HubSectionId[] = ["progressInsights", "addActivity", "social"];

export function MapJournalView({ theme, mapMode, onMapModeChange, activeExpeditionId }: MapJournalViewProps) {
  const [progressMode, setProgressMode] = useState<ProgressMode>("progress");
  const [open, setOpen] = useState(true);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<HubSectionId[]>(INITIAL_ORDER);
  const [openSections, setOpenSections] = useState<Record<HubSectionId, boolean>>({
    progressInsights: true,
    addActivity: true,
    social: true,
  });

  function moveSection(id: HubSectionId, direction: "up" | "down") {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;

      const nextIdx = direction === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;

      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(nextIdx, 0, item);
      return next;
    });
  }

  function toggleSection(id: HubSectionId) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function sectionTitle(id: HubSectionId): string {
    if (id === "progressInsights") {
      return progressMode === "progress" ? "Progress" : "Insights";
    }
    if (id === "addActivity") return "Add Activity";
    return "Social";
  }

  function renderSectionBody(id: HubSectionId) {
    if (id === "progressInsights") {
      return (
        <>
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
        </>
      );
    }

    if (id === "addActivity") {
      return <LogForm activeExpeditionId={activeExpeditionId} />;
    }

    return <ActivityFeed activeExpeditionId={activeExpeditionId} />;
  }

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
        <div className="drawer-header">
          <h2>Team Hub</h2>
          <div className="drawer-header-actions">
            {open && (
              <button
                className={`drawer-toggle ${isEditingLayout ? "active" : ""}`}
                onClick={() => setIsEditingLayout((v) => !v)}
              >
                {isEditingLayout ? "Done" : "Edit layout"}
              </button>
            )}
            <button className="drawer-toggle" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {open && (
          <div className="drawer-content">
            {sectionOrder.map((sectionId, idx) => (
              <section key={sectionId} className="drawer-section accordion-section">
                <div className="section-heading section-heading-row">
                  <button
                    className="section-toggle"
                    onClick={() => toggleSection(sectionId)}
                  >
                    {sectionTitle(sectionId)} {openSections[sectionId] ? "▲" : "▼"}
                  </button>
                  {isEditingLayout && (
                    <div className="reorder-controls">
                      <button
                        onClick={() => moveSection(sectionId, "up")}
                        disabled={idx === 0}
                        aria-label="Move section up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveSection(sectionId, "down")}
                        disabled={idx === sectionOrder.length - 1}
                        aria-label="Move section down"
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </div>
                {openSections[sectionId] && (
                  <div className="accordion-body">{renderSectionBody(sectionId)}</div>
                )}
              </section>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
