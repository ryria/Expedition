import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiDashboard } from "./KpiDashboard";

const mocks = vi.hoisted(() => ({
  useTableMock: vi.fn(),
  tables: {
    expedition: "expedition-table",
    membership: "membership-table",
    activity_log: "activity-table",
    plan_subscription: "subscription-table",
  },
}));

vi.mock("spacetimedb/react", () => ({
  useTable: mocks.useTableMock,
}));

vi.mock("../../spacetime/generated", () => ({
  tables: mocks.tables,
}));

describe("KpiDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const threeDaysAgo = new Date(now - 3 * dayMs);
    const tenDaysAgo = new Date(now - 10 * dayMs);

    const expeditionRows = [
      { id: 1n, isArchived: false },
      { id: 2n, isArchived: false },
      { id: 3n, isArchived: true },
    ];

    const membershipRows = [
      { expeditionId: 1n, memberId: 11n, status: "active", leftAt: null },
      { expeditionId: 1n, memberId: 12n, status: "active", leftAt: null },
      { expeditionId: 2n, memberId: 21n, status: "active", leftAt: null },
    ];

    const activityRows = [
      { expeditionId: 1n, memberId: 11n, timestamp: { toDate: () => threeDaysAgo } },
      { expeditionId: 1n, memberId: 12n, timestamp: { toDate: () => threeDaysAgo } },
      { expeditionId: 2n, memberId: 21n, timestamp: { toDate: () => tenDaysAgo } },
      { expeditionId: 2n, memberId: 11n, timestamp: { toDate: () => tenDaysAgo } },
    ];

    const subscriptionRows = [
      { expeditionId: 1n, status: "active" },
      { expeditionId: 2n, status: "canceled" },
    ];

    mocks.useTableMock.mockImplementation((table: string) => {
      if (table === mocks.tables.expedition) return [expeditionRows, true];
      if (table === mocks.tables.membership) return [membershipRows, true];
      if (table === mocks.tables.activity_log) return [activityRows, true];
      if (table === mocks.tables.plan_subscription) return [subscriptionRows, true];
      return [[], true];
    });
  });

  it("renders computed KPI metrics", () => {
    render(<KpiDashboard />);

    expect(screen.getByText("Growth & Revenue KPIs")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getAllByText("50.0%")).toHaveLength(4);
    expect(screen.queryByText("0.0%")).toBeNull();
  });
});
