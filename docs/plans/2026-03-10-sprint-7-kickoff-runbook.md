# Sprint 7 Kickoff Runbook

**Date:** 2026-03-10  
**Primary Goal:** Execute Sprint 7 with explicit ownership, dependable handoffs, strong QA gates, and a safe release path.

---

## pre-flight

- [ ] [PM] Confirm Sprint 7 scope, priorities, and owners for all in-scope BE/FE/QA/OPS issues.
- [ ] [PM] Confirm definition of done for each issue (functional, regression, observability, and release-readiness).
- [ ] [BE] Confirm API/schema contracts for Sprint 7 are finalized and shared with FE/QA.
- [ ] [FE] Confirm all Sprint 7 UI states (loading/empty/error/retry) align with backend contracts.
- [ ] [OPS] Verify staging/prod env vars and secrets required for Sprint 7 are present and valid.
- [ ] [OPS] Verify dashboards and alerts are active for API error rate, latency, client error spikes, and ingestion failures.
- [ ] [QA] Confirm Sprint 7 test matrix and seed data cover happy path, edge cases, and negative-path scenarios.
- [ ] [BE] Confirm rollback points and feature-flag controls exist for each high-risk change.
- [ ] [PM] Publish release window, freeze policy, and on-call roster.

---

## daily standup

- [ ] [PM] Review issue status, blockers, dependency shifts, and critical-path changes.
- [ ] [BE] Report backend progress, contract changes, and unresolved technical risks.
- [ ] [FE] Report frontend progress, integration mismatches, and UX risk areas.
- [ ] [QA] Report executed tests, failure trends, and risk concentration by feature.
- [ ] [OPS] Report environment health, alert activity, deployment readiness, and infra constraints.
- [ ] [PM] Capture top blockers with named owner, mitigation, and ETA.
- [ ] [PM] Confirm next-24h goals align with Sprint 7 critical path.

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
- [ ] [QA] Execute functional, regression, and negative-path tests for all Sprint 7 in-scope items.
- [ ] [QA] Validate permissions, data visibility boundaries, and logging/traceability requirements.
- [ ] [QA] Validate failure handling for stale/expired/invalid client and server states.
- [ ] [QA] Record P0/P1 defects immediately with reproducible steps, environment details, and expected vs actual behavior.
- [ ] [PM] Record formal QA sign-off on each Sprint 7 deliverable.

---

## release checklist

- [ ] [PM] Confirm go/no-go criteria, release sequence, and decision owner at each gate.
- [ ] [OPS] Confirm deployment order (schema/config/backend/frontend) with rollback owner per stage.
- [ ] [BE] Confirm migrations and API changes are backward compatible for staged rollout.
- [ ] [BE] Confirm feature flags and guardrails are configured for controlled enablement.
- [ ] [FE] Confirm production builds point to correct endpoints, callback URLs, and analytics keys.
- [ ] [QA] Confirm required CI/manual suites are green before launch.
- [ ] [OPS] Deploy in approved order and verify health checks between each stage.
- [ ] [QA] Execute release smoke test for core journeys and highest-risk edge cases.
- [ ] [OPS] Monitor elevated alerts and telemetry during stabilization window.
- [ ] [PM] Publish release summary with residual risks, owner follow-ups, and next checkpoint.

---

## incident mini-playbook for launch-blocking regressions

### trigger conditions

- [ ] [QA] Trigger incident for reproducible regression that blocks launch-critical user journeys.
- [ ] [OPS] Trigger incident for sustained production/staging failures that prevent safe release.
- [ ] [BE] Trigger incident when backend/API/data regressions break core flow completion.
- [ ] [FE] Trigger incident when client regressions block primary navigation, submission, or recovery paths.
- [ ] [PM] Assign incident commander, severity, communication cadence, and release decision authority.

### immediate containment (0-15 min)

- [ ] [OPS] Freeze deployments and open dedicated incident channel.
- [ ] [BE] Disable or gate newly introduced high-risk paths via feature flags.
- [ ] [FE] Hide or disable affected UI actions where safe to reduce user impact.
- [ ] [QA] Start focused repro matrix by environment, role, and workflow.
- [ ] [PM] Send first stakeholder update with known impact and containment status.

### triage and stabilization (15-45 min)

- [ ] [BE] Isolate failing layer (validation, business logic, data write/read path, integration, or API response).
- [ ] [FE] Verify client-side state handling and error recovery against backend responses.
- [ ] [OPS] Compare current deploy/config to last known-good baseline and roll back if needed.
- [ ] [QA] Validate rollback/hotfix outcomes with targeted regression checks.
- [ ] [PM] Maintain regular status updates until critical-path behavior is stable.

### recovery and closeout (45-180 min)

- [ ] [BE] Implement root-cause fix and add explicit server-side protections.
- [ ] [FE] Implement companion UI safeguards and clear error/retry behavior for affected flows.
- [ ] [QA] Add or update regression coverage for the exact launch-blocking failure mode.
- [ ] [OPS] Re-enable restricted paths in controlled stages with active monitoring.
- [ ] [PM] Record incident summary, launch decision, corrective actions, and owner due dates.
