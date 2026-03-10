# EXP-013 Frontend/Client Implementation Spec (Sprint 2)

**Issue:** EXP-013  
**Title:** Expedition switcher + creation UI  
**Sprint:** Sprint 2 — Multi-Tenant Core  
**Owner:** Frontend  
**Status:** Draft for implementation tickets  
**Last updated:** 2026-03-10

---

## 1) Scope and Guardrails (Sprint 2 only)

### In scope
- Expedition context selection in-app (switch active expedition).
- Expedition creation from client UI.
- Wiring active expedition context into existing Expedition/Members/Settings views.
- Basic loading, empty, and failure handling for expedition selection and creation.
- Client-side instrumentation for key expedition context actions.

### Explicitly out of scope
- Billing/paywalls/entitlements (only leave placeholder hook points).
- Invite creation/join flows and role management UI (Sprint 3).
- Archive/delete expedition UX (can expose non-clickable placeholder affordance only).
- Multi-step onboarding redesign beyond expedition selector/create entry points.

---

## 2) IA and UX Flow

## 2.1 Navigation information architecture

### Current
- Top nav: `Expedition` | `Members` | `Settings` | `Sign out`.

### Sprint 2 target
- Keep existing tab model.
- Add **active expedition switcher** in global nav/header area so context is visible from every tab.
- Add **Create expedition** action from the switcher menu.
- Preserve existing per-tab content areas; no new full-screen routes required.

## 2.2 Primary user flows

### A. Existing user with memberships switches expedition
1. User opens app, existing auth/session resolves.
2. Header shows current active expedition name in switcher control.
3. User opens switcher dropdown/list.
4. User selects another expedition.
5. UI enters lightweight loading state for context transition.
6. Map/Feed/Stats, Members, and Settings re-bind to selected expedition data.
7. Success toast/message optional; silent success acceptable if transition is clear.

### B. Existing user creates first/new expedition
1. User opens switcher.
2. User selects `Create expedition`.
3. Inline sheet/popover or compact modal collects minimum fields:
   - Expedition name (required)
   - Optional short description (if backend supports; otherwise omit)
4. Submit action triggers create reducer/procedure.
5. On success:
   - New expedition becomes active context.
   - User remains on current tab.
   - Empty-state content reflects newly created expedition.
6. On failure:
   - Form remains open.
   - User sees recoverable error with retry path.

### C. User with no memberships
1. App loads and finds zero memberships.
2. Replace normal expedition content with clear empty-state CTA:
   - `Create your first expedition` (primary)
   - Optional secondary placeholder `Join via invite` (disabled/coming soon label).
3. After successful creation, app transitions to standard tabbed experience in new context.

## 2.3 UX behavior notes
- Switching expedition never signs user out and never resets theme/map-mode preferences.
- Context switch should keep current tab when possible (e.g., stay on `Members` tab but for selected expedition).
- If selected expedition becomes unavailable (removed membership server-side), auto-fallback to next available expedition; if none, enter no-membership empty state.

---

## 3) Component-Level Implementation Plan (mapped to current app)

## 3.1 `App` composition and global context

### File(s)
- `client/src/App.tsx`

### Planned changes
- Introduce active expedition state orchestration at app shell level.
- Render new `ExpeditionSwitcher` UI in header/nav.
- Gate existing tab content by expedition readiness:
  - loading expedition memberships
  - no memberships
  - active expedition available
- Keep existing tab logic (`expedition` | `members` | `settings`) unchanged.
- Keep existing onboarding warning logic, but scope it to active expedition member resolution.

### Ticket split suggestion
- Ticket A: app-shell expedition context state + guard states.
- Ticket B: header UX integration of switcher and create action.

## 3.2 `MapJournalView` integration

### File(s)
- `client/src/components/MapView/MapJournalView.tsx`
- Child components under `MapView`, `LogView`, `StatsView` (read-only consumers for Sprint 2)

### Planned changes
- Accept active expedition context as input (prop and/or hook-driven context).
- Ensure map/log/stats child hooks read expedition-scoped data only.
- Provide expedition-aware empty state inside map/journal region when active expedition has no activity yet.

### Non-goal
- No redesign of map drawer or section ordering UX.

## 3.3 `MembersPanel` integration

### File(s)
- `client/src/components/MembersPanel/MembersPanel.tsx`

### Planned changes
- Filter members list by active expedition membership context.
- Update empty message copy for expedition-scoped state:
  - no members in this expedition
  - or no active expedition selected

## 3.4 `SettingsPanel` integration

### File(s)
- `client/src/components/SettingsPanel/SettingsPanel.tsx`

### Planned changes
- Keep profile/theme/map-mode controls as-is.
- Add expedition section with:
  - read-only current expedition summary
  - `Create expedition` secondary entry point (same action as switcher)
  - disabled `Invite members (coming in Sprint 3)` placeholder
- Do not add role or invite management interactions yet.

## 3.5 Hook layer (new and updated)

### Existing hooks to update
- `client/src/hooks/useMembers.ts`
- `client/src/hooks/useActivityLog.ts`
- `client/src/hooks/useComments.ts`
- `client/src/hooks/useReactions.ts`

### New hook(s) expected
- `useExpeditions` (membership + expedition list retrieval + sort rules)
- `useActiveExpedition` (active id selection, persistence, fallback)
- `useCreateExpedition` (mutation state: idle/loading/success/error)

### Design rule
- Keep hooks composable and aligned with existing `useTable` pattern.
- Avoid pushing expedition state deep into unrelated presentation components.

---

## 4) State Model and Persistence Behavior

## 4.1 Client state model (Sprint 2)

### Global app state
- `expeditions`: expeditions user can access (from membership scope).
- `activeExpeditionId`: selected expedition context (nullable until resolved).
- `expeditionResolutionState`: `loading | ready | empty | error`.
- `createExpeditionState`: `idle | submitting | success | error` (+ message).

### Derived state
- `activeMembership`: membership row for auth user in active expedition.
- `isRegisteredInActiveExpedition`: boolean used by existing onboarding warning.

## 4.2 Persistence rules

### LocalStorage
- Persist `activeExpeditionId` under a dedicated key (for example: `expedition-active-id`).
- Existing keys (`expedition-theme`, `expedition-map-mode`, auth token key) remain unchanged.

### Restore priority on load
1. If persisted `activeExpeditionId` exists and still valid, use it.
2. Else default to first expedition in stable sort order (createdAt asc, then id).
3. If no expeditions, set state to `empty`.

### Invalid persisted ID handling
- If persisted id is missing from current membership set, clear persisted id and apply fallback rule.
- Fire instrumentation event for stale persisted context recovery.

### Mutation behavior
- On successful create expedition, set new expedition as active and persist immediately.
- On create failure, do not mutate active expedition.

---

## 5) Edge Cases and UI States

## 5.1 Loading states
- Initial load while memberships/expeditions are unresolved.
- Context switch in progress (brief spinner/skeleton in content region).
- Create expedition submit in progress (disable submit/cancel race conditions).

## 5.2 Empty states
- No expedition memberships at all.
- Active expedition exists but has no activities yet.
- Active expedition has only creator member.

## 5.3 Error states
- Expedition list fetch/subscription failure.
- Create expedition validation failure (name empty/duplicate/invalid characters per backend rules).
- Create expedition network/server failure.
- Selected expedition lost access mid-session.

## 5.4 Concurrency/consistency cases
- Rapid switching between expeditions before previous load settles.
- New expedition appears via realtime update from another client session.
- Membership revoked from active expedition while user is viewing that expedition.

### Expected behavior
- Last switch intent wins.
- UI never shows mixed expedition data in same render frame.
- Fallback to safe state (`ready` with fallback expedition, else `empty`) is deterministic.

---

## 6) Instrumentation Events

## 6.1 Event naming
- Use canonical `expedition_*` namespace.
- Include `active_expedition_id` and `source_surface` when applicable.

## 6.2 Required events
- `expedition_switcher_opened`
  - payload: `{ source_surface: "header" | "settings" }`
- `expedition_switch_selected`
  - payload: `{ from_expedition_id, to_expedition_id, source_surface }`
- `expedition_switch_succeeded`
  - payload: `{ to_expedition_id, duration_ms }`
- `expedition_switch_failed`
  - payload: `{ to_expedition_id, error_code, error_message? }`
- `expedition_create_started`
  - payload: `{ source_surface }`
- `expedition_create_succeeded`
  - payload: `{ created_expedition_id, became_active: true, duration_ms }`
- `expedition_create_failed`
  - payload: `{ error_code, validation_field?, source_surface }`
- `expedition_context_restored`
  - payload: `{ restored_expedition_id, restore_source: "local_storage" | "default_first" }`
- `expedition_context_restore_stale`
  - payload: `{ stale_expedition_id }`

## 6.3 Placeholder event hooks (do not implement behavior yet)
- `expedition_invite_placeholder_clicked`
- `expedition_billing_placeholder_viewed`

---

## 7) Acceptance Criteria (EXP-013)

- Authenticated user with memberships can view a switcher and change active expedition without page reload.
- After switching, `MapJournalView`, `MembersPanel`, and `SettingsPanel` reflect the new expedition context only.
- User can create an expedition from switcher flow; success sets it active immediately.
- `activeExpeditionId` persists across refresh and restores when still valid.
- Invalid persisted active expedition is handled gracefully with deterministic fallback.
- No-membership user sees first-expedition empty state and can create expedition from it.
- Loading and error states are visible and actionable for switch/create flows.
- Required instrumentation events fire with expected payload shape.
- Sprint 2 placeholders for invites/billing appear only as non-functional affordances where specified.

---

## 8) QA Checklist (manual + integration focus)

## 8.1 Functional path checks
- Switch expedition from header while on each tab (`Expedition`, `Members`, `Settings`).
- Create expedition from header flow; verify auto-selection.
- Create expedition from settings secondary entry point; verify same outcome.
- Refresh browser; verify persisted active expedition is restored.

## 8.2 Data isolation checks (frontend)
- After switch, previously active expedition rows are not shown in feed/stats/members.
- Add activity in expedition A; verify it does not appear when switched to expedition B.

## 8.3 Edge/error checks
- Remove user membership from active expedition externally; verify fallback behavior.
- Simulate create validation error and server error; verify inline error messaging.
- Simulate slow connection; verify loading treatment and no duplicate create submissions.

## 8.4 Instrumentation checks
- Verify all required events are emitted once per user action.
- Validate key payload fields (`from_expedition_id`, `to_expedition_id`, `source_surface`, `duration_ms`).

## 8.5 Regression checks
- Theme and map mode persistence still work unchanged.
- Sign out and auth callback behavior unchanged.
- Existing onboarding/profile flow in Settings still works within active expedition context.

---

## 9) Implementation Ticket Breakdown (suggested)

- `EXP-013A` App shell expedition context state + persistence/fallback logic.
- `EXP-013B` Header expedition switcher UI + switch behavior.
- `EXP-013C` Expedition creation UX + submit/error handling.
- `EXP-013D` Scope existing hooks/components to active expedition.
- `EXP-013E` Instrumentation wiring + event payload validation.
- `EXP-013F` QA pass + regression + bugfix sweep.
