import { useEffect, useMemo, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { useMembers } from "../../hooks/useMembers";
import { DbConnection, tables } from "../../spacetime/generated";
import { DEFAULT_COLORS, STRAVA_CLIENT_ID, type DistanceUnit } from "../../config";
import "./SettingsPanel.css";

type Theme = "dark" | "light";
type MapMode = "asRan" | "contribution";
type MembershipRow = {
  id: bigint;
  expeditionId: bigint;
  memberId: bigint;
  role: string;
  status: string;
  leftAt: unknown;
};
type PlanSubscriptionRow = {
  id: bigint;
  expeditionId: bigint;
  ownerMemberId: bigint;
  planCode: string;
  status: string;
  seatLimit: number;
  cancelAtPeriodEnd: boolean;
  periodStartEpoch: bigint;
  periodEndEpoch: bigint;
};
type EntitlementRow = {
  id: bigint;
  expeditionId: bigint;
  featureKey: string;
  enabled: boolean;
  limitValue: number;
};
type ExpeditionRow = {
  id: bigint;
  name: string;
  slug: string;
  inviteOnly: boolean;
  isArchived: boolean;
};
type NotificationRow = {
  id: bigint;
  recipientMemberId: bigint;
  actorMemberId: bigint;
  expeditionId: bigint;
  eventKind: string;
  title: string;
  body: string;
  entityType: string;
  entityId: bigint;
  isRead: boolean;
  createdAt: { toDate: () => Date };
  readAt: unknown;
};

type ReminderCadence = "off" | "daily" | "weekly";

interface NotificationPreferences {
  inviteEvents: boolean;
  engagementEvents: boolean;
  milestoneEvents: boolean;
  reminderCadence: ReminderCadence;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  inviteEvents: true,
  engagementEvents: true,
  milestoneEvents: true,
  reminderCadence: "weekly",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
};

const NOTIFICATION_PREFERENCES_STORAGE_KEY = "expedition-notification-preferences";
const STRAVA_PENDING_CALLBACK_STORAGE_KEY = "expedition-strava-oauth-callback-pending";

const PRICING_TIERS = [
  { name: "Free", summary: "1 expedition · up to 5 members · base stats" },
  { name: "Pro", summary: "Owner-paid monthly tier · expanded seats · advanced insights" },
  { name: "Club", summary: "Higher seat tiers · admin controls · club operations" },
] as const;

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  distanceUnit?: DistanceUnit;
  onDistanceUnitChange?: (unit: DistanceUnit) => void;
  activeExpedition: {
    id: bigint;
    name: string;
    slug: string;
  } | null;
}

export function SettingsPanel({
  theme,
  onThemeChange,
  mapMode,
  onMapModeChange,
  distanceUnit = "km",
  onDistanceUnitChange = () => {},
  activeExpedition,
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
  const [billingStatus, setBillingStatus] = useState("");
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [visibilityStatus, setVisibilityStatus] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");
  const [isDeletingExpedition, setIsDeletingExpedition] = useState(false);
  const [markingNotificationId, setMarkingNotificationId] = useState<bigint | null>(null);
  const [notificationStatus, setNotificationStatus] = useState("");
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );

  const STRAVA_STATE_STORAGE_KEY = "expedition-strava-oauth-state";
  const conn = connectionState.getConnection() as DbConnection | null;
  const [expeditionRows] = useTable(tables.expedition);
  const [membershipRows] = useTable(tables.membership);
  const [planSubscriptionRows] = useTable(tables.plan_subscription);
  const [entitlementRows] = useTable(tables.entitlement);
  const [notificationRows] = useTable(tables.notification);

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
  const activeMembership = useMemo(() => {
    if (!activeExpedition || !linkedMember) return null;
    return (membershipRows as readonly MembershipRow[]).find(
      (row) =>
        row.expeditionId === activeExpedition.id &&
        row.memberId === linkedMember.id &&
        row.leftAt == null &&
        row.status.toLowerCase() !== "left",
    ) ?? null;
  }, [activeExpedition, linkedMember, membershipRows]);

  const isOwner = activeMembership?.role.toLowerCase() === "owner";

  const activePlanSubscription = useMemo(() => {
    if (!activeExpedition) return null;
    return (planSubscriptionRows as readonly PlanSubscriptionRow[]).find(
      (row) => row.expeditionId === activeExpedition.id,
    ) ?? null;
  }, [activeExpedition, planSubscriptionRows]);

  const activeEntitlements = useMemo(() => {
    if (!activeExpedition) return [] as EntitlementRow[];
    return (entitlementRows as readonly EntitlementRow[])
      .filter((row) => row.expeditionId === activeExpedition.id)
      .sort((a, b) => a.featureKey.localeCompare(b.featureKey));
  }, [activeExpedition, entitlementRows]);

  const activeExpeditionRow = useMemo(() => {
    if (!activeExpedition) return null;
    return (expeditionRows as readonly ExpeditionRow[]).find((row) => row.id === activeExpedition.id) ?? null;
  }, [activeExpedition, expeditionRows]);

  const visibleNotifications = useMemo(() => {
    if (!activeExpedition || !linkedMember) return [] as NotificationRow[];

    return [...(notificationRows as readonly NotificationRow[])]
      .filter(
        (row) =>
          row.expeditionId === activeExpedition.id &&
          row.recipientMemberId === linkedMember.id,
      )
      .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
      .slice(0, 20);
  }, [activeExpedition, linkedMember, notificationRows]);

  const unreadNotificationCount = useMemo(
    () => visibleNotifications.filter((notification) => !notification.isRead).length,
    [visibleNotifications],
  );

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
    if (!linkedMember) {
      setNotificationPrefs(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }

    const raw = localStorage.getItem(
      `${NOTIFICATION_PREFERENCES_STORAGE_KEY}:${linkedMember.id.toString()}`,
    );
    if (!raw) {
      setNotificationPrefs(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
      const reminderCadence =
        parsed.reminderCadence === "daily" || parsed.reminderCadence === "weekly" || parsed.reminderCadence === "off"
          ? parsed.reminderCadence
          : DEFAULT_NOTIFICATION_PREFERENCES.reminderCadence;

      setNotificationPrefs({
        inviteEvents: parsed.inviteEvents ?? DEFAULT_NOTIFICATION_PREFERENCES.inviteEvents,
        engagementEvents: parsed.engagementEvents ?? DEFAULT_NOTIFICATION_PREFERENCES.engagementEvents,
        milestoneEvents: parsed.milestoneEvents ?? DEFAULT_NOTIFICATION_PREFERENCES.milestoneEvents,
        reminderCadence,
        quietHoursStart: parsed.quietHoursStart ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursStart,
        quietHoursEnd: parsed.quietHoursEnd ?? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnd,
        timezone: parsed.timezone ?? DEFAULT_NOTIFICATION_PREFERENCES.timezone,
      });
    } catch {
      setNotificationPrefs(DEFAULT_NOTIFICATION_PREFERENCES);
    }
  }, [linkedMember]);

  useEffect(() => {
    if (!linkedMember) return;
    localStorage.setItem(
      `${NOTIFICATION_PREFERENCES_STORAGE_KEY}:${linkedMember.id.toString()}`,
      JSON.stringify(notificationPrefs),
    );
  }, [linkedMember, notificationPrefs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("strava_code");
    const callbackState = params.get("strava_state");
    const callbackError = params.get("strava_error");

    const cleanup = () => {
      params.delete("strava_code");
      params.delete("strava_state");
      params.delete("strava_scope");
      params.delete("strava_error");
      const next = params.toString();
      const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
      window.history.replaceState({}, document.title, url);
    };

    if (code || callbackError) {
      localStorage.setItem(
        STRAVA_PENDING_CALLBACK_STORAGE_KEY,
        JSON.stringify({
          code,
          state: callbackState,
          error: callbackError,
        }),
      );
      cleanup();
    }

    const pendingRaw = localStorage.getItem(STRAVA_PENDING_CALLBACK_STORAGE_KEY);
    if (!pendingRaw) return;

    let pending: { code: string | null; state: string | null; error: string | null } | null = null;
    try {
      pending = JSON.parse(pendingRaw) as { code: string | null; state: string | null; error: string | null };
    } catch {
      localStorage.removeItem(STRAVA_PENDING_CALLBACK_STORAGE_KEY);
      return;
    }

    if (!pending) {
      localStorage.removeItem(STRAVA_PENDING_CALLBACK_STORAGE_KEY);
      return;
    }

    if (pending.error) {
      setStravaStatus(`Strava link failed: ${pending.error}. Click Connect Strava to try again.`);
      localStorage.removeItem(STRAVA_PENDING_CALLBACK_STORAGE_KEY);
      localStorage.removeItem(STRAVA_STATE_STORAGE_KEY);
      return;
    }

    if (!pending.code) {
      localStorage.removeItem(STRAVA_PENDING_CALLBACK_STORAGE_KEY);
      return;
    }
    const pendingCode = pending.code;

    const expectedState = localStorage.getItem(STRAVA_STATE_STORAGE_KEY);
    if (!expectedState || pending.state !== expectedState) {
      setStravaStatus("Strava link failed: invalid OAuth state. Click Connect Strava to restart linking.");
      localStorage.removeItem(STRAVA_PENDING_CALLBACK_STORAGE_KEY);
      localStorage.removeItem(STRAVA_STATE_STORAGE_KEY);
      return;
    }

    if (!sub) {
      setStravaStatus("Strava link failed: sign in required. Sign in again, then click Connect Strava.");
      return;
    }

    if (!conn) {
      setStravaStatus("Strava callback received. Waiting for connection — keep this tab open.");
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
        await procedures.linkStravaAccount({ code: pendingCode, redirectUri });
        localStorage.removeItem(STRAVA_PENDING_CALLBACK_STORAGE_KEY);
        localStorage.removeItem(STRAVA_STATE_STORAGE_KEY);
        setStravaStatus("Strava linked. Use Sync now to import recent activities.");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("not connected")) {
          setStravaStatus("Strava callback received. Waiting for connection — keep this tab open.");
          return;
        }
        localStorage.removeItem(STRAVA_PENDING_CALLBACK_STORAGE_KEY);
        localStorage.removeItem(STRAVA_STATE_STORAGE_KEY);
        setStravaStatus(`Strava link failed: ${message}`);
      } finally {
        setIsLinkingStrava(false);
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

  function handleStartCheckout() {
    setBillingStatus("");
    if (!conn) {
      setBillingStatus("SpacetimeDB not connected");
      return;
    }
    if (!activeExpedition) {
      setBillingStatus("Select an active expedition first.");
      return;
    }
    if (!isOwner) {
      setBillingStatus("Only the expedition owner can start checkout.");
      return;
    }

    void (async () => {
      try {
        setIsStartingCheckout(true);
        const procedures = conn.procedures as {
          createCheckoutSession?: (args: { expeditionId: bigint }) => Promise<string>;
        };
        if (!procedures.createCheckoutSession) {
          setBillingStatus("Checkout unavailable until client bindings are regenerated.");
          return;
        }

        const checkoutUrl = await procedures.createCheckoutSession({
          expeditionId: activeExpedition.id,
        });
        if (checkoutUrl && checkoutUrl.startsWith("http")) {
          window.location.assign(checkoutUrl);
          return;
        }

        setBillingStatus("Checkout session could not be created. Verify Stripe config keys.");
      } catch (err) {
        setBillingStatus(err instanceof Error ? err.message : String(err));
      } finally {
        setIsStartingCheckout(false);
      }
    })();
  }

  function handleSetVisibility(visibility: "public" | "invite_only") {
    setVisibilityStatus("");
    if (!conn) {
      setVisibilityStatus("SpacetimeDB not connected");
      return;
    }
    if (!activeExpedition) {
      setVisibilityStatus("Select an active expedition first.");
      return;
    }
    if (!isOwner) {
      setVisibilityStatus("Only the expedition owner can change visibility.");
      return;
    }

    try {
      const reducers = conn.reducers as {
        setExpeditionVisibility?: (args: { expeditionId: bigint; visibility: string }) => void;
      };
      if (!reducers.setExpeditionVisibility) {
        setVisibilityStatus("Visibility controls unavailable until client bindings are regenerated.");
        return;
      }

      reducers.setExpeditionVisibility({
        expeditionId: activeExpedition.id,
        visibility,
      });
      setVisibilityStatus(`Visibility updated to ${visibility === "invite_only" ? "invite-only" : "public"}.`);
    } catch (err) {
      setVisibilityStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function handleMarkNotificationRead(notificationId: bigint) {
    setNotificationStatus("");
    if (!conn) {
      setNotificationStatus("SpacetimeDB not connected");
      return;
    }

    try {
      setMarkingNotificationId(notificationId);
      conn.reducers.markNotificationRead({ notificationId });
    } catch (err) {
      setNotificationStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setMarkingNotificationId(null);
    }
  }

  function handleDeleteExpedition() {
    setDeleteStatus("");
    if (!conn) {
      setDeleteStatus("SpacetimeDB not connected");
      return;
    }
    if (!activeExpedition) {
      setDeleteStatus("Select an active expedition first.");
      return;
    }
    if (!isOwner) {
      setDeleteStatus("Only the expedition owner can delete this expedition.");
      return;
    }

    const confirmed = window.confirm(
      `Delete expedition \"${activeExpedition.name}\" permanently? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsDeletingExpedition(true);
      const reducers = conn.reducers as {
        deleteExpedition?: (args: { expeditionId: bigint }) => void;
      };
      if (!reducers.deleteExpedition) {
        setDeleteStatus("Delete expedition unavailable until client bindings are regenerated.");
        return;
      }

      reducers.deleteExpedition({ expeditionId: activeExpedition.id });
      setDeleteStatus("Expedition delete requested.");
    } catch (err) {
      setDeleteStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDeletingExpedition(false);
    }
  }

  function updateNotificationPrefs(
    patch: Partial<NotificationPreferences>,
  ) {
    setNotificationPrefs((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="settings-panel">
      <h2>Settings</h2>

      <section className="settings-group">
        <h3>Profile & Identity</h3>
        <p>Set the display name and color used across your expedition activity.</p>
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
        <h3>Expedition Space</h3>
        <p>
          {activeExpedition
            ? `Active expedition: ${activeExpedition.name} (${activeExpedition.slug})`
            : "No active expedition selected."}
        </p>
        {activeExpeditionRow && (
          <p>
            Visibility: {activeExpeditionRow.inviteOnly ? "Invite-only" : "Public"}
          </p>
        )}
        <div className="strava-actions">
          <button
            type="button"
            onClick={() => handleSetVisibility("public")}
            disabled={!activeExpedition || !isOwner || !activeExpeditionRow?.inviteOnly}
          >
            Set public
          </button>
          <button
            type="button"
            onClick={() => handleSetVisibility("invite_only")}
            disabled={!activeExpedition || !isOwner || Boolean(activeExpeditionRow?.inviteOnly)}
          >
            Set invite-only
          </button>
        </div>
        {!isOwner && activeExpedition && <p>Only the current owner can change expedition visibility.</p>}
        {visibilityStatus && <p className="field-error">{visibilityStatus}</p>}
        <div className="strava-actions">
          <button
            type="button"
            onClick={handleDeleteExpedition}
            disabled={!activeExpedition || !isOwner || isDeletingExpedition}
          >
            {isDeletingExpedition ? "Deleting…" : "Delete expedition"}
          </button>
        </div>
        {!isOwner && activeExpedition && <p>Only the current owner can delete this expedition.</p>}
        {deleteStatus && <p className="field-error">{deleteStatus}</p>}
      </section>

      <section className="settings-group">
        <h3>Billing</h3>
        <p>Compare plan tiers and upgrade when limits block expedition actions.</p>

        <div className="pricing-list">
          {PRICING_TIERS.map((tier) => (
            <div key={tier.name} className="pricing-row">
              <span className="pricing-name">{tier.name}</span>
              <span className="pricing-summary">{tier.summary}</span>
            </div>
          ))}
        </div>

        {!activeExpedition ? (
          <p>Select an active expedition to view billing state.</p>
        ) : (
          <>
            {activePlanSubscription ? (
              <p>
                Plan: {activePlanSubscription.planCode} · Status: {activePlanSubscription.status} · Seats: {activePlanSubscription.seatLimit}
              </p>
            ) : (
              <p>No subscription record for this expedition yet.</p>
            )}

            {activeEntitlements.length > 0 && (
              <div className="invite-list">
                {activeEntitlements.map((entitlement) => (
                  <div key={String(entitlement.id)} className="invite-row">
                    <span className="invite-token">{entitlement.featureKey}</span>
                    <span className="invite-meta">
                      {entitlement.enabled ? "enabled" : "disabled"} · limit {entitlement.limitValue}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="strava-actions">
              <button type="button" onClick={handleStartCheckout} disabled={!isOwner || isStartingCheckout}>
                {isStartingCheckout ? "Starting checkout…" : "Upgrade now"}
              </button>
            </div>

            {!isOwner && <p>Only the current owner can start checkout.</p>}
          </>
        )}
        {billingStatus && <p className="field-error">{billingStatus}</p>}
      </section>

      <section className="settings-group">
        <h3>Notifications</h3>
        <p>Review expedition activity alerts and configure reminder/engagement preferences.</p>

        <div className="settings-subgroup">
          <h4>Event Preferences</h4>
          <div className="notification-preferences">
            <label>
              <input
                type="checkbox"
                checked={notificationPrefs.inviteEvents}
                onChange={(e) => updateNotificationPrefs({ inviteEvents: e.target.checked })}
              />
              Invite updates
            </label>
            <label>
              <input
                type="checkbox"
                checked={notificationPrefs.engagementEvents}
                onChange={(e) => updateNotificationPrefs({ engagementEvents: e.target.checked })}
              />
              Comments and reactions
            </label>
            <label>
              <input
                type="checkbox"
                checked={notificationPrefs.milestoneEvents}
                onChange={(e) => updateNotificationPrefs({ milestoneEvents: e.target.checked })}
              />
              Activity milestones
            </label>
          </div>
        </div>

        <div className="settings-subgroup">
          <h4>Reminders</h4>
          <div className="strava-actions">
            <select
              className="invite-input"
              aria-label="Reminder cadence"
              value={notificationPrefs.reminderCadence}
              onChange={(e) =>
                updateNotificationPrefs({ reminderCadence: e.target.value as ReminderCadence })
              }
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <input
              type="time"
              className="invite-input"
              aria-label="Quiet hours start"
              value={notificationPrefs.quietHoursStart}
              onChange={(e) => updateNotificationPrefs({ quietHoursStart: e.target.value })}
            />
            <input
              type="time"
              className="invite-input"
              aria-label="Quiet hours end"
              value={notificationPrefs.quietHoursEnd}
              onChange={(e) => updateNotificationPrefs({ quietHoursEnd: e.target.value })}
            />
          </div>
          <div className="strava-actions">
            <input
              type="text"
              className="invite-input"
              aria-label="Timezone"
              value={notificationPrefs.timezone}
              onChange={(e) => updateNotificationPrefs({ timezone: e.target.value.trim() || "UTC" })}
              placeholder="Timezone (e.g. Australia/Sydney)"
            />
          </div>
        </div>

        <div className="settings-subgroup">
          <h4>Notification Center {unreadNotificationCount > 0 ? `(Unread: ${unreadNotificationCount})` : ""}</h4>
          {!activeExpedition || !linkedMember ? (
            <p>Select an active expedition to view notifications.</p>
          ) : visibleNotifications.length === 0 ? (
            <p>No notifications yet for this expedition.</p>
          ) : (
            <div className="notification-list">
              {visibleNotifications.map((notification) => (
                <div key={notification.id.toString()} className={`notification-row ${notification.isRead ? "" : "unread"}`}>
                  <div className="notification-copy">
                    <span className="notification-title">{notification.title}</span>
                    <span className="notification-meta">
                      {notification.body} · {notification.createdAt.toDate().toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMarkNotificationRead(notification.id)}
                    disabled={notification.isRead || markingNotificationId === notification.id}
                  >
                    {notification.isRead
                      ? "Read"
                      : markingNotificationId === notification.id
                        ? "Marking…"
                        : "Mark read"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {notificationStatus && <p className="field-error">{notificationStatus}</p>}
      </section>

      <section className="settings-group">
        <h3>Integrations</h3>
        <p>Connect services that can automatically sync activity into your expedition.</p>
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

      <section className="settings-group">
        <h3>Display Preferences</h3>
        <p>Adjust how the app looks and how route progress is represented.</p>

        <div className="settings-subgroup">
          <h4>Theme</h4>
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
        </div>

        <div className="settings-subgroup">
          <h4>Map View Mode</h4>
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
        </div>

        <div className="settings-subgroup">
          <h4>Distance Units</h4>
          <div className="theme-toggle" role="group" aria-label="Distance Units">
            <button
              className={distanceUnit === "km" ? "active" : ""}
              onClick={() => onDistanceUnitChange("km")}
              type="button"
            >
              Kilometers
            </button>
            <button
              className={distanceUnit === "mi" ? "active" : ""}
              onClick={() => onDistanceUnitChange("mi")}
              type="button"
            >
              Miles
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}