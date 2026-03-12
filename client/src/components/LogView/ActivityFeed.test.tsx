import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityFeed } from "./ActivityFeed";

const mocks = vi.hoisted(() => ({
  useActivityLogMock: vi.fn(),
  activityCardMock: vi.fn(),
}));

vi.mock("../../hooks/useActivityLog", () => ({
  useActivityLog: mocks.useActivityLogMock,
}));

vi.mock("./ActivityCard", () => ({
  ActivityCard: (props: { entry: { id: bigint } }) => {
    mocks.activityCardMock(props);
    return <li data-testid={`activity-${props.entry.id.toString()}`}>card</li>;
  },
}));

describe("ActivityFeed", () => {
  it("shows loading state before activity table is ready", () => {
    mocks.useActivityLogMock.mockReturnValue({ entries: [], isLoaded: false });

    render(<ActivityFeed activeExpeditionId={10n} />);

    expect(screen.getByText("Loading activities…")).toBeTruthy();
  });

  it("shows empty state once loaded with no entries", () => {
    mocks.useActivityLogMock.mockReturnValue({ entries: [], isLoaded: true });

    render(<ActivityFeed activeExpeditionId={10n} />);

    expect(screen.getByText("No activities yet — open Add Activity to log the first one.")).toBeTruthy();
  });

  it("renders activity cards when entries exist", () => {
    mocks.useActivityLogMock.mockReturnValue({
      isLoaded: true,
      entries: [
        {
          id: 1n,
          expeditionId: 10n,
          memberId: 2n,
          personName: "Runner",
          activityType: "run",
          distanceKm: 5,
          note: "",
          timestamp: { toDate: () => new Date("2026-03-12T00:00:00Z") },
          aiResponse: "",
        },
      ],
    });

    render(<ActivityFeed activeExpeditionId={10n} />);

    expect(screen.getByTestId("activity-1")).toBeTruthy();
  });
});
