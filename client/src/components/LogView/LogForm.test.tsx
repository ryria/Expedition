import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LogForm } from "./LogForm";

const mocks = vi.hoisted(() => {
  let latestOnInsert: ((row: unknown) => void) | undefined;
  const logActivity = vi.fn();
  const trackProductEvent = vi.fn();
  const requestAiCoaching = vi.fn(async () => ({}));
  return {
    setLatestOnInsert: (cb: ((row: unknown) => void) | undefined) => {
      latestOnInsert = cb;
    },
    getLatestOnInsert: () => latestOnInsert,
    logActivity,
    trackProductEvent,
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

    mocks.setLatestOnInsert(undefined);
    mocks.useTableMock.mockImplementation((_table, options?: { onInsert?: (row: unknown) => void }) => {
      if (options?.onInsert) {
        mocks.setLatestOnInsert(options.onInsert);
      }
      return [[], true];
    });
    mocks.useSpacetimeDBMock.mockReturnValue({
      getConnection: () => ({
        reducers: {
          logActivity: mocks.logActivity,
          trackProductEvent: mocks.trackProductEvent,
        },
        procedures: {
          requestAiCoaching: mocks.requestAiCoaching,
        },
      }),
    });
  });

  it("submits when no active expedition is selected", () => {
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

    expect(mocks.logActivity).toHaveBeenCalledWith({
      memberId: 1n,
      activityType: "run",
      distanceKm: 5,
      note: "",
    });
    expect(mocks.trackProductEvent).toHaveBeenCalledWith({
      eventName: "activity_log_submitted",
      expeditionId: 0n,
      payloadJson: JSON.stringify({
        activityType: "run",
        distanceKm: 5,
      }),
    });
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

  it("submits user-level log activity for linked member", () => {
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
    expect(mocks.trackProductEvent).toHaveBeenCalledWith({
      eventName: "activity_log_submitted",
      expeditionId: 10n,
      payloadJson: JSON.stringify({
        activityType: "run",
        distanceKm: 6.5,
      }),
    });
  });

  it("surfaces reducer authentication-required rejection for forged unauthenticated context", () => {
    mocks.logActivity.mockImplementation(() => {
      throw new Error("log_activity: Authentication required");
    });
    mocks.useAuthMock.mockReturnValue({ user: undefined });
    mocks.useMembersMock.mockReturnValue({
      members: [
        { id: 1n, name: "A", ownerSub: "sub-a", colorHex: "#111111", createdAt: { toDate: () => new Date() } },
      ],
    });

    render(<LogForm activeExpeditionId={10n} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("Distance (km)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));

    expect(screen.getByText("log_activity: Authentication required")).toBeTruthy();
    expect(mocks.logActivity).toHaveBeenCalledTimes(1);
    expect(mocks.requestAiCoaching).not.toHaveBeenCalled();
  });

  it("surfaces reducer auth-mismatch rejection for forged mutation attempts", () => {
    mocks.logActivity.mockImplementation(() => {
      throw new Error("log_activity: you can only log activity for your own profile");
    });
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
    fireEvent.change(screen.getByPlaceholderText("Distance (km)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));

    expect(screen.getByText("log_activity: you can only log activity for your own profile")).toBeTruthy();
    expect(mocks.logActivity).toHaveBeenCalledTimes(1);
    expect(mocks.requestAiCoaching).not.toHaveBeenCalled();
  });

  it("shows consistent distance bounds for invalid lower-bound input", () => {
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
    fireEvent.change(screen.getByPlaceholderText("Distance (km)"), { target: { value: "0" } });
    const submitButton = screen.getByRole("button", { name: "Log it" });
    fireEvent.submit(submitButton.closest("form") as HTMLFormElement);

    expect(screen.getByText("Distance must be 0.1–500 km")).toBeTruthy();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });

  it("blocks duplicate submits while previous log is still pending", () => {
    mocks.logActivity.mockImplementation(() => {});
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
    fireEvent.change(screen.getByPlaceholderText("Distance (km)"), { target: { value: "4" } });
    const submitButton = screen.getByRole("button", { name: "Log it" });
    const form = submitButton.closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(mocks.logActivity).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Previous activity log is still processing. Please wait a moment.")).toBeTruthy();
  });

  it("triggers AI coaching only for matching member insert", async () => {
    mocks.logActivity.mockImplementation(() => {});
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
    fireEvent.change(screen.getByPlaceholderText("Distance (km)"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));

    const onInsert = mocks.getLatestOnInsert();
    expect(onInsert).toBeTypeOf("function");

    onInsert?.({ id: 100n, memberId: 2n, expeditionId: 20n });
    expect(mocks.requestAiCoaching).not.toHaveBeenCalled();

    onInsert?.({ id: 101n, memberId: 1n, expeditionId: 10n });
    await waitFor(() => {
      expect(mocks.requestAiCoaching).toHaveBeenCalledWith({ logId: 101n });
    });
  });
});
