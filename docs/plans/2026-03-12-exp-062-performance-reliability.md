# EXP-062 Performance & Reliability Tuning (Sprint 7)

**Date:** 2026-03-12  
**Status:** Completed  
**Scope:** client hot-path rendering + live-table reconnect reliability.

---

## Baseline (pre-change)

- `useComments` / `useReactions` performed per-card `filter + sort` work repeatedly for each log card render.
- `MapView` recalculated `totalKm`, ordered trails, and `getTrailSegments(...)` on every render.
- `ActivityCard` counted emoji reactions via repeated array scans per emoji render path.
- `useLiveTable` retried connection with a fixed delay (`retryDelayMs`), increasing reconnect churn risk during outages.

---

## Implemented changes

### 1) Hook-level subscription/read optimization

- `client/src/hooks/useComments.ts`
  - Added memoized per-log index map and pre-sorted arrays.
  - `commentsFor(logId)` now returns indexed results instead of re-filtering/sorting each call.
- `client/src/hooks/useReactions.ts`
  - Added memoized per-log index map and pre-sorted arrays.
  - `reactionsFor(logId)` now returns indexed results.

### 2) Render-path tuning in hot views

- `client/src/components/MapView/MapView.tsx`
  - Memoized `totalKm`, trail ordering, and `getTrailSegments(...)` computation.
- `client/src/components/LogView/ActivityCard.tsx`
  - Added memoized reaction count aggregation (`emoji -> count`) to avoid repeated scans.

### 3) Reliability safeguard for reconnect behavior

- `client/src/hooks/useLiveTable.ts`
  - Added exponential retry backoff with cap (`retryDelayMs`, `maxRetryDelayMs`).
  - Retry attempts reset after successful connection attach.

---

## Validation evidence

- Focused tests (changed surfaces):
  - `npx vitest run src/hooks/useComments.test.ts src/hooks/useReactions.test.ts src/components/MapView/MapView.test.ts src/hooks/useLiveTable.test.tsx`
  - Result: `12/12` passing.
- Full frontend suite:
  - `npx vitest run`
  - Result: `55/55` passing.
- Build validation:
  - `npm run build`
  - Result: pass.

### New/updated regression coverage

- `client/src/hooks/useLiveTable.test.tsx`
  - verifies exponential backoff retries and successful attach after transient connection failure.

---

## Reliability/Performance outcome summary

- Reduced redundant per-render data work on activity/comment/reaction hot paths.
- Reduced expensive map recomputation on unrelated rerenders.
- Reduced reconnect pressure during transient backend outages via bounded backoff.
- Functional behavior preserved; no regressions in full suite/build.

---

## Follow-ups (deferred)

1. Add lightweight in-app profiling counters for render-phase durations in `MapView` and feed cards.
2. Evaluate module-side index tuning against production-like read/write mix once slow-query telemetry is available.
