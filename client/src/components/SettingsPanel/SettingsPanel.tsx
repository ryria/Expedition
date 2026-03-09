import { useEffect, useMemo, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useMembers } from "../../hooks/useMembers";
import { getConnection } from "../../spacetime/connection";
import { DEFAULT_COLORS } from "../../config";
import "./SettingsPanel.css";

type Theme = "dark" | "light";

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export function SettingsPanel({ theme, onThemeChange }: SettingsPanelProps) {
  const auth = useAuth();
  const { members } = useMembers();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

    const conn = getConnection();
    const changed = !linkedMember || linkedMember.name !== name.trim() || linkedMember.colorHex !== color;
    if (!changed) return;
    setIsSaving(true);
    conn.reducers.addMember({ name: name.trim(), colorHex: color });
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
    </div>
  );
}