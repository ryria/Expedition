import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { MapJournalView } from "./components/MapView/MapJournalView";
import { MembersPanel } from "./components/MembersPanel/MembersPanel";
import { SettingsPanel } from "./components/SettingsPanel/SettingsPanel";
import { useAuth } from "react-oidc-context";
import { useMembers } from "./hooks/useMembers";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { DbConnection, tables } from "./spacetime/generated";
import { emitExpeditionEvent } from "./hooks/expeditionEvents";
import { OBS_EVENT_NAME, getSessionTraceId } from "./observability/telemetry";
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import "./App.css";

type AppTab = "expedition" | "members" | "settings";
type Theme = "dark" | "light";
type MapMode = "asRan" | "contribution";

const THEME_STORAGE_KEY = "expedition-theme";
const MAP_MODE_STORAGE_KEY = "expedition-map-mode";
const ACTIVE_EXPEDITION_STORAGE_KEY = "expedition-active-id";

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
  const [tab, setTab] = useState<AppTab>("expedition");
  const [theme, setTheme] = useState<Theme>(loadInitialTheme);
  const [mapMode, setMapMode] = useState<MapMode>(loadInitialMapMode);
  const [activeExpeditionId, setActiveExpeditionId] = useState<bigint | null>(null);
  const [activeResolved, setActiveResolved] = useState(false);
  const [newExpeditionName, setNewExpeditionName] = useState("");
  const [isCreatingExpedition, setIsCreatingExpedition] = useState(false);
  const [expeditionCreateError, setExpeditionCreateError] = useState("");
  const [pendingCreatedSlug, setPendingCreatedSlug] = useState<string | null>(null);
  const auth = useAuth();
  const { members } = useMembers();
  const connectionState = useSpacetimeDB();
  const [expeditionRows] = useTable(tables.expedition);
  const [membershipRows] = useTable(tables.membership);

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

  const visibleTabs: AppTab[] = ["expedition", "members", "settings"];

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

  return (
    <div className="app">
      <AppBar position="static" color="transparent" elevation={0} className="app-bar">
        <Toolbar className="app-toolbar" disableGutters>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1} className="toolbar-block toolbar-left">
            <Typography variant="h6" className="app-title">
              The Expedition
            </Typography>
            {isRegistered && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} className="expedition-controls">
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
              </Stack>
            )}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" className="toolbar-block toolbar-right">
            <Tabs value={tab} onChange={(_, value) => setTab(value as AppTab)} variant="scrollable" allowScrollButtonsMobile>
              {visibleTabs.map((t) => (
                <Tab
                  key={t}
                  value={t}
                  label={t === "expedition" ? "Expedition" : t === "members" ? "Members" : "Settings"}
                />
              ))}
            </Tabs>
            <Button variant="text" color="inherit" onClick={() => auth.signoutRedirect()}>
              Sign out
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <main className={`app-main ${tab === "expedition" ? "expedition-main" : ""}`}>
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
        {tab === "expedition" && activeExpeditionId != null && !expeditionLoading && !hasNoMembership && (
          <MapJournalView
            theme={theme}
            mapMode={mapMode}
            onMapModeChange={setMapMode}
            activeExpeditionId={activeExpeditionId}
          />
        )}
        {tab === "members" && activeExpeditionId != null && !expeditionLoading && !hasNoMembership && (
          <div className="content-shell">
            <MembersPanel activeExpeditionId={activeExpeditionId} />
          </div>
        )}
        {tab === "settings" && !expeditionLoading && (
          <div className="content-shell">
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
        )}
      </main>
    </div>
  );
}
