# Sprint 5 Kickoff Runbook

**Date:** 2026-03-10  
**Primary Goal:** Deliver Sprint 5 scope with clear ownership, clean handoffs, and safe release/incident handling.

---

## pre-flight

- [ ] [PM] Confirm Sprint 5 issue scope, priorities, and owners across BE/FE/QA/OPS.
- [ ] [PM] Confirm definition of done for each issue (functional, regression, and observability criteria).
- [ ] [BE] Confirm API/schema contract changes are finalized and shared.
- [ ] [FE] Confirm UI flows and error states align with current BE contracts.
- [ ] [OPS] Verify required env vars/secrets are present in staging and production.
- [ ] [OPS] Verify dashboards/alerts are active for API errors, auth failures, and latency spikes.
- [ ] [QA] Confirm test matrix and seed data cover happy path, edge cases, and abuse scenarios.
- [ ] [BE] Confirm rollback points for schema, service behavior, and feature flags.
- [ ] [PM] Publish release window, freeze policy, and on-call contacts.

---

## daily standup

- [ ] [PM] Review issue-by-issue status, blockers, and dependency changes.
- [ ] [BE] Report backend progress, contract changes, and unresolved technical risks.
- [ ] [FE] Report frontend progress, integration mismatches, and UX edge-case gaps.
- [ ] [QA] Report executed tests, failures, and risk concentration.
- [ ] [OPS] Report environment health, active alerts, and deployment readiness.
- [ ] [PM] Capture top blockers with owner + ETA and assign escalation if needed.
- [ ] [PM] Confirm next-24h goals match critical path.

---

## handoffs

- [ ] [BE] Share finalized endpoint contracts, validation rules, and error codes.
- [ ] [BE] Share state-transition rules and any eventual-consistency expectations.
- [ ] [FE] Confirm all UI states map directly to BE responses (no inferred hidden states).
- [ ] [FE] Share integration payload examples and expected side effects for each user action.
- [ ] [BE] Confirm backend behavior supports all FE-visible retry/recovery actions.
- [ ] [PM] Ensure BE and FE both record sign-off before QA entry.
- [ ] [PM] Ensure PR links, screenshots, and migration notes are attached to issue threads.

---

## QA handoff

- [ ] [BE] Confirm backend changes are merged or available in integrated test branch.
- [ ] [FE] Confirm frontend changes are merged or available in integrated test branch.
- [ ] [OPS] Confirm stable staging environment with latest config and realistic data.
- [ ] [QA] Confirm test plan reflects accepted scope, non-goals, and known limitations.
- [ ] [QA] Execute functional, regression, and negative-path coverage for Sprint 5 scope.
- [ ] [QA] Validate permission boundaries, data visibility, and audit/log coverage.
- [ ] [QA] Validate failure handling for expired/stale/invalid client and server states.
- [ ] [QA] Record P0/P1 defects immediately with reproducible steps and environment details.
- [ ] [PM] Capture formal QA sign-off on all in-scope Sprint 5 items.

---

## release checklist

- [ ] [PM] Confirm go/no-go decision and release communications plan.
- [ ] [OPS] Confirm release order (schema/config/backend/frontend) and rollback owner per step.
- [ ] [BE] Confirm migrations are backward-compatible for rolling deploy.
- [ ] [BE] Confirm safety guards/feature flags are set for controlled rollout.
- [ ] [FE] Confirm production build points to correct endpoints and callback URLs.
- [ ] [QA] Confirm required CI/manual suites are green before deploy.
- [ ] [OPS] Execute deploy in approved order and verify health checks between stages.
- [ ] [QA] Run post-deploy smoke on core user journeys and critical permissions.
- [ ] [OPS] Monitor elevated alerts during stabilization window.
- [ ] [PM] Publish release summary with residual risk and follow-up actions.

---

## incident mini-playbook for moderation/privacy regressions

### trigger conditions

- [ ] [OPS] Trigger incident on confirmed or suspected unauthorized data exposure.
- [ ] [OPS] Trigger incident on moderation bypass, unsafe content visibility, or policy-enforcement failure.
- [ ] [QA] Trigger incident on reproducible regression affecting privacy controls or moderation rules.
- [ ] [PM] Assign incident commander, severity, and update cadence immediately.

### immediate containment (0-15 min)

- [ ] [OPS] Freeze deployments and open dedicated incident channel.
- [ ] [BE] Disable or gate affected moderation/privacy mutation paths via feature flags.
- [ ] [OPS] Restrict high-risk endpoints/actions if exposure risk is active.
- [ ] [QA] Start focused repro matrix to determine blast radius by role, endpoint, and data type.
- [ ] [PM] Send first stakeholder update with known impact and current containment status.

### triage and stabilization (15-45 min)

- [ ] [BE] Identify failing layer (authorization, policy evaluation, filtering, projection, or client contract).
- [ ] [OPS] Roll back to last known-good version if containment is insufficient.
- [ ] [BE] Apply hotfix guardrails for missing checks and unsafe defaults.
- [ ] [QA] Validate containment and rollback/hotfix outcomes with targeted regression checks.
- [ ] [PM] Maintain regular status updates until risk is stabilized.

### recovery and closeout (45-180 min)

- [ ] [BE] Implement root-cause fix and add explicit server-side checks.
- [ ] [FE] Ensure UI no longer enables unsafe moderation/privacy actions.
- [ ] [QA] Add regression tests for exact failure mode before re-release approval.
- [ ] [OPS] Re-enable restricted paths in controlled stages with live monitoring.
- [ ] [PM] Publish incident summary, impact, corrective actions, and owners/due dates.
