import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { useMembers } from "../../hooks/useMembers";
import { DbConnection, tables } from "../../spacetime/generated";
import {
  ACTIVITY_TYPES,
  ACTIVITY_ICONS,
  distanceUnitLabel,
  formatDistance,
  toStoredDistance,
  type DistanceUnit,
} from "../../config";

type ActivityLogInsertRow = {
  id: bigint;
  memberId: bigint;
  expeditionId: bigint;
  timestamp: { toDate: () => Date };
};
type ExpeditionProcedures = {
  requestAiCoaching(args: { logId: bigint }): Promise<unknown>;
};

type AnalyticsReducers = {
  trackProductEvent?: (args: {
    eventName: string;
    expeditionId: bigint;
    payloadJson: string;
  }) => void;
};

const PENDING_SUBMISSION_TTL_MS = 5000;

interface LogFormProps {
  activeExpeditionId?: bigint;
  distanceUnit?: DistanceUnit;
}

export function LogForm({ activeExpeditionId, distanceUnit = "km" }: LogFormProps) {
  const auth = useAuth();
  const connectionState = useSpacetimeDB();
  const { members } = useMembers();
  const [personMemberId, setPersonMemberId] = useState("");
  const [actType, setActType] = useState<string>("run");
  const [dist, setDist] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pendingSubmission = useRef<{ memberId: bigint; submittedAtMs: number } | null>(null);
  const sub = auth.user?.profile?.sub as string | undefined;
  const maxDisplayDistance = Number(formatDistance(500, distanceUnit, 1)).toString();

  const linkedMember = members.find((m) => sub != null && m.ownerSub === sub) ?? null;

  useEffect(() => {
    if (linkedMember) {
      setPersonMemberId(String(linkedMember.id));
    }
  }, [linkedMember]);

  useTable(tables.activity_log, {
    onInsert: (row) => {
      const inserted = row as ActivityLogInsertRow;
      const pending = pendingSubmission.current;
      const insertedAtMs = inserted.timestamp?.toDate?.().getTime() ?? Date.now();
      if (
        pending != null &&
        inserted.memberId === pending.memberId &&
        insertedAtMs >= pending.submittedAtMs - 1000
      ) {
        pendingSubmission.current = null;
        const conn = connectionState.getConnection() as DbConnection | null;
        const procedures = conn?.procedures as ExpeditionProcedures | undefined;
        void procedures?.requestAiCoaching({ logId: inserted.id }).catch((err) => {
          console.warn("requestAiCoaching failed", err);
        });
      }
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const enteredDistance = parseFloat(dist);
    const km = toStoredDistance(enteredDistance, distanceUnit);
    const pending = pendingSubmission.current;
    if (pending) {
      if (Date.now() - pending.submittedAtMs < PENDING_SUBMISSION_TTL_MS) {
        setError("Previous activity log is still processing. Please wait a moment.");
        return;
      }
      pendingSubmission.current = null;
    }
    if (sub && !linkedMember) {
      setError("Create your member profile first (Members tab)");
      return;
    }
    if (!personMemberId) { setError("Select a person"); return; }
    const selectedMember = members.find((m) => String(m.id) === personMemberId) ?? null;
    if (!selectedMember) {
      setError("Selected member not found");
      return;
    }
    if (linkedMember && selectedMember.id !== linkedMember.id) {
      setError("You can only log activity for your linked member profile");
      return;
    }
    if (!dist || isNaN(km) || isNaN(enteredDistance) || enteredDistance <= 0 || km > 500) {
      setError(`Distance must be 0.1–${maxDisplayDistance} ${distanceUnitLabel(distanceUnit)}`); return;
    }
    setSubmitting(true);
    try {
      const conn = connectionState.getConnection() as DbConnection | null;
      if (!conn) throw new Error("SpacetimeDB not connected");
      pendingSubmission.current = {
        memberId: selectedMember.id,
        submittedAtMs: Date.now(),
      };
      const noteValue = note.trim();
      const logActivityReducer = (conn.reducers as { logActivity?: (...args: unknown[]) => unknown }).logActivity;
      if (!logActivityReducer) {
        throw new Error("log_activity reducer unavailable");
      }

      try {
        await Promise.resolve(logActivityReducer(selectedMember.id, actType, km, noteValue));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes("invalid arguments for reducer log_activity")) {
          throw err;
        }
        await Promise.resolve(
          logActivityReducer({
            memberId: selectedMember.id,
            activityType: actType,
            distanceKm: km,
            note: noteValue,
          }),
        );
      }

      const analytics = conn.reducers as AnalyticsReducers;
      analytics.trackProductEvent?.({
        eventName: "activity_log_submitted",
        expeditionId: activeExpeditionId ?? 0n,
        payloadJson: JSON.stringify({
          activityType: actType,
          distanceKm: km,
        }),
      });
      setDist("");
      setNote("");
    } catch (err: unknown) {
      pendingSubmission.current = null;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="log-form">
      <select value={personMemberId} onChange={(e) => setPersonMemberId(e.target.value)} required disabled={!!linkedMember}>
        <option value="">Who are you?</option>
        {members.map((m) => (
          <option key={String(m.id)} value={String(m.id)}>{m.name}</option>
        ))}
      </select>

      <div className="act-type-row">
        {ACTIVITY_TYPES.map((t) => (
          <button
            key={t} type="button"
            className={`act-btn ${actType === t ? "active" : ""}`}
            onClick={() => setActType(t)}
          >
            {ACTIVITY_ICONS[t]} {t}
          </button>
        ))}
      </div>

      <input
        type="number" value={dist} onChange={(e) => setDist(e.target.value)}
        placeholder={`Distance (${distanceUnitLabel(distanceUnit)})`} min="0.1" max={maxDisplayDistance} step="0.1" required
      />

      <textarea
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)" rows={2} maxLength={300}
      />

      {error && <p className="field-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Logging…" : "Log it"}
      </button>
    </form>
  );
}
