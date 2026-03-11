import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  beforeEach(() => {
    vi.clearAllMocks();

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
        },
        procedures: {
          syncMyStravaActivities: mocks.syncMyStravaActivities,
          linkStravaAccount: mocks.linkStravaAccount,
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

  function renderPanel(memberships: Array<{ id: bigint; expeditionId: bigint; memberId: bigint; role: string; status: string; leftAt: unknown }>) {
    mocks.useTableMock.mockImplementation((table) => {
      if (table === tables.invite) return [[], true];
      if (table === tables.membership) return [memberships, true];
      return [[], true];
    });

    render(
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
});
