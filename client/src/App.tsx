import { useEffect, useRef, useState } from "react";
import { MapJournalView } from "./components/MapView/MapJournalView";
import { MembersPanel } from "./components/MembersPanel/MembersPanel";
import { useAuth } from "react-oidc-context";
import { useMembers } from "./hooks/useMembers";
import "./App.css";

type Tab = "expedition" | "members";

export default function App() {
  const [tab, setTab] = useState<Tab>("expedition");
  const auth = useAuth();
  const { members } = useMembers();
  const onboardingPrompted = useRef(false);

  const sub = auth.user?.profile?.sub as string | undefined;
  const isRegistered = members.some((m) => sub != null && m.ownerSub === sub);

  const visibleTabs: Tab[] = ["expedition", "members"];

  useEffect(() => {
    if (!isRegistered && !onboardingPrompted.current) {
      onboardingPrompted.current = true;
      setTab("members");
      return;
    }

    if (isRegistered) {
      onboardingPrompted.current = false;
    }
  }, [isRegistered, tab]);

  return (
    <div className="app">
      <nav className="app-nav">
        <h1 className="app-title">The Expedition</h1>
        <div className="nav-tabs">
          {visibleTabs.map((t) => (
            <button key={t} className={`nav-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}>
              {t === "expedition" ? "Expedition" : "Members"}
            </button>
          ))}
          <button className="nav-tab" onClick={() => auth.signoutRedirect()}>
            Sign out
          </button>
        </div>
      </nav>
      <main className={`app-main ${tab === "expedition" ? "expedition-main" : ""}`}>
        {!isRegistered && (
          <p>Please complete onboarding in Members (set your name and colour) to unlock Log and Stats.</p>
        )}
        {tab === "expedition" && <MapJournalView />}
        {tab === "members" && <MembersPanel />}
      </main>
    </div>
  );
}
