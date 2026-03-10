# Sprint 6 Kickoff Runbook

**Date:** 2026-03-10  
**Primary Goal:** Execute Sprint 6 with clear ownership, fast handoffs, strong QA gates, and safe beta/release operations.

---

## pre-flight

- [ ] [PM] Confirm Sprint 6 scope, priorities, and owners for all in-scope BE/FE/QA/OPS issues.
- [ ] [PM] Confirm definition of done for each issue (functional, regression, observability, and release-readiness).
- [ ] [BE] Confirm API/schema contracts for Sprint 6 are finalized and shared with FE/QA.
- [ ] [FE] Confirm all Sprint 6 UI states (loading/empty/error/retry) align with backend contracts.
- [ ] [OPS] Verify staging/prod env vars and secrets required for Sprint 6 are present and valid.
- [ ] [OPS] Verify dashboards and alerts are active for API error rate, latency, client error spikes, and ingestion failures.
- [ ] [QA] Confirm Sprint 6 test matrix and seed data cover happy path, edge cases, and negative-path scenarios.
- [ ] [BE] Confirm rollback points and feature-flag controls exist for each high-risk change.
- [ ] [PM] Publish release/beta window, freeze policy, and on-call roster.

---

## daily standup

- [ ] [PM] Review issue status, blockers, dependency shifts, and critical-path changes.
- [ ] [BE] Report backend progress, contract changes, and unresolved technical risks.
- [ ] [FE] Report frontend progress, integration mismatches, and UX risk areas.
- [ ] [QA] Report executed tests, failure trends, and risk concentration by feature.
- [ ] [OPS] Report environment health, alert activity, deployment readiness, and infra constraints.
- [ ] [PM] Capture top blockers with named owner, mitigation, and ETA.
- [ ] [PM] Confirm next-24h goals align with Sprint 6 critical path.

---

## handoffs

- [ ] [BE] Share finalized endpoint contracts, validation rules, and error codes.
- [ ] [BE] Share event/state-transition behavior and consistency expectations.
- [ ] [FE] Confirm UI state mapping directly reflects backend responses (no hidden inferred states).
- [ ] [FE] Share integration payload examples and expected side effects for each user action.
- [ ] [BE] Confirm backend supports all FE retry/recovery actions.
- [ ] [PM] Ensure BE and FE explicit sign-off before QA entry.
- [ ] [PM] Ensure issue threads include PR links, screenshots, migration/config notes, and known limitations.

---

## QA handoff

- [ ] [BE] Confirm backend changes are merged or available in integrated test branch.
- [ ] [FE] Confirm frontend changes are merged or available in integrated test branch.
- [ ] [OPS] Confirm stable staging environment with latest config and representative data.
- [ ] [QA] Confirm test plan reflects accepted scope, non-goals, and known limitations.
- [ ] [QA] Execute functional, regression, and negative-path tests for all Sprint 6 in-scope items.
- [ ] [QA] Validate permissions, data visibility boundaries, and logging/traceability requirements.
- [ ] [QA] Validate failure handling for stale/expired/invalid client and server states.
- [ ] [QA] Record P0/P1 defects immediately with reproducible steps, environment details, and expected vs actual behavior.
- [ ] [PM] Record formal QA sign-off on each Sprint 6 deliverable.

---

## release/beta checklist

- [ ] [PM] Confirm go/no-go criteria and beta cohort/rollout plan.
- [ ] [OPS] Confirm deployment order (schema/config/backend/frontend) with rollback owner per stage.
- [ ] [BE] Confirm migrations and API changes are backward compatible for staged rollout.
- [ ] [BE] Confirm feature flags and guardrails are configured for beta cohort control.
- [ ] [FE] Confirm production/beta builds point to correct endpoints, callback URLs, and analytics keys.
- [ ] [QA] Confirm required CI/manual suites are green before beta launch.
- [ ] [OPS] Deploy in approved order and verify health checks between each stage.
- [ ] [QA] Execute beta smoke test for core journeys and high-risk edge cases.
- [ ] [OPS] Monitor elevated alerts and telemetry during beta stabilization window.
- [ ] [PM] Publish beta/release summary with residual risks, owner follow-ups, and next decision checkpoint.

---

## incident mini-playbook for analytics/ops regressions

### trigger conditions

- [ ] [OPS] Trigger incident on sustained analytics ingestion drop, event volume anomaly, or telemetry outage.
- [ ] [OPS] Trigger incident on operational regressions causing elevated error rate, latency, or deployment instability.
- [ ] [QA] Trigger incident on reproducible regression that blocks observability or operational control paths.
- [ ] [PM] Assign incident commander, severity, and update cadence immediately.

### immediate containment (0-15 min)

- [ ] [OPS] Freeze deployments and open dedicated incident channel.
- [ ] [BE] Disable or gate newly introduced high-risk paths via feature flags.
- [ ] [OPS] Stabilize platform by reverting unsafe config changes when needed.
- [ ] [QA] Begin focused repro matrix by environment, role, and impacted workflow.
- [ ] [PM] Send first stakeholder update with known impact and containment status.

### triage and stabilization (15-45 min)

- [ ] [BE] Identify failing layer (event emission, transport, ingestion pipeline, storage, query, or API surface).
- [ ] [OPS] Compare current deploy/config to last known-good baseline and roll back if containment is insufficient.
- [ ] [BE] Apply hotfix guardrails for missing checks, retries, or fallback behavior.
- [ ] [QA] Validate containment and rollback/hotfix outcomes with targeted regression checks.
- [ ] [PM] Maintain regular status updates until key health metrics stabilize.

### recovery and closeout (45-180 min)

- [ ] [BE] Implement root-cause fix and add explicit server-side protections.
- [ ] [FE] Verify analytics/ops-related UI paths (status surfaces, retry actions, error messaging) reflect recovered state.
- [ ] [QA] Add regression tests for exact failure mode before re-release approval.
- [ ] [OPS] Re-enable restricted paths in controlled stages with active monitoring.
- [ ] [PM] Publish incident summary, impact, corrective actions, and owners/due dates.
