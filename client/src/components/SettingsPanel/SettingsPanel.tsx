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
  const [billingStatus, setBillingStatus] = useState("");
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);

  const STRAVA_STATE_STORAGE_KEY = "expedition-strava-oauth-state";
  const conn = connectionState.getConnection() as DbConnection | null;
  const [inviteRows] = useTable(tables.invite);
  const [membershipRows] = useTable(tables.membership);
  const [planSubscriptionRows] = useTable(tables.plan_subscription);
  const [entitlementRows] = useTable(tables.entitlement);

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
      setTransferringToMemberId(newOwnerMemberId);
      conn.reducers.transferExpeditionOwnership({
        expeditionId: activeExpedition.id,
        newOwnerMemberId,
      });
      setRoleStatus("Ownership transfer requested.");
    } catch (err) {
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
                      disabled={!canPromote || isUpdating || isTransferring}
                    >
                      {isUpdating && canPromote ? "Updating…" : "Make admin"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetRole(membership.memberId, "member")}
                      disabled={!canDemote || isUpdating || isTransferring}
                    >
                      {isUpdating && canDemote ? "Updating…" : "Make member"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTransferOwnership(membership.memberId)}
                      disabled={!canTransfer || isUpdating || isTransferring}
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
      </section>
    </div>
  );
}