import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsPanel } from "./SettingsPanel";
import { tables } from "../../spacetime/generated";

const mocks = vi.hoisted(() => {
  return {
    useAuthMock: vi.fn(),
    useSpacetimeDBMock: vi.fn(),
    useTableMock: vi.fn(),
    useMembersMock: vi.fn(),
    createInvite: vi.fn(),
    acceptInvite: vi.fn(),
    revokeInvite: vi.fn(),
    setMembershipRole: vi.fn(),
    transferExpeditionOwnership: vi.fn(),
    setExpeditionVisibility: vi.fn(),
    markNotificationRead: vi.fn(),
    trackProductEvent: vi.fn(),
    createCheckoutSession: vi.fn(async () => "https://checkout.stripe.com/test"),
    addMember: vi.fn(),
    bindAuthIdentity: vi.fn(),
    syncMyStravaActivities: vi.fn(async () => ({})),
    linkStravaAccount: vi.fn(async () => ({})),
  };
});

vi.mock("react-oidc-context", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("spacetimedb/react", () => ({
  useSpacetimeDB: mocks.useSpacetimeDBMock,
  useTable: mocks.useTableMock,
}));

vi.mock("../../hooks/useMembers", () => ({
  useMembers: mocks.useMembersMock,
}));

describe("SettingsPanel invite/role security", () => {
  const STRAVA_STATE_STORAGE_KEY = "expedition-strava-oauth-state";
  const STRAVA_PENDING_CALLBACK_STORAGE_KEY = "expedition-strava-oauth-callback-pending";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");

    mocks.useAuthMock.mockReturnValue({
      user: {
        profile: {
          sub: "owner-sub",
          preferred_username: "owner",
        },
      },
    });

    mocks.useSpacetimeDBMock.mockReturnValue({
      getConnection: () => ({
        reducers: {
          addMember: mocks.addMember,
          bindAuthIdentity: mocks.bindAuthIdentity,
          createInvite: mocks.createInvite,
          acceptInvite: mocks.acceptInvite,
          revokeInvite: mocks.revokeInvite,
          setMembershipRole: mocks.setMembershipRole,
          transferExpeditionOwnership: mocks.transferExpeditionOwnership,
          setExpeditionVisibility: mocks.setExpeditionVisibility,
          markNotificationRead: mocks.markNotificationRead,
          trackProductEvent: mocks.trackProductEvent,
        },
        procedures: {
          syncMyStravaActivities: mocks.syncMyStravaActivities,
          linkStravaAccount: mocks.linkStravaAccount,
          createCheckoutSession: mocks.createCheckoutSession,
        },
      }),
    });

    mocks.useMembersMock.mockReturnValue({
      members: [
        { id: 1n, name: "Owner", ownerSub: "owner-sub", colorHex: "#111111", createdAt: { toDate: () => new Date() } },
        { id: 2n, name: "Member", ownerSub: "member-sub", colorHex: "#222222", createdAt: { toDate: () => new Date() } },
      ],
    });
  });

  function renderPanel(
    memberships: Array<{ id: bigint; expeditionId: bigint; memberId: bigint; role: string; status: string; leftAt: unknown }>,
    notifications: Array<{
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
    }> = [],
    expeditionInviteOnly = false,
  ) {
    mocks.useTableMock.mockImplementation((table) => {
      if (table === tables.invite) return [[], true];
      if (table === tables.expedition) {
        return [[{ id: 10n, name: "Alpha", slug: "alpha", inviteOnly: expeditionInviteOnly, isArchived: false }], true];
      }
      if (table === tables.membership) return [memberships, true];
      if (table === tables.notification) return [notifications, true];
      return [[], true];
    });

    return render(
      <SettingsPanel
        theme="dark"
        onThemeChange={() => {}}
        mapMode="asRan"
        onMapModeChange={() => {}}
        activeExpedition={{ id: 10n, name: "Alpha", slug: "alpha" }}
        onCreateExpedition={async () => true}
        isCreatingExpedition={false}
        expeditionCreateError=""
      />,
    );
  }

  it("blocks non-owner from role changes in UI", () => {
    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "admin", status: "active", leftAt: null },
      { id: 2n, expeditionId: 10n, memberId: 2n, role: "member", status: "active", leftAt: null },
    ]);

    const makeAdminButtons = screen.getAllByRole("button", { name: "Make admin" });
    const makeOwnerButtons = screen.getAllByRole("button", { name: "Make owner" });

    makeAdminButtons.forEach((button) => {
      expect(button.hasAttribute("disabled")).toBe(true);
    });
    makeOwnerButtons.forEach((button) => {
      expect(button.hasAttribute("disabled")).toBe(true);
    });

    expect(screen.getByText("Only the current owner can change roles or transfer ownership.")).toBeTruthy();
    expect(mocks.setMembershipRole).not.toHaveBeenCalled();
    expect(mocks.transferExpeditionOwnership).not.toHaveBeenCalled();
  });

  it("allows owner to promote member and transfer ownership", () => {
    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
      { id: 2n, expeditionId: 10n, memberId: 2n, role: "member", status: "active", leftAt: null },
    ]);

    const makeAdminButtons = screen.getAllByRole("button", { name: "Make admin" });
    const makeOwnerButtons = screen.getAllByRole("button", { name: "Make owner" });

    fireEvent.click(makeAdminButtons[1]);
    fireEvent.click(makeOwnerButtons[1]);

    expect(mocks.setMembershipRole).toHaveBeenCalledWith({
      expeditionId: 10n,
      targetMemberId: 2n,
      newRole: "admin",
    });
    expect(mocks.transferExpeditionOwnership).toHaveBeenCalledWith({
      expeditionId: 10n,
      newOwnerMemberId: 2n,
    });
  });

  it("blocks additional role mutations while ownership transfer is pending", () => {
    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
      { id: 2n, expeditionId: 10n, memberId: 2n, role: "member", status: "active", leftAt: null },
    ]);

    const makeAdminButtons = screen.getAllByRole("button", { name: "Make admin" });
    const makeOwnerButtons = screen.getAllByRole("button", { name: "Make owner" });

    fireEvent.click(makeOwnerButtons[1]);
    fireEvent.click(makeAdminButtons[1]);

    expect(mocks.transferExpeditionOwnership).toHaveBeenCalledTimes(1);
    expect(mocks.setMembershipRole).not.toHaveBeenCalled();
    expect(makeAdminButtons[1].hasAttribute("disabled")).toBe(true);
  });

  it("surfaces reducer rejection for invite abuse attempts", () => {
    mocks.acceptInvite.mockImplementation(() => {
      throw new Error("accept_invite: invite is expired");
    });

    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
    ]);

    fireEvent.change(screen.getByPlaceholderText("Invite token"), { target: { value: "expired-token" } });
    fireEvent.click(screen.getByRole("button", { name: "Join by token" }));

    expect(screen.getByText("accept_invite: invite is expired")).toBeTruthy();
    expect(mocks.acceptInvite).toHaveBeenCalledWith({ token: "expired-token" });
  });

  it("surfaces reducer rejection for forged role escalation", () => {
    mocks.setMembershipRole.mockImplementation(() => {
      throw new Error("set_membership_role: allowed roles are owner");
    });

    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
      { id: 2n, expeditionId: 10n, memberId: 2n, role: "member", status: "active", leftAt: null },
    ]);

    const makeAdminButtons = screen.getAllByRole("button", { name: "Make admin" });
    fireEvent.click(makeAdminButtons[1]);

    expect(screen.getByText("set_membership_role: allowed roles are owner")).toBeTruthy();
    expect(mocks.setMembershipRole).toHaveBeenCalledTimes(1);
  });

  it("starts checkout for owner expedition", async () => {
    mocks.createCheckoutSession.mockResolvedValueOnce("");

    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
      { id: 2n, expeditionId: 10n, memberId: 2n, role: "member", status: "active", leftAt: null },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Upgrade now" }));

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith({ expeditionId: 10n });
      expect(screen.getByText("Checkout session could not be created. Verify Stripe config keys.")).toBeTruthy();
    });
  });

  it("surfaces upgrade guidance when seat limit blocks invite acceptance", async () => {
    mocks.acceptInvite.mockImplementation(() => {
      throw new Error("accept_invite: member seat limit reached (5/5)");
    });

    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
    ]);

    fireEvent.change(screen.getByPlaceholderText("Invite token"), { target: { value: "seat-full" } });
    fireEvent.click(screen.getByRole("button", { name: "Join by token" }));

    await waitFor(() => {
      expect(screen.getByText("Action blocked by current plan limit. Upgrade to Pro or Club for higher limits.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Upgrade now" })).toBeTruthy();
    });
  });

  it("renders notifications and marks one as read", () => {
    renderPanel(
      [{ id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null }],
      [
        {
          id: 99n,
          recipientMemberId: 1n,
          actorMemberId: 2n,
          expeditionId: 10n,
          eventKind: "comment_added",
          title: "New comment on your activity",
          body: "Member commented on your activity.",
          entityType: "activity_log",
          entityId: 8n,
          isRead: false,
          createdAt: { toDate: () => new Date("2026-03-12T01:00:00.000Z") },
          readAt: null,
        },
      ],
    );

    expect(screen.getByText("New comment on your activity")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    expect(mocks.markNotificationRead).toHaveBeenCalledWith({ notificationId: 99n });
  });

  it("updates reminder cadence preference", () => {
    renderPanel([{ id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null }]);

    const reminderCadenceSelect = screen.getByLabelText("Reminder cadence") as HTMLSelectElement;
    expect(reminderCadenceSelect.value).toBe("weekly");

    fireEvent.change(reminderCadenceSelect, { target: { value: "daily" } });
    expect(reminderCadenceSelect.value).toBe("daily");
  });

  it("allows owner to set expedition visibility to invite-only", () => {
    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Set invite-only" }));

    expect(mocks.setExpeditionVisibility).toHaveBeenCalledWith({
      expeditionId: 10n,
      visibility: "invite_only",
    });
    expect(screen.getByText("Visibility updated to invite-only.")).toBeTruthy();
  });

  it("blocks non-owner from changing expedition visibility", () => {
    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "member", status: "active", leftAt: null },
    ]);

    const setPublic = screen.getByRole("button", { name: "Set public" });
    const setInviteOnly = screen.getByRole("button", { name: "Set invite-only" });

    expect(setPublic.hasAttribute("disabled")).toBe(true);
    expect(setInviteOnly.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Only the current owner can change expedition visibility.")).toBeTruthy();
  });

  it("allows owner to set expedition visibility to public", () => {
    renderPanel(
      [{ id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null }],
      [],
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "Set public" }));

    expect(mocks.setExpeditionVisibility).toHaveBeenCalledWith({
      expeditionId: 10n,
      visibility: "public",
    });
    expect(screen.getByText("Visibility updated to public.")).toBeTruthy();
  });

  it("tracks onboarding milestone completion", () => {
    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
    ]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Invite accepted" }));

    expect(mocks.trackProductEvent).toHaveBeenCalledWith({
      eventName: "beta_onboarding_milestone_completed",
      expeditionId: 10n,
      payloadJson: JSON.stringify({ milestone: "inviteAccepted" }),
    });
  });

  it("requires support intake metadata and creates triage ticket", () => {
    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
      { id: 2n, expeditionId: 10n, memberId: 2n, role: "member", status: "active", leftAt: null },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Submit support ticket" }));
    expect(screen.getByText("Issue summary is required.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Issue summary"), { target: { value: "Cannot join expedition" } });
    fireEvent.change(screen.getByLabelText("Repro steps"), { target: { value: "Open invite link and submit token" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit support ticket" }));
    expect(screen.getByText("Next action is required.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Next action"), { target: { value: "Assign BE owner for invite validation" } });
    fireEvent.change(screen.getByLabelText("Support severity"), { target: { value: "blocker" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit support ticket" }));

    expect(screen.getByText("Support ticket created and queued for triage.")).toBeTruthy();
    expect(screen.getByText("Cannot join expedition")).toBeTruthy();
    expect(mocks.trackProductEvent).toHaveBeenCalledWith({
      eventName: "beta_support_ticket_submitted",
      expeditionId: 10n,
      payloadJson: expect.stringContaining("blocker"),
    });
  });

  it("updates ticket status through triage workflow and tracks KPI events", () => {
    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
      { id: 2n, expeditionId: 10n, memberId: 2n, role: "member", status: "active", leftAt: null },
    ]);

    fireEvent.change(screen.getByLabelText("Issue summary"), { target: { value: "Sync stuck" } });
    fireEvent.change(screen.getByLabelText("Repro steps"), { target: { value: "Click sync and wait" } });
    fireEvent.change(screen.getByLabelText("Next action"), { target: { value: "Route to ops for sync diagnostics" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit support ticket" }));

    fireEvent.change(screen.getByLabelText("Status for Sync stuck"), { target: { value: "triaged" } });
    fireEvent.change(screen.getByLabelText("Owner for Sync stuck"), { target: { value: "Member" } });
    fireEvent.change(screen.getByLabelText("Status for Sync stuck"), { target: { value: "closed" } });

    expect(screen.getByDisplayValue("Member")).toBeTruthy();
    expect(mocks.trackProductEvent).toHaveBeenCalledWith({
      eventName: "beta_support_ticket_status_changed",
      expeditionId: 10n,
      payloadJson: expect.stringContaining("closed"),
    });
    expect(screen.getByText(/Avg first triage/)).toBeTruthy();
  });

  it("normalizes legacy persisted support tickets on load", () => {
    localStorage.setItem(
      "expedition-beta-support-tickets:1:10",
      JSON.stringify([
        {
          id: "legacy-1",
          summary: "Old ticket",
          category: "bug",
          severity: "critical",
          status: "open",
        },
      ]),
    );

    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
      { id: 2n, expeditionId: 10n, memberId: 2n, role: "member", status: "active", leftAt: null },
    ]);

    expect(screen.getByText("Old ticket")).toBeTruthy();
    expect((screen.getByLabelText("Status for Old ticket") as HTMLSelectElement).value).toBe("new");
    expect((screen.getByLabelText("Owner for Old ticket") as HTMLSelectElement).value).toBe("unassigned");
    expect(screen.getByText(/source:in_app/)).toBeTruthy();
  });

  it("replays pending Strava callback after transient connection interruption", async () => {
    const pendingState = "owner-sub:state-1";
    localStorage.setItem(STRAVA_STATE_STORAGE_KEY, pendingState);
    window.history.replaceState({}, "", `/?strava_code=auth-code&strava_state=${encodeURIComponent(pendingState)}`);

    let currentConnection: unknown | null = null;

    mocks.useSpacetimeDBMock.mockImplementation(() => ({
      getConnection: () => currentConnection,
    }));

    const rendered = renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
      { id: 2n, expeditionId: 10n, memberId: 2n, role: "member", status: "active", leftAt: null },
    ]);

    expect(screen.getByText("Strava callback received. Waiting for connection — keep this tab open.")).toBeTruthy();
    expect(localStorage.getItem(STRAVA_PENDING_CALLBACK_STORAGE_KEY)).toContain("auth-code");
    expect(window.location.search).toBe("");

    currentConnection = {
      reducers: {
        addMember: mocks.addMember,
        bindAuthIdentity: mocks.bindAuthIdentity,
        createInvite: mocks.createInvite,
        acceptInvite: mocks.acceptInvite,
        revokeInvite: mocks.revokeInvite,
        setMembershipRole: mocks.setMembershipRole,
        transferExpeditionOwnership: mocks.transferExpeditionOwnership,
        setExpeditionVisibility: mocks.setExpeditionVisibility,
        markNotificationRead: mocks.markNotificationRead,
        trackProductEvent: mocks.trackProductEvent,
      },
      procedures: {
        syncMyStravaActivities: mocks.syncMyStravaActivities,
        linkStravaAccount: mocks.linkStravaAccount,
        createCheckoutSession: mocks.createCheckoutSession,
      },
    };

    rendered.rerender(
      <SettingsPanel
        theme="dark"
        onThemeChange={() => {}}
        mapMode="asRan"
        onMapModeChange={() => {}}
        activeExpedition={{ id: 10n, name: "Alpha", slug: "alpha" }}
        onCreateExpedition={async () => true}
        isCreatingExpedition={false}
        expeditionCreateError=""
      />,
    );

    await waitFor(() => {
      expect(mocks.linkStravaAccount).toHaveBeenCalledWith(
        expect.objectContaining({ code: "auth-code" }),
      );
      expect(screen.getByText("Strava linked. Use Sync now to import recent activities.")).toBeTruthy();
    });

    expect(localStorage.getItem(STRAVA_PENDING_CALLBACK_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(STRAVA_STATE_STORAGE_KEY)).toBeNull();
  });

  it("shows actionable guidance for invalid Strava OAuth state", () => {
    localStorage.setItem(STRAVA_STATE_STORAGE_KEY, "owner-sub:expected");
    window.history.replaceState({}, "", "/?strava_code=auth-code&strava_state=owner-sub:unexpected");

    renderPanel([
      { id: 1n, expeditionId: 10n, memberId: 1n, role: "owner", status: "active", leftAt: null },
      { id: 2n, expeditionId: 10n, memberId: 2n, role: "member", status: "active", leftAt: null },
    ]);

    expect(screen.getByText("Strava link failed: invalid OAuth state. Click Connect Strava to restart linking.")).toBeTruthy();
  });
});
