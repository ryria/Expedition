import { useEffect, useRef, useState } from "react";
import { useMembers } from "../../hooks/useMembers";
import { getConnection, getProcedures } from "../../spacetime/connection";
import { ACTIVITY_TYPES, ACTIVITY_ICONS } from "../../config";

type ActivityLogInsertRow = { id: bigint; personName: string };
type ActivityInsertCb = (ctx: unknown, row: ActivityLogInsertRow) => void;

interface ActivityLogInsertTable {
  onInsert(cb: ActivityInsertCb): void;
  removeOnInsert(cb: ActivityInsertCb): void;
}

export function LogForm() {
  const { members } = useMembers();
  const [person, setPerson] = useState("");
  const [actType, setActType] = useState<string>("run");
  const [dist, setDist] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Track the person who just submitted so we can call AI coaching on their new entry
  const pendingPerson = useRef<string | null>(null);

  // Listen for new activity inserts; call AI coaching on the first match
  useEffect(() => {
    const conn = getConnection();
    const table = (conn.db.activity_log as ActivityLogInsertTable);
    const onInsert: ActivityInsertCb = (_ctx, row) => {
      if (pendingPerson.current && row.personName === pendingPerson.current) {
        pendingPerson.current = null;
        try {
          getProcedures().requestAiCoaching({ logId: row.id });
        } catch (err) {
          console.warn("requestAiCoaching failed", err);
        }
      }
    };
    table.onInsert(onInsert);
    return () => table.removeOnInsert(onInsert);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const km = parseFloat(dist);
    if (!person) { setError("Select a person"); return; }
    if (!dist || isNaN(km) || km <= 0 || km > 500) {
      setError("Distance must be 0–500 km"); return;
    }
    setSubmitting(true);
    try {
      const conn = getConnection();
      pendingPerson.current = person;
      conn.reducers.logActivity({ personName: person, activityType: actType, distanceKm: km, note: note.trim() });
      setDist("");
      setNote("");
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="log-form">
      <select value={person} onChange={(e) => setPerson(e.target.value)} required>
        <option value="">Who are you?</option>
        {members.map((m) => (
          <option key={String(m.id)} value={m.name}>{m.name}</option>
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
