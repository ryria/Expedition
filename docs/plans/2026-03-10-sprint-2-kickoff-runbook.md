# Sprint 2 Kickoff Runbook (EXP-010..014)

**Date:** 2026-03-10  
**Scope:** `EXP-010`, `EXP-011`, `EXP-012`, `EXP-013`, `EXP-014`  
**Primary Goal:** Ship multi-tenant core with zero cross-expedition data leakage.

---

## 1) Pre-Flight Checklist

### Branching & Ownership

- [ ] [PM] Confirm assignees for `BE`, `FE`, `QA`, `OPS` on EXP-010..014.
- [ ] [PM] Confirm sprint board priorities and dependency order: `010 -> 011/012 -> 013 -> 014`.
- [ ] [BE] Create branch `feature/sprint-2-multitenant-core` from latest `main`.
- [ ] [FE] Create branch `feature/exp-013-expedition-switcher` from latest `main` or shared Sprint 2 branch.
- [ ] [QA] Create test tracking sheet for `EXP014-UT/INT/SEC/REG` IDs.
- [ ] [OPS] Confirm branch protection and required CI checks are enabled.

### Environments & Configuration

- [ ] [OPS] Verify staging and production connection targets are documented and current.
- [ ] [OPS] Verify required secrets/variables exist for all target environments.
- [ ] [BE] Verify schema generation + client binding flow is working locally.
- [ ] [FE] Verify local client can run against current staging/test backend.
- [ ] [QA] Verify test environment has at least 2 expeditions and multi-member fixture data.
- [ ] [PM] Confirm maintenance window candidate for EXP-012 migration cutover.

### Backups & Recovery Readiness

- [ ] [OPS] Create and timestamp pre-migration data snapshot backup.
- [ ] [OPS] Verify restore procedure from snapshot in staging (at least one successful restore test).
- [ ] [BE] Document Phase A/B/C/D rollback checkpoints in issue notes.
- [ ] [OPS] Confirm compatibility mode toggle/process is documented for emergency fallback.
- [ ] [PM] Publish rollback communication template (internal + user-facing short notice).

### Baseline Validation (Before First Code Change)

- [ ] [BE] Run backend/module tests and record baseline result.
- [ ] [FE] Run client tests and build (`npx vitest run`, `npm run build`) and record baseline.
- [ ] [QA] Execute smoke test on current map/feed/stats + comments/reactions.
- [ ] [BE] Capture baseline query checks for existing data consistency.
- [ ] [PM] Confirm baseline artifacts are attached to sprint kickoff ticket.

---

## 2) Daily Standup Checklist

- [ ] [PM] Confirm yesterday's completed items by issue (`EXP-010..014`) and update status.
- [ ] [BE] Report migration/authorization risks (schema, guard, data backfill, blockers).
- [ ] [FE] Report UI integration progress and any API/contract mismatches.
- [ ] [QA] Report test coverage delta (new passing/failing UT/INT/SEC/REG tests).
- [ ] [OPS] Report environment health, deploy readiness, and alert status.
- [ ] [PM] Record top 3 blockers, owner, and ETA for unblock.
- [ ] [PM] Reconfirm next 24h objectives against dependency chain.

---

## 3) Developer Handoff Checklist

### BE -> FE

- [ ] [BE] Provide finalized reducer/procedure contracts for `create/archive/join/leave` expedition actions.
- [ ] [BE] Provide role/guard behavior matrix and deterministic error cases.
- [ ] [BE] Provide migration status for `expedition_id` scoping and known caveats.
- [ ] [BE] Share sample payloads for happy/edge/error paths.
- [ ] [FE] Confirm client integration against latest contracts (no undocumented assumptions).

### FE -> BE/QA

- [ ] [FE] Share expedition switcher/create UI behavior with loading/error/state restore rules.
- [ ] [FE] Share expected instrumentation events (`expedition_*`) and payload fields.
- [ ] [FE] Provide reproducible test steps for switch/create/no-membership flows.
- [ ] [BE] Confirm server-side scoped enforcement supports FE behavior.
- [ ] [QA] Confirm test scenarios map to delivered FE behavior.

### Cross-Functional Dev Handoff Artifacts

- [ ] [BE] Link PR(s), migration notes, and schema diff summary.
- [ ] [FE] Link PR(s), screen recordings, and feature flag/toggle notes (if used).
- [ ] [QA] Link test plan updates and newly automated cases.
- [ ] [PM] Confirm all handoff artifacts are attached to issue(s) before review starts.

---

## 4) QA Handoff Checklist

### Entry Criteria

- [ ] [BE] EXP-010/011/012 merged or ready in integrated test branch.
- [ ] [FE] EXP-013 merged or ready in integrated test branch.
- [ ] [QA] EXP-014 matrix updated with latest scope and acceptance checks.
- [ ] [OPS] Stable test environment with representative seeded multi-tenant data.

### Test Execution

- [ ] [QA] Validate no cross-expedition reads for activities/comments/reactions.
- [ ] [QA] Validate no cross-expedition writes with forged context or mismatched auth.
- [ ] [QA] Validate expedition create/switch behavior and stale context invalidation.
- [ ] [QA] Validate archive/join/leave permission boundaries (`owner/admin/member`).
- [ ] [QA] Validate migration integrity: zero null `expedition_id` in scoped tables.
- [ ] [QA] Re-run legacy regression for map/feed/stats under scoped model.

### Exit Criteria

- [ ] [QA] All `SEC` and cross-expedition `INT` tests pass in CI.
- [ ] [QA] No P0/P1 isolation or authorization defects remain open.
- [ ] [QA] Manual multi-session leakage check completed.
- [ ] [PM] QA sign-off recorded on sprint board issues.

---

## 5) Merge/Release Checklist

### Pre-Merge

- [ ] [BE] PRs are small, scoped by issue, and include rollback notes where relevant.
- [ ] [FE] UI PR includes before/after evidence and state transition notes.
- [ ] [QA] Required test suites green and linked in PR comments.
- [ ] [OPS] Deployment order approved (`schema expand -> app deploy -> backfill -> enforce`).
- [ ] [PM] All acceptance criteria for `EXP-010..014` explicitly checked.

### Release Execution

- [ ] [OPS] Announce release start and freeze window.
- [ ] [BE] Apply schema changes for current migration phase.
- [ ] [OPS] Deploy backend/module changes.
- [ ] [OPS] Deploy client changes after backend compatibility is confirmed.
- [ ] [QA] Run post-deploy smoke checks for create/join/leave/switch/isolation.
- [ ] [OPS] Start 24-hour focused monitoring period.

### Post-Release

- [ ] [QA] Confirm no new leakage/auth alerts in first 24 hours.
- [ ] [BE] Confirm data integrity checks remain clean after live traffic.
- [ ] [PM] Publish sprint release note with known issues and follow-up items.
- [ ] [OPS] Close release window after monitoring sign-off.

---

## 6) Incident Rollback Mini-Playbook (EXP-012 Migration Phase)

### Trigger Conditions

- [ ] [OPS] Trigger rollback if cross-tenant data leak is confirmed.
- [ ] [OPS] Trigger rollback if scoped writes fail broadly for valid users.
- [ ] [OPS] Trigger rollback if migration/backfill creates integrity drift.
- [ ] [PM] Declare incident severity and incident commander.

### Immediate Response (0-15 min)

- [ ] [OPS] Pause further deploy/migration actions.
- [ ] [OPS] Announce incident in team channel with timestamp and owner.
- [ ] [BE] Enable compatibility mode/fallback path (if available).
- [ ] [QA] Begin focused reproduction and blast-radius validation.
- [ ] [PM] Publish short internal status update cadence (every 15 min).

### Rollback Execution (15-45 min)

- [ ] [OPS] Roll back to last known-good checkpoint (A/B/C as applicable).
- [ ] [BE] Revert enforcement steps (`NOT NULL`/strict scope checks) only if required by plan.
- [ ] [OPS] Restore from snapshot only if checkpoint rollback cannot stabilize safely.
- [ ] [QA] Run rollback verification smoke tests (auth, feed, map, stats, comments/reactions).
- [ ] [BE] Validate key integrity queries and confirm no active leakage.

### Stabilization (45-120 min)

- [ ] [OPS] Keep feature/migration gates in safe mode until fix is validated.
- [ ] [QA] Re-run `SEC` + cross-expedition `INT` high-priority cases.
- [ ] [PM] Send stakeholder update with impact, current status, and next checkpoint ETA.
- [ ] [BE] Produce root-cause hypothesis and required fix scope.

### Recovery & Learnings (Same day)

- [ ] [PM] Record incident timeline, decisions, and owner actions.
- [ ] [BE] Document technical root cause and preventive controls.
- [ ] [QA] Add/upgrade regression tests to prevent recurrence.
- [ ] [OPS] Update rollback/runbook steps from real incident learnings.
- [ ] [PM] Approve criteria before re-attempting migration phase.

---

## 7) Sprint 2 Completion Gate (One-Page Summary)

- [ ] [PM] `EXP-010..014` all accepted against documented criteria.
- [ ] [QA] Tenant isolation verified by automated + manual checks.
- [ ] [OPS] Migration/cutover evidence and rollback drill evidence archived.
- [ ] [BE] Authorization + scoped data guarantees validated in production-like environment.
- [ ] [FE] Expedition switch/create UX validated for normal + recovery states.
