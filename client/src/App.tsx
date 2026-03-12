import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { MapJournalView } from "./components/MapView/MapJournalView";
import { MapView } from "./components/MapView/MapView";
import { MembersPanel } from "./components/MembersPanel/MembersPanel";
import { SettingsPanel } from "./components/SettingsPanel/SettingsPanel";
import { ActivityFeed } from "./components/LogView/ActivityFeed";
import { LogForm } from "./components/LogView/LogForm";
import { SummaryStats } from "./components/StatsView/SummaryStats";
import { ActivityTypeChart } from "./components/StatsView/ActivityTypeChart";
import { PersonBreakdown } from "./components/StatsView/PersonBreakdown";
import { LandmarksPassed } from "./components/StatsView/LandmarksPassed";
import { useAuth } from "react-oidc-context";
import { useMembers } from "./hooks/useMembers";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { DbConnection, tables } from "./spacetime/generated";
import { emitExpeditionEvent } from "./hooks/expeditionEvents";
import { OBS_EVENT_NAME, getSessionTraceId } from "./observability/telemetry";
import { ROUTE_TOTAL_KM } from "./config";
import { LANDMARKS } from "./data/route";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import "./App.css";

type AppTab = "dashboard" | "map" | "feed" | "stats" | "members" | "settings";
type Theme = "dark" | "light";
type MapMode = "asRan" | "contribution";

const THEME_STORAGE_KEY = "expedition-theme";
const MAP_MODE_STORAGE_KEY = "expedition-map-mode";
const ACTIVE_EXPEDITION_STORAGE_KEY = "expedition-active-id";
const BETA_SUPPORT_TICKETS_STORAGE_KEY = "expedition-beta-support-tickets";

interface ExpeditionRow {
  id: bigint;
  name: string;
  slug: string;
  isArchived: boolean;
}

interface MembershipRow {
  id: bigint;
  expeditionId: bigint;
  memberId: bigint;
  status: string;
  leftAt: unknown;
}

interface ActivityLogRow {
  id: bigint;
  expeditionId: bigint;
  memberId: bigint;
  distanceKm: number;
  timestamp: { toDate: () => Date };
}

interface NotificationRow {
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
}

type BugSeverity = "low" | "medium" | "high" | "blocker";

interface SupportTicketDraft {
  id: string;
  summary: string;
  category: string;
  source: string;
  impact: string;
  frequency: string;
  reproSteps: string;
  severity: BugSeverity;
  status: "new";
  owner: string;
  nextAction: string;
  feedbackTag: string;
  createdAtIso: string;
  triagedAtIso: string | null;
  firstResponseAtIso: string | null;
  closedAtIso: string | null;
}

interface AnalyticsReducers {
  trackProductEvent?: (args: {
    eventName: string;
    expeditionId: bigint;
    payloadJson: string;
  }) => void;
}

function parsePersistedExpeditionId(raw: string | null): bigint | null {
  if (!raw) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function toSlug(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `expedition-${Date.now()}`;
}

function loadInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function loadInitialMapMode(): MapMode {
  const stored = localStorage.getItem(MAP_MODE_STORAGE_KEY);
  if (stored === "asRan" || stored === "contribution") {
    return stored;
  }

  return "asRan";
}

export default function App() {
  const [tab, setTab] = useState<AppTab>("dashboard");
  const [theme, setTheme] = useState<Theme>(loadInitialTheme);
  const [mapMode, setMapMode] = useState<MapMode>(loadInitialMapMode);
  const [activeExpeditionId, setActiveExpeditionId] = useState<bigint | null>(null);
  const [activeResolved, setActiveResolved] = useState(false);
  const [newExpeditionName, setNewExpeditionName] = useState("");
  const [isCreatingExpedition, setIsCreatingExpedition] = useState(false);
  const [expeditionCreateError, setExpeditionCreateError] = useState("");
  const [pendingCreatedSlug, setPendingCreatedSlug] = useState<string | null>(null);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [bugSummary, setBugSummary] = useState("");
  const [bugReproSteps, setBugReproSteps] = useState("");
  const [bugNextAction, setBugNextAction] = useState("");
  const [bugCategory, setBugCategory] = useState("bug");
  const [bugSeverity, setBugSeverity] = useState<BugSeverity>("medium");
  const [bugStatus, setBugStatus] = useState("");
  const [markingNotificationId, setMarkingNotificationId] = useState<bigint | null>(null);
  const [notificationStatus, setNotificationStatus] = useState("");
  const auth = useAuth();
  const { members } = useMembers();
  const connectionState = useSpacetimeDB();
  const [expeditionRows] = useTable(tables.expedition);
  const [membershipRows] = useTable(tables.membership);
  const [activityLogRows] = useTable(tables.activity_log);
  const [notificationRows] = useTable(tables.notification);

  const sub = auth.user?.profile?.sub as string | undefined;
  const isRegistered = members.some((m) => sub != null && m.ownerSub === sub);
  const linkedMember = members.find((m) => sub != null && m.ownerSub === sub) ?? null;

  const expeditions = useMemo(
    () =>
      [...(expeditionRows as readonly ExpeditionRow[])]
        .filter((expedition) => !expedition.isArchived)
        .sort((a, b) => Number(a.id - b.id)),
    [expeditionRows],
  );

  const memberships = useMemo(() => membershipRows as readonly MembershipRow[], [membershipRows]);

  const availableExpeditions = useMemo(() => {
    if (!linkedMember) return [];

    const allowedExpeditionIds = new Set(
      memberships
        .filter(
          (membership) =>
            membership.memberId === linkedMember.id &&
            membership.leftAt == null &&
            membership.status.toLowerCase() !== "left",
        )
        .map((membership) => membership.expeditionId.toString()),
    );

    return expeditions.filter((expedition) => allowedExpeditionIds.has(expedition.id.toString()));
  }, [linkedMember, memberships, expeditions]);

  const activeExpedition = useMemo(
    () => availableExpeditions.find((expedition) => expedition.id === activeExpeditionId) ?? null,
    [availableExpeditions, activeExpeditionId],
  );

  const desktopNavTabs: AppTab[] = ["dashboard", "map", "feed", "stats", "members", "settings"];
  const mobileNavTabs: AppTab[] = ["dashboard", "map", "feed", "stats"];

  const scopedActivity = useMemo(() => {
    if (activeExpeditionId == null) return [];
    return (activityLogRows as readonly ActivityLogRow[])
      .filter((row) => row.expeditionId === activeExpeditionId)
      .sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
  }, [activityLogRows, activeExpeditionId]);

  const visibleNotifications = useMemo(() => {
    if (!activeExpeditionId || !linkedMember) return [] as NotificationRow[];

    return [...(notificationRows as readonly NotificationRow[])]
      .filter(
        (row) =>
          row.expeditionId === activeExpeditionId &&
          row.recipientMemberId === linkedMember.id,
      )
      .sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime())
      .slice(0, 20);
  }, [activeExpeditionId, linkedMember, notificationRows]);

  const unreadNotificationCount = useMemo(
    () => visibleNotifications.filter((notification) => !notification.isRead).length,
    [visibleNotifications],
  );

  const dashboardMetrics = useMemo(() => {
    const now = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;

    const totalKm = scopedActivity.reduce((sum, row) => sum + row.distanceKm, 0);
    const weeklyKm = scopedActivity
      .filter((row) => row.timestamp.toDate().getTime() >= weekStart)
      .reduce((sum, row) => sum + row.distanceKm, 0);

    const activeToday = new Set(
      scopedActivity
        .filter((row) => row.timestamp.toDate().getTime() >= dayStart.getTime())
        .map((row) => row.memberId.toString()),
    ).size;

    const activeWeek = new Set(
      scopedActivity
        .filter((row) => row.timestamp.toDate().getTime() >= weekStart)
        .map((row) => row.memberId.toString()),
    ).size;

    const completionPct = Math.min((totalKm / ROUTE_TOTAL_KM) * 100, 100);
    const nextLandmark = LANDMARKS.find((landmark) => landmark.km > totalKm) ?? LANDMARKS[LANDMARKS.length - 1];
    const remainingToLandmark = Math.max(nextLandmark.km - totalKm, 0);

    return {
      totalKm,
      weeklyKm,
      activeToday,
      activeWeek,
      completionPct,
      nextLandmark,
      remainingToLandmark,
    };
  }, [scopedActivity]);

  function tabLabel(value: AppTab): string {
    switch (value) {
      case "dashboard":
        return "Dashboard";
      case "map":
        return "Map";
      case "feed":
        return "Activity Feed";
      case "stats":
        return "Stats";
      case "members":
        return "Members";
      case "settings":
        return "Settings";
      default:
        return value;
    }
  }

  function openBugReport() {
    setBugStatus("");
    setIsBugReportOpen(true);
  }

  function openQuickLog() {
    setIsQuickLogOpen(true);
  }

  function closeQuickLog() {
    setIsQuickLogOpen(false);
  }

  function openNotifications() {
    setNotificationStatus("");
    setIsNotificationsOpen(true);
  }

  function closeNotifications() {
    setIsNotificationsOpen(false);
    setNotificationStatus("");
  }

  function closeBugReport() {
    setIsBugReportOpen(false);
    setBugStatus("");
  }

  function handleMarkNotificationRead(notificationId: bigint) {
    setNotificationStatus("");
    if (!connectionState.getConnection()) {
      setNotificationStatus("SpacetimeDB not connected");
      return;
    }

    try {
      setMarkingNotificationId(notificationId);
      connectionState.getConnection()?.reducers.markNotificationRead({ notificationId });
    } catch (err) {
      setNotificationStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setMarkingNotificationId(null);
    }
  }

  function handleSubmitBugReport(e: FormEvent) {
    e.preventDefault();
    setBugStatus("");

    if (!activeExpedition || !linkedMember) {
      setBugStatus("Select an active expedition and linked profile first.");
      return;
    }

    if (!bugSummary.trim()) {
      setBugStatus("Issue summary is required.");
      return;
    }

    if (!bugReproSteps.trim()) {
      setBugStatus("Repro steps are required.");
      return;
    }

    if (!bugNextAction.trim()) {
      setBugStatus("Next action is required.");
      return;
    }

    const key = `${BETA_SUPPORT_TICKETS_STORAGE_KEY}:${linkedMember.id.toString()}:${activeExpedition.id.toString()}`;
    const now = new Date().toISOString();
    const feedbackTag = `beta-feedback:${bugCategory}:${bugSeverity}`;

    const nextTicket: SupportTicketDraft = {
      id: crypto.randomUUID(),
      summary: bugSummary.trim(),
      category: bugCategory,
      source: "in_app",
      impact: bugSeverity === "blocker" || bugSeverity === "high" ? "high" : "medium",
      frequency: "single",
      reproSteps: bugReproSteps.trim(),
      severity: bugSeverity,
      status: "new",
      owner: "unassigned",
      nextAction: bugNextAction.trim(),
      feedbackTag,
      createdAtIso: now,
      triagedAtIso: null,
      firstResponseAtIso: null,
      closedAtIso: null,
    };

    let existingTickets: SupportTicketDraft[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          existingTickets = parsed as SupportTicketDraft[];
        }
      }
    } catch {
      existingTickets = [];
    }

    localStorage.setItem(key, JSON.stringify([nextTicket, ...existingTickets]));
    trackProductEvent(
      "beta_support_ticket_submitted",
      {
        ticketId: nextTicket.id,
        severity: nextTicket.severity,
        category: nextTicket.category,
      },
      activeExpedition.id,
    );

    setBugSummary("");
    setBugReproSteps("");
    setBugNextAction("");
    setBugCategory("bug");
    setBugSeverity("medium");
    setBugStatus("Bug report submitted.");
    window.setTimeout(() => setIsBugReportOpen(false), 400);
  }

  function trackProductEvent(
    eventName: string,
    payload: Record<string, unknown>,
    expeditionId?: bigint | null,
  ) {
    try {
      const conn = connectionState.getConnection() as DbConnection | null;
      if (!conn) return;
      const reducers = conn.reducers as AnalyticsReducers;
      if (!reducers.trackProductEvent) return;

      reducers.trackProductEvent({
        eventName,
        expeditionId: expeditionId ?? 0n,
        payloadJson: JSON.stringify({ traceId: getSessionTraceId(), ...payload }),
      });
    } catch {}
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(MAP_MODE_STORAGE_KEY, mapMode);
  }, [mapMode]);

  useEffect(() => {
    const trackedEvents = [
      "expedition_switch_success",
      "expedition_switch_failure",
      "expedition_create_success",
      "expedition_create_failure",
      "expedition_restore_success",
      "expedition_restore_failure",
    ] as const;

    const listeners = trackedEvents.map((eventName) => {
      const handler = (event: Event) => {
        const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
        const rawExpeditionId = detail.expeditionId;
        const expeditionId =
          typeof rawExpeditionId === "string" && rawExpeditionId.trim().length > 0
            ? BigInt(rawExpeditionId)
            : activeExpeditionId ?? 0n;

        trackProductEvent(eventName, detail, expeditionId);
      };

      window.addEventListener(eventName, handler as EventListener);
      return { eventName, handler };
    });

    return () => {
      for (const listener of listeners) {
        window.removeEventListener(listener.eventName, listener.handler as EventListener);
      }
    };
  }, [activeExpeditionId, connectionState]);

  useEffect(() => {
    trackProductEvent(
      "ui_tab_changed",
      { tab },
      activeExpeditionId,
    );
  }, [tab, activeExpeditionId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail ?? {};
      const rawExpeditionId = detail.expeditionId;
      const expeditionId =
        typeof rawExpeditionId === "string" && rawExpeditionId.trim().length > 0
          ? BigInt(rawExpeditionId)
          : activeExpeditionId ?? 0n;

      trackProductEvent("client_observability_signal", detail, expeditionId);
    };

    window.addEventListener(OBS_EVENT_NAME, handler as EventListener);
    return () => {
      window.removeEventListener(OBS_EVENT_NAME, handler as EventListener);
    };
  }, [activeExpeditionId, connectionState]);

  useEffect(() => {
    if (!linkedMember) {
      setActiveResolved(true);
      setActiveExpeditionId(null);
      return;
    }

    if (availableExpeditions.length === 0) {
      setActiveResolved(true);
      setActiveExpeditionId(null);
      return;
    }

    const activeIsValid =
      activeExpeditionId != null &&
      availableExpeditions.some((expedition) => expedition.id === activeExpeditionId);

    if (activeIsValid) {
      setActiveResolved(true);
      return;
    }

    const persistedRaw = localStorage.getItem(ACTIVE_EXPEDITION_STORAGE_KEY);
    const persisted = parsePersistedExpeditionId(persistedRaw);
    const restored =
      persisted != null
        ? availableExpeditions.find((expedition) => expedition.id === persisted) ?? null
        : null;

    if (restored) {
      setActiveExpeditionId(restored.id);
      localStorage.setItem(ACTIVE_EXPEDITION_STORAGE_KEY, restored.id.toString());
      emitExpeditionEvent("expedition_restore_success", {
        source: "localStorage",
        expeditionId: restored.id.toString(),
      });
      setActiveResolved(true);
      return;
    }

    const fallback = availableExpeditions[0];
    setActiveExpeditionId(fallback.id);
    localStorage.setItem(ACTIVE_EXPEDITION_STORAGE_KEY, fallback.id.toString());
    if (persistedRaw) {
      emitExpeditionEvent("expedition_restore_failure", {
        reason: persisted == null ? "invalid" : "stale",
        persistedId: persistedRaw,
        fallbackExpeditionId: fallback.id.toString(),
      });
    } else {
      emitExpeditionEvent("expedition_restore_success", {
        source: "fallback_first_available",
        expeditionId: fallback.id.toString(),
      });
    }
    setActiveResolved(true);
  }, [linkedMember, availableExpeditions, activeExpeditionId]);

  useEffect(() => {
    if (!pendingCreatedSlug) return;
    const created = availableExpeditions.find((expedition) => expedition.slug === pendingCreatedSlug);
    if (!created) return;

    setPendingCreatedSlug(null);
    setActiveExpeditionId(created.id);
    localStorage.setItem(ACTIVE_EXPEDITION_STORAGE_KEY, created.id.toString());
    emitExpeditionEvent("expedition_create_success", {
      expeditionId: created.id.toString(),
      slug: created.slug,
      autoSelected: true,
    });
    emitExpeditionEvent("expedition_switch_success", {
      expeditionId: created.id.toString(),
      reason: "created_auto_select",
    });
    setNewExpeditionName("");
    setExpeditionCreateError("");
  }, [pendingCreatedSlug, availableExpeditions]);

  function handleSwitchExpedition(expeditionIdRaw: string) {
    const parsed = parsePersistedExpeditionId(expeditionIdRaw);
    if (parsed == null) {
      emitExpeditionEvent("expedition_switch_failure", {
        reason: "invalid_id",
        value: expeditionIdRaw,
      });
      return;
    }

    const next = availableExpeditions.find((expedition) => expedition.id === parsed);
    if (!next) {
      emitExpeditionEvent("expedition_switch_failure", {
        reason: "unauthorized_or_missing",
        expeditionId: parsed.toString(),
      });
      return;
    }

    setActiveExpeditionId(next.id);
    localStorage.setItem(ACTIVE_EXPEDITION_STORAGE_KEY, next.id.toString());
    emitExpeditionEvent("expedition_switch_success", {
      expeditionId: next.id.toString(),
      reason: "manual",
    });
  }

  async function handleCreateExpedition(name: string): Promise<boolean> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setExpeditionCreateError("Expedition name is required");
      emitExpeditionEvent("expedition_create_failure", { reason: "empty_name" });
      return false;
    }

    const slug = toSlug(trimmedName);
    setExpeditionCreateError("");
    setIsCreatingExpedition(true);
    try {
      const conn = connectionState.getConnection() as DbConnection | null;
      if (!conn) throw new Error("SpacetimeDB not connected");
      conn.reducers.createExpedition({ name: trimmedName, slug });
      setPendingCreatedSlug(slug);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setExpeditionCreateError(message);
      emitExpeditionEvent("expedition_create_failure", {
        reason: "reducer_error",
        message,
        slug,
      });
      return false;
    } finally {
      setIsCreatingExpedition(false);
    }
  }

  function handleHeaderCreate(e: FormEvent) {
    e.preventDefault();
    void handleCreateExpedition(newExpeditionName);
  }

  const expeditionLoading = linkedMember != null && !activeResolved;
  const hasNoMembership = linkedMember != null && activeResolved && availableExpeditions.length === 0;

  const completionLabel =
    dashboardMetrics.completionPct > 0 && dashboardMetrics.completionPct < 0.1
      ? "<0.1% complete"
      : `${dashboardMetrics.completionPct.toFixed(1)}% complete`;
  const journeyMessage =
    dashboardMetrics.totalKm < 5
      ? "First steps on the route — your team has started the journey together."
      : "Every session keeps the team moving forward on the shared route.";

  return (
    <div className="app">
      <div className="app-shell">
        <aside className="shell-sidebar">
          <div className="sidebar-top">
            <Typography variant="h6" className="app-title">
              Expedition
            </Typography>
            {isRegistered && (
              <div className="expedition-controls sidebar-expedition-switcher">
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="active-expedition-select-label">Expedition</InputLabel>
                  <Select
                    labelId="active-expedition-select-label"
                    id="active-expedition-select"
                    value={activeExpeditionId?.toString() ?? ""}
                    label="Expedition"
                    onChange={(e) => handleSwitchExpedition(e.target.value)}
                    disabled={!availableExpeditions.length}
                  >
                    {!availableExpeditions.length && <MenuItem value="">No active expeditions</MenuItem>}
                    {availableExpeditions.map((expedition) => (
                      <MenuItem key={expedition.id.toString()} value={expedition.id.toString()}>
                        {expedition.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            )}
          </div>

          <nav className="sidebar-nav" aria-label="Primary">
            {desktopNavTabs.map((navTab) => (
              <button
                key={navTab}
                type="button"
                className={`sidebar-nav-item ${tab === navTab ? "active" : ""}`}
                onClick={() => setTab(navTab)}
              >
                {tabLabel(navTab)}
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-user">
              <Avatar>{(linkedMember?.name?.[0] ?? "U").toUpperCase()}</Avatar>
              <div>
                <p className="sidebar-user-name">{linkedMember?.name ?? "Your Profile"}</p>
                <p className="sidebar-user-subtle">Strava status in Settings</p>
              </div>
            </div>
            <Button variant="outlined" onClick={openBugReport}>Report bug</Button>
            <Button variant="text" color="inherit" onClick={() => auth.signoutRedirect()}>
              Sign out
            </Button>
          </div>
        </aside>

        <main className={`app-main ${tab === "map" ? "expedition-main" : ""}`}>
          <div className="main-page-head">
            <div>
              <Typography variant="h5" className="page-title">{tabLabel(tab)}</Typography>
              <Typography variant="body2" className="page-subtitle">
                {activeExpedition?.name ?? "Shared route and team momentum"}
              </Typography>
            </div>
            <div className="page-actions">
              <Button
                variant="outlined"
                onClick={openNotifications}
                disabled={activeExpeditionId == null || expeditionLoading || hasNoMembership}
              >
                🔔 {unreadNotificationCount > 0 ? `(${unreadNotificationCount})` : ""}
              </Button>
              <Button
                variant="contained"
                onClick={openQuickLog}
                disabled={activeExpeditionId == null || expeditionLoading || hasNoMembership}
              >
                Log Activity
              </Button>
              <Button variant="outlined" onClick={() => setTab("members")}>Invite Members</Button>
              <Button variant="outlined" onClick={openBugReport}>Report bug</Button>
            </div>
          </div>

        {expeditionLoading && (
          <Box className="status-row">
            <CircularProgress size={18} />
            <Typography variant="body2">Loading expeditions…</Typography>
          </Box>
        )}
        {hasNoMembership && (
          <Paper className="empty-state" variant="outlined">
            <Typography variant="body1">You are not in an expedition yet. Create one to get started.</Typography>
            <Box className="empty-state-create" component="form" onSubmit={handleHeaderCreate}>
              <TextField
                size="small"
                value={newExpeditionName}
                onChange={(e) => setNewExpeditionName(e.target.value)}
                placeholder="Expedition name"
                inputProps={{ maxLength: 64 }}
              />
              <Button type="submit" variant="contained" disabled={isCreatingExpedition}>
                {isCreatingExpedition ? "Creating…" : "Create expedition"}
              </Button>
            </Box>
            {expeditionCreateError && <Alert severity="error">{expeditionCreateError}</Alert>}
          </Paper>
        )}
        {!isRegistered && (
          <Alert
            severity="info"
            className="onboarding-alert"
            action={
              <Button color="inherit" size="small" onClick={() => setTab("settings")}>
                Open Settings
              </Button>
            }
          >
            Complete onboarding in Settings: set your profile name and color, then create or join an expedition to unlock activity logging.
          </Alert>
        )}

        {tab === "dashboard" && activeExpeditionId != null && !expeditionLoading && !hasNoMembership && (
          <div className="dashboard-layout">
            <section className="dashboard-hero">
              <div className="dashboard-hero-copy">
                <p className="hero-kicker">{activeExpedition?.name ?? "Current Expedition"}</p>
                <h2 className="hero-progress-number">{dashboardMetrics.totalKm.toFixed(1)} km</h2>
                <p>{completionLabel} of {ROUTE_TOTAL_KM.toLocaleString()} km route</p>
                <p>{dashboardMetrics.remainingToLandmark.toFixed(1)} km to {dashboardMetrics.nextLandmark.name}</p>
                <p className="hero-message">{journeyMessage}</p>
                <div className="hero-meta-row">
                  <span>+{dashboardMetrics.weeklyKm.toFixed(1)} km this week</span>
                  <span>{dashboardMetrics.activeToday} members active today</span>
                </div>
              </div>
              <div className="dashboard-map-preview">
                <MapView
                  theme={theme}
                  mode={mapMode}
                  onModeChange={setMapMode}
                  hubOpen={false}
                  activeExpeditionId={activeExpeditionId}
                />
              </div>
            </section>

            <section className="dashboard-cards-row">
              <Paper className="dashboard-card" variant="outlined">
                <h3>Team Momentum</h3>
                <p>{dashboardMetrics.weeklyKm.toFixed(1)} km this week</p>
                <p>{dashboardMetrics.activeWeek} members active in the last 7 days</p>
              </Paper>
              <Paper className="dashboard-card" variant="outlined">
                <h3>Your Contribution</h3>
                <p>View your latest movement and consistency in Feed and Stats.</p>
                <Button variant="text" onClick={() => setTab("feed")}>Open Activity Feed</Button>
              </Paper>
              <Paper className="dashboard-card milestone-card" variant="outlined">
                <h3>Next Milestone</h3>
                <p>{dashboardMetrics.nextLandmark.name}</p>
                <p>{dashboardMetrics.remainingToLandmark.toFixed(1)} km remaining</p>
              </Paper>
            </section>

            <section className="dashboard-lower">
              <Paper className="dashboard-feed" variant="outlined">
                <h3>Activity Feed</h3>
                {scopedActivity.length <= 1 && (
                  <p className="low-activity-note">Low activity so far — each new log will make the team journey feel more alive here.</p>
                )}
                <ActivityFeed activeExpeditionId={activeExpeditionId} />
              </Paper>
              <aside className="dashboard-insights">
                <Paper className="coach-card" variant="outlined">
                  <h4>Coach</h4>
                  <p>
                    {dashboardMetrics.weeklyKm > 0
                      ? "Great momentum this week. A mid-week push can bring the next landmark into reach faster."
                      : "Start the route with one activity today. Every distance entry moves the whole team forward."}
                  </p>
                </Paper>
                <Paper className="dashboard-chip-card" variant="outlined">
                  <h4>Today</h4>
                  <p>{dashboardMetrics.activeToday} contributors logged today</p>
                </Paper>
              </aside>
            </section>
          </div>
        )}

        {tab === "map" && activeExpeditionId != null && !expeditionLoading && !hasNoMembership && (
          <MapJournalView
            theme={theme}
            mapMode={mapMode}
            onMapModeChange={setMapMode}
            activeExpeditionId={activeExpeditionId}
          />
        )}

        {tab === "feed" && activeExpeditionId != null && !expeditionLoading && !hasNoMembership && (
          <div className="content-shell">
            <div className="feed-shell">
              {scopedActivity.length <= 1 && (
                <Paper className="low-activity-note-card" variant="outlined">
                  <h3>Team Feed</h3>
                  <p>
                    This timeline gets richer as more members log activities. Start with quick notes and reactions to build momentum.
                  </p>
                </Paper>
              )}
              <ActivityFeed activeExpeditionId={activeExpeditionId} />
            </div>
          </div>
        )}

        {tab === "stats" && activeExpeditionId != null && !expeditionLoading && !hasNoMembership && (
          <div className="content-shell">
            <div className="stats-shell">
              <SummaryStats activeExpeditionId={activeExpeditionId} />
              <ActivityTypeChart activeExpeditionId={activeExpeditionId} />
              <PersonBreakdown activeExpeditionId={activeExpeditionId} />
              <LandmarksPassed activeExpeditionId={activeExpeditionId} />
            </div>
          </div>
        )}

        {tab === "members" && activeExpeditionId != null && !expeditionLoading && !hasNoMembership && (
          <div className="content-shell">
            <div className="members-shell">
              <MembersPanel activeExpeditionId={activeExpeditionId} />
            </div>
          </div>
        )}
        {tab === "settings" && !expeditionLoading && (
          <div className="content-shell">
            <div className="settings-shell">
              <SettingsPanel
                theme={theme}
                onThemeChange={setTheme}
                mapMode={mapMode}
                onMapModeChange={setMapMode}
                activeExpedition={activeExpedition}
                onCreateExpedition={handleCreateExpedition}
                isCreatingExpedition={isCreatingExpedition}
                expeditionCreateError={expeditionCreateError}
              />
            </div>
          </div>
        )}

        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile">
        {mobileNavTabs.map((navTab) => (
          <button
            key={navTab}
            type="button"
            className={tab === navTab ? "active" : ""}
            onClick={() => setTab(navTab)}
          >
            {navTab === "dashboard" ? "Home" : tabLabel(navTab)}
          </button>
        ))}
      </nav>

      <Dialog open={isQuickLogOpen} onClose={closeQuickLog} fullWidth maxWidth="sm">
        <DialogTitle>Log activity</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
          {activeExpeditionId != null && !expeditionLoading && !hasNoMembership ? (
            <LogForm activeExpeditionId={activeExpeditionId} />
          ) : (
            <Typography variant="body2" className="page-subtitle">
              Select or create an expedition first.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeQuickLog}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isNotificationsOpen} onClose={closeNotifications} fullWidth maxWidth="sm">
        <DialogTitle>
          Notifications {unreadNotificationCount > 0 ? `(Unread: ${unreadNotificationCount})` : ""}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
          {!activeExpeditionId || !linkedMember ? (
            <Typography variant="body2" className="page-subtitle">
              Select an active expedition to view notifications.
            </Typography>
          ) : visibleNotifications.length === 0 ? (
            <Typography variant="body2" className="page-subtitle">
              No notifications yet for this expedition.
            </Typography>
          ) : (
            <div className="notification-modal-list">
              {visibleNotifications.map((notification) => (
                <div
                  key={notification.id.toString()}
                  className={`notification-modal-row ${notification.isRead ? "" : "unread"}`}
                >
                  <div className="notification-modal-copy">
                    <span className="notification-modal-title">{notification.title}</span>
                    <span className="notification-modal-meta">
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

          {notificationStatus && <Typography className="field-error">{notificationStatus}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeNotifications}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isBugReportOpen} onClose={closeBugReport} fullWidth maxWidth="sm">
        <DialogTitle>Report a bug</DialogTitle>
        <Box component="form" onSubmit={handleSubmitBugReport}>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.2 }}>
            <TextField
              label="Issue summary"
              value={bugSummary}
              onChange={(e) => setBugSummary(e.target.value)}
              inputProps={{ maxLength: 120 }}
              required
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel id="bug-category-label">Category</InputLabel>
              <Select
                labelId="bug-category-label"
                value={bugCategory}
                label="Category"
                onChange={(e) => setBugCategory(e.target.value)}
              >
                <MenuItem value="bug">Bug</MenuItem>
                <MenuItem value="onboarding">Onboarding</MenuItem>
                <MenuItem value="collaboration">Collaboration</MenuItem>
                <MenuItem value="performance">Performance</MenuItem>
                <MenuItem value="billing">Billing</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="bug-severity-label">Severity</InputLabel>
              <Select
                labelId="bug-severity-label"
                value={bugSeverity}
                label="Severity"
                onChange={(e) => setBugSeverity(e.target.value as BugSeverity)}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="blocker">Blocker</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Repro steps"
              value={bugReproSteps}
              onChange={(e) => setBugReproSteps(e.target.value)}
              multiline
              minRows={3}
              required
              fullWidth
            />

            <TextField
              label="Suggested next action"
              value={bugNextAction}
              onChange={(e) => setBugNextAction(e.target.value)}
              inputProps={{ maxLength: 140 }}
              required
              fullWidth
            />

            {bugStatus && <Typography className="field-error">{bugStatus}</Typography>}
          </DialogContent>

          <DialogActions>
            <Button onClick={closeBugReport}>Cancel</Button>
            <Button type="submit" variant="contained">Submit report</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </div>
  );
}
