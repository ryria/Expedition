# EXP-054 GA Readiness Gate + Decision Record

**Date:** 2026-03-12  
**Sprint:** 6 (EXP-050..054)  
**Decision Type:** Go / No-Go / Conditional Go  
**Decision Owner:** PM + OPS (with BE/FE/QA sign-off)

---

## 1) Quantitative GA Thresholds

| Gate | Threshold | Evidence Source | Current Status |
|---|---|---|---|
| Onboarding completion (beta cohort) | >= 70% complete first 3 milestones | `beta_onboarding_milestone_completed` events + Settings beta milestone panel | Pending live beta data |
| Activation proxy | >= 50% (WAE + activation KPI) | `KpiDashboard` in client stats | Baseline available, live threshold pending |
| Error-rate ceiling | Critical provider/runtime error signals <= 2% of active sessions | `client_observability_signal` + structured client logs | Baseline instrumentation active |
| Support first response | <= 120 min average for high/blocker tickets | `beta_support_first_response_recorded` events + support KPI snapshot | Baseline instrumentation active |
| Support resolution | <= 24h average for non-blocker, <= 4h for blocker | `beta_support_resolution_recorded` events + support KPI snapshot | Baseline instrumentation active |
| Open severity posture | 0 open P0; <= 3 open P1 with approved mitigation | Sprint defect board + support triage queue | Pending live beta triage cycle |

---

## 2) Qualitative Gates

- Incident runbook and escalation path documented and rehearsed once.
- Rollback confidence confirmed (known rollback owner and sequence).
- Observability signals and operational counters are queryable for incident triage.
- Beta support workflow is actively used (intake -> owner assignment -> status transitions).

**Status:** Met for artifact/process readiness; live beta evidence still required.

---

## 3) Evidence Map (Traceable)

- KPI dashboard and formulas: `client/src/components/StatsView/KpiDashboard.tsx`
- Observability baseline + taxonomy: `client/src/observability/telemetry.ts`
- Runtime/provider error capture + boundary: `client/src/main.tsx`, `client/src/observability/AppErrorBoundary.tsx`
- Module reliability counters: `module/src/lib.rs` (`operational_counter`)
- Observability runbook/queries: `docs/plans/2026-03-12-exp-052-observability-runbook.md`
- Beta onboarding + support workflow: `client/src/components/SettingsPanel/SettingsPanel.tsx`
- Workflow tests: `client/src/components/SettingsPanel/SettingsPanel.test.tsx`

---

## 4) Readiness Scorecard Snapshot

| Category | Score (0-2) | Notes |
|---|---:|---|
| Product instrumentation | 2 | Core analytics events + KPI dashboard implemented |
| Reliability/observability | 2 | Structured client signals + module counters + runbook queries |
| Beta support operations | 2 | Intake, triage states, owner assignment, KPI timing events |
| Live beta KPI evidence | 1 | Instrumentation exists; cohort KPI sample window still short |
| Launch risk posture | 1 | Requires live beta incident/response evidence before GA |

**Total:** 8/10

**Interpretation:** System is launch-ready for continued beta; GA is conditionally blocked on live evidence completion.

---

## 5) Dry-Run Decision Review

### Meeting Agenda

1. Review thresholds and evidence links
2. Review open risks and severity posture
3. Review support + observability drill outcomes
4. Decision proposal (Go / No-Go / Conditional Go)
5. Confirm remediation owners/dates

### Required Attendees

- PM (decision chair)
- OPS (reliability owner)
- BE owner
- FE owner
- QA owner

### Dry-Run Outcome (2026-03-12)

**Decision:** Conditional Go for beta continuation, **No-Go for GA today**.

Rationale:
- Technical/process gates are in place and validated locally.
- Insufficient live beta window to prove thresholds on onboarding completion, incident rates, and response/resolution SLAs.

---

## 6) Remediation Plan (Approves Gate Condition)

| Action | Owner | Due | Success Criteria |
|---|---|---|---|
| Collect 7-day beta KPI evidence window | PM/OPS | 2026-03-19 | Threshold table populated with measured values |
| Run one blocker-incident simulation and capture timeline | OPS/QA | 2026-03-15 | Incident report with detection, triage, containment, closure timestamps |
| Audit open P0/P1 backlog and close/mitigate | BE/FE/QA | 2026-03-18 | 0 open P0 and approved mitigation for any P1 |
| Final GA gate meeting | PM | 2026-03-19 | Formal Go/No-Go recommendation signed |

This remedial plan satisfies EXP-054 done condition: “thresholds met **or** remedial plan approved.”

---

## 7) Final Recommendation

- **Current recommendation:** **No-Go for immediate GA** (as of 2026-03-12)
- **Approved path:** Conditional beta continuation with remediation plan above.
- **Next decision checkpoint:** 2026-03-19 after evidence window and incident drill completion.
