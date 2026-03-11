import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "react-oidc-context";
import { useSpacetimeDB } from "spacetimedb/react";
import { useMembers } from "../../hooks/useMembers";
import { DbConnection } from "../../spacetime/generated";
import { DEFAULT_COLORS, STRAVA_CLIENT_ID } from "../../config";
import "./SettingsPanel.css";

type Theme = "dark" | "light";
type MapMode = "asRan" | "contribution";

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  activeExpedition: {
    id: bigint;
    name: string;
    slug: string;
  } | null;
  onCreateExpedition: (name: string) => Promise<boolean>;
  isCreatingExpedition: boolean;
  expeditionCreateError: string;
}

export function SettingsPanel({
  theme,
  onThemeChange,
  mapMode,
  onMapModeChange,
  activeExpedition,
  onCreateExpedition,
  isCreatingExpedition,
  expeditionCreateError,
}: SettingsPanelProps) {
  const auth = useAuth();
  const connectionState = useSpacetimeDB();
  const { members } = useMembers();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [stravaStatus, setStravaStatus] = useState("");
  const [isLinkingStrava, setIsLinkingStrava] = useState(false);
  const [isSyncingStrava, setIsSyncingStrava] = useState(false);
  const [newExpeditionName, setNewExpeditionName] = useState("");

  const STRAVA_STATE_STORAGE_KEY = "expedition-strava-oauth-state";
  const conn = connectionState.getConnection() as DbConnection | null;

  const sub = auth.user?.profile?.sub as string | undefined;
  const suggestedName = useMemo(() => {
    const profile = auth.user?.profile as Record<string, unknown> | undefined;
    const preferred = profile?.preferred_username;
    const fullName = profile?.name;
    const email = profile?.email;

    if (typeof preferred === "string" && preferred.trim()) return preferred.trim();
    if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
    if (typeof email === "string" && email.includes("@")) return email.split("@")[0];
    return "";
  }, [auth.user?.profile]);

  const linkedMember = members.find((m) => sub != null && m.ownerSub === sub) ?? null;

  useEffect(() => {
    if (!isSaving) return;
    const timer = setTimeout(() => {
      setIsSaving(false);
      setError("Profile update timed out. Please try again.");
    }, 8000);
    return () => clearTimeout(timer);
  }, [isSaving]);

  useEffect(() => {
    if (isSaving && linkedMember) {
      setIsSaving(false);
    }
  }, [isSaving, linkedMember]);

  useEffect(() => {
    if (linkedMember) {
      setName(linkedMember.name);
      setColor(linkedMember.colorHex);
      return;
    }
    if (suggestedName) setName((prev) => (prev ? prev : suggestedName));
  }, [linkedMember, suggestedName]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("strava_code");
    const callbackState = params.get("strava_state");
    const callbackError = params.get("strava_error");

    if (!code && !callbackError) return;

    const cleanup = () => {
      params.delete("strava_code");
      params.delete("strava_state");
      params.delete("strava_scope");
      params.delete("strava_error");
      const next = params.toString();
      const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
      window.history.replaceState({}, document.title, url);
    };

    if (callbackError) {
      setStravaStatus(`Strava link failed: ${callbackError}`);
      cleanup();
      return;
    }

    if (!code) {
      cleanup();
      return;
    }

    const expectedState = localStorage.getItem(STRAVA_STATE_STORAGE_KEY);
    if (!expectedState || callbackState !== expectedState) {
      setStravaStatus("Strava link failed: invalid OAuth state.");
      cleanup();
      return;
    }

    if (!sub) {
      setStravaStatus("Strava link failed: sign in required.");
      cleanup();
      return;
    }

    const redirectUri = new URL("strava/callback/", window.location.origin + import.meta.env.BASE_URL).toString();
    setIsLinkingStrava(true);
    setStravaStatus("Linking Strava account…");

    void (async () => {
      try {
        if (!conn) throw new Error("SpacetimeDB not connected");
        const reducers = conn.reducers as { bindAuthIdentity?: (args?: Record<string, never>) => void };
        if (linkedMember) {
          reducers.bindAuthIdentity?.({});
        }

        const procedures = conn.procedures as {
          linkStravaAccount?: (args: { code: string; redirectUri: string }) => Promise<unknown>;
        };
        if (!procedures.linkStravaAccount) {
          setStravaStatus("Strava link unavailable until client bindings are regenerated.");
          return;
        }
        await procedures.linkStravaAccount({ code, redirectUri });
        localStorage.removeItem(STRAVA_STATE_STORAGE_KEY);
        setStravaStatus("Strava linked. Use Sync now to import recent activities.");
      } catch (err) {
        setStravaStatus(err instanceof Error ? `Strava link failed: ${err.message}` : `Strava link failed: ${String(err)}`);
      } finally {
        setIsLinkingStrava(false);
        cleanup();
      }
    })();
  }, [conn, linkedMember, sub]);

  function handleSaveProfile() {
    setError("");
    if (isSaving) return;
    if (!sub) {
      setError("Sign in required");
      return;
    }
    if (!name.trim()) {
      setError("Name required");
      return;
    }

    const normalized = name.trim().toLowerCase();
    if (members.some((m) => m.name.toLowerCase() === normalized && m.ownerSub !== sub)) {
      setError("Name already taken");
      return;
    }

    const changed = !linkedMember || linkedMember.name !== name.trim() || linkedMember.colorHex !== color;
    if (!changed) return;
    setIsSaving(true);
    try {
      if (!conn) throw new Error("SpacetimeDB not connected");
      conn.reducers.addMember({ name: name.trim(), colorHex: color });
    } catch (err) {
      setIsSaving(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleConnectStrava() {
    setStravaStatus("");
    if (!sub) {
      setStravaStatus("Sign in required before linking Strava.");
      return;
    }

    if (!STRAVA_CLIENT_ID) {
      setStravaStatus("Missing VITE_STRAVA_CLIENT_ID in client env.");
      return;
    }

    const state = `${sub}:${crypto.randomUUID()}`;
    localStorage.setItem(STRAVA_STATE_STORAGE_KEY, state);

    const redirectUri = new URL("strava/callback/", window.location.origin + import.meta.env.BASE_URL).toString();
    const params = new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirectUri,
      approval_prompt: "auto",
      scope: "read,activity:read_all",
      state,
    });

    window.location.assign(`https://www.strava.com/oauth/authorize?${params.toString()}`);
  }

  function handleSyncStrava() {
    setStravaStatus("");
    setIsSyncingStrava(true);
    void (async () => {
      try {
        if (!conn) throw new Error("SpacetimeDB not connected");
        const reducers = conn.reducers as { bindAuthIdentity?: (args?: Record<string, never>) => void };
        if (linkedMember) {
          reducers.bindAuthIdentity?.({});
        }
        const procedures = conn.procedures as {
          syncMyStravaActivities?: (args?: Record<string, never>) => Promise<unknown>;
        };
        if (!procedures.syncMyStravaActivities) {
          setStravaStatus("Strava sync unavailable until client bindings are regenerated.");
          return;
        }
        await procedures.syncMyStravaActivities({});
        setStravaStatus("Strava sync requested. New activities will appear when processed.");
      } catch (err) {
        setStravaStatus(err instanceof Error ? `Strava sync failed: ${err.message}` : `Strava sync failed: ${String(err)}`);
      } finally {
        setIsSyncingStrava(false);
      }
    })();
  }

  function handleCreateExpedition(e: FormEvent) {
    e.preventDefault();
    void (async () => {
      const created = await onCreateExpedition(newExpeditionName);
      if (created) {
        setNewExpeditionName("");
      }
    })();
  }

  return (
    <div className="settings-panel">
      <h2>User Settings</h2>

      <section className="settings-group">
        <h3>Appearance</h3>
        <div className="theme-toggle" role="group" aria-label="Theme">
          <button
            className={theme === "dark" ? "active" : ""}
            onClick={() => onThemeChange("dark")}
            type="button"
          >
            Dark
          </button>
          <button
            className={theme === "light" ? "active" : ""}
            onClick={() => onThemeChange("light")}
            type="button"
          >
            Light
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h3>Map View Mode</h3>
        <div className="theme-toggle" role="group" aria-label="Map View Mode">
          <button
            className={mapMode === "asRan" ? "active" : ""}
            onClick={() => onMapModeChange("asRan")}
            type="button"
          >
            As Ran
          </button>
          <button
            className={mapMode === "contribution" ? "active" : ""}
            onClick={() => onMapModeChange("contribution")}
            type="button"
          >
            Contribution
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h3>Profile</h3>
        <div className="add-member">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
            placeholder="Your name"
            maxLength={30}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            title="Pick colour"
          />
          <button onClick={handleSaveProfile} disabled={isSaving}>
            {isSaving ? "Saving…" : linkedMember ? "Save" : "Create"}
          </button>
        </div>
        <p>{linkedMember ? "This profile is linked to your sign-in." : "Create your linked member profile."}</p>
        {error && <p className="field-error">{error}</p>}
      </section>

      <section className="settings-group">
        <h3>Expedition</h3>
        <p>
          {activeExpedition
            ? `Active expedition: ${activeExpedition.name} (${activeExpedition.slug})`
            : "No active expedition selected."}
        </p>
        <form className="strava-actions" onSubmit={handleCreateExpedition}>
          <input
            type="text"
            value={newExpeditionName}
            onChange={(e) => setNewExpeditionName(e.target.value)}
            placeholder="New expedition name"
            maxLength={64}
          />
          <button type="submit" disabled={isCreatingExpedition}>
            {isCreatingExpedition ? "Creating…" : "Create expedition"}
          </button>
          <button type="button" disabled title="Coming in Sprint 3">
            Invite members (coming in Sprint 3)
          </button>
        </form>
        {expeditionCreateError && <p className="field-error">{expeditionCreateError}</p>}
      </section>

      <section className="settings-group">
        <h3>Strava</h3>
        <div className="strava-actions">
          <button type="button" onClick={handleConnectStrava} disabled={isLinkingStrava}>
            {isLinkingStrava ? "Linking…" : "Connect Strava"}
          </button>
          <button type="button" onClick={handleSyncStrava} disabled={isSyncingStrava || isLinkingStrava}>
            {isSyncingStrava ? "Syncing…" : "Sync now"}
          </button>
        </div>
        <p>Imports Run, Walk, Ride, and Rowing activities from linked Strava accounts.</p>
        {stravaStatus && <p className="field-error">{stravaStatus}</p>}
      </section>
    </div>
  );
}