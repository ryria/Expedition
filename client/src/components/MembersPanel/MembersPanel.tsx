import { useState } from "react";
import { useMembers } from "../../hooks/useMembers";
import { getConnection } from "../../spacetime/connection";
import { DEFAULT_COLORS } from "../../config";
import "./MembersPanel.css";

export function MembersPanel() {
  const { members } = useMembers();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [error, setError] = useState("");

  function handleAdd() {
    setError("");
    if (!name.trim()) { setError("Name required"); return; }
    if (members.some((m) => m.name.toLowerCase() === name.trim().toLowerCase())) {
      setError("Name already taken"); return;
    }
    const conn = getConnection();
    (conn as any).reducers.addMember(name.trim(), color);
    setName("");
  }

  function handleRemove(id: bigint) {
    (getConnection() as any).reducers.removeMember(id);
  }

  return (
    <div className="members-panel">
      <h2>Members</h2>

      <ul className="member-list">
        {members.map((m) => (
          <li key={String(m.id)} className="member-row">
            <span className="swatch" style={{ background: m.colorHex }} />
            <span className="member-name">{m.name}</span>
            <button className="remove-btn" onClick={() => handleRemove(m.id)}>✕</button>
          </li>
        ))}
      </ul>

      <div className="add-member">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Name"
          maxLength={30}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          title="Pick colour"
        />
        <button onClick={handleAdd}>Add</button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
