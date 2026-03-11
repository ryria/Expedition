import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { useMembers } from "../../hooks/useMembers";
import { DbConnection, tables } from "../../spacetime/generated";
import { ACTIVITY_TYPES, ACTIVITY_ICONS } from "../../config";

type ActivityLogInsertRow = { id: bigint; memberId: bigint };
type ExpeditionProcedures = {
  requestAiCoaching(args: { logId: bigint }): Promise<unknown>;
};

interface LogFormProps {
  activeExpeditionId?: bigint;
}

export function LogForm({ activeExpeditionId }: LogFormProps) {
  const auth = useAuth();
  const connectionState = useSpacetimeDB();
  const { members } = useMembers(activeExpeditionId);
  const [personMemberId, setPersonMemberId] = useState("");
  const [actType, setActType] = useState<string>("run");
  const [dist, setDist] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Track the member who just submitted so we can call AI coaching on their new entry
  const pendingMemberId = useRef<bigint | null>(null);
  const sub = auth.user?.profile?.sub as string | undefined;

  const linkedMember = members.find((m) => sub != null && m.ownerSub === sub) ?? null;

  useEffect(() => {
    if (linkedMember) {
      setPersonMemberId(String(linkedMember.id));
    }
  }, [linkedMember]);

  useTable(tables.activity_log, {
    onInsert: (row) => {
      const inserted = row as ActivityLogInsertRow;
      if (pendingMemberId.current != null && inserted.memberId === pendingMemberId.current) {
        pendingMemberId.current = null;
        const conn = connectionState.getConnection() as DbConnection | null;
        const procedures = conn?.procedures as ExpeditionProcedures | undefined;
        void procedures?.requestAiCoaching({ logId: inserted.id }).catch((err) => {
          console.warn("requestAiCoaching failed", err);
        });
      }
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (activeExpeditionId == null) {
      setError("Select an expedition first");
      return;
    }
    const km = parseFloat(dist);
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
    if (!dist || isNaN(km) || km <= 0 || km > 500) {
      setError("Distance must be 0–500 km"); return;
    }
    setSubmitting(true);
    try {
      const conn = connectionState.getConnection() as DbConnection | null;
      if (!conn) throw new Error("SpacetimeDB not connected");
      pendingMemberId.current = selectedMember.id;
      conn.reducers.logActivity({
        expeditionId: activeExpeditionId,
        memberId: selectedMember.id,
        activityType: actType,
        distanceKm: km,
        note: note.trim(),
      });
      setDist("");
      setNote("");
    } catch (err: unknown) {
      pendingMemberId.current = null;
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
        placeholder="Distance (km)" min="0.1" max="500" step="0.1" required
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
