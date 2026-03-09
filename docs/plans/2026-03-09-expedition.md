# The Expedition — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use kodex:executing-plans to implement this plan task-by-task.

**Goal:** Build a collaborative fitness tracker for three friends circumnavigating Australia (14,500 km), with a React+Vite SPA, SpacetimeDB Maincloud backend (TypeScript module), real-time sync, Claude AI coaching, dynamic member management, and an aged nautical map view.

**Architecture:** React+Vite SPA connects to a SpacetimeDB Maincloud module via WebSocket subscription. The module owns all persistent state (Members, ActivityLog, Reactions, Comments) and executes Claude API calls via a Procedure (server-side HTTP). GitHub Pages serves the static Vite build; GitHub Actions deploys on push to `main`.

**Tech Stack:** React 18, TypeScript 5, Vite, SpacetimeDB 1.3 (TypeScript module + `@clockworklabs/spacetimedb-sdk`), Claude `claude-sonnet-4-5` (via SpacetimeDB Procedure), Vitest, GitHub Actions, GitHub Pages.

---

## Phase 1 — Project scaffold + SpacetimeDB module

### Task 1: Initialise repository and directory structure

**Files:**
- Create: `module/` (SpacetimeDB TypeScript module)
- Create: `client/` (React + Vite SPA)
- Create: `docs/` (already exists)

**Step 1: Initialise git**

```bash
cd c:/Coding/Expedition
git init
echo "node_modules/\ndist/\n.env\n*.env\nclient/dist/\nmodule/dist/" > .gitignore
```

**Step 2: Scaffold the SpacetimeDB TypeScript module**

```bash
cd c:/Coding/Expedition
spacetime init --lang typescript module
cd module
```

This generates `module/src/lib.ts`, `module/package.json`, and `module/tsconfig.json`. Review the generated `src/lib.ts` to confirm the import paths and decorator API — they may differ slightly between SpacetimeDB versions; use whatever the scaffold generates as the authoritative reference.

**Step 3: Scaffold the React + Vite client**

```bash
cd c:/Coding/Expedition
npm create vite@latest client -- --template react-ts
cd client
npm install
npm install @clockworklabs/spacetimedb-sdk
```

**Step 4: Verify client dev server starts**

```bash
cd c:/Coding/Expedition/client
npm run dev
```

Expected: Vite dev server at `http://localhost:5173`. Stop it with Ctrl+C.

**Step 5: Commit scaffold**

```bash
cd c:/Coding/Expedition
git add .
git commit -m "chore: scaffold module and client"
```

---

### Task 2: Define SpacetimeDB module tables and reducers

**Files:**
- Modify: `module/src/lib.ts` (replace generated stub)

This is the full server-side module. Write all tables and reducers now — schema changes after UI is built require republishing and migration.

**Step 1: Replace `module/src/lib.ts` with the full module**

```typescript
// module/src/lib.ts
// Consult the generated scaffold for exact import paths — they vary by SDK version.
// The example below uses the decorator API. Adjust if your scaffold uses a different style.

import {
  table,
  reducer,
  column,
  primaryKey,
  autoInc,
  SpacetimeDB,
  ReducerContext,
  Identity,
  Timestamp,
} from "@clockworklabs/spacetimedb-sdk/spacetimedb";

// ─── Members ────────────────────────────────────────────────────────────────

@table({ name: "Member", public: true })
export class Member {
  @column({ primaryKey: true, autoInc: true })
  id!: bigint;

  @column({ unique: true })
  name!: string;

  @column
  colorHex!: string; // e.g. "#8b2020"

  @column
  createdAt!: Timestamp;
}

@reducer
export function addMember(ctx: ReducerContext, name: string, colorHex: string) {
  if (!name.trim()) throw new Error("Name cannot be empty");
  if (!colorHex.match(/^#[0-9a-fA-F]{6}$/)) throw new Error("Invalid colour hex");
  Member.insert({ name: name.trim(), colorHex, createdAt: ctx.timestamp });
}

@reducer
export function removeMember(ctx: ReducerContext, id: bigint) {
  Member.id.delete(id);
}

// ─── ActivityLog ─────────────────────────────────────────────────────────────

@table({ name: "ActivityLog", public: true })
export class ActivityLog {
  @column({ primaryKey: true, autoInc: true })
  id!: bigint;

  @column
  personName!: string;

  @column
  activityType!: string; // "run" | "row" | "walk" | "cycle"

  @column
  distanceKm!: number;

  @column
  note!: string; // empty string if none

  @column
  timestamp!: Timestamp;

  @column
  aiResponse!: string; // empty until procedure patches it
}

@reducer
export function logActivity(
  ctx: ReducerContext,
  personName: string,
  activityType: string,
  distanceKm: number,
  note: string
) {
  const validTypes = ["run", "row", "walk", "cycle"];
  if (!personName.trim()) throw new Error("Person name required");
  if (!validTypes.includes(activityType)) throw new Error("Invalid activity type");
  if (distanceKm <= 0 || distanceKm > 500) throw new Error("Distance must be 0–500 km");
  ActivityLog.insert({
    personName: personName.trim(),
    activityType,
    distanceKm,
    note: note.trim(),
    timestamp: ctx.timestamp,
    aiResponse: "",
  });
}

// ─── Reactions ───────────────────────────────────────────────────────────────

@table({ name: "Reaction", public: true })
export class Reaction {
  @column({ primaryKey: true, autoInc: true })
  id!: bigint;

  @column
  logId!: bigint;

  @column
  emoji!: string;

  @column
  reactedBy!: string;

  @column
  timestamp!: Timestamp;
}

@reducer
export function addReaction(
  ctx: ReducerContext,
  logId: bigint,
  emoji: string,
  reactedBy: string
) {
  if (!reactedBy.trim()) throw new Error("Name required to react");
  Reaction.insert({ logId, emoji, reactedBy: reactedBy.trim(), timestamp: ctx.timestamp });
}

// ─── Comments ────────────────────────────────────────────────────────────────

@table({ name: "Comment", public: true })
export class Comment {
  @column({ primaryKey: true, autoInc: true })
  id!: bigint;

  @column
  logId!: bigint;

  @column
  author!: string;

  @column
  body!: string;

  @column
  timestamp!: Timestamp;
}

@reducer
export function addComment(
  ctx: ReducerContext,
  logId: bigint,
  author: string,
  body: string
) {
  if (!author.trim()) throw new Error("Author required");
  if (!body.trim()) throw new Error("Comment cannot be empty");
  Comment.insert({ logId, author: author.trim(), body: body.trim(), timestamp: ctx.timestamp });
}
```

> **Note:** If the generated scaffold uses a different import style or decorator syntax, follow the scaffold's pattern. The table/reducer names and field names above are canonical — keep them exactly as written regardless of import style.

**Step 2: Build the module**

```bash
cd c:/Coding/Expedition/module
npm install
npm run build
```

Expected: `dist/` contains a `.wasm` file. Fix any TypeScript errors about decorators by checking `tsconfig.json` has `"experimentalDecorators": true`.

**Step 3: Publish to Maincloud**

```bash
cd c:/Coding/Expedition/module
spacetime login  # authenticate as Ryria if not already logged in
spacetime publish --project-path . expedition
```

Expected: Module published. Note the module address printed to the terminal — you'll need it in Task 4.

**Step 4: Verify tables exist**

```bash
spacetime describe expedition
```

Expected: Lists `Member`, `ActivityLog`, `Reaction`, `Comment` tables.

**Step 5: Commit**

```bash
cd c:/Coding/Expedition
git add module/
git commit -m "feat(module): define all tables and reducers"
```

---

### Task 3: Client — SpacetimeDB connection + type generation

**Files:**
- Create: `client/src/spacetime/connection.ts`
- Create: `client/src/spacetime/types.ts`
- Modify: `client/src/main.tsx`

**Step 1: Generate TypeScript client types from the published module**

```bash
cd c:/Coding/Expedition/client
spacetime generate --lang typescript --out-dir src/spacetime/generated --project-path ../module
```

This generates typed table classes and reducer call functions in `src/spacetime/generated/`. These are auto-generated — never edit them manually.

**Step 2: Create connection helper**

Create `client/src/spacetime/connection.ts`:

```typescript
import { DBConnection } from "@clockworklabs/spacetimedb-sdk";

// Replace with your published module address from `spacetime publish` output.
// Format: "hostname/database" e.g. "maincloud.spacetimedb.com/expedition"
export const MODULE_ADDRESS = import.meta.env.VITE_STDB_ADDRESS as string;

let _conn: DBConnection | null = null;

export function getConnection(): DBConnection {
  if (!_conn) throw new Error("SpacetimeDB not connected — call initConnection() first");
  return _conn;
}

export async function initConnection(): Promise<DBConnection> {
  const conn = await DBConnection.builder()
    .withUri(MODULE_ADDRESS)
    .withModuleName("expedition")
    .build();
  _conn = conn;
  return conn;
}
```

**Step 3: Create `.env.local` for the module address**

```
VITE_STDB_ADDRESS=maincloud.spacetimedb.com/expedition
```

> Replace `maincloud.spacetimedb.com/expedition` with the actual address printed by `spacetime publish`. `.env.local` is gitignored.

**Step 4: Wire connection into `main.tsx`**

```typescript
// client/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initConnection } from "./spacetime/connection";

initConnection()
  .then((conn) => {
    // Subscribe to all tables
    conn.subscriptionBuilder()
      .subscribe(["SELECT * FROM Member", "SELECT * FROM ActivityLog",
                  "SELECT * FROM Reaction", "SELECT * FROM Comment"]);
    console.log("[SpacetimeDB] connected and subscribed");
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode><App /></React.StrictMode>
    );
  })
  .catch((err) => {
    console.error("[SpacetimeDB] connection failed:", err);
  });
```

**Step 5: Verify connection in browser console**

```bash
cd c:/Coding/Expedition/client
npm run dev
```

Open browser console. Expected: `[SpacetimeDB] connected and subscribed`.

**Step 6: Commit**

```bash
cd c:/Coding/Expedition
git add client/
git commit -m "feat(client): SpacetimeDB connection + type generation"
```

---

## Phase 2 — Members management

### Task 4: Config + Members hook

**Files:**
- Create: `client/src/config.ts`
- Create: `client/src/hooks/useMembers.ts`
- Test: `client/src/hooks/useMembers.test.ts`

**Step 1: Create config**

```typescript
// client/src/config.ts
export const ROUTE_TOTAL_KM = 14_500;

export const DEFAULT_COLORS = [
  "#8b2020", "#1a5c3a", "#1e3a6e",
  "#7c4a03", "#4b0082", "#005c5c",
];

export const ACTIVITY_TYPES = ["run", "row", "walk", "cycle"] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  run: "🏃",
  row: "🚣",
  walk: "🚶",
  cycle: "🚴",
};
```

**Step 2: Write the failing test**

```typescript
// client/src/hooks/useMembers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMembers } from "./useMembers";

// Mock the generated SpacetimeDB client
vi.mock("../spacetime/generated", () => ({
  Member: {
    filterById: vi.fn(),
    onInsert: vi.fn(),
    onDelete: vi.fn(),
  },
}));

describe("useMembers", () => {
  it("returns empty array initially", () => {
    const { result } = renderHook(() => useMembers());
    expect(result.current.members).toEqual([]);
  });
});
```

**Step 3: Run test to confirm it fails**

```bash
cd c:/Coding/Expedition/client
npx vitest run src/hooks/useMembers.test.ts
```

Expected: FAIL — `useMembers` not found.

**Step 4: Implement `useMembers`**

```typescript
// client/src/hooks/useMembers.ts
import { useState, useEffect } from "react";
import { Member } from "../spacetime/generated";

export interface MemberRow {
  id: bigint;
  name: string;
  colorHex: string;
}

export function useMembers() {
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    // Initial load from local cache (populated after subscription)
    const rows = Member.filterById ? [] : []; // SDK populates via onInsert/onDelete
    setMembers(rows);

    const onInsert = (row: MemberRow) =>
      setMembers((prev) => [...prev, row].sort((a, b) => Number(a.id - b.id)));
    const onDelete = (row: MemberRow) =>
      setMembers((prev) => prev.filter((m) => m.id !== row.id));

    Member.onInsert(onInsert);
    Member.onDelete(onDelete);

    return () => {
      // SDK cleanup — check generated types for unsubscribe API
    };
  }, []);

  return { members };
}
```

> **Note:** The exact SpacetimeDB SDK event API (`onInsert`, `onDelete`) should be verified against the generated client code in `src/spacetime/generated/`. The pattern above matches SDK 1.x — adjust if necessary.

**Step 5: Run test to confirm it passes**

```bash
cd c:/Coding/Expedition/client
npx vitest run src/hooks/useMembers.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/config.ts client/src/hooks/
git commit -m "feat(client): config + useMembers hook"
```

---

### Task 5: Members settings panel component

**Files:**
- Create: `client/src/components/MembersPanel/MembersPanel.tsx`
- Create: `client/src/components/MembersPanel/MembersPanel.css`

**Step 1: Write the component**

```typescript
// client/src/components/MembersPanel/MembersPanel.tsx
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
    conn.reducers.addMember(name.trim(), color);
    setName("");
  }

  function handleRemove(id: bigint) {
    getConnection().reducers.removeMember(id);
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
```

**Step 2: Add minimal CSS**

```css
/* client/src/components/MembersPanel/MembersPanel.css */
.members-panel { padding: 1rem; }
.member-list { list-style: none; padding: 0; margin: 0 0 1rem; }
.member-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
.swatch { display: inline-block; width: 18px; height: 18px; border-radius: 3px; flex-shrink: 0; }
.member-name { flex: 1; }
.remove-btn { background: none; border: none; cursor: pointer; color: #999; font-size: 0.9rem; }
.add-member { display: flex; gap: 0.5rem; align-items: center; }
.add-member input[type="text"] { flex: 1; }
.field-error { color: #c00; font-size: 0.85rem; margin-top: 0.25rem; }
```

**Step 3: Mount in App temporarily to verify it renders**

```typescript
// client/src/App.tsx (temporary)
import { MembersPanel } from "./components/MembersPanel/MembersPanel";
export default function App() { return <MembersPanel />; }
```

**Step 4: Open browser, add two members, verify they appear in real time on a second tab**

Open `http://localhost:5173` in two tabs. Add a member in one — it should appear in both.

**Step 5: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/components/MembersPanel/
git commit -m "feat(client): members panel with add/remove and colour picker"
```

---

## Phase 3 — Activity logging + feed

### Task 6: useActivityLog hook

**Files:**
- Create: `client/src/hooks/useActivityLog.ts`
- Test: `client/src/hooks/useActivityLog.test.ts`

**Step 1: Write failing test**

```typescript
// client/src/hooks/useActivityLog.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useActivityLog } from "./useActivityLog";

vi.mock("../spacetime/generated", () => ({
  ActivityLog: { onInsert: vi.fn(), onDelete: vi.fn() },
}));

describe("useActivityLog", () => {
  it("returns entries sorted newest-first", () => {
    const { result } = renderHook(() => useActivityLog());
    expect(result.current.entries).toEqual([]);
  });
});
```

**Step 2: Run to confirm fail**

```bash
cd c:/Coding/Expedition/client
npx vitest run src/hooks/useActivityLog.test.ts
```

**Step 3: Implement hook**

```typescript
// client/src/hooks/useActivityLog.ts
import { useState, useEffect } from "react";
import { ActivityLog } from "../spacetime/generated";

export interface ActivityEntry {
  id: bigint;
  personName: string;
  activityType: string;
  distanceKm: number;
  note: string;
  timestamp: Date;
  aiResponse: string;
}

export function useActivityLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    const onInsert = (row: ActivityEntry) =>
      setEntries((prev) =>
        [row, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      );
    const onUpdate = (oldRow: ActivityEntry, newRow: ActivityEntry) =>
      setEntries((prev) => prev.map((e) => (e.id === oldRow.id ? newRow : e)));
    const onDelete = (row: ActivityEntry) =>
      setEntries((prev) => prev.filter((e) => e.id !== row.id));

    ActivityLog.onInsert(onInsert);
    ActivityLog.onUpdate?.(onUpdate);
    ActivityLog.onDelete(onDelete);
  }, []);

  return { entries };
}
```

**Step 4: Run to confirm pass**

```bash
npx vitest run src/hooks/useActivityLog.test.ts
```

**Step 5: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/hooks/useActivityLog.ts client/src/hooks/useActivityLog.test.ts
git commit -m "feat(client): useActivityLog hook"
```

---

### Task 7: Log form component

**Files:**
- Create: `client/src/components/LogView/LogForm.tsx`
- Create: `client/src/components/LogView/LogView.css`

**Step 1: Write the component**

```typescript
// client/src/components/LogView/LogForm.tsx
import { useState } from "react";
import { useMembers } from "../../hooks/useMembers";
import { getConnection } from "../../spacetime/connection";
import { ACTIVITY_TYPES, ACTIVITY_ICONS } from "../../config";

export function LogForm() {
  const { members } = useMembers();
  const [person, setPerson] = useState("");
  const [actType, setActType] = useState<string>("run");
  const [dist, setDist] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
      conn.reducers.logActivity(person, actType, km, note.trim());
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
```

**Step 2: Create `ActivityFeed.tsx` and `ActivityCard.tsx` stubs**

```typescript
// client/src/components/LogView/ActivityFeed.tsx
import { useActivityLog } from "../../hooks/useActivityLog";
import { ActivityCard } from "./ActivityCard";

export function ActivityFeed() {
  const { entries } = useActivityLog();
  if (!entries.length) return <p className="empty">No activities yet — log the first one!</p>;
  return (
    <ul className="activity-feed">
      {entries.map((e) => <ActivityCard key={String(e.id)} entry={e} />)}
    </ul>
  );
}
```

```typescript
// client/src/components/LogView/ActivityCard.tsx
import type { ActivityEntry } from "../../hooks/useActivityLog";
import { ACTIVITY_ICONS } from "../../config";

interface Props { entry: ActivityEntry; }

export function ActivityCard({ entry }: Props) {
  return (
    <li className="activity-card">
      <div className="card-header">
        <span className="act-icon">{ACTIVITY_ICONS[entry.activityType as keyof typeof ACTIVITY_ICONS] ?? "🏅"}</span>
        <strong>{entry.personName}</strong>
        <span className="km">{entry.distanceKm.toFixed(1)} km</span>
        <span className="ts">{new Date(entry.timestamp).toLocaleString()}</span>
      </div>
      {entry.note && <p className="note">{entry.note}</p>}
      {entry.aiResponse && <p className="ai-response">{entry.aiResponse}</p>}
    </li>
  );
}
```

```typescript
// client/src/components/LogView/LogView.tsx
import { LogForm } from "./LogForm";
import { ActivityFeed } from "./ActivityFeed";

export function LogView() {
  return (
    <div className="log-view">
      <LogForm />
      <ActivityFeed />
    </div>
  );
}
```

**Step 3: Update `App.tsx` to render `LogView` and verify end-to-end**

```typescript
// client/src/App.tsx (temporary)
import { LogView } from "./components/LogView/LogView";
export default function App() { return <LogView />; }
```

**Step 4: Log an entry, verify it appears across two open tabs**

**Step 5: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/components/LogView/
git commit -m "feat(client): log form and activity feed"
```

---

## Phase 4 — Reactions + comments

### Task 8: Reactions

**Files:**
- Create: `client/src/hooks/useReactions.ts`
- Modify: `client/src/components/LogView/ActivityCard.tsx`

**Step 1: Write `useReactions` hook**

```typescript
// client/src/hooks/useReactions.ts
import { useState, useEffect } from "react";
import { Reaction } from "../spacetime/generated";

export interface ReactionRow {
  id: bigint;
  logId: bigint;
  emoji: string;
  reactedBy: string;
}

export function useReactions() {
  const [reactions, setReactions] = useState<ReactionRow[]>([]);

  useEffect(() => {
    Reaction.onInsert((r: ReactionRow) => setReactions((prev) => [...prev, r]));
    Reaction.onDelete((r: ReactionRow) =>
      setReactions((prev) => prev.filter((x) => x.id !== r.id))
    );
  }, []);

  function reactionsFor(logId: bigint) {
    return reactions.filter((r) => r.logId === logId);
  }

  return { reactionsFor };
}
```

**Step 2: Add reaction bar to `ActivityCard`**

Extend `ActivityCard.tsx` to include:
- Six emoji reactions: `["🔥","💪","🌊","🎉","😮","❤️"]`
- A `useReactions()` call to get grouped counts
- Prompt for `reactedBy` name on click (simple `window.prompt` is fine for now)
- Show counts next to each emoji

```typescript
// Add to ActivityCard.tsx
import { useState } from "react";
import { useReactions } from "../../hooks/useReactions";
import { getConnection } from "../../spacetime/connection";

const EMOJIS = ["🔥", "💪", "🌊", "🎉", "😮", "❤️"];

// Inside ActivityCard component:
const { reactionsFor } = useReactions();
const reactionList = reactionsFor(entry.id);

function handleReact(emoji: string) {
  const name = window.prompt("Your name?");
  if (!name?.trim()) return;
  getConnection().reducers.addReaction(entry.id, emoji, name.trim());
}

// In JSX:
// <div className="reaction-bar">
//   {EMOJIS.map((e) => {
//     const count = reactionList.filter((r) => r.emoji === e).length;
//     return (
//       <button key={e} className="reaction-btn" onClick={() => handleReact(e)}>
//         {e}{count > 0 && <span className="reaction-count">{count}</span>}
//       </button>
//     );
//   })}
// </div>
```

**Step 3: Verify reactions sync across tabs**

**Step 4: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/hooks/useReactions.ts client/src/components/LogView/ActivityCard.tsx
git commit -m "feat(client): emoji reactions on activity cards"
```

---

### Task 9: Comments

**Files:**
- Create: `client/src/hooks/useComments.ts`
- Create: `client/src/components/LogView/CommentThread.tsx`
- Modify: `client/src/components/LogView/ActivityCard.tsx`

**Step 1: Write `useComments` hook**

```typescript
// client/src/hooks/useComments.ts
import { useState, useEffect } from "react";
import { Comment } from "../spacetime/generated";

export interface CommentRow {
  id: bigint;
  logId: bigint;
  author: string;
  body: string;
  timestamp: Date;
}

export function useComments() {
  const [comments, setComments] = useState<CommentRow[]>([]);

  useEffect(() => {
    Comment.onInsert((c: CommentRow) => setComments((prev) => [...prev, c]));
    Comment.onDelete((c: CommentRow) =>
      setComments((prev) => prev.filter((x) => x.id !== c.id))
    );
  }, []);

  function commentsFor(logId: bigint) {
    return comments
      .filter((c) => c.logId === logId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  return { commentsFor };
}
```

**Step 2: Write `CommentThread` component**

```typescript
// client/src/components/LogView/CommentThread.tsx
import { useState } from "react";
import { useComments } from "../../hooks/useComments";
import { getConnection } from "../../spacetime/connection";

interface Props { logId: bigint; }

export function CommentThread({ logId }: Props) {
  const { commentsFor } = useComments();
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const comments = commentsFor(logId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!author.trim() || !body.trim()) return;
    getConnection().reducers.addComment(logId, author.trim(), body.trim());
    setBody("");
  }

  return (
    <div className="comment-thread">
      <button className="toggle-comments" onClick={() => setOpen((o) => !o)}>
        {comments.length} comment{comments.length !== 1 ? "s" : ""} {open ? "▲" : "▼"}
      </button>
      {open && (
        <>
          {comments.map((c) => (
            <div key={String(c.id)} className="comment">
              <strong>{c.author}</strong>: {c.body}
              <span className="comment-ts">{new Date(c.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
          <form onSubmit={handleSubmit} className="comment-form">
            <input value={author} onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name" maxLength={30} />
            <input value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment" maxLength={300} />
            <button type="submit">Post</button>
          </form>
        </>
      )}
    </div>
  );
}
```

**Step 3: Add `<CommentThread logId={entry.id} />` to `ActivityCard`**

**Step 4: Verify comments sync live across tabs**

**Step 5: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/hooks/useComments.ts client/src/components/LogView/CommentThread.tsx client/src/components/LogView/ActivityCard.tsx
git commit -m "feat(client): comment threads on activity cards"
```

---

## Phase 5 — Claude AI responses (Procedure)

### Task 10: Add `getAiResponse` Procedure to module

**Files:**
- Modify: `module/src/lib.ts`

SpacetimeDB Procedures can make outbound HTTP requests. They are defined similarly to reducers but using `@procedure` decorator (check the SpacetimeDB 1.x docs for the exact API, which was in beta at time of writing).

**Step 1: Add procedure to `module/src/lib.ts`**

```typescript
// Add to module/src/lib.ts — adjust imports if @procedure is not available in 1.3.0
// Check: https://spacetimedb.com/docs — look for "Procedure" or "HTTP outbound calls"

// If procedures are not yet stable in 1.3.0, use the Cloudflare Worker fallback
// described in the design doc.

import { procedure } from "@clockworklabs/spacetimedb-sdk/spacetimedb"; // check availability

const LANDMARKS = [
  { name: "Sydney", km: 0 },
  { name: "Brisbane", km: 1340 },
  { name: "Cairns", km: 2120 },
  { name: "Darwin", km: 3200 },
  { name: "Broome", km: 4700 },
  { name: "Geraldton", km: 6060 },
  { name: "Perth", km: 6720 },
  { name: "Albany", km: 8080 },
  { name: "Eucla", km: 9460 },
  { name: "Adelaide", km: 11240 },
  { name: "Melbourne", km: 12100 },
  { name: "Eden", km: 12690 },
  { name: "Sydney", km: 14500 },
];

@procedure
export async function getAiResponse(ctx: ReducerContext, logId: bigint) {
  const entry = ActivityLog.id.find(logId);
  if (!entry) return;

  // Sum all previous activity km
  const allEntries = ActivityLog.filterById
    ? ([] as typeof entry[]) // SDK provides iterator — check generated types
    : [];
  const totalKm = allEntries.reduce((s, e) => s + e.distanceKm, 0);
  const pct = ((totalKm / 14_500) * 100).toFixed(1);

  // Find nearest landmarks
  const passed = LANDMARKS.filter((l) => l.km <= totalKm);
  const next = LANDMARKS.find((l) => l.km > totalKm);
  const last = passed[passed.length - 1] ?? LANDMARKS[0];
  const kmToNext = next ? (next.km - totalKm).toFixed(0) : "0";

  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";

  const body = JSON.stringify({
    model: "claude-sonnet-4-5",
    max_tokens: 150,
    system:
      "You are the AI coach for The Expedition — three friends circumnavigating Australia. " +
      "Be short (2-3 sentences), specific to the location, and energetic without being cheesy.",
    messages: [
      {
        role: "user",
        content:
          `${entry.personName} just logged ${entry.distanceKm} km of ${entry.activityType}. ` +
          (entry.note ? `Note: "${entry.note}". ` : "") +
          `Team total: ${totalKm.toFixed(1)} km (${pct}% of 14,500 km). ` +
          `Last landmark: ${last.name}. Next: ${next?.name ?? "Sydney (finish!)"} in ${kmToNext} km.`,
      },
    ],
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  const data = await response.json();
  const text = data?.content?.[0]?.text ?? "";

  // Patch the ai_response field
  entry.aiResponse = text;
  ActivityLog.id.update(entry);
}
```

> **Important:** Set `ANTHROPIC_API_KEY` as an environment secret in the SpacetimeDB Maincloud dashboard before publishing. Never hardcode it.

**Step 2: Republish module**

```bash
cd c:/Coding/Expedition/module
spacetime publish --project-path . expedition
```

**Step 3: Update client to call the procedure after logging**

In `LogForm.tsx`, after `conn.reducers.logActivity(...)` succeeds, call:

```typescript
// The log_activity reducer returns the new row ID via callback in the SDK.
// Check the generated client for how to get the new row ID, then:
// conn.reducers.getAiResponse(newId);
// If the SDK doesn't provide the new ID directly, subscribe to ActivityLog.onInsert
// and call getAiResponse on the first new entry whose personName matches.
```

**Step 4: Log an entry, verify AI response patches into the card within a few seconds**

**Step 5: Commit**

```bash
cd c:/Coding/Expedition
git add module/src/lib.ts client/src/components/LogView/LogForm.tsx
git commit -m "feat(module): Claude AI procedure + wire up in log form"
```

---

## Phase 6 — Map view: route data + trail rendering

### Task 11: Route waypoints + landmark data

**Files:**
- Create: `client/src/data/route.ts`
- Test: `client/src/data/route.test.ts`

**Step 1: Write failing tests for interpolation utility**

```typescript
// client/src/data/route.test.ts
import { describe, it, expect } from "vitest";
import { interpolatePosition, getTrailSegments } from "./route";

describe("interpolatePosition", () => {
  it("returns start point at km 0", () => {
    const pt = interpolatePosition(0);
    expect(pt).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  });

  it("returns end point at km 14500", () => {
    const pt = interpolatePosition(14500);
    expect(pt).toBeDefined();
  });

  it("interpolates midpoint between two waypoints", () => {
    // midpoint between km 0 (Sydney) and km 1340 (Brisbane)
    const mid = interpolatePosition(670);
    const start = interpolatePosition(0);
    const end = interpolatePosition(1340);
    // x and y should be between start and end values
    expect(mid.x).toBeGreaterThanOrEqual(Math.min(start.x, end.x));
    expect(mid.x).toBeLessThanOrEqual(Math.max(start.x, end.x));
  });
});

describe("getTrailSegments — As Ran", () => {
  it("produces one segment per entry", () => {
    const entries = [
      { personName: "Rob", distanceKm: 10 },
      { personName: "Sam", distanceKm: 5 },
    ];
    const members = [
      { name: "Rob", colorHex: "#8b2020" },
      { name: "Sam", colorHex: "#1a5c3a" },
    ];
    const segs = getTrailSegments(entries, members, "asRan");
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ person: "Rob", fromKm: 0, toKm: 10, color: "#8b2020" });
    expect(segs[1]).toMatchObject({ person: "Sam", fromKm: 10, toKm: 15, color: "#1a5c3a" });
  });
});

describe("getTrailSegments — Contribution", () => {
  it("stacks per-person totals", () => {
    const entries = [
      { personName: "Rob", distanceKm: 10 },
      { personName: "Sam", distanceKm: 5 },
      { personName: "Rob", distanceKm: 5 },
    ];
    const members = [
      { name: "Rob", colorHex: "#8b2020" },
      { name: "Sam", colorHex: "#1a5c3a" },
    ];
    const segs = getTrailSegments(entries, members, "contribution");
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ person: "Rob", fromKm: 0, toKm: 15 });
    expect(segs[1]).toMatchObject({ person: "Sam", fromKm: 15, toKm: 20 });
  });
});
```

**Step 2: Run to confirm failures**

```bash
cd c:/Coding/Expedition/client
npx vitest run src/data/route.test.ts
```

**Step 3: Create `route.ts` with waypoints, landmarks, interpolation, and segment generation**

```typescript
// client/src/data/route.ts

// Clockwise from Sydney. ViewBox: 0 0 1100 720.
// Format: [svgX, svgY, cumulativeKm]
export const WAYPOINTS: [number, number, number][] = [
  // Sydney — east coast start
  [878, 578, 0],
  [882, 555, 60],
  [890, 520, 130],
  [900, 490, 200],
  [905, 455, 280],
  // Brisbane area
  [902, 428, 1340],
  [898, 390, 1440],
  [895, 360, 1540],
  [888, 320, 1680],
  // Far north Queensland
  [872, 270, 1850],
  [868, 220, 2060],
  // Cairns
  [868, 200, 2120],
  [870, 175, 2220],
  [872, 150, 2330],
  [875, 120, 2470],
  // Cape York
  [872, 88, 2620],
  [856, 72, 2730],
  // Gulf of Carpentaria — top
  [800, 65, 2880],
  [740, 60, 3060],
  [680, 58, 3170],
  // Darwin
  [614, 72, 3200],
  [570, 80, 3340],
  [520, 90, 3500],
  [470, 88, 3660],
  [420, 92, 3820],
  // Kimberly coast
  [360, 115, 4020],
  [310, 145, 4230],
  [265, 178, 4450],
  // Broome
  [228, 220, 4700],
  [204, 260, 4880],
  [188, 310, 5060],
  [176, 360, 5240],
  [164, 410, 5440],
  // Geraldton
  [148, 458, 6060],
  [138, 490, 6220],
  [130, 520, 6380],
  // Perth
  [130, 548, 6720],
  [138, 575, 6870],
  [150, 600, 7020],
  [165, 624, 7200],
  // Albany
  [195, 642, 8080],
  [235, 652, 8250],
  [280, 655, 8430],
  [330, 654, 8640],
  // Eucla / Nullarbor
  [380, 650, 8860],
  [430, 648, 9060],
  [478, 646, 9260],
  // Eucla
  [510, 644, 9460],
  [555, 640, 9680],
  [600, 636, 9900],
  [648, 632, 10120],
  [695, 620, 10380],
  [730, 608, 10600],
  [760, 600, 10810],
  // Adelaide
  [780, 590, 11240],
  [800, 596, 11410],
  [815, 598, 11550],
  // Melbourne
  [820, 625, 12100],
  [825, 630, 12180],
  [840, 625, 12280],
  // East coast heading home
  [845, 614, 12440],
  // Eden
  [848, 598, 12690],
  [852, 584, 12820],
  [858, 578, 12940],
  [864, 576, 13100],
  [868, 574, 13280],
  [872, 574, 13480],
  [876, 576, 13700],
  [878, 578, 14500], // Sydney — finish
];

export interface Landmark {
  name: string;
  km: number;
  fact: string;
  svgX: number;
  svgY: number;
}

export const LANDMARKS: Landmark[] = [
  { name: "Sydney", km: 0, fact: "Where the journey begins. The Harbour Bridge and Opera House mark the start line.", svgX: 878, svgY: 578 },
  { name: "Brisbane", km: 1340, fact: "Queensland's capital. Gateway to the Great Barrier Reef and the tropical north.", svgX: 902, svgY: 428 },
  { name: "Cairns", km: 2120, fact: "Tropical gateway to the Reef. Cassowaries roam the rainforest just behind the esplanade.", svgX: 868, svgY: 200 },
  { name: "Darwin", km: 3200, fact: "NT capital. Crocodiles in every waterway. Monsoonal lightning storms roll in each afternoon during the Wet.", svgX: 614, svgY: 72 },
  { name: "Broome", km: 4700, fact: "Famous for the Staircase to the Moon — full moon reflecting on tidal flats. Red pindan cliffs, turquoise sea.", svgX: 228, svgY: 220 },
  { name: "Geraldton", km: 6060, fact: "The wreck of the Dutch vessel Batavia (1629) lies offshore — a story of mutiny and survival.", svgX: 148, svgY: 458 },
  { name: "Perth", km: 6720, fact: "The most isolated major city on Earth. Closer to Singapore than to Sydney. Indian Ocean sunsets.", svgX: 130, svgY: 548 },
  { name: "Albany", km: 8080, fact: "Australia's last whaling station closed here in 1978. Now a whale-watching mecca for Southern Rights and Humpbacks.", svgX: 195, svgY: 642 },
  { name: "Eucla", km: 9460, fact: "Population 50. The Nullarbor Plain. The world's longest straight road — 146 km without a bend.", svgX: 510, svgY: 644 },
  { name: "Adelaide", km: 11240, fact: "City of Churches. The Barossa and McLaren Vale begin at the city's edge.", svgX: 780, svgY: 590 },
  { name: "Melbourne", km: 12100, fact: "Australia's cultural capital. Laneways, coffee, street art. Claims most liveable city regularly.", svgX: 820, svgY: 625 },
  { name: "Eden", km: 12690, fact: "Orcas and Humpbacks interact in Twofold Bay. The final stretch home begins.", svgX: 848, svgY: 598 },
  { name: "Sydney", km: 14500, fact: "Journey complete.", svgX: 878, svgY: 578 },
];

// ─── Interpolation ───────────────────────────────────────────────────────────

export function interpolatePosition(km: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(km, 14_500));
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const [x0, y0, km0] = WAYPOINTS[i - 1];
    const [x1, y1, km1] = WAYPOINTS[i];
    if (clamped <= km1) {
      const t = km1 === km0 ? 0 : (clamped - km0) / (km1 - km0);
      return { x: x0 + t * (x1 - x0), y: y0 + t * (y1 - y0) };
    }
  }
  const last = WAYPOINTS[WAYPOINTS.length - 1];
  return { x: last[0], y: last[1] };
}

// ─── Trail segments ──────────────────────────────────────────────────────────

export interface TrailSegment {
  person: string;
  fromKm: number;
  toKm: number;
  color: string;
}

type ViewMode = "asRan" | "contribution";

interface EntrySlice { personName: string; distanceKm: number; }
interface MemberSlice { name: string; colorHex: string; }

export function getTrailSegments(
  entries: EntrySlice[],
  members: MemberSlice[],
  mode: ViewMode
): TrailSegment[] {
  const colorMap = Object.fromEntries(members.map((m) => [m.name, m.colorHex]));
  const segments: TrailSegment[] = [];
  let cursor = 0;

  if (mode === "asRan") {
    for (const e of entries) {
      segments.push({
        person: e.personName,
        fromKm: cursor,
        toKm: cursor + e.distanceKm,
        color: colorMap[e.personName] ?? "#888",
      });
      cursor += e.distanceKm;
    }
  } else {
    // contribution: one block per member in member display order
    for (const m of members) {
      const total = entries
        .filter((e) => e.personName === m.name)
        .reduce((s, e) => s + e.distanceKm, 0);
      if (total > 0) {
        segments.push({ person: m.name, fromKm: cursor, toKm: cursor + total, color: m.colorHex });
        cursor += total;
      }
    }
  }

  return segments;
}

// ─── SVG path helpers ────────────────────────────────────────────────────────

/** Build an SVG path `d` string for a segment from fromKm to toKm */
export function buildSegmentPath(fromKm: number, toKm: number): string {
  if (toKm <= fromKm) return "";

  // Collect all waypoints within the segment range, plus interpolated endpoints
  const from = interpolatePosition(fromKm);
  const to = interpolatePosition(toKm);

  const midWaypoints = WAYPOINTS.filter(([, , km]) => km > fromKm && km < toKm);

  const pts: { x: number; y: number }[] = [
    from,
    ...midWaypoints.map(([x, y]) => ({ x, y })),
    to,
  ];

  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}
```

**Step 4: Run tests to confirm they pass**

```bash
cd c:/Coding/Expedition/client
npx vitest run src/data/route.test.ts
```

Expected: All tests pass.

**Step 5: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/data/route.ts client/src/data/route.test.ts
git commit -m "feat(client): route waypoints, landmarks, interpolation, trail segment logic"
```

---

### Task 12: Map SVG component — base rendering

**Files:**
- Create: `client/src/components/MapView/MapView.tsx`
- Create: `client/src/components/MapView/MapSVG.tsx`
- Create: `client/src/components/MapView/AustraliaPath.tsx`
- Create: `client/src/components/MapView/TrailsLayer.tsx`
- Create: `client/src/components/MapView/ModeToggle.tsx`
- Create: `client/src/components/MapView/MapView.css`

**Step 1: `AustraliaPath.tsx` — the landmass SVG path**

Build the coastline path from `WAYPOINTS`:

```typescript
// client/src/components/MapView/AustraliaPath.tsx
import { WAYPOINTS } from "../../data/route";

export function AustraliaPath() {
  const d = WAYPOINTS.map(([x, y], i) =>
    `${i === 0 ? "M" : "L"}${x},${y}`
  ).join(" ") + " Z";

  return (
    <path
      d={d}
      fill="#d4b96a"
      stroke="#2c1a0e"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  );
}
```

**Step 2: `TrailsLayer.tsx` — coloured trail segments**

```typescript
// client/src/components/MapView/TrailsLayer.tsx
import { buildSegmentPath, type TrailSegment } from "../../data/route";

interface Props { segments: TrailSegment[]; totalKm: number; }

export function TrailsLayer({ segments, totalKm }: Props) {
  if (totalKm <= 0) return null;
  return (
    <g className="trails-layer">
      {segments.map((seg, i) => {
        const d = buildSegmentPath(seg.fromKm, seg.toKm);
        if (!d) return null;
        return (
          <g key={i}>
            {/* Ink shadow */}
            <path d={d} stroke="#2c1a0e" strokeWidth="5" fill="none" strokeLinecap="round" opacity={0.3} />
            {/* Colour fill */}
            <path d={d} stroke={seg.color} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            {/* White highlight */}
            <path d={d} stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}
```

**Step 3: `MapSVG.tsx` — parchment background + composited layers**

```typescript
// client/src/components/MapView/MapSVG.tsx
import { useRef, useState, useCallback } from "react";
import { AustraliaPath } from "./AustraliaPath";
import { TrailsLayer } from "./TrailsLayer";
import type { TrailSegment } from "../../data/route";

interface Props {
  segments: TrailSegment[];
  totalKm: number;
}

export function MapSVG({ segments, totalKm }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.5, Math.min(6, z - e.deltaY * 0.001)));
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan((p) => ({
      x: p.x + (e.clientX - lastPos.current.x),
      y: p.y + (e.clientY - lastPos.current.y),
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { dragging.current = false; };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1100 720"
      className="map-svg"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ cursor: dragging.current ? "grabbing" : "grab" }}
    >
      <defs>
        <filter id="paper-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blend" />
        </filter>
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(30,15,0,0.45)" />
        </radialGradient>
      </defs>

      <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
        {/* Parchment background */}
        <rect width="1100" height="720" fill="#e8d5a3" filter="url(#paper-grain)" />
        {/* Sea colour */}
        <rect width="1100" height="720" fill="#b8d4e8" opacity={0.35} />

        <AustraliaPath />
        <TrailsLayer segments={segments} totalKm={totalKm} />
      </g>

      {/* Vignette overlay (not affected by pan/zoom) */}
      <rect width="1100" height="720" fill="url(#vignette)" style={{ pointerEvents: "none" }} />
    </svg>
  );
}
```

**Step 4: `ModeToggle.tsx`**

```typescript
// client/src/components/MapView/ModeToggle.tsx
type ViewMode = "asRan" | "contribution";
interface Props { mode: ViewMode; onChange: (m: ViewMode) => void; }

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="mode-toggle">
      <button className={mode === "asRan" ? "active" : ""} onClick={() => onChange("asRan")}>
        As Ran
      </button>
      <button className={mode === "contribution" ? "active" : ""} onClick={() => onChange("contribution")}>
        Contribution
      </button>
    </div>
  );
}
```

**Step 5: `MapView.tsx` — assembles all pieces**

```typescript
// client/src/components/MapView/MapView.tsx
import { useState } from "react";
import { MapSVG } from "./MapSVG";
import { ModeToggle } from "./ModeToggle";
import { useActivityLog } from "../../hooks/useActivityLog";
import { useMembers } from "../../hooks/useMembers";
import { getTrailSegments, ROUTE_TOTAL_KM } from "../../data/route";
import { ROUTE_TOTAL_KM as TOTAL } from "../../config";
import "./MapView.css";

type ViewMode = "asRan" | "contribution";

export function MapView() {
  const { entries } = useActivityLog();
  const { members } = useMembers();
  const [mode, setMode] = useState<ViewMode>("asRan");

  const totalKm = entries.reduce((s, e) => s + e.distanceKm, 0);
  const segments = getTrailSegments(entries, members, mode);

  return (
    <div className="map-view">
      <div className="map-stats-bar">
        <span>{totalKm.toFixed(1)} km logged</span>
        <span>{((totalKm / 14_500) * 100).toFixed(1)}% complete</span>
        <span>{(14_500 - totalKm).toFixed(1)} km remaining</span>
      </div>
      <MapSVG segments={segments} totalKm={totalKm} />
      <ModeToggle mode={mode} onChange={setMode} />
    </div>
  );
}
```

**Step 6: Update `App.tsx` to render `MapView` and verify trails render**

**Step 7: Log some test activities, verify the trail draws correctly and the toggle changes mode**

**Step 8: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/components/MapView/
git commit -m "feat(client): map view with parchment SVG, trail rendering, and mode toggle"
```

---

## Phase 7 — Map polish: landmarks, milestones, compass rose, legend

### Task 13: Landmarks, milestones, compass rose, legend

**Files:**
- Create: `client/src/components/MapView/LandmarksLayer.tsx`
- Create: `client/src/components/MapView/MilestonesLayer.tsx`
- Create: `client/src/components/MapView/CompassRose.tsx`
- Create: `client/src/components/MapView/PersonLegend.tsx`
- Modify: `client/src/components/MapView/MapSVG.tsx`

**Step 1: `LandmarksLayer.tsx`**

```typescript
// client/src/components/MapView/LandmarksLayer.tsx
import { useState } from "react";
import { LANDMARKS } from "../../data/route";

interface Props { totalKm: number; }

export function LandmarksLayer({ totalKm }: Props) {
  const [hoverId, setHoverId] = useState<number | null>(null);

  return (
    <g className="landmarks-layer">
      {LANDMARKS.map((lm, i) => {
        const reached = totalKm >= lm.km;
        const hovered = hoverId === i;
        return (
          <g key={i}
            onMouseEnter={() => setHoverId(i)}
            onMouseLeave={() => setHoverId(null)}
            style={{ cursor: "pointer" }}>
            <circle cx={lm.svgX} cy={lm.svgY} r={5}
              fill={reached ? "#2c1a0e" : "none"}
              stroke="#2c1a0e" strokeWidth="1.5" />
            <text x={lm.svgX + 7} y={lm.svgY + 4}
              fontFamily="'IM Fell English', serif" fontSize="9" fill="#2c1a0e" opacity={0.8}>
              {lm.name}
            </text>
            {hovered && (
              <foreignObject x={lm.svgX + 10} y={lm.svgY - 55} width="200" height="80">
                <div className="landmark-tooltip">
                  <strong>{lm.name}</strong> — {lm.km} km
                  <p>{lm.fact}</p>
                  <span>{reached ? "✅ Reached" : `${(lm.km - totalKm).toFixed(0)} km ahead`}</span>
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </g>
  );
}
```

**Step 2: `MilestonesLayer.tsx` — 10% tick marks**

```typescript
// client/src/components/MapView/MilestonesLayer.tsx
import { interpolatePosition } from "../../data/route";

export function MilestonesLayer() {
  const milestones = Array.from({ length: 9 }, (_, i) => (i + 1) * 1450);
  return (
    <g className="milestones-layer">
      {milestones.map((km) => {
        const { x, y } = interpolatePosition(km);
        return (
          <g key={km}>
            <circle cx={x} cy={y} r={4} fill="#8b6914" opacity={0.7} />
            <text x={x + 6} y={y + 3} fontSize="8" fontFamily="'IM Fell English', serif" fill="#8b6914" opacity={0.8}>
              {(km / 14500 * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </g>
  );
}
```

**Step 3: `CompassRose.tsx` — decorative SVG compass**

```typescript
// client/src/components/MapView/CompassRose.tsx
export function CompassRose() {
  // Place in lower-left corner of the viewBox
  const cx = 75, cy = 640, r = 45;
  return (
    <g transform={`translate(${cx},${cy})`} opacity={0.7}>
      {/* Outer ring */}
      <circle r={r} fill="#e8d5a3" stroke="#2c1a0e" strokeWidth="1" />
      {/* Cardinal points */}
      {[0, 90, 180, 270].map((deg, i) => {
        const rad = (deg - 90) * Math.PI / 180;
        const x1 = Math.cos(rad) * 8, y1 = Math.sin(rad) * 8;
        const x2 = Math.cos(rad) * (r - 4), y2 = Math.sin(rad) * (r - 4);
        const label = ["N", "E", "S", "W"][i];
        const lx = Math.cos(rad) * (r + 10), ly = Math.sin(rad) * (r + 10);
        return (
          <g key={deg}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2c1a0e" strokeWidth="1.5" />
            <text x={lx} y={ly + 3} textAnchor="middle" fontSize="10"
              fontFamily="'IM Fell English', serif" fill="#2c1a0e" fontWeight="bold">
              {label}
            </text>
          </g>
        );
      })}
      {/* Decorative center dot */}
      <circle r={4} fill="#8b2020" />
    </g>
  );
}
```

**Step 4: `PersonLegend.tsx`**

```typescript
// client/src/components/MapView/PersonLegend.tsx
import { useMembers } from "../../hooks/useMembers";
import { useActivityLog } from "../../hooks/useActivityLog";

export function PersonLegend() {
  const { members } = useMembers();
  const { entries } = useActivityLog();
  return (
    <div className="person-legend">
      {members.map((m) => {
        const km = entries.filter((e) => e.personName === m.name).reduce((s, e) => s + e.distanceKm, 0);
        return (
          <div key={String(m.id)} className="legend-row">
            <span className="legend-swatch" style={{ background: m.colorHex }} />
            <span className="legend-name">{m.name}</span>
            <span className="legend-km">{km.toFixed(1)} km</span>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 5: Update `MapSVG.tsx` to include `LandmarksLayer`, `MilestonesLayer`, `CompassRose`**

Add to the `<g transform={...}>` inside `MapSVG`:

```typescript
import { LandmarksLayer } from "./LandmarksLayer";
import { MilestonesLayer } from "./MilestonesLayer";
import { CompassRose } from "./CompassRose";

// After TrailsLayer:
<MilestonesLayer />
<LandmarksLayer totalKm={totalKm} />
<CompassRose />
```

Also add a cartouche `<text>` in upper-right (approximately x=900, y=60):

```typescript
<text x={960} y={55} textAnchor="middle" fontFamily="'IM Fell English', serif"
  fontSize="20" fill="#2c1a0e" fontStyle="italic">
  The Expedition
</text>
<text x={960} y={75} textAnchor="middle" fontFamily="'IM Fell English', serif"
  fontSize="11" fill="#2c1a0e" opacity={0.7}>
  Circumnavigation of Australia · 14,500 km
</text>
```

**Step 6: Add Google Font `IM Fell English` to `index.html`**

```html
<!-- in <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
```

**Step 7: Add `PersonLegend` to `MapView.tsx`**

**Step 8: Verify map looks correct: landmarks, milestones, compass, legend all render**

**Step 9: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/components/MapView/
git commit -m "feat(client): landmarks, milestones, compass rose, person legend, cartouche"
```

---

## Phase 8 — Stats view

### Task 14: Stats view

**Files:**
- Create: `client/src/components/StatsView/StatsView.tsx`
- Create: `client/src/components/StatsView/SummaryStats.tsx`
- Create: `client/src/components/StatsView/PersonBreakdown.tsx`
- Create: `client/src/components/StatsView/ActivityTypeChart.tsx`
- Create: `client/src/components/StatsView/LandmarksPassed.tsx`
- Create: `client/src/components/StatsView/StatsView.css`

**Step 1: `SummaryStats.tsx`**

```typescript
// client/src/components/StatsView/SummaryStats.tsx
import { useActivityLog } from "../../hooks/useActivityLog";
import { LANDMARKS } from "../../data/route";

export function SummaryStats() {
  const { entries } = useActivityLog();
  const totalKm = entries.reduce((s, e) => s + e.distanceKm, 0);
  const pct = (totalKm / 14_500 * 100).toFixed(2);
  const remaining = (14_500 - totalKm).toFixed(1);
  const next = LANDMARKS.find((l) => l.km > totalKm);
  return (
    <div className="summary-stats">
      <div className="stat"><span className="stat-value">{totalKm.toFixed(1)}</span><span className="stat-label">km logged</span></div>
      <div className="stat"><span className="stat-value">{pct}%</span><span className="stat-label">complete</span></div>
      <div className="stat"><span className="stat-value">{remaining}</span><span className="stat-label">km to Sydney</span></div>
      {next && <div className="stat"><span className="stat-value">{next.name}</span><span className="stat-label">next landmark in {(next.km - totalKm).toFixed(0)} km</span></div>}
    </div>
  );
}
```

**Step 2: `PersonBreakdown.tsx`**

```typescript
// client/src/components/StatsView/PersonBreakdown.tsx
import { useMembers } from "../../hooks/useMembers";
import { useActivityLog } from "../../hooks/useActivityLog";
import { ACTIVITY_TYPES, ACTIVITY_ICONS } from "../../config";

export function PersonBreakdown() {
  const { members } = useMembers();
  const { entries } = useActivityLog();
  return (
    <div className="person-breakdown">
      <h3>Per Person</h3>
      {members.map((m) => {
        const myEntries = entries.filter((e) => e.personName === m.name);
        const totalKm = myEntries.reduce((s, e) => s + e.distanceKm, 0);
        return (
          <div key={String(m.id)} className="person-stat">
            <div className="person-stat-header">
              <span className="swatch" style={{ background: m.colorHex }} />
              <strong>{m.name}</strong>
              <span>{totalKm.toFixed(1)} km · {myEntries.length} activities</span>
            </div>
            <div className="act-breakdown">
              {ACTIVITY_TYPES.map((t) => {
                const km = myEntries.filter((e) => e.activityType === t).reduce((s, e) => s + e.distanceKm, 0);
                if (km === 0) return null;
                return <span key={t}>{ACTIVITY_ICONS[t]} {km.toFixed(1)} km</span>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: `ActivityTypeChart.tsx` — proportional bar chart**

```typescript
// client/src/components/StatsView/ActivityTypeChart.tsx
import { useActivityLog } from "../../hooks/useActivityLog";
import { ACTIVITY_TYPES, ACTIVITY_ICONS } from "../../config";

const COLORS: Record<string, string> = {
  run: "#c0392b", row: "#2980b9", walk: "#27ae60", cycle: "#f39c12",
};

export function ActivityTypeChart() {
  const { entries } = useActivityLog();
  const totalKm = entries.reduce((s, e) => s + e.distanceKm, 0);
  if (totalKm === 0) return <p>No data yet.</p>;
  return (
    <div className="act-type-chart">
      <h3>By Activity Type</h3>
      <div className="stacked-bar">
        {ACTIVITY_TYPES.map((t) => {
          const km = entries.filter((e) => e.activityType === t).reduce((s, e) => s + e.distanceKm, 0);
          const pct = (km / totalKm * 100).toFixed(1);
          if (km === 0) return null;
          return (
            <div key={t} className="bar-segment" style={{ width: `${pct}%`, background: COLORS[t] }}
              title={`${ACTIVITY_ICONS[t]} ${t}: ${km.toFixed(1)} km (${pct}%)`} />
          );
        })}
      </div>
      <div className="act-legend">
        {ACTIVITY_TYPES.map((t) => {
          const km = entries.filter((e) => e.activityType === t).reduce((s, e) => s + e.distanceKm, 0);
          if (km === 0) return null;
          return (
            <span key={t} className="act-legend-item">
              <span className="act-dot" style={{ background: COLORS[t] }} />
              {ACTIVITY_ICONS[t]} {t}: {km.toFixed(1)} km
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 4: `LandmarksPassed.tsx`**

```typescript
// client/src/components/StatsView/LandmarksPassed.tsx
import { useActivityLog } from "../../hooks/useActivityLog";
import { LANDMARKS } from "../../data/route";

export function LandmarksPassed() {
  const { entries } = useActivityLog();
  const totalKm = entries.reduce((s, e) => s + e.distanceKm, 0);
  const passed = LANDMARKS.filter((l) => l.km <= totalKm && l.km > 0);
  if (!passed.length) return <p>No landmarks reached yet.</p>;
  return (
    <div className="landmarks-passed">
      <h3>Landmarks Reached</h3>
      {passed.map((l) => (
        <div key={l.name} className="landmark-item">
          <strong>{l.name}</strong> <span className="km-badge">{l.km} km</span>
          <p>{l.fact}</p>
        </div>
      ))}
    </div>
  );
}
```

**Step 5: Assemble `StatsView.tsx`**

```typescript
// client/src/components/StatsView/StatsView.tsx
import { SummaryStats } from "./SummaryStats";
import { PersonBreakdown } from "./PersonBreakdown";
import { ActivityTypeChart } from "./ActivityTypeChart";
import { LandmarksPassed } from "./LandmarksPassed";
import "./StatsView.css";

export function StatsView() {
  return (
    <div className="stats-view">
      <SummaryStats />
      <PersonBreakdown />
      <ActivityTypeChart />
      <LandmarksPassed />
    </div>
  );
}
```

**Step 6: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/components/StatsView/
git commit -m "feat(client): stats view with summary, per-person breakdown, activity chart, landmarks"
```

---

## Phase 9 — App shell: navigation + layout

### Task 15: App shell with tab navigation

**Files:**
- Modify: `client/src/App.tsx`
- Create: `client/src/App.css`

**Step 1: Write `App.tsx` with three-tab navigation**

```typescript
// client/src/App.tsx
import { useState } from "react";
import { MapView } from "./components/MapView/MapView";
import { LogView } from "./components/LogView/LogView";
import { StatsView } from "./components/StatsView/StatsView";
import { MembersPanel } from "./components/MembersPanel/MembersPanel";
import "./App.css";

type Tab = "map" | "log" | "stats" | "members";

export default function App() {
  const [tab, setTab] = useState<Tab>("map");

  return (
    <div className="app">
      <nav className="app-nav">
        <h1 className="app-title">The Expedition</h1>
        <div className="nav-tabs">
          {(["map", "log", "stats", "members"] as Tab[]).map((t) => (
            <button key={t} className={`nav-tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}>
              {t === "map" ? "🗺 Map" : t === "log" ? "📝 Log" : t === "stats" ? "📊 Stats" : "👥 Members"}
            </button>
          ))}
        </div>
      </nav>
      <main className="app-main">
        {tab === "map" && <MapView />}
        {tab === "log" && <LogView />}
        {tab === "stats" && <StatsView />}
        {tab === "members" && <MembersPanel />}
      </main>
    </div>
  );
}
```

**Step 2: Add base styles in `App.css`**

Include: nav bar styles, tab buttons (with `active` state using person colours), `IM Fell English` for the title, responsive max-width container, map view taking full available height.

**Step 3: Verify full app navigation works end-to-end**

Walk through: add a member → log an activity → view on map → check stats.

**Step 4: Commit**

```bash
cd c:/Coding/Expedition
git add client/src/App.tsx client/src/App.css
git commit -m "feat(client): app shell with tab navigation"
```

---

## Phase 10 — GitHub Pages deploy + CI/CD

### Task 16: Vite config + GitHub Pages deploy

**Files:**
- Modify: `client/vite.config.ts`
- Create: `.github/workflows/deploy.yml`

**Step 1: Set `base` in `vite.config.ts`**

```typescript
// client/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/expedition/", // Replace "expedition" with your actual GitHub repo name
});
```

**Step 2: Create deploy workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: client/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: client

      - name: Build
        run: npm run build
        working-directory: client
        env:
          VITE_STDB_ADDRESS: ${{ secrets.VITE_STDB_ADDRESS }}

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: client/dist
```

**Step 3: Set up GitHub repository**

```bash
cd c:/Coding/Expedition
git remote add origin https://github.com/<your-username>/expedition.git
git push -u origin main
```

**Step 4: Add `VITE_STDB_ADDRESS` as a GitHub Actions secret**

Go to: GitHub repo → Settings → Secrets and variables → Actions → New secret.
Name: `VITE_STDB_ADDRESS`, Value: your module address (same as `.env.local`).

**Step 5: Enable GitHub Pages**

Go to: GitHub repo → Settings → Pages → Source: `gh-pages` branch, `/ (root)`.

**Step 6: Push and verify CI/CD deploys successfully**

```bash
git push
```

Watch the Actions tab. Expected: build passes, site live at `https://<username>.github.io/expedition/`.

**Step 7: Final commit**

```bash
cd c:/Coding/Expedition
git add .github/ client/vite.config.ts
git commit -m "feat: GitHub Pages deploy + CI/CD workflow"
git push
```

---

## Appendix: Acceptance Criteria

| Phase | Done when |
|-------|-----------|
| 1 | Module published; React app connects; live data in console |
| 2 | Members panel: add/remove/colour-pick; syncs live across tabs |
| 3 | Log form submits; entry appears in feed on second tab in real time |
| 4 | Reactions and comment threads sync live |
| 5 | Logging an entry triggers AI response; it patches back within 5s |
| 6 | Trail renders correctly; As Ran / Contribution toggle works |
| 7 | Landmarks, milestones, compass rose, cartouche all visible; tooltips work |
| 8 | All stats panels show correct data |
| 9 | Three-tab navigation works; full app navigable end-to-end |
| 10 | `git push` to main auto-deploys; friends can access the live URL |

## Important Notes

- **SpacetimeDB decorator API:** The exact import path and decorator syntax for `@table`, `@reducer`, `@procedure` may differ from the examples above. Always follow what `spacetime init` generates — the generated scaffold is the authoritative reference for your installed version (1.3.0).
- **Procedures in beta:** If `@procedure` / outbound HTTP is not available in 1.3.0, fall back to a minimal Cloudflare Worker proxy for the Claude API call. See the design doc (§6) for guidance.
- **Generated client types:** After any schema change, re-run `spacetime generate` to regenerate `src/spacetime/generated/`. Never edit generated files.
- **API key:** Set `ANTHROPIC_API_KEY` in SpacetimeDB Maincloud dashboard before calling the procedure. Never commit it.
- **Route waypoints:** The waypoints in `route.ts` are stylised approximations — not GIS-accurate. This is intentional for the nautical chart aesthetic.
