import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LogForm } from "./LogForm";

const mocks = vi.hoisted(() => {
  const logActivity = vi.fn();
  const requestAiCoaching = vi.fn(async () => ({}));
  return {
    logActivity,
    requestAiCoaching,
    useAuthMock: vi.fn(),
    useMembersMock: vi.fn(),
    useSpacetimeDBMock: vi.fn(),
    useTableMock: vi.fn(),
  };
});

vi.mock("react-oidc-context", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("../../hooks/useMembers", () => ({
  useMembers: mocks.useMembersMock,
}));

vi.mock("spacetimedb/react", () => ({
  useSpacetimeDB: mocks.useSpacetimeDBMock,
  useTable: mocks.useTableMock,
}));

describe("LogForm integration guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useTableMock.mockReturnValue([[], true]);
    mocks.useSpacetimeDBMock.mockReturnValue({
      getConnection: () => ({
        reducers: {
          logActivity: mocks.logActivity,
        },
        procedures: {
          requestAiCoaching: mocks.requestAiCoaching,
        },
      }),
    });
  });

  it("blocks submission when no active expedition is selected", () => {
    mocks.useAuthMock.mockReturnValue({
      user: {
        profile: {
          sub: "sub-a",
        },
      },
    });
    mocks.useMembersMock.mockReturnValue({
      members: [
        { id: 1n, name: "A", ownerSub: "sub-a", colorHex: "#111111", createdAt: { toDate: () => new Date() } },
      ],
    });

    render(<LogForm />);
    fireEvent.change(screen.getByPlaceholderText("Distance (km)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));

    expect(screen.getByText("Select an expedition first")).toBeTruthy();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("blocks authenticated users without a linked member profile", () => {
    mocks.useAuthMock.mockReturnValue({
      user: {
        profile: {
          sub: "sub-a",
        },
      },
    });
    mocks.useMembersMock.mockReturnValue({ members: [] });

    render(<LogForm activeExpeditionId={10n} />);
    fireEvent.change(screen.getByPlaceholderText("Distance (km)"), { target: { value: "5" } });
    const submitButton = screen.getByRole("button", { name: "Log it" });
    fireEvent.submit(submitButton.closest("form") as HTMLFormElement);

    expect(screen.getByText("Create your member profile first (Members tab)")).toBeTruthy();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("submits scoped log activity for linked member", () => {
    mocks.useAuthMock.mockReturnValue({
      user: {
        profile: {
          sub: "sub-a",
        },
      },
    });
    mocks.useMembersMock.mockReturnValue({
      members: [
        { id: 1n, name: "A", ownerSub: "sub-a", colorHex: "#111111", createdAt: { toDate: () => new Date() } },
      ],
    });

    render(<LogForm activeExpeditionId={10n} />);
    fireEvent.change(screen.getByPlaceholderText("Distance (km)"), { target: { value: "6.5" } });
    fireEvent.change(screen.getByPlaceholderText("Note (optional)"), { target: { value: "tempo" } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));

    expect(mocks.logActivity).toHaveBeenCalledTimes(1);
    expect(mocks.logActivity).toHaveBeenCalledWith({
      memberId: 1n,
      activityType: "run",
      distanceKm: 6.5,
      note: "tempo",
    });
  });
});
