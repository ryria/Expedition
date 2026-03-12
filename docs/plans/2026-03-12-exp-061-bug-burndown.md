# EXP-061 Bug Burn-down Board (Sprint 7)

**Date:** 2026-03-12  
**Status:** In progress  
**Goal:** Close high-impact stabilization defects with regression protection.

---

## Burn-down shortlist

| ID | Area | Severity | Defect | Status | Evidence |
|---|---|---|---|---|---|
| B1 | MapView | P1 | Completion % can render `Infinity/NaN` when route total is zero/unavailable | Closed | `completionPercent` guard + tests in `MapView.test.ts` |
| B2 | LogView | P1 | AI coaching can attach to wrong insert event without expedition match | Closed | Pending submission scope uses member+expedition + test in `LogForm.test.tsx` |
| B3 | LogView | P1 | Distance validation message mismatch (`0–500` vs effective lower bound) | Closed | Message aligned to `0.1–500 km` + regression assertion in `LogForm.test.tsx` |
| B4 | Social/Comments | P1 | Investigate comment/reaction ordering consistency under rapid updates | Closed | Deterministic sort by timestamp + id in `useComments` and `useReactions` with tie-breaker tests |
| B5 | Members | P1 | Verify role/ownership transitions under concurrent updates | Closed | Ownership-transfer pending lock prevents follow-up role mutations until refresh/timeout + regression test |
| B6 | MapView | P2 | Review over-100% completion display behavior expectation | Closed | `completionPercent` now clamps to `100` + regression test |
| B7 | LogForm | P1 | Validate duplicate submit behavior during transient connection churn | Closed | Pending submission TTL guard blocks rapid duplicate reducer calls + regression test |
| B8 | Integrations | P1 | Validate Strava callback state recovery under reload/interruption | Closed | Persisted pending callback replay in `SettingsPanel` + interruption regression test |
| B9 | Settings/BetaOps | P2 | Persisted triage ticket schema migration compatibility check | Closed | Support-ticket normalization parser with legacy fallback defaults + hydration test |
| B10 | ActivityFeed | P2 | Verify empty-state behavior under delayed subscriptions | Closed | Added loading-state guard before empty-state + component tests |

---

## Completed fix evidence

### B1 — Map completion percent guard

- File: `client/src/components/MapView/MapView.tsx`
- Fix: added `completionPercent(totalKm, routeTotalKm)` guard to avoid divide-by-zero/non-finite output.
- Test: `client/src/components/MapView/MapView.test.ts`.

### B2 — Log AI coaching insert scoping

- File: `client/src/components/LogView/LogForm.tsx`
- Fix: pending submission now tracks `{ memberId, expeditionId }`; `onInsert` trigger requires both to match.
- Test: `client/src/components/LogView/LogForm.test.tsx` (`triggers AI coaching only for matching expedition/member insert`).

### B3 — Distance validation message consistency

- File: `client/src/components/LogView/LogForm.tsx`
- Fix: aligned validation copy to input constraints (`Distance must be 0.1–500 km`).
- Test: `client/src/components/LogView/LogForm.test.tsx` (`shows consistent distance bounds for invalid lower-bound input`).

### B4 — Deterministic social ordering under rapid updates

- Files: `client/src/hooks/useComments.ts`, `client/src/hooks/useReactions.ts`
- Fix: apply stable ordering (`timestamp`, then `id`) for consistent comment/reaction rendering when timestamps collide.
- Tests: `client/src/hooks/useComments.test.ts`, `client/src/hooks/useReactions.test.ts` (same-timestamp ordering assertions).

### B5 — Ownership transition race guard

- File: `client/src/components/SettingsPanel/SettingsPanel.tsx`
- Fix: introduced ownership transfer pending window that disables role action buttons while transfer authority is settling.
- Test: `client/src/components/SettingsPanel/SettingsPanel.test.tsx` (`blocks additional role mutations while ownership transfer is pending`).

### B7 — Duplicate log submit guard

- File: `client/src/components/LogView/LogForm.tsx`
- Fix: added pending submission TTL lock to reject duplicate submit attempts during transient acknowledgement lag.
- Test: `client/src/components/LogView/LogForm.test.tsx` (`blocks duplicate submits while previous log is still pending`).

### B8 — Strava callback interruption/reload recovery

- File: `client/src/components/SettingsPanel/SettingsPanel.tsx`
- Fix: persist callback payload (`code/state/error`) before URL cleanup and replay linking from pending storage until connection is available.
- Test: `client/src/components/SettingsPanel/SettingsPanel.test.tsx` (`replays pending Strava callback after transient connection interruption`).

### B6 — Map completion display cap

- File: `client/src/components/MapView/MapView.tsx`
- Fix: clamp displayed completion percentage to `100` to prevent overrun display drift.
- Test: `client/src/components/MapView/MapView.test.ts` (`caps completion at 100 percent`).

### B9 — Support ticket schema compatibility

- File: `client/src/components/SettingsPanel/SettingsPanel.tsx`
- Fix: normalize legacy/partial persisted support tickets on load (severity/status coercion + default fields).
- Test: `client/src/components/SettingsPanel/SettingsPanel.test.tsx` (`normalizes legacy persisted support tickets on load`).

### B10 — ActivityFeed delayed subscription behavior

- Files: `client/src/hooks/useActivityLog.ts`, `client/src/components/LogView/ActivityFeed.tsx`
- Fix: expose `isLoaded` from `useActivityLog`; show `Loading activities…` until table subscription is ready.
- Test: `client/src/components/LogView/ActivityFeed.test.tsx` (loading, empty, and populated states).

---

## Validation snapshot

- Focused tests: `useComments` + `useReactions` + `SettingsPanel` + `LogForm` pass.
- Full frontend suite: `54/54` pass.
- Build: `npm run build` pass.

---

## Next burn-down actions

1. Hand off to `EXP-062` (performance/reliability tuning) with stabilization baseline captured.
