# Sprint 4 Kickoff Runbook (Billing + Entitlements)

**Date:** 2026-03-10  
**Scope:** Billing flows, webhook processing, entitlement grant/revoke correctness, and release safety.  
**Primary Goal:** Ship billing + entitlements with reliable webhook handling, no duplicate grants, and clear rollback/incident procedures.

---

## Pre-flight checklist (env/secrets/webhook test setup)

### Scope and ownership

- [ ] [PM] Confirm Sprint 4 issue owners across billing, entitlements, webhook infra, and QA.
- [ ] [PM] Confirm definition of done for billing + entitlement stories (functional, security, observability).
- [ ] [PM] Confirm dependency order (schema -> webhook backend -> entitlement service -> FE -> QA).

### Environment and secrets

- [ ] [OPS] Verify billing provider API keys are present in staging/prod secret stores.
- [ ] [OPS] Verify webhook signing secret is set and rotated according to policy.
- [ ] [OPS] Verify environment variables for price IDs/plan IDs map to the correct tier catalog.
- [ ] [BE] Verify app boots with missing/invalid billing config as fail-safe (no silent entitlement grants).
- [ ] [FE] Verify client environment points to correct billing publishable key and callback URLs.

### Webhook test setup

- [ ] [BE] Verify local webhook endpoint and signature verification path are runnable in dev.
- [ ] [OPS] Verify webhook forwarding/test harness is configured for staging endpoint.
- [ ] [BE] Verify idempotency strategy for repeated webhook delivery is implemented and documented.
- [ ] [QA] Prepare webhook replay fixtures for success, duplicate, out-of-order, and invalid-signature events.
- [ ] [OPS] Verify monitoring/alerts exist for webhook failure rate, latency, and dead-letter queue growth.

### Baseline and rollback readiness

- [ ] [BE] Record baseline entitlement behavior for free, trial, and paid users before Sprint 4 changes.
- [ ] [QA] Capture baseline E2E results for checkout, subscription state, and feature access gates.
- [ ] [OPS] Confirm rollback steps for schema changes, webhook processors, and entitlement calculators.
- [ ] [PM] Publish on-call schedule and incident communication templates for billing incidents.

---

## Daily standup checklist

- [ ] [PM] Confirm progress by ticket and update board with blocker status.
- [ ] [BE] Report billing API/webhook/entitlement backend progress since last standup.
- [ ] [FE] Report checkout/account UI progress and contract mismatches.
- [ ] [QA] Report executed tests, failing scenarios, and risk concentration.
- [ ] [OPS] Report environment health, alert noise, and deployment readiness.
- [ ] [PM] Capture top blockers with owner, mitigation, and ETA.
- [ ] [PM] Confirm next 24-hour goal aligns with critical path.

---

## BE<->FE handoff checklist

### BE -> FE

- [ ] [BE] Share finalized API contracts for checkout session creation, subscription status, and entitlement reads.
- [ ] [BE] Share canonical subscription states and transition rules (active, past_due, canceled, trialing, grace).
- [ ] [BE] Share entitlement mapping rules from plan/add-on to feature flags/limits.
- [ ] [BE] Share error codes for payment failure, auth failure, stale state, and provider outage.
- [ ] [BE] Share webhook eventual-consistency expectations and FE polling/refresh guidance.
- [ ] [FE] Confirm UI state handling aligns with BE contract and no inferred states are used.

### FE -> BE

- [ ] [FE] Share UI state map for checkout start/success/failure/cancel/retry flows.
- [ ] [FE] Share account/billing management flows and expected backend side effects.
- [ ] [FE] Share sample payload traces from integration tests.
- [ ] [BE] Confirm backend responses support every FE-visible state and recovery action.

### Joint handoff artifacts

- [ ] [BE] Link PRs, schema notes, and endpoint examples in issue comments.
- [ ] [FE] Link PRs, screenshots/video captures, and edge-case notes.
- [ ] [PM] Confirm explicit BE+FE sign-off before QA entry.

---

## QA handoff checklist

### Entry criteria

- [ ] [BE] Billing and entitlement backend changes are merged or available in integrated branch.
- [ ] [FE] Billing and entitlement UI changes are merged or available in integrated branch.
- [ ] [OPS] Stable staging environment with valid billing test account configuration.
- [ ] [QA] Test plan reflects accepted scope changes, non-goals, and known limitations.

### Test execution checklist

- [ ] [QA] Validate successful checkout grants expected entitlements.
- [ ] [QA] Validate cancellation, downgrade, and expiration revoke entitlements correctly.
- [ ] [QA] Validate webhook replay and duplicate event handling do not double-grant.
- [ ] [QA] Validate out-of-order webhook events converge to correct final entitlement state.
- [ ] [QA] Validate invalid signature events are rejected and logged.
- [ ] [QA] Validate payment-failure and past-due states apply intended access behavior.
- [ ] [QA] Validate UI messaging and retry guidance for each billing error state.
- [ ] [QA] Run regression on auth/session flows that gate entitled features.

### Exit criteria

- [ ] [QA] All P0/P1 billing and entitlement scenarios pass in CI and manual checks.
- [ ] [QA] No open defects for duplicate grants, missing revokes, or incorrect plan mapping.
- [ ] [QA] Adversarial checks completed (replay, forged signature, stale client state).
- [ ] [PM] QA sign-off recorded for all Sprint 4 billing/entitlement issues.

---

## Release checklist

### Pre-release gate

- [ ] [OPS] Confirm release window, freeze policy, and rollback owner assignments.
- [ ] [BE] Confirm DB migrations are backward compatible for rolling deploy.
- [ ] [BE] Confirm webhook consumers are idempotent and safe across redeploys.
- [ ] [FE] Confirm production build references correct billing keys/URLs.
- [ ] [QA] Confirm required smoke/regression suites are green and linked.
- [ ] [PM] Confirm acceptance criteria met for all in-scope Sprint 4 items.

### Release execution

- [ ] [OPS] Deploy schema/data changes first and verify health checks.
- [ ] [BE] Deploy backend webhook + entitlement services and verify provider event ingestion.
- [ ] [FE] Deploy client billing UX after backend verification passes.
- [ ] [QA] Run post-deploy smoke for checkout, webhook settlement, and entitlement gating.
- [ ] [OPS] Enable heightened monitoring for webhook failures and entitlement drift.

### Post-release verification

- [ ] [OPS] Confirm no critical billing/webhook alerts in initial monitoring window.
- [ ] [BE] Confirm processed webhook counts match provider delivery expectations.
- [ ] [QA] Confirm live production-like E2E checks pass for paid and non-paid users.
- [ ] [PM] Publish release summary with residual risks and next actions.

---

## Incident response mini-playbook for billing/webhook failures

### Trigger conditions

- [ ] [OPS] Trigger incident on sustained webhook failure rate above threshold.
- [ ] [OPS] Trigger incident if entitlement grants/revokes diverge from billing truth.
- [ ] [QA] Trigger incident on reproducible duplicate-grant or missing-revoke path.
- [ ] [PM] Assign incident commander, severity, and communications cadence immediately.

### Immediate containment (0-15 min)

- [ ] [OPS] Freeze deploys and open dedicated incident channel.
- [ ] [BE] Disable unsafe entitlement mutation path or switch to safe fallback mode.
- [ ] [OPS] Pause problematic webhook subscription if event storm is causing corruption.
- [ ] [QA] Start rapid repro matrix to identify blast radius by plan/event type.
- [ ] [PM] Send first stakeholder update with known impact and mitigation in progress.

### Triage and stabilization (15-45 min)

- [ ] [BE] Identify failing stage (provider delivery, signature check, queue, handler, DB write, projection).
- [ ] [OPS] Drain/retry dead-letter queue with controlled reprocessing strategy.
- [ ] [BE] Roll back recent billing/entitlement changes if recovery is not immediate.
- [ ] [QA] Validate stabilization with targeted checks on affected flows.
- [ ] [PM] Maintain 15-minute status updates until failure rate normalizes.

### Recovery (45-180 min)

- [ ] [BE] Patch root cause and add missing idempotency/ordering guards.
- [ ] [OPS] Re-enable webhook ingestion in controlled stages with live monitoring.
- [ ] [QA] Re-run regression pack for checkout, renewal, cancellation, and entitlement gates.
- [ ] [FE] Verify customer-facing error states and self-retry paths are correct after recovery.
- [ ] [PM] Approve return to normal operations after BE/QA/OPS sign-off.

### Post-incident closeout

- [ ] [PM] Publish timeline, impact assessment, and customer communication summary.
- [ ] [BE] Document root cause and permanent preventive controls.
- [ ] [OPS] Tune alert thresholds/runbooks and verify on-call readiness updates.
- [ ] [QA] Add regression cases for exact failure mode before next release.
- [ ] [PM] Track action items with owners and due dates to closure.
