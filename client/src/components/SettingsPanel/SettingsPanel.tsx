import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "react-oidc-context";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { useMembers } from "../../hooks/useMembers";
import { DbConnection, tables } from "../../spacetime/generated";
import { DEFAULT_COLORS, STRAVA_CLIENT_ID } from "../../config";
import "./SettingsPanel.css";

type Theme = "dark" | "light";
type MapMode = "asRan" | "contribution";
type InviteRow = {
  id: bigint;
  token: string;
  expeditionId: bigint;
  createdByMemberId: bigint;
  maxUses: number;
  usedCount: number;
  expiresAtEpoch: bigint;
  revokedAt: unknown;
};
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

type BetaMilestone = "inviteAccepted" | "firstSession" | "firstActivity" | "firstCollaboration";

interface BetaOnboardingStatus {
  inviteAccepted: boolean;
  firstSession: boolean;
  firstActivity: boolean;
  firstCollaboration: boolean;
}

type SupportSeverity = "low" | "medium" | "high" | "blocker";
type SupportTicketStatus = "new" | "triaged" | "in-progress" | "validated" | "closed";

interface SupportTicket {
  id: string;
  summary: string;
  category: string;
  source: string;
  impact: string;
  frequency: string;
  reproSteps: string;
  severity: SupportSeverity;
  status: SupportTicketStatus;
  owner: string;
  nextAction: string;
  feedbackTag: string;
  createdAtIso: string;
  triagedAtIso: string | null;
  firstResponseAtIso: string | null;
  closedAtIso: string | null;
}

function normalizeSupportSeverity(value: unknown): SupportSeverity {
  if (value === "low" || value === "medium" || value === "high" || value === "blocker") return value;
  return "medium";
}

function normalizeSupportStatus(value: unknown): SupportTicketStatus {
  if (value === "new" || value === "triaged" || value === "in-progress" || value === "validated" || value === "closed") {
    return value;
  }
  return "new";
}

function normalizeSupportTicket(raw: unknown, fallbackIndex: number): SupportTicket | null {
  if (!raw || typeof raw !== "object") return null;
  const ticket = raw as Partial<SupportTicket> & Record<string, unknown>;
  const summary = typeof ticket.summary === "string" ? ticket.summary.trim() : "";
  if (!summary) return null;

  const category = typeof ticket.category === "string" && ticket.category.trim() ? ticket.category : "bug";
  const source = typeof ticket.source === "string" && ticket.source.trim() ? ticket.source : "in_app";
  const impact = typeof ticket.impact === "string" && ticket.impact.trim() ? ticket.impact : "medium";
  const frequency = typeof ticket.frequency === "string" && ticket.frequency.trim() ? ticket.frequency : "single";
  const reproSteps = typeof ticket.reproSteps === "string" ? ticket.reproSteps : "";
  const owner = typeof ticket.owner === "string" && ticket.owner.trim() ? ticket.owner : "unassigned";
  const nextAction = typeof ticket.nextAction === "string" ? ticket.nextAction : "";

  const severity = normalizeSupportSeverity(ticket.severity);
  const status = normalizeSupportStatus(ticket.status);
  const createdAtIso = typeof ticket.createdAtIso === "string" && ticket.createdAtIso
    ? ticket.createdAtIso
    : new Date().toISOString();

  const feedbackTag = typeof ticket.feedbackTag === "string" && ticket.feedbackTag.trim()
    ? ticket.feedbackTag
    : `beta-feedback:${category}:${severity}`;

  return {
    id: typeof ticket.id === "string" && ticket.id.trim() ? ticket.id : `ticket-${fallbackIndex + 1}`,
    summary,
    category,
    source,
    impact,
    frequency,
    reproSteps,
    severity,
    status,
    owner,
    nextAction,
    feedbackTag,
    createdAtIso,
    triagedAtIso: typeof ticket.triagedAtIso === "string" ? ticket.triagedAtIso : null,
    firstResponseAtIso: typeof ticket.firstResponseAtIso === "string" ? ticket.firstResponseAtIso : null,
    closedAtIso: typeof ticket.closedAtIso === "string" ? ticket.closedAtIso : null,
  };
}

function parseSupportTickets(raw: string): SupportTicket[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((ticket, index) => normalizeSupportTicket(ticket, index))
    .filter((ticket): ticket is SupportTicket => ticket != null);
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
const BETA_ONBOARDING_STORAGE_KEY = "expedition-beta-onboarding";
const BETA_SUPPORT_TICKETS_STORAGE_KEY = "expedition-beta-support-tickets";
const STRAVA_PENDING_CALLBACK_STORAGE_KEY = "expedition-strava-oauth-callback-pending";

const DEFAULT_BETA_ONBOARDING_STATUS: BetaOnboardingStatus = {
  inviteAccepted: false,
  firstSession: false,
  firstActivity: false,
  firstCollaboration: false,
};

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
  const [inviteTokenInput, setInviteTokenInput] = useState("");
  const [inviteTtlMinutes, setInviteTtlMinutes] = useState("1440");
  const [inviteMaxUses, setInviteMaxUses] = useState("1");
  const [inviteStatus, setInviteStatus] = useState("");
  const [roleStatus, setRoleStatus] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState<bigint | null>(null);
  const [transferringToMemberId, setTransferringToMemberId] = useState<bigint | null>(null);
  const [ownershipTransferPendingUntilMs, setOwnershipTransferPendingUntilMs] = useState(0);
  const [billingStatus, setBillingStatus] = useState("");
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [visibilityStatus, setVisibilityStatus] = useState("");
  const [markingNotificationId, setMarkingNotificationId] = useState<bigint | null>(null);
  const [notificationStatus, setNotificationStatus] = useState("");
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [onboardingStatus, setOnboardingStatus] = useState<BetaOnboardingStatus>(
    DEFAULT_BETA_ONBOARDING_STATUS,
  );
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportSummary, setSupportSummary] = useState("");
  const [supportCategory, setSupportCategory] = useState("onboarding");
  const [supportSource, setSupportSource] = useState("in_app");
  const [supportImpact, setSupportImpact] = useState("medium");
  const [supportFrequency, setSupportFrequency] = useState("single");
  const [supportReproSteps, setSupportReproSteps] = useState("");
  const [supportNextAction, setSupportNextAction] = useState("");
  const [supportSeverity, setSupportSeverity] = useState<SupportSeverity>("medium");
  const [supportStatus, setSupportStatus] = useState("");

  const STRAVA_STATE_STORAGE_KEY = "expedition-strava-oauth-state";
  const conn = connectionState.getConnection() as DbConnection | null;
  const [inviteRows] = useTable(tables.invite);
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

  const canManageInvites =
    activeMembership != null &&
    (activeMembership.role.toLowerCase() === "owner" || activeMembership.role.toLowerCase() === "admin");

  const isOwner = activeMembership?.role.toLowerCase() === "owner";
  const isOwnershipTransferPending = ownershipTransferPendingUntilMs > Date.now();

  useEffect(() => {
    if (!isOwnershipTransferPending) return;
    const timeoutMs = Math.max(0, ownershipTransferPendingUntilMs - Date.now());
    const timeoutId = window.setTimeout(() => {
      setOwnershipTransferPendingUntilMs(0);
    }, timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [isOwnershipTransferPending, ownershipTransferPendingUntilMs]);

  useEffect(() => {
    if (!isOwner && ownershipTransferPendingUntilMs !== 0) {
      setOwnershipTransferPendingUntilMs(0);
    }
  }, [isOwner, ownershipTransferPendingUntilMs]);

  const expeditionMemberships = useMemo(() => {
    if (!activeExpedition) return [] as Array<{ memberId: bigint; memberName: string; role: string }>;

    const membersById = new Map(members.map((member) => [member.id.toString(), member]));
    return (membershipRows as readonly MembershipRow[])
      .filter(
        (row) =>
          row.expeditionId === activeExpedition.id &&
          row.leftAt == null &&
          row.status.toLowerCase() !== "left" &&
          membersById.has(row.memberId.toString()),
      )
      .map((row) => {
        const member = membersById.get(row.memberId.toString());
        return {
          memberId: row.memberId,
          memberName: member?.name ?? `Member ${row.memberId.toString()}`,
          role: row.role.toLowerCase(),
        };
      })
      .sort((a, b) => {
        if (a.role === "owner" && b.role !== "owner") return -1;
        if (a.role !== "owner" && b.role === "owner") return 1;
        return a.memberName.localeCompare(b.memberName);
      });
  }, [activeExpedition, members, membershipRows]);

  const activeInvites = useMemo(() => {
    if (!activeExpedition) return [] as InviteRow[];
    const nowEpoch = BigInt(Math.floor(Date.now() / 1000));
    return (inviteRows as readonly InviteRow[])
      .filter(
        (invite) =>
          invite.expeditionId === activeExpedition.id &&
          invite.revokedAt == null &&
          invite.expiresAtEpoch > nowEpoch,
      )
      .sort((a, b) => Number(b.id - a.id));
  }, [activeExpedition, inviteRows]);

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

  const onboardingProgress = useMemo(() => {
    const values = Object.values(onboardingStatus);
    return {
      completed: values.filter(Boolean).length,
      total: values.length,
    };
  }, [onboardingStatus]);

  const supportMetrics = useMemo(() => {
    const firstTriageMinutes: number[] = [];
    const resolutionMinutes: number[] = [];

    for (const ticket of supportTickets) {
      const createdAt = new Date(ticket.createdAtIso).getTime();
      if (ticket.triagedAtIso) {
        const triagedAt = new Date(ticket.triagedAtIso).getTime();
        if (triagedAt >= createdAt) {
          firstTriageMinutes.push((triagedAt - createdAt) / 60_000);
        }
      }

      if (ticket.closedAtIso) {
        const closedAt = new Date(ticket.closedAtIso).getTime();
        if (closedAt >= createdAt) {
          resolutionMinutes.push((closedAt - createdAt) / 60_000);
        }
      }
    }

    const avg = (nums: number[]) =>
      nums.length === 0 ? 0 : nums.reduce((sum, value) => sum + value, 0) / nums.length;

    return {
      totalTickets: supportTickets.length,
      unresolvedTickets: supportTickets.filter((ticket) => ticket.status !== "closed").length,
      unresolvedHighSeverityCount: supportTickets.filter(
        (ticket) =>
          ticket.status !== "closed" && (ticket.severity === "high" || ticket.severity === "blocker"),
      ).length,
      avgFirstTriageMinutes: avg(firstTriageMinutes),
      avgResolutionMinutes: avg(resolutionMinutes),
    };
  }, [supportTickets]);

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
    if (!linkedMember || !activeExpedition) {
      setOnboardingStatus(DEFAULT_BETA_ONBOARDING_STATUS);
      return;
    }

    const key = `${BETA_ONBOARDING_STORAGE_KEY}:${linkedMember.id.toString()}:${activeExpedition.id.toString()}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setOnboardingStatus(DEFAULT_BETA_ONBOARDING_STATUS);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<BetaOnboardingStatus>;
      setOnboardingStatus({
        inviteAccepted: parsed.inviteAccepted ?? false,
        firstSession: parsed.firstSession ?? false,
        firstActivity: parsed.firstActivity ?? false,
        firstCollaboration: parsed.firstCollaboration ?? false,
      });
    } catch {
      setOnboardingStatus(DEFAULT_BETA_ONBOARDING_STATUS);
    }
  }, [linkedMember, activeExpedition]);

  useEffect(() => {
    if (!linkedMember || !activeExpedition) return;
    const key = `${BETA_ONBOARDING_STORAGE_KEY}:${linkedMember.id.toString()}:${activeExpedition.id.toString()}`;
    localStorage.setItem(key, JSON.stringify(onboardingStatus));
  }, [linkedMember, activeExpedition, onboardingStatus]);

  useEffect(() => {
    if (!linkedMember || !activeExpedition) {
      setSupportTickets([]);
      return;
    }

    const key = `${BETA_SUPPORT_TICKETS_STORAGE_KEY}:${linkedMember.id.toString()}:${activeExpedition.id.toString()}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setSupportTickets([]);
      return;
    }

    try {
      setSupportTickets(parseSupportTickets(raw));
    } catch {
      setSupportTickets([]);
    }
  }, [linkedMember, activeExpedition]);

  useEffect(() => {
    if (!linkedMember || !activeExpedition) return;
    const key = `${BETA_SUPPORT_TICKETS_STORAGE_KEY}:${linkedMember.id.toString()}:${activeExpedition.id.toString()}`;
    localStorage.setItem(key, JSON.stringify(supportTickets));
  }, [linkedMember, activeExpedition, supportTickets]);

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

  function handleCreateExpedition(e: FormEvent) {
    e.preventDefault();
    void (async () => {
      const created = await onCreateExpedition(newExpeditionName);
      if (created) {
        setNewExpeditionName("");
      }
    })();
  }

  function handleCreateInvite() {
    setInviteStatus("");
    if (!conn) {
      setInviteStatus("SpacetimeDB not connected");
      return;
    }
    if (!activeExpedition) {
      setInviteStatus("Select an active expedition first.");
      return;
    }
    if (!canManageInvites) {
      setInviteStatus("Only owner/admin can create invites.");
      return;
    }

    const ttl = Number(inviteTtlMinutes);
    const maxUses = Number(inviteMaxUses);
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 43200) {
      setInviteStatus("TTL must be between 1 and 43200 minutes.");
      return;
    }
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
      setInviteStatus("Max uses must be between 1 and 10000.");
      return;
    }

    try {
      setIsCreatingInvite(true);
      conn.reducers.createInvite({
        expeditionId: activeExpedition.id,
        ttlMinutes: ttl,
        maxUses,
      });
      setInviteStatus("Invite created. Share token from the active invites list.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setInviteStatus(message);
      if (message.toLowerCase().includes("limit reached")) {
        setBillingStatus("Action blocked by current plan limit. Upgrade to Pro or Club for higher limits.");
      }
    } finally {
      setIsCreatingInvite(false);
    }
  }

  function handleJoinByToken() {
    setInviteStatus("");
    if (!conn) {
      setInviteStatus("SpacetimeDB not connected");
      return;
    }

    const token = inviteTokenInput.trim();
    if (!token) {
      setInviteStatus("Invite token required.");
      return;
    }

    try {
      setIsJoiningInvite(true);
      conn.reducers.acceptInvite({ token });
      setInviteTokenInput("");
      setInviteStatus("Join request sent.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setInviteStatus(message);
      if (message.toLowerCase().includes("limit reached")) {
        setBillingStatus("Action blocked by current plan limit. Upgrade to Pro or Club for higher limits.");
      }
    } finally {
      setIsJoiningInvite(false);
    }
  }

  function handleRevokeInvite(token: string) {
    setInviteStatus("");
    if (!conn) {
      setInviteStatus("SpacetimeDB not connected");
      return;
    }
    try {
      setRevokingToken(token);
      conn.reducers.revokeInvite({ token });
      setInviteStatus("Invite revoked.");
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setRevokingToken(null);
    }
  }

  function handleSetRole(targetMemberId: bigint, newRole: "admin" | "member") {
    setRoleStatus("");
    if (isOwnershipTransferPending) {
      setRoleStatus("Ownership transfer in progress. Wait for membership refresh.");
      return;
    }
    if (!conn) {
      setRoleStatus("SpacetimeDB not connected");
      return;
    }
    if (!activeExpedition) {
      setRoleStatus("Select an active expedition first.");
      return;
    }
    if (!isOwner) {
      setRoleStatus("Only the owner can change member roles.");
      return;
    }

    try {
      setUpdatingRoleMemberId(targetMemberId);
      conn.reducers.setMembershipRole({
        expeditionId: activeExpedition.id,
        targetMemberId,
        newRole,
      });
      setRoleStatus(`Updated role to ${newRole}.`);
    } catch (err) {
      setRoleStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingRoleMemberId(null);
    }
  }

  function handleTransferOwnership(newOwnerMemberId: bigint) {
    setRoleStatus("");
    if (isOwnershipTransferPending) {
      setRoleStatus("Ownership transfer in progress. Wait for membership refresh.");
      return;
    }
    if (!conn) {
      setRoleStatus("SpacetimeDB not connected");
      return;
    }
    if (!activeExpedition) {
      setRoleStatus("Select an active expedition first.");
      return;
    }
    if (!isOwner) {
      setRoleStatus("Only the owner can transfer ownership.");
      return;
    }

    try {
      setOwnershipTransferPendingUntilMs(Date.now() + 5000);
      setTransferringToMemberId(newOwnerMemberId);
      conn.reducers.transferExpeditionOwnership({
        expeditionId: activeExpedition.id,
        newOwnerMemberId,
      });
      setRoleStatus("Ownership transfer requested.");
    } catch (err) {
      setOwnershipTransferPendingUntilMs(0);
      setRoleStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setTransferringToMemberId(null);
    }
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

  function updateNotificationPrefs(
    patch: Partial<NotificationPreferences>,
  ) {
    setNotificationPrefs((current) => ({ ...current, ...patch }));
  }

  function trackSupportKpiEvent(eventName: string, payload: Record<string, unknown>) {
    if (!conn || !activeExpedition) return;

    const reducers = conn.reducers as {
      trackProductEvent?: (args: {
        eventName: string;
        expeditionId: bigint;
        payloadJson: string;
      }) => void;
    };

    reducers.trackProductEvent?.({
      eventName,
      expeditionId: activeExpedition.id,
      payloadJson: JSON.stringify(payload),
    });
  }

  function updateOnboardingMilestone(milestone: BetaMilestone, completed: boolean) {
    setOnboardingStatus((current) => ({ ...current, [milestone]: completed }));

    if (completed) {
      trackSupportKpiEvent("beta_onboarding_milestone_completed", {
        milestone,
      });
    }
  }

  function handleSubmitSupportTicket(e: FormEvent) {
    e.preventDefault();
    setSupportStatus("");

    if (!activeExpedition || !linkedMember) {
      setSupportStatus("Select an active expedition and linked profile first.");
      return;
    }

    if (!supportSummary.trim()) {
      setSupportStatus("Issue summary is required.");
      return;
    }

    if (!supportReproSteps.trim()) {
      setSupportStatus("Repro steps are required.");
      return;
    }

    if (!supportNextAction.trim()) {
      setSupportStatus("Next action is required.");
      return;
    }

    const now = new Date().toISOString();
    const feedbackTag = `beta-feedback:${supportCategory}:${supportSeverity}`;
    const nextTicket: SupportTicket = {
      id: crypto.randomUUID(),
      summary: supportSummary.trim(),
      category: supportCategory,
      source: supportSource,
      impact: supportImpact,
      frequency: supportFrequency,
      reproSteps: supportReproSteps.trim(),
      severity: supportSeverity,
      status: "new",
      owner: "unassigned",
      nextAction: supportNextAction.trim(),
      feedbackTag,
      createdAtIso: now,
      triagedAtIso: null,
      firstResponseAtIso: null,
      closedAtIso: null,
    };

    setSupportTickets((current) => [nextTicket, ...current]);
    setSupportSummary("");
    setSupportCategory("onboarding");
    setSupportSource("in_app");
    setSupportImpact("medium");
    setSupportFrequency("single");
    setSupportReproSteps("");
    setSupportNextAction("");
    setSupportSeverity("medium");
    setSupportStatus("Support ticket created and queued for triage.");

    trackSupportKpiEvent("beta_support_ticket_submitted", {
      ticketId: nextTicket.id,
      severity: nextTicket.severity,
      category: nextTicket.category,
      source: nextTicket.source,
      impact: nextTicket.impact,
      frequency: nextTicket.frequency,
      nextAction: nextTicket.nextAction,
      account: sub ?? "unknown",
    });
  }

  function handleTicketOwnerChange(ticketId: string, owner: string) {
    setSupportTickets((current) =>
      current.map((ticket) => (ticket.id === ticketId ? { ...ticket, owner } : ticket)),
    );
  }

  function handleTicketStatusChange(ticketId: string, nextStatus: SupportTicketStatus) {
    setSupportTickets((current) =>
      current.map((ticket) => {
        if (ticket.id !== ticketId) return ticket;

        const nowIso = new Date().toISOString();
        const triagedAtIso =
          ticket.triagedAtIso ?? (nextStatus === "new" ? null : nowIso);
        const firstResponseAtIso =
          ticket.firstResponseAtIso ?? (nextStatus === "new" ? null : nowIso);
        const closedAtIso = nextStatus === "closed" ? nowIso : ticket.closedAtIso;

        if (nextStatus !== ticket.status) {
          trackSupportKpiEvent("beta_support_ticket_status_changed", {
            ticketId,
            previousStatus: ticket.status,
            nextStatus,
            severity: ticket.severity,
          });

          if (!ticket.triagedAtIso && triagedAtIso) {
            const firstTriageMinutes = Math.max(
              0,
              Math.round((new Date(triagedAtIso).getTime() - new Date(ticket.createdAtIso).getTime()) / 60_000),
            );
            trackSupportKpiEvent("beta_feedback_first_triage_recorded", {
              ticketId,
              firstTriageMinutes,
              severity: ticket.severity,
            });
          }

          if (!ticket.firstResponseAtIso && firstResponseAtIso) {
            const firstResponseMinutes = Math.max(
              0,
              Math.round((new Date(firstResponseAtIso).getTime() - new Date(ticket.createdAtIso).getTime()) / 60_000),
            );
            trackSupportKpiEvent("beta_support_first_response_recorded", {
              ticketId,
              firstResponseMinutes,
              severity: ticket.severity,
            });
          }

          if (nextStatus === "closed" && closedAtIso) {
            const resolutionMinutes = Math.max(
              0,
              Math.round((new Date(closedAtIso).getTime() - new Date(ticket.createdAtIso).getTime()) / 60_000),
            );
            trackSupportKpiEvent("beta_support_resolution_recorded", {
              ticketId,
              resolutionMinutes,
              severity: ticket.severity,
            });
          }
        }

        return {
          ...ticket,
          status: nextStatus,
          triagedAtIso,
          firstResponseAtIso,
          closedAtIso,
        };
      }),
    );
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
        </form>
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
        {expeditionCreateError && <p className="field-error">{expeditionCreateError}</p>}
      </section>

      <section className="settings-group">
        <h3>Team Invites</h3>
        <p>Create, revoke, and redeem invitation tokens for this expedition.</p>
        <div className="strava-actions">
          <input
            type="number"
            min={1}
            max={43200}
            value={inviteTtlMinutes}
            onChange={(e) => setInviteTtlMinutes(e.target.value)}
            placeholder="TTL (minutes)"
            className="invite-input"
          />
          <input
            type="number"
            min={1}
            max={10000}
            value={inviteMaxUses}
            onChange={(e) => setInviteMaxUses(e.target.value)}
            placeholder="Max uses"
            className="invite-input"
          />
          <button type="button" onClick={handleCreateInvite} disabled={!canManageInvites || isCreatingInvite}>
            {isCreatingInvite ? "Creating…" : "Create invite"}
          </button>
        </div>

        {!canManageInvites && (
          <p>Owner/admin membership is required to create and revoke invites for the active expedition.</p>
        )}

        <div className="invite-list">
          {activeInvites.length === 0 ? (
            <p>No active invites for this expedition.</p>
          ) : (
            activeInvites.map((invite) => (
              <div key={String(invite.id)} className="invite-row">
                <span className="invite-token">{invite.token}</span>
                <span className="invite-meta">
                  uses {invite.usedCount}/{invite.maxUses}
                </span>
                <button
                  type="button"
                  onClick={() => handleRevokeInvite(invite.token)}
                  disabled={!canManageInvites || revokingToken === invite.token}
                >
                  {revokingToken === invite.token ? "Revoking…" : "Revoke"}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="strava-actions">
          <input
            type="text"
            value={inviteTokenInput}
            onChange={(e) => setInviteTokenInput(e.target.value)}
            placeholder="Invite token"
            className="invite-input"
          />
          <button type="button" onClick={handleJoinByToken} disabled={isJoiningInvite}>
            {isJoiningInvite ? "Joining…" : "Join by token"}
          </button>
        </div>

        {inviteStatus && <p className="field-error">{inviteStatus}</p>}
      </section>

      <section className="settings-group">
        <h3>Team Roles</h3>
        <p>Manage ownership and role permissions for expedition members.</p>
        {!activeExpedition ? (
          <p>Select an active expedition to manage roles.</p>
        ) : expeditionMemberships.length === 0 ? (
          <p>No active members in this expedition.</p>
        ) : (
          <div className="role-list">
            {expeditionMemberships.map((membership) => {
              const isSelf = linkedMember != null && membership.memberId === linkedMember.id;
              const isMemberOwner = membership.role === "owner";
              const isUpdating = updatingRoleMemberId === membership.memberId;
              const isTransferring = transferringToMemberId === membership.memberId;
              const canPromote = isOwner && !isMemberOwner && membership.role !== "admin";
              const canDemote = isOwner && !isMemberOwner && membership.role !== "member";
              const canTransfer = isOwner && !isMemberOwner;

              return (
                <div key={membership.memberId.toString()} className="role-row">
                  <div className="role-member">
                    <span>{membership.memberName}</span>
                    <span className="role-badge">{membership.role}</span>
                    {isSelf && <span className="role-self">you</span>}
                  </div>
                  <div className="role-actions">
                    <button
                      type="button"
                      onClick={() => handleSetRole(membership.memberId, "admin")}
                      disabled={!canPromote || isUpdating || isTransferring || isOwnershipTransferPending}
                    >
                      {isUpdating && canPromote ? "Updating…" : "Make admin"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetRole(membership.memberId, "member")}
                      disabled={!canDemote || isUpdating || isTransferring || isOwnershipTransferPending}
                    >
                      {isUpdating && canDemote ? "Updating…" : "Make member"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTransferOwnership(membership.memberId)}
                      disabled={!canTransfer || isUpdating || isTransferring || isOwnershipTransferPending}
                    >
                      {isTransferring ? "Transferring…" : "Make owner"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!isOwner && activeExpedition && (
          <p>Only the current owner can change roles or transfer ownership.</p>
        )}
        {roleStatus && <p className="field-error">{roleStatus}</p>}
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
        <h3>Beta Operations</h3>
        <p>Track onboarding milestones and run support triage for beta cohorts.</p>

        <div className="settings-subgroup">
          <h4>
            Onboarding Milestones ({onboardingProgress.completed}/{onboardingProgress.total})
          </h4>
          <div className="notification-preferences">
            <label>
              <input
                type="checkbox"
                checked={onboardingStatus.inviteAccepted}
                onChange={(e) => updateOnboardingMilestone("inviteAccepted", e.target.checked)}
              />
              Invite accepted
            </label>
            <label>
              <input
                type="checkbox"
                checked={onboardingStatus.firstSession}
                onChange={(e) => updateOnboardingMilestone("firstSession", e.target.checked)}
              />
              First session
            </label>
            <label>
              <input
                type="checkbox"
                checked={onboardingStatus.firstActivity}
                onChange={(e) => updateOnboardingMilestone("firstActivity", e.target.checked)}
              />
              First activity
            </label>
            <label>
              <input
                type="checkbox"
                checked={onboardingStatus.firstCollaboration}
                onChange={(e) => updateOnboardingMilestone("firstCollaboration", e.target.checked)}
              />
              First collaboration action
            </label>
          </div>
        </div>

        <div className="settings-subgroup">
          <h4>Support Intake</h4>
          <form className="support-form" onSubmit={handleSubmitSupportTicket}>
            <input
              type="text"
              className="invite-input"
              value={supportSummary}
              onChange={(e) => setSupportSummary(e.target.value)}
              placeholder="Issue summary"
              aria-label="Issue summary"
              maxLength={120}
            />
            <select
              className="invite-input"
              value={supportCategory}
              onChange={(e) => setSupportCategory(e.target.value)}
              aria-label="Support category"
            >
              <option value="onboarding">Onboarding</option>
              <option value="collaboration">Collaboration</option>
              <option value="billing">Billing</option>
              <option value="bug">Bug</option>
              <option value="performance">Performance</option>
              <option value="feature_request">Feature request</option>
            </select>
            <select
              className="invite-input"
              value={supportSource}
              onChange={(e) => setSupportSource(e.target.value)}
              aria-label="Support source"
            >
              <option value="in_app">In-app note</option>
              <option value="github">GitHub issue</option>
              <option value="support_message">Support message</option>
              <option value="direct_comment">Direct beta comment</option>
            </select>
            <select
              className="invite-input"
              value={supportImpact}
              onChange={(e) => setSupportImpact(e.target.value)}
              aria-label="Support impact"
            >
              <option value="low">Low impact</option>
              <option value="medium">Medium impact</option>
              <option value="high">High impact</option>
            </select>
            <select
              className="invite-input"
              value={supportFrequency}
              onChange={(e) => setSupportFrequency(e.target.value)}
              aria-label="Support frequency"
            >
              <option value="single">Single report</option>
              <option value="recurring">Recurring</option>
              <option value="widespread">Widespread</option>
            </select>
            <select
              className="invite-input"
              value={supportSeverity}
              onChange={(e) => setSupportSeverity(e.target.value as SupportSeverity)}
              aria-label="Support severity"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="blocker">Blocker</option>
            </select>
            <textarea
              className="support-repro"
              value={supportReproSteps}
              onChange={(e) => setSupportReproSteps(e.target.value)}
              placeholder="Repro steps"
              aria-label="Repro steps"
              rows={3}
            />
            <input
              type="text"
              className="invite-input"
              value={supportNextAction}
              onChange={(e) => setSupportNextAction(e.target.value)}
              placeholder="Next action (owner follow-up)"
              aria-label="Next action"
              maxLength={140}
            />
            <button type="submit">Submit support ticket</button>
          </form>
          <p>
            Account: {sub ?? "unknown"} · Expedition: {activeExpedition?.slug ?? "none"}
          </p>
          {supportStatus && <p className="field-error">{supportStatus}</p>}
        </div>

        <div className="settings-subgroup">
          <h4>Triage Queue</h4>
          <p>
            Workflow: new → triaged → in-progress → validated → closed. Escalate blocker incidents to owner/ops immediately.
          </p>
          {supportTickets.length === 0 ? (
            <p>No support tickets yet.</p>
          ) : (
            <div className="support-ticket-list">
              {supportTickets.map((ticket) => (
                <div key={ticket.id} className="support-ticket-row">
                  <div className="support-ticket-copy">
                    <strong>{ticket.summary}</strong>
                    <span>
                      {ticket.category} · {ticket.severity} · source:{ticket.source} · impact:{ticket.impact} · frequency:{ticket.frequency}
                    </span>
                    <span>next action: {ticket.nextAction}</span>
                    <span>tag:{ticket.feedbackTag}</span>
                    <span>{ticket.reproSteps}</span>
                  </div>
                  <div className="support-ticket-controls">
                    <select
                      className="invite-input"
                      aria-label={`Owner for ${ticket.summary}`}
                      value={ticket.owner}
                      onChange={(e) => handleTicketOwnerChange(ticket.id, e.target.value)}
                    >
                      <option value="unassigned">Unassigned</option>
                      {expeditionMemberships.map((membership) => (
                        <option key={membership.memberId.toString()} value={membership.memberName}>
                          {membership.memberName}
                        </option>
                      ))}
                    </select>
                    <select
                      className="invite-input"
                      aria-label={`Status for ${ticket.summary}`}
                      value={ticket.status}
                      onChange={(e) => handleTicketStatusChange(ticket.id, e.target.value as SupportTicketStatus)}
                    >
                      <option value="new">new</option>
                      <option value="triaged">triaged</option>
                      <option value="in-progress">in-progress</option>
                      <option value="validated">validated</option>
                      <option value="closed">closed</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="settings-subgroup">
          <h4>Support KPI Snapshot</h4>
          <div className="support-kpi-grid">
            <div className="invite-row"><span className="invite-token">Total tickets</span><span className="invite-meta">{supportMetrics.totalTickets}</span></div>
            <div className="invite-row"><span className="invite-token">Unresolved</span><span className="invite-meta">{supportMetrics.unresolvedTickets}</span></div>
            <div className="invite-row"><span className="invite-token">Unresolved high/blocker</span><span className="invite-meta">{supportMetrics.unresolvedHighSeverityCount}</span></div>
            <div className="invite-row"><span className="invite-token">Avg first triage</span><span className="invite-meta">{supportMetrics.avgFirstTriageMinutes.toFixed(1)} min</span></div>
            <div className="invite-row"><span className="invite-token">Avg resolution</span><span className="invite-meta">{supportMetrics.avgResolutionMinutes.toFixed(1)} min</span></div>
          </div>
          <p>
            Weekly review ritual: every Friday, tag backlog items as `beta-feedback:&lt;category&gt;` and capture top 3 blockers.
          </p>
          <p>
            Playbook templates: welcome note, known-issue acknowledgement, and resolution follow-up for high/blocker incidents.
          </p>
        </div>
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
      </section>
    </div>
  );
}