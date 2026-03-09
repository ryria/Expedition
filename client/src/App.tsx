import { useState } from "react";
import { MapView } from "./components/MapView/MapView";
import { LogView } from "./components/LogView/LogView";
import { StatsView } from "./components/StatsView/StatsView";
import { MembersPanel } from "./components/MembersPanel/MembersPanel";
import "./App.css";

type Tab = "map" | "log" | "stats" | "members";

export default function App() {
  const [tab, setTab] = useState<Tab>("map");

  return (
    <div className="app">
      <nav className="app-nav">
        <h1 className="app-title">The Expedition</h1>
        <div className="nav-tabs">
          {(["map", "log", "stats", "members"] as Tab[]).map((t) => (
            <button key={t} className={`nav-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}>
              {t === "map" ? "🗺 Map" : t === "log" ? "📝 Log" : t === "stats" ? "📊 Stats" : "👥 Members"}
            </button>
          ))}
        </div>
      </nav>
      <main className="app-main">
        {tab === "map" && <MapView />}
        {tab === "log" && <LogView />}
        {tab === "stats" && <StatsView />}
        {tab === "members" && <MembersPanel />}
      </main>
    </div>
  );
}
