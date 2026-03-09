import { useEffect, useRef, useState } from "react";
import { MapJournalView } from "./components/MapView/MapJournalView";
import { MembersPanel } from "./components/MembersPanel/MembersPanel";
import { SettingsPanel } from "./components/SettingsPanel/SettingsPanel";
import { useAuth } from "react-oidc-context";
import { useMembers } from "./hooks/useMembers";
import "./App.css";

type Tab = "expedition" | "members" | "settings";
type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "expedition-theme";

function loadInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function App() {
  const [tab, setTab] = useState<Tab>("expedition");
  const [theme, setTheme] = useState<Theme>(loadInitialTheme);
  const auth = useAuth();
  const { members } = useMembers();
  const onboardingPrompted = useRef(false);

  const sub = auth.user?.profile?.sub as string | undefined;
  const isRegistered = members.some((m) => sub != null && m.ownerSub === sub);

  const visibleTabs: Tab[] = ["expedition", "members", "settings"];

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!isRegistered && !onboardingPrompted.current) {
      onboardingPrompted.current = true;
      setTab("settings");
      return;
    }

    if (isRegistered) {
      onboardingPrompted.current = false;
    }
  }, [isRegistered]);

  return (
    <div className="app">
      <nav className="app-nav">
        <h1 className="app-title">The Expedition</h1>
        <div className="nav-tabs">
          {visibleTabs.map((t) => (
            <button key={t} className={`nav-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}>
              {t === "expedition" ? "Expedition" : t === "members" ? "Members" : "Settings"}
            </button>
          ))}
          <button className="nav-tab" onClick={() => auth.signoutRedirect()}>
            Sign out
          </button>
        </div>
      </nav>
      <main className={`app-main ${tab === "expedition" ? "expedition-main" : ""}`}>
        {!isRegistered && (
          <p>Please complete onboarding in Settings (set your name and colour) to unlock Log and Stats.</p>
        )}
        {tab === "expedition" && <MapJournalView theme={theme} />}
        {tab === "members" && <MembersPanel />}
        {tab === "settings" && <SettingsPanel theme={theme} onThemeChange={setTheme} />}
      </main>
    </div>
  );
}
