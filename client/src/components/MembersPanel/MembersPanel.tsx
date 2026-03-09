import { useMembers } from "../../hooks/useMembers";
import "./MembersPanel.css";

export function MembersPanel() {
  const { members } = useMembers();

  return (
    <div className="members-panel">
      <h2>Current Expedition Members</h2>

      {!members.length && <p className="members-empty">No members yet. Add yourself in Settings.</p>}

      <ul className="member-list">
        {members.map((m) => (
          <li key={String(m.id)} className="member-row">
            <span className="swatch" style={{ background: m.colorHex }} />
            <span className="member-name">{m.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
