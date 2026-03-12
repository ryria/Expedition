import { useMemo } from "react";
import { useTable } from "spacetimedb/react";
import { tables } from "../../spacetime/generated";

type ExpeditionRow = {
  id: bigint;
  isArchived: boolean;
};

type MembershipRow = {
  expeditionId: bigint;
  memberId: bigint;
  status: string;
  leftAt: unknown;
};

type ActivityLogRow = {
  expeditionId: bigint;
  memberId: bigint;
  timestamp: { toDate: () => Date };
};

type PlanSubscriptionRow = {
  expeditionId: bigint;
  status: string;
};

function asPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export function KpiDashboard() {
  const [expeditionRows] = useTable(tables.expedition);
  const [membershipRows] = useTable(tables.membership);
  const [activityRows] = useTable(tables.activity_log);
  const [subscriptionRows] = useTable(tables.plan_subscription);

  const kpis = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const currentStart = now - sevenDaysMs;
    const previousStart = now - 2 * sevenDaysMs;

    const activeExpeditions = (expeditionRows as readonly ExpeditionRow[]).filter(
      (row) => !row.isArchived,
    );

    const recentActivity = (activityRows as readonly ActivityLogRow[]).filter(
      (row) => row.timestamp.toDate().getTime() >= currentStart,
    );

    const wae = new Set(recentActivity.map((row) => row.expeditionId.toString())).size;

    const membershipsByExpedition = new Map<string, Set<string>>();
    for (const membership of membershipRows as readonly MembershipRow[]) {
      if (membership.status.toLowerCase() === "left" || membership.leftAt != null) {
        continue;
      }

      const key = membership.expeditionId.toString();
      if (!membershipsByExpedition.has(key)) membershipsByExpedition.set(key, new Set());
      membershipsByExpedition.get(key)?.add(membership.memberId.toString());
    }

    const activityByExpedition = new Set((activityRows as readonly ActivityLogRow[]).map(
      (row) => row.expeditionId.toString(),
    ));

    const activatedExpeditions = activeExpeditions.filter((expedition) => {
      const key = expedition.id.toString();
      const members = membershipsByExpedition.get(key);
      return (members?.size ?? 0) >= 2 && activityByExpedition.has(key);
    }).length;

    const previousActiveMembers = new Set(
      (activityRows as readonly ActivityLogRow[])
        .filter((row) => {
          const when = row.timestamp.toDate().getTime();
          return when >= previousStart && when < currentStart;
        })
        .map((row) => row.memberId.toString()),
    );

    const currentActiveMembers = new Set(
      recentActivity.map((row) => row.memberId.toString()),
    );

    let retainedMembers = 0;
    for (const memberId of previousActiveMembers) {
      if (currentActiveMembers.has(memberId)) retainedMembers += 1;
    }

    const subscriptions = subscriptionRows as readonly PlanSubscriptionRow[];
    const activeSubscriptions = subscriptions.filter(
      (row) => row.status === "active" || row.status === "trialing",
    ).length;
    const canceledSubscriptions = subscriptions.filter(
      (row) => row.status === "canceled",
    ).length;

    return {
      wae,
      activationRate: asPercent(activatedExpeditions, activeExpeditions.length),
      retentionRate: asPercent(retainedMembers, previousActiveMembers.size),
      conversionRate: asPercent(activeSubscriptions, activeExpeditions.length),
      churnRate: asPercent(canceledSubscriptions, subscriptions.length),
    };
  }, [activityRows, expeditionRows, membershipRows, subscriptionRows]);

  return (
    <div className="kpi-dashboard">
      <h3>Growth & Revenue KPIs</h3>
      <div className="summary-stats">
        <div className="stat"><span className="stat-value">{kpis.wae}</span><span className="stat-label">WAE (7d)</span></div>
        <div className="stat"><span className="stat-value">{kpis.activationRate}</span><span className="stat-label">Activation</span></div>
        <div className="stat"><span className="stat-value">{kpis.retentionRate}</span><span className="stat-label">Retention (D7 proxy)</span></div>
        <div className="stat"><span className="stat-value">{kpis.conversionRate}</span><span className="stat-label">Free→Paid</span></div>
        <div className="stat"><span className="stat-value">{kpis.churnRate}</span><span className="stat-label">Paid churn</span></div>
      </div>
    </div>
  );
}
