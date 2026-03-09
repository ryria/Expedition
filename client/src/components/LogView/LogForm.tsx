import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { useMembers } from "../../hooks/useMembers";
import { getConnection, getProcedures } from "../../spacetime/connection";
import { ACTIVITY_TYPES, ACTIVITY_ICONS } from "../../config";

type ActivityLogInsertRow = { id: bigint; memberId: bigint };
type ActivityInsertCb = (ctx: unknown, row: ActivityLogInsertRow) => void;

interface ActivityLogInsertTable {
  onInsert(cb: ActivityInsertCb): void;
  removeOnInsert(cb: ActivityInsertCb): void;
}

export function LogForm() {
  const auth = useAuth();
  const { members } = useMembers();
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

  // Listen for new activity inserts; call AI coaching on the first match
  useEffect(() => {
    let disposed = false;
    let table: ActivityLogInsertTable | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const onInsert: ActivityInsertCb = (_ctx, row) => {
      if (pendingMemberId.current != null && row.memberId === pendingMemberId.current) {
        pendingMemberId.current = null;
        try {
          getProcedures().requestAiCoaching({ logId: row.id });
        } catch (err) {
          console.warn("requestAiCoaching failed", err);
        }
      }
    };

    const attach = () => {
      if (disposed) return;

      let conn;
      try {
        conn = getConnection();
      } catch {
        retryTimer = setTimeout(attach, 250);
        return;
      }

      table = conn.db.activity_log as ActivityLogInsertTable;
      table.onInsert(onInsert);
    };

    attach();

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      table?.removeOnInsert(onInsert);
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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
      const conn = getConnection();
      pendingMemberId.current = selectedMember.id;
      conn.reducers.logActivity({ memberId: selectedMember.id, activityType: actType, distanceKm: km, note: note.trim() });
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
