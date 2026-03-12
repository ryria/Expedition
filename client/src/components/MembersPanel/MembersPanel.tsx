import { useMembers } from "../../hooks/useMembers";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { DbConnection, tables } from "../../spacetime/generated";
import { Avatar, List, ListItem, ListItemAvatar, ListItemText, Paper, Typography } from "@mui/material";
import "./MembersPanel.css";

interface MembersPanelProps {
  activeExpeditionId: bigint;
}

type MembershipRow = {
  id: bigint;
  expeditionId: bigint;
  memberId: bigint;
  role: string;
  status: string;
  leftAt: unknown;
};

type InviteRow = {
  id: bigint;
  token: string;
  expeditionId: bigint;
  maxUses: number;
  usedCount: number;
  expiresAtEpoch: bigint;
  revokedAt: unknown;
};

const AUTO_INVITE_TTL_MINUTES = 43_200;
const AUTO_INVITE_MAX_USES = 10_000;

export function MembersPanel({ activeExpeditionId }: MembersPanelProps) {
  const auth = useAuth();
  const connectionState = useSpacetimeDB();
  const { members } = useMembers(activeExpeditionId);
  const [membershipRows] = useTable(tables.membership);
  const [inviteRows] = useTable(tables.invite);
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteTokenInput, setInviteTokenInput] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [roleStatus, setRoleStatus] = useState("");
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState<bigint | null>(null);
  const [transferringToMemberId, setTransferringToMemberId] = useState<bigint | null>(null);
  const [ownershipTransferPendingUntilMs, setOwnershipTransferPendingUntilMs] = useState(0);

  const conn = connectionState.getConnection() as DbConnection | null;
  const sub = auth.user?.profile?.sub as string | undefined;
  const linkedMember = members.find((m) => sub != null && m.ownerSub === sub) ?? null;

  const activeMembership = useMemo(() => {
    if (!linkedMember) return null;
    return (membershipRows as readonly MembershipRow[]).find(
      (row) =>
        row.expeditionId === activeExpeditionId &&
        row.memberId === linkedMember.id &&
        row.leftAt == null &&
        row.status.toLowerCase() !== "left",
    ) ?? null;
  }, [activeExpeditionId, linkedMember, membershipRows]);

  const isOwner = activeMembership?.role.toLowerCase() === "owner";
  const canManageInvites =
    activeMembership != null &&
    (activeMembership.role.toLowerCase() === "owner" || activeMembership.role.toLowerCase() === "admin");

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
    const membersById = new Map(members.map((member) => [member.id.toString(), member]));
    return (membershipRows as readonly MembershipRow[])
      .filter(
        (row) =>
          row.expeditionId === activeExpeditionId &&
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
  }, [activeExpeditionId, members, membershipRows]);

  const activeInvites = useMemo(() => {
    const nowEpoch = BigInt(Math.floor(Date.now() / 1000));
    return (inviteRows as readonly InviteRow[])
      .filter(
        (invite) =>
          invite.expeditionId === activeExpeditionId &&
          invite.revokedAt == null &&
          invite.expiresAtEpoch > nowEpoch,
      )
      .sort((a, b) => Number(b.id - a.id));
  }, [activeExpeditionId, inviteRows]);

  function handleCreateInvite() {
    setInviteStatus("");
    if (!conn) {
      setInviteStatus("SpacetimeDB not connected");
      return;
    }
    if (!canManageInvites) {
      setInviteStatus("Only owner/admin can create invites.");
      return;
    }

    try {
      setIsCreatingInvite(true);
      conn.reducers.createInvite({
        expeditionId: activeExpeditionId,
        ttlMinutes: AUTO_INVITE_TTL_MINUTES,
        maxUses: AUTO_INVITE_MAX_USES,
      });
      setInviteStatus("Invite created. Share token from the active invites list.");
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : String(err));
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
      setInviteStatus(err instanceof Error ? err.message : String(err));
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
    if (!isOwner) {
      setRoleStatus("Only the owner can change member roles.");
      return;
    }

    try {
      setUpdatingRoleMemberId(targetMemberId);
      conn.reducers.setMembershipRole({
        expeditionId: activeExpeditionId,
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
    if (!isOwner) {
      setRoleStatus("Only the owner can transfer ownership.");
      return;
    }

    try {
      setOwnershipTransferPendingUntilMs(Date.now() + 5000);
      setTransferringToMemberId(newOwnerMemberId);
      conn.reducers.transferExpeditionOwnership({
        expeditionId: activeExpeditionId,
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

  return (
    <Paper className="members-panel" variant="outlined">
      <Typography variant="h6" gutterBottom>
        Current Expedition Members
      </Typography>
      <Typography className="members-empty" sx={{ mt: -0.5, mb: 1 }}>
        See who is currently active in this expedition.
      </Typography>

      {!members.length && (
        <Typography className="members-empty">No members yet. Create your profile in Settings, then invite or join teammates to start collaborating.</Typography>
      )}

      <List className="member-list" disablePadding>
        {members.map((m) => (
          <ListItem key={String(m.id)} className="member-row" disableGutters>
            <ListItemAvatar>
              <Avatar className="swatch" sx={{ bgcolor: m.colorHex }}>
                {m.name.slice(0, 1).toUpperCase()}
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={m.name} className="member-name" />
          </ListItem>
        ))}
      </List>

      <section className="settings-group members-team-settings">
        <h3>Team Invites</h3>
        <p>Create and redeem invitation tokens for this expedition.</p>
        <div className="strava-actions">
          <button type="button" onClick={handleCreateInvite} disabled={!canManageInvites || isCreatingInvite}>
            {isCreatingInvite ? "Creating…" : "Generate invite code"}
          </button>
        </div>
        <p>Auto-configured: valid for up to 30 days and 10,000 uses.</p>

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

      <section className="settings-group members-team-settings">
        <h3>Team Roles</h3>
        <p>Manage ownership and role permissions for expedition members.</p>
        {expeditionMemberships.length === 0 ? (
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
        {!isOwner && (
          <p>Only the current owner can change roles or transfer ownership.</p>
        )}
        {roleStatus && <p className="field-error">{roleStatus}</p>}
      </section>
    </Paper>
  );
}
