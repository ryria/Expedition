# Sprint 3 Kickoff Runbook (EXP-020..024)

**Date:** 2026-03-10  
**Scope:** `EXP-020`, `EXP-021`, `EXP-022`, `EXP-023`, `EXP-024`  
**Primary Goal:** Ship invite + role-management improvements with strict authorization and no privilege-escalation regressions.

---

## Pre-flight checklist

### Scope, ownership, and dependencies

- [ ] [PM] Confirm issue owners for `EXP-020..024` across `BE`, `FE`, `QA`, `OPS`.
- [ ] [PM] Confirm dependency order and critical path for Sprint 3 delivery.
- [ ] [PM] Confirm definition of done for each issue (functional + security + observability).
- [ ] [BE] Confirm API contract draft for invite lifecycle and role changes.
- [ ] [FE] Confirm UI flows for invite create/accept/revoke and role update states.
- [ ] [QA] Confirm test matrix IDs for `UT/INT/E2E/SEC/REG` coverage.

### Environment and configuration readiness

- [ ] [OPS] Verify staging/prod secrets and variables required for invite and role features.
- [ ] [OPS] Verify audit/event logging is enabled for invite and role actions.
- [ ] [BE] Verify local and staging schema is aligned with latest generated bindings.
- [ ] [FE] Verify client builds and runs against current staging backend contracts.
- [ ] [QA] Verify seed data includes multiple expeditions, mixed roles, valid + expired invites.
- [ ] [OPS] Verify alert channels for authz failures and suspicious role-change spikes.

### Baseline and rollback readiness

- [ ] [BE] Record baseline permission behavior for owner/admin/member on current build.
- [ ] [QA] Run pre-sprint security smoke for invite/role endpoints and document results.
- [ ] [OPS] Take timestamped pre-release snapshot and verify restore path in staging.
- [ ] [BE] Document rollback points for schema, service, and enforcement toggles.
- [ ] [PM] Publish incident comms template and on-call roster for Sprint 3.

---

## Daily standup checklist

- [ ] [PM] Confirm issue-by-issue status (`EXP-020..024`) and update board.
- [ ] [BE] Report API/schema/authz progress and blockers since last standup.
- [ ] [FE] Report UI integration progress, contract mismatches, and UX edge cases.
- [ ] [QA] Report coverage delta, failing tests, and unresolved risk areas.
- [ ] [OPS] Report environment health, deploy risks, and active alerts.
- [ ] [PM] Capture top blockers with owner + ETA; assign escalation path.
- [ ] [PM] Confirm next-24h objective matches dependency order.

---

## BE<->FE handoff checklist

### BE -> FE

- [ ] [BE] Share finalized request/response contracts for invite create/list/revoke/accept.
- [ ] [BE] Share role-update contract, allowed transitions, and rejection/error codes.
- [ ] [BE] Share authorization matrix by actor role and target role.
- [ ] [BE] Share idempotency and race-condition expectations (duplicate invite, stale role state).
- [ ] [BE] Share audit event schema and required correlation IDs.
- [ ] [FE] Confirm implementation maps 1:1 to contract with no hidden assumptions.

### FE -> BE

- [ ] [FE] Share UI state map for loading/success/error/unauthorized/expired-invite paths.
- [ ] [FE] Share exact client-side validation rules and expected server validation parity.
- [ ] [FE] Share payload examples captured from integration tests.
- [ ] [BE] Confirm backend behavior matches FE-visible states and messages.

### Joint handoff artifacts

- [ ] [BE] Link PR(s), migration notes, and endpoint examples in issue comments.
- [ ] [FE] Link PR(s), screen capture of key flows, and regression notes.
- [ ] [PM] Confirm both sides sign off before QA entry.

---

## QA handoff checklist

### Entry criteria

- [ ] [BE] Invite + role backend changes merged or available in integrated test branch.
- [ ] [FE] Invite + role UI changes merged or available in integrated test branch.
- [ ] [OPS] Stable test environment with realistic role distribution and invite fixtures.
- [ ] [QA] Latest test plan reflects accepted scope changes and non-goals.

### Test execution checklist

- [ ] [QA] Validate invite create/revoke/accept happy paths across roles.
- [ ] [QA] Validate expired, duplicate, and already-used invite handling.
- [ ] [QA] Validate unauthorized role-change attempts are blocked and logged.
- [ ] [QA] Validate privilege boundaries (member cannot self-elevate, admin constraints enforced).
- [ ] [QA] Validate cross-expedition invite misuse is blocked.
- [ ] [QA] Validate audit trail completeness for invite/role mutations.
- [ ] [QA] Run regression on related membership views and access-dependent UI.

### Exit criteria

- [ ] [QA] All `SEC` and high-priority `INT/E2E` checks pass in CI.
- [ ] [QA] No open P0/P1 defects for authz, invite integrity, or role escalation.
- [ ] [QA] Manual adversarial checks completed (forged IDs, replay, stale token scenarios).
- [ ] [PM] QA sign-off recorded on all Sprint 3 issues.

---

## Merge/release checklist

### Pre-merge quality gate

- [ ] [BE] PRs include authz rationale, threat cases, and rollback notes.
- [ ] [FE] PRs include evidence for success and failure-path UX.
- [ ] [QA] Required suites are green and linked in PR comments.
- [ ] [OPS] Release order approved (schema -> backend -> client).
- [ ] [PM] Acceptance criteria for `EXP-020..024` explicitly checked.

### Release execution

- [ ] [OPS] Announce release window and freeze policy.
- [ ] [OPS] Apply schema changes and verify compatibility.
- [ ] [BE] Deploy backend and verify invite/role endpoints + authz metrics.
- [ ] [FE] Deploy client after backend verification passes.
- [ ] [QA] Execute post-deploy smoke for invite/accept/revoke/role update flows.
- [ ] [OPS] Start heightened monitoring for authz failures and unusual role-change volume.

### Post-release verification

- [ ] [OPS] Confirm no critical authz alerts in first monitoring window.
- [ ] [QA] Confirm production-like end-to-end checks pass after live deploy.
- [ ] [BE] Confirm audit logs show expected event coverage without gaps.
- [ ] [PM] Publish release note with risk status and follow-up actions.

---

## Incident response mini-playbook for invite/role security regressions

### Trigger conditions

- [ ] [OPS] Trigger incident if unauthorized role elevation is observed or suspected.
- [ ] [OPS] Trigger incident if invite can be reused, forged, or accepted outside intended scope.
- [ ] [QA] Trigger incident on reproducible cross-expedition invite/role bypass.
- [ ] [PM] Assign incident commander and severity level immediately.

### Immediate containment (0-15 min)

- [ ] [OPS] Freeze deployments and announce incident channel + cadence.
- [ ] [OPS] Enable emergency controls (disable role mutations and/or invite acceptance if available).
- [ ] [BE] Revoke vulnerable tokens/invites and activate safe defaults.
- [ ] [QA] Start rapid repro matrix to define blast radius.
- [ ] [PM] Publish first stakeholder update with known impact.

### Triage and rollback (15-45 min)

- [ ] [BE] Identify regression source (contract, authz check, data constraint, UI bypass).
- [ ] [OPS] Roll back to last known-good backend/client version per release plan.
- [ ] [BE] Apply hotfix guardrails if rollback alone is insufficient.
- [ ] [QA] Validate containment with targeted adversarial test set.
- [ ] [PM] Maintain 15-minute status updates until stable.

### Recovery and hardening (45-180 min)

- [ ] [BE] Patch root cause and add missing server-side authorization checks.
- [ ] [FE] Patch client paths that enabled confusing or unsafe role/invite actions.
- [ ] [QA] Add regression tests for exact exploit path before re-release approval.
- [ ] [OPS] Validate alert rules detect recurrence patterns.
- [ ] [PM] Approve controlled re-release only after BE/QA/OPS sign-off.

### Post-incident closeout (same day)

- [ ] [PM] Publish timeline, impact, and final resolution summary.
- [ ] [BE] Document root cause and permanent preventive controls.
- [ ] [QA] Record new mandatory security regression cases in the suite.
- [ ] [OPS] Update runbook and on-call playbook with proven response steps.
- [ ] [PM] Confirm action items have owners and due dates.
