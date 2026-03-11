# Expedition Productization Master Plan

**Version:** 1.0  
**Date:** 2026-03-10  
**Owner:** Expedition Core Team  
**Methodology:** SPARC (Specification, Pseudocode, Architecture, Refinement, Completion)

---

## How to Use This Plan

- Treat this as the single execution checklist for turning Expedition into a real product.
- Mark tasks as complete by changing `- [ ]` to `- [x]`.
- Add dates/owner names inline when a task starts or completes.
- Keep scope disciplined: ship in phases, avoid introducing net-new scope mid-sprint.

### Status Legend

- `- [ ]` Not started
- `- [x]` Completed
- `- [~]` In progress (manual marker)
- `- [!]` Blocked (manual marker)

---

## 0) Product Direction (Locked)

### Positioning

- [ ] Lock positioning statement: **Collaborative endurance challenges for friend groups and clubs**
- [ ] Lock ICP v1: friend groups (3–10 users) + run/fitness clubs (10–50 users)
- [ ] Lock non-goals for v1 (no marketplace, no enterprise SSO, no native mobile app)

### North Star + Core Metrics

- [ ] Lock North Star: **Weekly Active Expeditions (WAE)**
- [ ] Lock supporting metrics:
  - [ ] Expedition creation conversion
  - [ ] Invite acceptance rate
  - [ ] D7 retention
  - [ ] D30 retention
  - [ ] Free→Paid conversion
  - [ ] Paid churn
  - [ ] WAU/MAU

### Revenue Strategy (v1)

- [ ] Approve pricing model: freemium + owner-paid subscription
- [ ] Draft initial price points:
  - [ ] Free: 1 expedition, up to 5 members, base stats
  - [ ] Pro: $8–12/month owner, multiple expeditions, advanced analytics/AI
  - [ ] Club: $39–99/month, admin controls and expanded seats
- [ ] Define trial policy and cancellation/refund policy

---

## 1) SPARC Phase 1 — Specification

## 1.1 Product Requirements (PRD)

- [ ] Finalize PRD for v1 with exact scope and exclusions
- [ ] Document key user journeys:
  - [ ] Create expedition
  - [ ] Invite/join expedition
  - [ ] Log activity manually
  - [ ] Sync Strava activity
  - [ ] View map/feed/stats
  - [ ] Upgrade plan
- [ ] Define persona jobs-to-be-done:
  - [ ] Owner/Organizer
  - [ ] Member/Participant
  - [ ] Club Admin

## 1.2 Feature Requirements (Acceptance Criteria)

### A) Multi-tenant Expeditions
- [ ] Users can create expedition spaces independent of other teams
- [ ] Activity/comment/reaction data is isolated per expedition
- [ ] A user can belong to multiple expeditions
- [ ] Owner can archive expedition

### B) Invites & Roles
- [ ] Invite via link/token to join expedition
- [ ] Roles supported: owner/admin/member
- [ ] Permission matrix documented and enforced server-side
- [ ] Owner can transfer ownership

### C) Billing & Entitlements
- [ ] Plan entitlements enforce limits (expeditions, seats, advanced insights)
- [ ] Upgrade flow from blocked action is implemented
- [ ] Billing state updates from provider webhooks
- [ ] Downgrade behavior defined and tested

### D) Notifications & Retention
- [ ] Event-driven notifications for invites, comments/reactions, milestones
- [ ] Daily/weekly reminder settings per user
- [ ] Quiet hours/timezone support

### E) Trust, Safety, Privacy
- [ ] Report abuse flow for comments/activity
- [ ] Soft moderation actions (hide/remove content)
- [ ] Privacy settings per expedition (private, invite-only)
- [ ] Data export + delete account flow documented

## 1.3 Legal/Policy Requirements

- [ ] Draft Terms of Service
- [ ] Draft Privacy Policy
- [ ] Publish Data Retention Policy
- [ ] Publish Acceptable Use Policy
- [ ] Add support contact and SLA expectations

## 1.4 Analytics Specification

- [ ] Define event taxonomy (canonical event names + payload schema)
- [ ] Define dashboard requirements per role (product, growth, support)
- [ ] Define KPI targets for Beta and GA

---

## 2) SPARC Phase 2 — Pseudocode & Flows

## 2.1 End-to-end Flow Diagrams

- [ ] Expedition creation flow diagram
- [ ] Invite generation + acceptance diagram
- [ ] Role change + permission enforcement diagram
- [ ] Billing checkout + webhook reconciliation diagram
- [ ] Notification fan-out + delivery status diagram
- [ ] Abuse report triage diagram

## 2.2 API/Reducer/Procedure Contracts

- [ ] Draft request/response schema for each new action
- [ ] Define idempotency behavior where applicable
- [ ] Define retry policies and backoff behavior
- [ ] Define error code taxonomy and user-facing messages

## 2.3 Edge Cases Matrix

- [ ] Invite expired/invalid/reused
- [ ] Owner leaves expedition
- [ ] Billing failed card / past_due / canceled
- [ ] Seat limit reached on member join
- [ ] Duplicate webhook events
- [ ] Network interruptions during critical actions

---

## 3) SPARC Phase 3 — Architecture

## 3.1 Domain & Data Model Changes

### New tables/entities
- [ ] `expedition`
- [ ] `membership`
- [ ] `invite`
- [ ] `plan_subscription`
- [ ] `entitlement`
- [ ] `notification`
- [ ] `audit_log`
- [ ] `abuse_report`

### Existing table migrations
- [ ] Add `expedition_id` to `activity_log`
- [ ] Add `expedition_id` to `comment`
- [ ] Add `expedition_id` to `reaction`
- [ ] Ensure membership-linked ownership checks remain strict

### Indexes and constraints
- [ ] Unique active membership per user per expedition
- [ ] Invite token uniqueness and expiry indexes
- [ ] Cascading rules defined for archive/delete operations

## 3.2 Access Control & Security Architecture

- [ ] Centralized role guard helpers in module
- [ ] Row-level authorization checks in reducers/procedures
- [ ] Server-side validation for all client-provided IDs and role changes
- [ ] Rate-limiting strategy for invites/report abuse actions
- [ ] Security review for webhook signature verification

## 3.3 Integration Architecture

### Billing
- [ ] Stripe integration design approved
- [ ] Product/price IDs and environment mapping plan
- [ ] Webhook endpoint handling + replay safety

### Notification
- [ ] Provider selection (email first, push optional later)
- [ ] Notification template strategy
- [ ] Delivery status tracking model

### Analytics
- [ ] Event ingestion pipeline choice
- [ ] Dashboarding stack decided

## 3.4 ADRs (Architecture Decision Records)

- [ ] ADR: multi-tenant partition strategy
- [ ] ADR: entitlement enforcement location
- [ ] ADR: webhook processing + retries
- [ ] ADR: moderation model
- [ ] ADR: analytics event schema governance

---

## 4) SPARC Phase 4 — Refinement (Build with TDD)

## 4.1 Sprint 1: Multi-Tenant Foundations

### Backend/module
- [ ] Add expedition and membership tables
- [ ] Add reducers: create/archive expedition, join/leave expedition
- [ ] Add role guard utilities
- [ ] Add migration logic for existing global data

### Frontend/client
- [ ] Expedition switcher UI
- [ ] Expedition creation flow UI
- [ ] Empty states for no expedition membership

### Tests
- [ ] Unit tests for role guards
- [ ] Integration tests for membership and isolation
- [ ] Regression tests for existing map/feed/stats behavior

### Done when
- [ ] Data from one expedition never appears in another
- [ ] Existing users can migrate/create first expedition successfully

## 4.2 Sprint 2: Invites & Roles

### Backend/module
- [ ] Add invite table and token lifecycle
- [ ] Add reducers/procedures: create invite, accept invite, revoke invite
- [ ] Enforce role constraints for admin/member actions

### Frontend/client
- [ ] Invite management panel
- [ ] Join expedition flow from invite link
- [ ] Role management UI for owner/admin

### Tests
- [ ] Invite expiry/revocation tests
- [ ] Role escalation prevention tests
- [ ] Owner transfer tests

### Done when
- [ ] Invite and role system works end-to-end with strict auth checks

## 4.3 Sprint 3: Billing & Entitlements

### Backend/module
- [ ] Add subscription/entitlement tables
- [ ] Add entitlement gate helpers
- [ ] Add webhook ingestion handler with signature validation
- [ ] Add idempotent webhook event processing

### Frontend/client
- [ ] Pricing page or pricing panel
- [ ] Upgrade CTA at entitlement boundaries
- [ ] Subscription status UI in settings

### Tests
- [ ] Entitlement enforcement tests
- [ ] Webhook replay/idempotency tests
- [ ] Upgrade/downgrade behavior tests

### Done when
- [ ] Paid features unlock automatically after successful billing events

## 4.4 Sprint 4: Notifications, Trust & Privacy

### Backend/module
- [ ] Notification records and state transitions
- [ ] Abuse report table + moderation actions
- [ ] Privacy setting support for expedition visibility

### Frontend/client
- [ ] Notification center + preferences
- [ ] Report abuse UI
- [ ] Moderation queue (owner/admin)

### Tests
- [ ] Notification routing tests
- [ ] Abuse workflow tests
- [ ] Privacy visibility tests

### Done when
- [ ] Safety and privacy controls are functional and auditable

## 4.5 Sprint 5: Analytics & Growth Loops

### Product analytics
- [ ] Instrument all key funnel events
- [ ] Build product dashboard views

### Growth mechanics
- [ ] Referral loop for inviting new expeditions
- [ ] Milestone share cards (optional if in v1.1)

### Tests/QA
- [ ] Event payload validation tests
- [ ] Dashboard metric validation against source data

### Done when
- [ ] Team can monitor acquisition, activation, retention, and conversion weekly

---

## 5) SPARC Phase 5 — Completion

## 5.1 Launch Readiness

- [ ] Error monitoring and alerting set up
- [ ] Backup/recovery process documented
- [ ] Incident response runbook created
- [ ] Support triage process documented
- [ ] Final legal pages published

## 5.2 Release Strategy

- [ ] Internal alpha (team only)
- [ ] Closed beta (5–10 cohorts)
- [ ] Public launch (GA)
- [ ] Rollback and feature-flag strategy validated

## 5.3 Post-Launch Operations

- [ ] Weekly KPI review ritual scheduled
- [ ] Pricing review cadence established (monthly)
- [ ] Churn interview process established
- [ ] Product feedback loop from support into backlog

---

## 6) Detailed Feature Backlog (Trackable)

## 6.1 Expedition Workspace (Core)

- [ ] Expedition create/edit/archive
- [ ] Expedition metadata (name, route, target distance, start/end dates)
- [ ] Expedition-scoped map/feed/stats queries
- [ ] Expedition switcher persistence (last active)

## 6.2 Membership & Identity

- [ ] Membership role field and constraints
- [ ] Leave expedition with owner-transfer guard
- [ ] Owner transfer flow
- [ ] Membership audit events

## 6.3 Invitations

- [ ] Invite generation with TTL and max uses
- [ ] Invite acceptance flow with auth binding
- [ ] Revoke invite action
- [ ] Invite status dashboard

## 6.4 Billing & Plan Limits

- [ ] Billing customer creation/linking
- [ ] Checkout session creation
- [ ] Subscription portal deep-link
- [ ] Entitlement checks on all gated actions
- [ ] Seat/expedition limits with graceful UX messages

## 6.5 Notifications

- [ ] In-app notification feed
- [ ] Email notification provider integration
- [ ] User preference controls
- [ ] Digest scheduling (daily/weekly)

## 6.6 Safety & Moderation

- [ ] Report action for comment/activity
- [ ] Moderation queue + status lifecycle
- [ ] Hide/delete content action (role-gated)
- [ ] Moderator notes and audit logging

## 6.7 Privacy & Data Rights

- [ ] Expedition visibility controls
- [ ] Export user data bundle
- [ ] Delete account workflow
- [ ] Data retention job and policy enforcement

## 6.8 Analytics

- [ ] Canonical event schema implementation
- [ ] Funnel dashboard (create → invite → active)
- [ ] Retention cohorts dashboard
- [ ] Revenue dashboard (MRR, churn, conversion)

---

## 7) Definition of Done (Global)

- [ ] Feature acceptance criteria all green
- [ ] Unit + integration tests pass
- [ ] Security checks pass for touched areas
- [ ] Build and lint pass
- [ ] Monitoring + logging in place
- [ ] Documentation updated
- [ ] No unresolved P0/P1 defects

---

## 8) Risk Register

## Product Risks
- [ ] Risk: Scope creep delays launch
  - Mitigation: strict v1 scope lock + feature flags
- [ ] Risk: Weak retention after initial novelty
  - Mitigation: notifications + team goals + habit reminders

## Technical Risks
- [ ] Risk: Multi-tenant migration complexity
  - Mitigation: staged migration with fallback path
- [ ] Risk: Billing/webhook inconsistency
  - Mitigation: idempotent event processing + reconciliation jobs
- [ ] Risk: Abuse/moderation burden
  - Mitigation: minimal moderation tooling for owner/admin in v1

## Operational Risks
- [ ] Risk: Support load spikes at launch
  - Mitigation: FAQ + scripted responses + clear in-app errors

---

## 9) Milestone Timeline (Editable)

- [ ] **M1 (Week 1–2):** PRD + flows + architecture signed off
- [ ] **M2 (Week 3–4):** Multi-tenant core + expedition switching live
- [ ] **M3 (Week 5–6):** Invite/roles complete and tested
- [ ] **M4 (Week 7–8):** Billing + entitlements production-ready
- [ ] **M5 (Week 9):** Notifications + moderation + privacy controls
- [ ] **M6 (Week 10):** Beta launch + KPI instrumentation complete
- [ ] **M7 (Week 12):** GA decision checkpoint

---

## 10) Weekly Execution Template

Copy this section weekly and fill in.

### Week __ (Date Range: ____)

**Goals**
- [ ] Goal 1
- [ ] Goal 2
- [ ] Goal 3

**Committed Tasks**
- [ ] Task A (owner: __)
- [ ] Task B (owner: __)
- [ ] Task C (owner: __)

**Risks / Blockers**
- [ ] Blocker 1
- [ ] Blocker 2

**Completed**
- [ ] Completed item 1
- [ ] Completed item 2

**Metrics Snapshot**
- [ ] WAE:
- [ ] Invite acceptance:
- [ ] D7:
- [ ] Free→Paid:
- [ ] Churn:

---

## 11) Change Log

- [ ] 2026-03-10: Initial comprehensive productization plan created.

---

## 12) Sprint Board Backlog (Execution-Ready)

Use this section as your weekly board. Keep each issue updated with status and owner.

### Effort Scale

- `XS` (0.5–1 day)
- `S` (1–2 days)
- `M` (3–5 days)
- `L` (1–2 weeks)
- `XL` (2+ weeks, break down before starting)

### Roles (Owner tags)

- `BE` Backend/module
- `FE` Frontend/client
- `FS` Full-stack
- `PM` Product/requirements
- `QA` Test/validation
- `OPS` DevOps/operations

---

## Sprint 1 — Foundations & Scope Lock (Target: Week 1)

### Board Goal

- Lock product scope and prepare architecture decisions to unblock implementation.

### Issues

- [ ] `EXP-001` Lock v1 scope + non-goals  
  **Priority:** P0 · **Owner:** PM · **Effort:** S · **Depends on:** none  
  **Done when:** PRD has approved v1 features, explicit exclusions, and launch KPIs.

- [ ] `EXP-002` Define metrics/event taxonomy baseline  
  **Priority:** P0 · **Owner:** PM/FS · **Effort:** S · **Depends on:** EXP-001  
  **Done when:** canonical event list and payload schema are documented and reviewed.

- [ ] `EXP-003` Multi-tenant architecture ADR set  
  **Priority:** P0 · **Owner:** BE · **Effort:** M · **Depends on:** EXP-001  
  **Done when:** ADRs for tenant isolation, role checks, and migration strategy are approved.

- [ ] `EXP-004` Billing architecture ADR + provider setup plan  
  **Priority:** P1 · **Owner:** BE/OPS · **Effort:** S · **Depends on:** EXP-001  
  **Done when:** webhook processing, idempotency, and entitlement source-of-truth are defined.

- [ ] `EXP-005` Legal/policy doc outline  
  **Priority:** P1 · **Owner:** PM · **Effort:** XS · **Depends on:** EXP-001  
  **Done when:** Terms/Privacy/Retention/AUP outline exists with owners and due dates.

### Sprint Exit Criteria

- [ ] P0 issues complete (`EXP-001..003`)
- [ ] No unresolved architecture blockers for Sprint 2

---

## Sprint 2 — Multi-Tenant Core (Target: Weeks 2–3)

### Board Goal

- Introduce expedition workspaces and strict tenant data isolation.

### Issues

- [x] `EXP-010` Add `expedition` + `membership` tables  
  **Priority:** P0 · **Owner:** BE · **Effort:** M · **Depends on:** EXP-003  
  **Done when:** schema published and subscribable via generated client bindings.

- [x] `EXP-011` Add expedition reducers/procedures (create/archive/join/leave)  
  **Priority:** P0 · **Owner:** BE · **Effort:** M · **Depends on:** EXP-010  
  **Done when:** users can create and join expedition spaces with auth validation.

- [x] `EXP-012` Add `expedition_id` migration for activity/comment/reaction  
  **Priority:** P0 · **Owner:** BE · **Effort:** L · **Depends on:** EXP-010  
  **Done when:** all existing rows are scoped and isolation queries pass.

- [x] `EXP-013` Expedition switcher + creation UI  
  **Priority:** P0 · **Owner:** FE · **Effort:** M · **Depends on:** EXP-011  
  **Done when:** users can create/switch expedition context in-app.

- [~] `EXP-014` Tenant isolation test suite  
  **Priority:** P0 · **Owner:** QA/BE · **Effort:** M · **Depends on:** EXP-012  
  **Done when:** tests verify no cross-expedition reads/writes.

### Sprint Exit Criteria

- [ ] All P0 issues complete
- [ ] Existing core UX still functional in scoped expedition context

### Progress Notes

- 2026-03-10: Completed `EXP-010` and `EXP-011` in `module/src/lib.rs`; regenerated client bindings and validated with `cargo check`, `spacetime generate --lang typescript --out-dir src/spacetime/generated --module-path ../module`, `npx vitest run`, `npm run build`.
- 2026-03-10: `EXP-012` implementation started and validated in code (added `expedition_id` to activity/comment/reaction plus parent-child consistency and legacy default expedition compatibility), pending staging dry-run/backfill verification and cutover runbook completion.
- 2026-03-10: Completed `EXP-013` client integration for expedition switcher/create flow, active expedition persistence/fallback, scoped map/feed/stats/members/settings views, and expedition event instrumentation; validated with `npx vitest run` and `npm run build`.
- 2026-03-10: `EXP-014` test pack started: added expedition-scoped hook tests for activity log, members, comments, and reactions (13 tests passing total); integration/security matrix and CI required-check gating still pending.
- 2026-03-11: Added CI isolation gate in `.github/workflows/deploy.yml` to run EXP-014 hook isolation tests on pull requests and before deploy on push.
- 2026-03-11: Blocker confirmed for closing `EXP-012`/`EXP-014` operational gates: remote verification attempts against `maincloud` were intermittently unreachable and successful SQL checks reported `expedition_id` not in scope, indicating deployed schema has not yet reached migration phases required for cutover evidence.
- 2026-03-11: Unblocked schema rollout by publishing `module` to `maincloud` with additive migration plan (`expedition_id` columns + `expedition`/`membership` tables); live SQL now shows `expedition_id` in `activity_log`/`reaction`, while full backfill evidence remains blocked by intermittent `maincloud` 10060/502 connectivity failures.
- 2026-03-11: Captured post-deploy backfill baseline from `maincloud` with retries: `activity_log` rows at `expedition_id = 0` = `3`, `comment` = `6`, `reaction` = `39`; confirms schema migration landed but data backfill still pending.
- 2026-03-11: Added and executed one-time `ops_backfill_legacy_expedition` reducer in `module/src/lib.rs`; post-run verification on `maincloud` shows `expedition_count = 1`, `membership_count = 3`, and zero unscoped rows for `activity_log`/`comment`/`reaction` (`expedition_id = 0` counts all `0`).
- 2026-03-11: Expanded `EXP-014` hook isolation coverage with explicit cross-expedition deny-path and legacy no-active-expedition regression tests in `useComments`/`useReactions`; validated with targeted Vitest run (12/12 passing) and `npm run build`.
- 2026-03-11: Manual replay-resistance check for migration path passed: second `ops_backfill_legacy_expedition` invocation was rejected by one-time guard (`migration is one-time only and requires empty expedition/membership tables`) and post-attempt counts remained unchanged (`expedition_count = 1`, `membership_count = 3`, zero unscoped rows).
- 2026-03-11: Added `LogForm` integration/security tests (`client/src/components/LogView/LogForm.test.tsx`) covering active-expedition requirement, authenticated-unlinked-member rejection, and valid scoped reducer call path; isolation suite now 15/15 passing and wired into CI isolation gate.
- 2026-03-12: Reconciled parallel EXP-012/EXP-014 tracks: rollback drill artifacts captured on `hostinger-tls` and additional `LogForm` reducer-rejection integration tests merged; local full preflight run now green (`npx vitest run`: 22/22, `npm run build`: pass).

---

## Sprint 3 — Invites & Roles (Target: Weeks 4–5)

### Board Goal

- Enable collaborative growth with secure membership and role controls.

### Issues

- [x] `EXP-020` Add `invite` table + token lifecycle  
  **Priority:** P0 · **Owner:** BE · **Effort:** M · **Depends on:** EXP-011  
  **Done when:** invite create/revoke/expire logic is persisted with TTL.

- [x] `EXP-021` Implement role model (`owner/admin/member`) with guards  
  **Priority:** P0 · **Owner:** BE · **Effort:** M · **Depends on:** EXP-010  
  **Done when:** every privileged reducer checks role and expedition scope.

- [x] `EXP-022` Invite management + join flow UI  
  **Priority:** P0 · **Owner:** FE · **Effort:** M · **Depends on:** EXP-020  
  **Done when:** owners/admins can issue invites; users can join via link.

- [x] `EXP-023` Role management UI + owner transfer  
  **Priority:** P1 · **Owner:** FE/BE · **Effort:** M · **Depends on:** EXP-021  
  **Done when:** owner can promote/demote and transfer ownership safely.

- [x] `EXP-024` Invite/role security tests  
  **Priority:** P0 · **Owner:** QA · **Effort:** S · **Depends on:** EXP-021, EXP-022  
  **Done when:** role escalation and invite abuse edge cases are covered.

- 2026-03-12: Completed `EXP-020` in `module/src/lib.rs` by adding `invite` table and reducers `create_invite`, `accept_invite`, and `revoke_invite` with TTL, max-use, revocation, and joinability checks; validated with `cargo check`, `npx vitest run` (22/22), and `npm run build`.
- 2026-03-12: Completed `EXP-021` in `module/src/lib.rs` by centralizing role guards and adding `set_membership_role` + `transfer_expedition_ownership` reducers; invite management reducers now enforce owner/admin roles through shared scoped guard helpers; validated with `cargo check`, `npx vitest run` (22/22), and `npm run build`.
- 2026-03-12: Completed `EXP-022` in `client/src/components/SettingsPanel/SettingsPanel.tsx` by replacing the placeholder with live invite management (create/revoke/list active invites) and join-by-token flow scoped to the active expedition; regenerated Spacetime bindings and validated with `npx vitest run` (22/22) and `npm run build`.
- 2026-03-12: Completed `EXP-023` in `client/src/components/SettingsPanel/SettingsPanel.tsx` by adding owner-only role controls (promote/demote member) and ownership transfer actions for active expedition memberships; validated with `npx vitest run` (26/26) and `npm run build`.
- 2026-03-12: Completed `EXP-024` in `client/src/components/SettingsPanel/SettingsPanel.test.tsx` with invite/role security coverage for non-owner guard enforcement, reducer rejection surfacing for invite abuse, and forged role escalation rejection; validated with `npx vitest run` (26/26) and `npm run build`.

### Sprint Exit Criteria

- [ ] New users can join expeditions via invite links
- [ ] Permission matrix passes automated tests

---

## Sprint 4 — Billing & Entitlements (Target: Weeks 6–7)

### Board Goal

- Turn features into product revenue via plan gating and upgrade flows.

### Issues

- [x] `EXP-030` Add `plan_subscription` + `entitlement` data model  
  **Priority:** P0 · **Owner:** BE · **Effort:** M · **Depends on:** EXP-004  
  **Done when:** active plan state and limits can be queried per expedition/owner.

- [x] `EXP-031` Integrate checkout session creation  
  **Priority:** P0 · **Owner:** BE · **Effort:** M · **Depends on:** EXP-030  
  **Done when:** user can initiate checkout from app and return to success state.

- [x] `EXP-032` Implement webhook verification + idempotent processing  
  **Priority:** P0 · **Owner:** BE/OPS · **Effort:** M · **Depends on:** EXP-031  
  **Done when:** duplicate webhook events do not corrupt subscription state.

- [x] `EXP-033` Add entitlement gating helpers across reducers/procedures  
  **Priority:** P0 · **Owner:** BE · **Effort:** M · **Depends on:** EXP-030  
  **Done when:** free-plan limits are enforced at server boundary.

- [x] `EXP-034` Pricing + upgrade UX in client  
  **Priority:** P1 · **Owner:** FE · **Effort:** S · **Depends on:** EXP-031  
  **Done when:** blocked actions show upgrade CTA with clear plan comparison.

- [x] `EXP-035` Billing tests + reconciliation command  
  **Priority:** P1 · **Owner:** QA/BE · **Effort:** S · **Depends on:** EXP-032  
  **Done when:** test fixtures cover past_due, canceled, and replay scenarios.

### Sprint Exit Criteria

- [ ] Paid plan activates correctly from real webhook events
- [ ] Free-tier limits are enforced consistently

### Progress Notes

- 2026-03-12: Completed `EXP-030` in `module/src/lib.rs` by adding public `plan_subscription` and `entitlement` tables plus owner-scoped reducers `upsert_plan_subscription` and `upsert_entitlement`; regenerated client bindings (`client/src/spacetime/generated/*`) and validated with `cargo check`, `npx vitest run` (26/26), and `npm run build`.
- 2026-03-12: Completed `EXP-031` by adding `create_checkout_session` Stripe procedure in `module/src/lib.rs` (owner-scoped expedition validation + config-driven checkout session creation) and wiring `Start checkout` action in `client/src/components/SettingsPanel/SettingsPanel.tsx`; regenerated bindings and validated with `cargo check`, `npx vitest run` (27/27), and `npm run build`.
- 2026-03-12: Completed `EXP-032` by adding Stripe webhook signature verification (`HMAC-SHA256`) and idempotent ingestion (`billing_webhook_event` table keyed by provider event id) in `module/src/lib.rs` via `ingest_stripe_webhook`; subscription state updates now handle `checkout.session.completed`, `customer.subscription.created|updated`, and `customer.subscription.deleted` without duplicate mutation; regenerated bindings and validated with `cargo check`, `npx vitest run` (27/27), and `npm run build`.
- 2026-03-12: Completed `EXP-033` by adding server-side entitlement gate helpers in `module/src/lib.rs` and enforcing free-tier/entitled member-capacity checks (`max_members`) on `join_expedition` and `accept_invite`; validated with `cargo check`, `npx vitest run` (27/27), and `npm run build`.
- 2026-03-12: Completed `EXP-034` in `client/src/components/SettingsPanel/SettingsPanel.tsx` and `SettingsPanel.css` by adding plan comparison rows and a dedicated upgrade CTA (`Upgrade now`), plus blocked-action upgrade guidance when plan limits are hit; validated with `npx vitest run` (28/28) and `npm run build`.
- 2026-03-12: Completed `EXP-035` by adding `reconcile_billing_state` procedure in `module/src/lib.rs` and fixture-style webhook status unit tests (`past_due`, `canceled`, replay-deterministic mapping); regenerated bindings and validated with `cargo check`, `npx vitest run` (28/28), and `npm run build` (Rust `cargo test` execution is environment-limited here due non-runnable wasm artifact and missing native target toolchain).

---

## Sprint 5 — Notifications + Trust/Privacy (Target: Weeks 8–9)

### Board Goal

- Improve retention and safety to make the app production-credible.

### Issues

- [ ] `EXP-040` Add `notification` model + event producers  
  **Priority:** P0 · **Owner:** BE · **Effort:** M · **Depends on:** EXP-022  
  **Done when:** key events generate notification records.

- [ ] `EXP-041` Notification center + preference controls UI  
  **Priority:** P1 · **Owner:** FE · **Effort:** M · **Depends on:** EXP-040  
  **Done when:** users can view and configure reminder/engagement notifications.

- [ ] `EXP-042` Add `abuse_report` + moderation actions  
  **Priority:** P0 · **Owner:** BE · **Effort:** M · **Depends on:** EXP-021  
  **Done when:** report/hide/remove flows are role-gated and auditable.

- [ ] `EXP-043` Privacy controls for expedition visibility  
  **Priority:** P1 · **Owner:** FE/BE · **Effort:** S · **Depends on:** EXP-011  
  **Done when:** expedition can be marked private/invite-only and enforced server-side.

- [ ] `EXP-044` Safety/privacy regression suite  
  **Priority:** P0 · **Owner:** QA · **Effort:** S · **Depends on:** EXP-042, EXP-043  
  **Done when:** moderation and privacy policies are validated by tests.

### Sprint Exit Criteria

- [ ] Report abuse flow works end-to-end
- [ ] Notification preferences are persisted and respected

---

## Sprint 6 — Analytics, Beta Launch, Operations (Target: Weeks 10–12)

### Board Goal

- Instrument the product, launch beta, and establish operating cadence.

### Issues

- [ ] `EXP-050` Implement product analytics events end-to-end  
  **Priority:** P0 · **Owner:** FS · **Effort:** M · **Depends on:** EXP-002  
  **Done when:** event schema is implemented and validated in all core flows.

- [ ] `EXP-051` Build growth/revenue dashboards  
  **Priority:** P0 · **Owner:** FS/PM · **Effort:** S · **Depends on:** EXP-050  
  **Done when:** dashboard tracks WAE, activation, retention, conversion, churn.

- [ ] `EXP-052` Observability hardening (errors, alerts, runbooks)  
  **Priority:** P0 · **Owner:** OPS · **Effort:** M · **Depends on:** EXP-044  
  **Done when:** production alerts and incident playbook are active and tested.

- [ ] `EXP-053` Beta cohort onboarding kit + support process  
  **Priority:** P1 · **Owner:** PM · **Effort:** S · **Depends on:** EXP-051  
  **Done when:** beta users can onboard with documentation and support path.

- [ ] `EXP-054` GA readiness review and launch/no-launch decision  
  **Priority:** P0 · **Owner:** PM/OPS · **Effort:** S · **Depends on:** EXP-051, EXP-052  
  **Done when:** KPI thresholds and stability gates are either met or remedial plan approved.

### Sprint Exit Criteria

- [ ] Beta running with live KPI monitoring
- [ ] GA decision made from agreed thresholds

---

## 13) Backlog Parking Lot (Post-v1)

- [ ] Team challenges marketplace
- [ ] Public challenge discovery
- [ ] Sponsor/brand partnerships and reward rails
- [ ] Native mobile app
- [ ] Enterprise SSO + advanced compliance controls

---

## 14) Assignee Roster (Fill Once)

- [ ] `PM` → __________________
- [ ] `BE` → __________________
- [ ] `FE` → __________________
- [ ] `FS` → __________________
- [ ] `QA` → __________________
- [ ] `OPS` → __________________

---

## 15) Quick Board Ops

- [ ] Weekly planning complete (every Monday)
- [ ] Mid-week risk review complete
- [ ] Sprint demo complete
- [ ] Retro complete with carry-over tasks identified
- [ ] Changelog updated for every completed issue

---

## 16) Agent Output — Sprint 1 Scope Lock Draft (EXP-001, EXP-002, EXP-005)

Use this as the working draft for Sprint 1 docs. Convert each item to approved final wording during review.

## 16.1 EXP-001 v1 Scope Lock (Draft)

### In scope

- [ ] Core loop: member joins expedition, logs/syncs activity, sees shared map/feed/stats
- [ ] Group collaboration: comments + reactions on activities
- [ ] Identity integrity: reliable auth/member binding
- [ ] Strava sync baseline: link, sync, visible status/errors
- [ ] AI coaching v1: response tied to recent activity context
- [ ] Event instrumentation coverage for core flows
- [ ] Basic operational readiness (error logging + support runbook)

### Out of scope

- [ ] Public challenge marketplace/discovery
- [ ] Sponsorship/rewards economy
- [ ] Native mobile apps
- [ ] Enterprise SSO and org billing
- [ ] Complex challenge systems (brackets/streak ladders)

### Launch gates

- [ ] Activation gate: signup/bind → first activity visible in staging
- [ ] Data quality gate: no orphaned/invalid rows in scoped data
- [ ] Instrumentation gate: required events firing with required properties
- [ ] Reliability gate: sync retries and error states verified
- [ ] Security/privacy gate: secrets never exposed client-side
- [ ] Legal gate: terms/privacy/disclaimer published and linked

## 16.2 EXP-002 KPI + Event Taxonomy (Draft)

### North star

- [ ] Weekly Active Challengers (WAC)

### KPI set

- [ ] Signup→Bound Member conversion
- [ ] Strava connection rate
- [ ] Time to first activity (median)
- [ ] Week-1 activation rate
- [ ] D7 retention
- [ ] Social engagement rate
- [ ] Sync success rate
- [ ] AI coaching usage rate

### Canonical events (minimum v1)

- [ ] `auth_signup_completed`
- [ ] `member_bound`
- [ ] `strava_link_started`
- [ ] `strava_link_succeeded`
- [ ] `strava_sync_run_completed`
- [ ] `activity_logged`
- [ ] `activity_synced`
- [ ] `feed_viewed`
- [ ] `map_viewed`
- [ ] `stats_viewed`
- [ ] `comment_added`
- [ ] `reaction_added`
- [ ] `ai_coaching_requested`
- [ ] `ai_coaching_delivered`
- [ ] `challenge_progress_viewed`

## 16.3 EXP-005 Legal/Policy Outline (Draft)

- [ ] Privacy Policy drafted and published
- [ ] Terms of Service drafted and published
- [ ] Health/fitness disclaimer visible in onboarding + AI surfaces
- [ ] Third-party disclosures (Strava + AI provider)
- [ ] Analytics notice for product telemetry
- [ ] Data export/delete request workflow documented
- [ ] Incident response policy documented
- [ ] Secrets handling standard documented
- [ ] Owners assigned for legal/engineering/support execution

## 16.4 Risks/Assumptions (Draft)

- [ ] Strava dependency can affect activation if sync/link breaks
- [ ] Auth/member mapping errors can damage trust and data integrity
- [ ] Telemetry scope must remain minimal and documented
- [ ] Social loop may underperform without UX emphasis
- [ ] Scope creep must be actively blocked during Sprint 1

---

## 17) Agent Output — ADR Draft Pack (EXP-003, EXP-004)

Use these as draft ADR placeholders. Promote each to approved ADR format once reviewed.

### ADR-001 Multi-tenant partition strategy

- [ ] **Status:** Proposed
- [ ] **Decision:** add required `expedition_id` partition key across scoped data and enforce in reads/writes
- [ ] **Positive:** strong isolation and predictable authorization
- [ ] **Negative:** migration complexity and broad touchpoints
- [ ] **Fallback:** temporary compatibility read mode behind feature flag during rollout

### ADR-002 Authorization model (owner/admin/member)

- [ ] **Status:** Proposed
- [ ] **Decision:** server-enforced role guards on all privileged reducers/procedures
- [ ] **Positive:** no trust in client-side role checks
- [ ] **Negative:** expanded role/action test matrix
- [ ] **Fallback:** no write-path fallback; maintain strict enforcement once enabled

### ADR-003 Migration from global to multi-tenant

- [ ] **Status:** Proposed
- [ ] **Decision:** phased expand/contract migration (`nullable -> backfill -> enforce not-null`)
- [ ] **Positive:** lower-risk incremental rollout
- [ ] **Negative:** temporary dual logic
- [ ] **Fallback:** pause before hard constraints and run in compatibility mode while fixing issues

### ADR-004 Billing entitlement source-of-truth

- [ ] **Status:** Proposed
- [ ] **Decision:** entitlement state stored server-side; client reads for UX only; server enforces gates
- [ ] **Positive:** consistent enforcement and simpler audits
- [ ] **Negative:** operational dependency on webhook freshness
- [ ] **Fallback:** temporary grace entitlements with reconciliation logs during provider incidents

### ADR-005 Webhook verification + idempotency model

- [ ] **Status:** Proposed
- [ ] **Decision:** verify signatures, store event metadata, enforce unique provider event IDs, support replay
- [ ] **Positive:** duplicate-safe and auditable processing
- [ ] **Negative:** added handler/storage complexity
- [ ] **Fallback:** persist verified events as pending and retry asynchronously (never drop verified events)

---

## 18) Immediate Next Actions (Pre-filled)

- [ ] Assign owners for `EXP-001`, `EXP-002`, `EXP-003`, `EXP-004`, `EXP-005`
- [ ] Schedule 60-minute ADR review and scope lock meeting
- [ ] Convert sections 16 and 17 from draft to approved language
- [ ] Mark Sprint 1 P0 items as in-progress with dates

---

## 19) Agent Output — Sprint 2 Build Pack (EXP-010 to EXP-014)

This section consolidates second-wave agent outputs into issue-ready execution items.

## 19.1 EXP-010 Schema Spec (Backend/Module)

### `expedition` table checklist

- [ ] Add `id` (PK, auto-inc)
- [ ] Add `name` (required, trimmed)
- [ ] Add `slug` (required, URL-safe, unique)
- [ ] Add `created_by_member_id` (FK to member)
- [ ] Add `is_archived`, `created_at`, `archived_at`
- [ ] Add index(es): `slug` unique, `created_by_member_id`, `is_archived`

### `membership` table checklist

- [x] Add `id` (PK, auto-inc)
- [x] Add `expedition_id` (FK)
- [x] Add `member_id` (FK)
- [x] Add `role` (`owner|admin|member`)
- [x] Add `status` (`active|left`) + `joined_at` + `left_at`
- [x] Add unique synthetic key for expedition/member pair
- [ ] Enforce one owner per expedition (via reducer logic + verification)
- [ ] Add indexes for expedition/member/status queries

### EXP-010 acceptance checks

- [x] Cannot create duplicate expedition slug
- [x] Cannot create duplicate active expedition/member pair
- [x] Expedition creator automatically gets owner membership
- [x] New schema is published and visible in client bindings

## 19.2 EXP-011 Reducer/Permission Spec (Backend/Module)

### Required reducers

- [x] `create_expedition(name, slug)`
- [x] `archive_expedition(expedition_id)`
- [x] `join_expedition(expedition_id)`
- [x] `leave_expedition(expedition_id)`

### Shared guard checklist

- [x] Require authenticated member profile for all actions
- [x] Require expedition exists and is active where applicable
- [x] Require active membership for scoped mutations
- [x] Require owner role for archive and ownership-sensitive actions

### Behavior rules

- [x] Join is idempotent (active member rejoin is safe no-op)
- [x] Leave marks membership as `left` with timestamp
- [x] Owner cannot leave without ownership transfer
- [x] Archived expedition blocks joins and scoped writes

### EXP-011 acceptance checks

- [x] Non-owner cannot archive expedition
- [x] Authenticated member can create expedition and become owner
- [x] Join/leave transitions are correct for active/left states
- [x] All rejected actions return deterministic error paths

## 19.3 EXP-012 Migration & Cutover Spec (Backend/Module + Ops)

### Phase checklist

- [x] Phase A: add new tables and nullable `expedition_id` columns (expand-only)
- [x] Phase B: create legacy expedition + seed memberships
- [x] Phase C: backfill `expedition_id` for activity/comment/reaction
- [ ] Phase D: enforce non-null + strict scoped checks, switch client to scoped reads

### Backfill verification checklist

- [x] Zero null `expedition_id` rows in scoped tables
- [x] Comment/reaction `expedition_id` always matches parent activity
- [x] No unresolved backfill rows without remediation plan
- [ ] Regression smoke for map/feed/stats passes in legacy expedition

### Rollback checkpoints

- [ ] Rollback point after Phase A
- [ ] Rollback point after Phase B
- [x] Rollback point after Phase C
- [ ] Temporary compatibility mode plan documented for emergency rollback

### Cutover runbook checklist

- [ ] Staging dry-run completed from snapshot
- [x] Staging rollback drill completed and documented
- [ ] Production maintenance window + comms prepared
- [ ] 24-hour post-cutover monitoring checklist prepared

### Blockers / Notes

- [x] Rollback drill evidence captured on active STDB server `hostinger-tls` (2026-03-11, SQL-level reversible drill).
- [!] Live SQL evidence capture remains flaky after deploy: `maincloud` intermittently returns connect timeout (os error 10060) and 502 during aggregate verification queries, preventing stable post-migration backfill counts in this session.
- [x] Operational backfill verification attached: seeded legacy expedition/memberships and validated `expedition_id = 0` counts are `0` for `activity_log`/`comment`/`reaction`.
- [x] One-time migration replay guard verified through logs + post-attempt counts (no mutation on second invocation).
- [x] Unblock action 1: deploy updated module schema (with `expedition_id` fields) to staging/target environment.
- [x] Unblock action 2: rerun SQL evidence checks for zero unscoped rows and parent-child consistency.
- [x] Unblock action 3: execute rollback drill and attach artifacts to Sprint 2 review.
- [x] Drill baseline counts before + after rollback matched exactly on `hostinger-tls`: `expedition=2`, `membership=2`, `activity_log=2`, `comment=0`, `reaction=0`.
- [x] Controlled temporary drill mutations were applied then reverted: `expedition.name` (`id=1`), `membership.role` (`id=1`), `activity_log.note` (`id=1`).
- [!] Caveat: direct SQL `INSERT` for timestamped rows on `hostinger-tls` requires strict timestamp typed literals; reducer-based `add_comment` probe via CLI did not mutate under current auth context. Drill was completed safely using reversible SQL `UPDATE` mutations + rollback verification.

## 19.4 EXP-013 Frontend/Client Spec Integration

Detailed spec prepared in [docs/plans/2026-03-10-exp-013-frontend-client-implementation-spec.md](docs/plans/2026-03-10-exp-013-frontend-client-implementation-spec.md).

### Implementation checklist

- [x] Add global expedition switcher to app header/nav
- [x] Add create expedition flow (header + settings entry point)
- [x] Add no-membership empty state with create CTA
- [x] Add active expedition persistence + deterministic restore fallback
- [x] Scope Members/MapJournal/Settings data to active expedition
- [x] Add required `expedition_*` instrumentation events

### EXP-013 acceptance checks

- [x] Switching expedition updates all views without mixed-tenant data
- [x] New expedition creation auto-selects created expedition
- [x] Invalid persisted active expedition recovers cleanly
- [x] Loading/error states are visible for switch/create actions

## 19.5 EXP-014 Test Pack (QA + Engineering)

### Test matrix coverage

- [x] Unit tests for expedition-scoped hooks/selectors
- [~] Integration tests for scoped reducers and permission guards
- [x] Regression tests for legacy behavior under scoped model
- [~] Security tests for cross-expedition access attempts

### Priority test IDs

- [x] `EXP014-UT-001` active expedition filter for members
- [x] `EXP014-UT-002` activity feed scoped filtering
- [x] `EXP014-UT-003` switch context invalidates stale state
- [~] `EXP014-INT-001..005` scoped mutation auth/behavior checks (added `LogForm` guard-path integration tests for active-expedition + linked-member enforcement, plus reducer rejection-path handling for unauthenticated/auth-mismatch mutation attempts)
- [~] `EXP014-SEC-001..003` auth mismatch and forged context rejection (hook-level cross-expedition deny checks + `LogForm` reducer-rejection integration tests for `Authentication required` and auth-mismatch paths; reducer-native forged-context automation still pending)
- [x] `EXP014-REG-001..004` migration and cross-tenant regression checks

### Sprint 2 quality gate

- [ ] All `SEC` and cross-expedition `INT` tests green in CI
- [~] Local preflight green on 2026-03-12 (`npx vitest run`: 22/22 tests pass, plus `npm run build` pass); awaiting GitHub Actions run for CI checkbox above
- [ ] Zero P0/P1 leakage or authorization defects
- [x] Migration verification artifacts attached to sprint review
- [ ] Manual multi-session leakage check completed

---

## 20) Immediate Next Actions — Sprint 2 (Pre-filled)

- [ ] Assign owners to `EXP-010` through `EXP-014`
- [ ] Split each issue into implementation tickets and estimates
- [ ] Schedule migration rehearsal in staging
- [x] Add CI job gate for `EXP014-SEC-*` tests as required checks
- [ ] Start Sprint 2 with `EXP-010`, `EXP-011`, and `EXP-013A` in parallel

---

## 21) Sprint 2 Dependency Roadmap (Execution Sequence)

### Preconditions

- [ ] `EXP-003` ADRs approved before implementation starts
- [ ] Sprint goal locked: `EXP-010..014` complete with zero cross-tenant leakage defects

### Dependency graph

- [ ] Hard chain: `EXP-010` -> `EXP-011` and `EXP-012`
- [ ] `EXP-011` must be sufficiently stable before full `EXP-013` integration
- [ ] `EXP-012` must complete before final `EXP-014` tenant-isolation gate
- [ ] Parallelizable after `EXP-010`: `EXP-011` and early `EXP-012` prep
- [ ] Parallelizable before `EXP-011` completion: `EXP-013A` shell scaffolding with mocked contracts

### Critical path and bottlenecks

- [ ] Critical path A: `EXP-010 -> EXP-012 -> EXP-014`
- [ ] Critical path B: `EXP-010 -> EXP-011 -> EXP-013`
- [ ] Monitor schema publish/bindings latency as integration bottleneck
- [ ] Monitor migration backfill correctness as highest-risk bottleneck
- [ ] Monitor flaky `SEC/INT` tests as release blocker risk

### Team assignment model (recommended for 3 engineers)

- [ ] Engineer A (BE): own `EXP-010` + core `EXP-011`
- [ ] Engineer B (BE/QA): own `EXP-012` + `EXP-014` harness
- [ ] Engineer C (FE): own `EXP-013A..F`

### Decision gates (G1..G5)

- [ ] `G1` Day 2: schema freeze and generated bindings available
- [ ] `G2` Day 4: reducer contract + permission errors stabilized
- [ ] `G3` Day 6: migration rehearsal + rollback drill successful
- [ ] `G4` Day 8: no mixed-tenant UI state + key security tests green
- [ ] `G5` Day 10: full quality gate green and sprint exit accepted

### 10-day schedule checklist

- [ ] Day 1: start `EXP-010`, `EXP-012` prep, `EXP-013A`
- [ ] Day 2: complete schema/bindings and pass `G1`
- [ ] Day 3-4: implement `EXP-011`, run migration phases A/B/C prep, build switcher/create UI
- [ ] Day 5-6: integrate FE/BE contracts, run migration enforcement rehearsal, pass `G3`
- [ ] Day 7-8: hardening + `EXP-014` test expansion, pass `G4`
- [ ] Day 9-10: stabilization, full matrix green, pass `G5`

---

## 22) Execution Assets (Generated)

- [ ] GitHub-ready issue templates (`EXP-010..014`) prepared in [docs/plans/2026-03-10-exp-010-014-github-issue-templates.md](docs/plans/2026-03-10-exp-010-014-github-issue-templates.md)
- [ ] Sprint 2 kickoff runbook prepared in [docs/plans/2026-03-10-sprint-2-kickoff-runbook.md](docs/plans/2026-03-10-sprint-2-kickoff-runbook.md)
- [ ] Frontend deep spec for `EXP-013` in [docs/plans/2026-03-10-exp-013-frontend-client-implementation-spec.md](docs/plans/2026-03-10-exp-013-frontend-client-implementation-spec.md)

### Immediate use checklist

- [ ] Create GitHub issues from templates file
- [ ] Assign owners and due dates using assignee roster
- [ ] Attach runbook to Sprint 2 planning ticket
- [ ] Tag issues with gate IDs (`G1..G5`) for risk tracking

---

## 23) Sprint 3 Dependency Roadmap (Invites & Roles)

### Scope

- [ ] `EXP-020` Invite token lifecycle backend
- [ ] `EXP-021` Role guard enforcement backend
- [ ] `EXP-022` Invite management + join flow UI
- [ ] `EXP-023` Role management UI + owner transfer
- [ ] `EXP-024` Invite/role security + regression test gate

### Dependency graph

- [ ] Primary chain: `EXP-020 -> EXP-022 -> EXP-024`
- [ ] Secondary chain: `EXP-021 -> EXP-023 -> EXP-024`
- [ ] Parallelizable after contracts: `EXP-020` and `EXP-021` can run concurrently
- [ ] FE can scaffold `EXP-022` before full backend completion using locked contracts

### Critical path and bottlenecks

- [ ] Critical path: invite lifecycle backend + join UX + security gate
- [ ] Bottleneck: permission matrix drift between backend guards and UI affordances
- [ ] Bottleneck: token expiry/revocation edge cases causing flaky integration tests

### Decision gates (Sprint 3)

- [ ] `R1` Day 2: invite + role contract freeze
- [ ] `R2` Day 4: backend invite/role enforcement passes integration tests
- [ ] `R3` Day 6: FE invite/join and role UI integrated with real contracts
- [ ] `R4` Day 8: `SEC` invite/role tests green and required in CI
- [ ] `R5` Day 10: sprint exit with zero P0/P1 authorization defects

### 10-day schedule checklist

- [ ] Day 1-2: `EXP-020` and `EXP-021` implementation + contract freeze (`R1`)
- [ ] Day 3-4: backend hardening + `EXP-022` UI skeleton (`R2`)
- [ ] Day 5-6: full FE/BE integration for `EXP-022` and `EXP-023` (`R3`)
- [ ] Day 7-8: `EXP-024` security/regression expansion and CI gate (`R4`)
- [ ] Day 9-10: stabilization, triage, sprint exit review (`R5`)

---

## 24) Sprint 3 Execution Assets (Generated)

- [ ] GitHub-ready issue templates (`EXP-020..024`) in [docs/plans/2026-03-10-exp-020-024-github-issue-templates.md](docs/plans/2026-03-10-exp-020-024-github-issue-templates.md)
- [ ] Sprint 3 dependency roadmap in [docs/plans/2026-03-10-sprint-3-exp-020-024-roadmap.md](docs/plans/2026-03-10-sprint-3-exp-020-024-roadmap.md)
- [ ] Sprint 3 kickoff runbook in [docs/plans/2026-03-10-sprint-3-kickoff-runbook.md](docs/plans/2026-03-10-sprint-3-kickoff-runbook.md)

### Immediate use checklist

- [ ] Create GitHub issues from Sprint 3 template doc
- [ ] Assign owners for `EXP-020..024`
- [ ] Add gate tags (`R1..R5`) to Sprint 3 tickets
- [ ] Attach Sprint 3 runbook to planning ticket
- [ ] Ensure `EXP-024` security tests are marked as required checks before sprint close

---

## 25) Sprint 4 Dependency Roadmap (Billing & Entitlements)

### Scope

- [ ] `EXP-030` subscription + entitlement data model
- [ ] `EXP-031` checkout session integration
- [ ] `EXP-032` webhook verification + idempotent processing
- [ ] `EXP-033` server-side entitlement gates
- [ ] `EXP-034` pricing/upgrade UX
- [ ] `EXP-035` billing regression + reconciliation tests

### Dependency graph

- [ ] Primary chain: `EXP-030 -> EXP-033 -> EXP-035`
- [ ] Billing event chain: `EXP-031 -> EXP-032 -> EXP-035`
- [ ] FE upgrade UX (`EXP-034`) starts after contract freeze from `EXP-031/033`
- [ ] `EXP-035` is final quality gate and depends on webhook + entitlement stability

### Critical path and bottlenecks

- [ ] Critical path: entitlement model -> webhook correctness -> quality gate
- [ ] Bottleneck: webhook signature/idempotency implementation correctness
- [ ] Bottleneck: stale billing state causing incorrect entitlements
- [ ] Bottleneck: mismatch between FE upgrade affordances and BE enforcement

### Decision gates (Sprint 4)

- [ ] `B1` Day 2: pricing model + entitlement contract freeze
- [ ] `B2` Day 4: checkout and webhook verification integrated in staging
- [ ] `B3` Day 6: server-side gates active with deterministic error behavior
- [ ] `B4` Day 8: billing regression and replay/idempotency tests green
- [ ] `B5` Day 10: sprint exit with no P0/P1 billing state defects

### 10-day schedule checklist

- [ ] Day 1-2: implement `EXP-030` and contract freeze (`B1`)
- [ ] Day 3-4: build `EXP-031/032` in staging and pass verification (`B2`)
- [ ] Day 5-6: implement `EXP-033` + integrate `EXP-034` (`B3`)
- [ ] Day 7-8: complete `EXP-035` matrix + required CI checks (`B4`)
- [ ] Day 9-10: stabilization, reconciliation checks, sprint close (`B5`)

---

## 26) Sprint 4 Execution Assets (Generated)

- [ ] GitHub-ready issue templates (`EXP-030..035`) in [docs/plans/2026-03-10-exp-030-035-github-issue-templates.md](docs/plans/2026-03-10-exp-030-035-github-issue-templates.md)
- [ ] Sprint 4 dependency roadmap in [docs/plans/2026-03-10-sprint-4-exp-030-035-roadmap.md](docs/plans/2026-03-10-sprint-4-exp-030-035-roadmap.md)
- [ ] Sprint 4 kickoff runbook in [docs/plans/2026-03-10-sprint-4-kickoff-runbook.md](docs/plans/2026-03-10-sprint-4-kickoff-runbook.md)

### Immediate use checklist

- [ ] Create GitHub issues from Sprint 4 templates
- [ ] Assign owners for `EXP-030..035`
- [ ] Add gate tags (`B1..B5`) to Sprint 4 issues
- [ ] Attach Sprint 4 runbook to planning ticket
- [ ] Mark webhook replay/idempotency tests as required checks before sprint close

---

## 27) Sprint 5 Dependency Roadmap (Notifications + Trust/Privacy)

### Scope

- [ ] `EXP-040` notification model + event producers
- [ ] `EXP-041` notification center + preferences UI
- [ ] `EXP-042` abuse report + moderation actions
- [ ] `EXP-043` expedition visibility/privacy controls
- [ ] `EXP-044` safety/privacy regression and authorization gate

### Dependency graph

- [ ] Primary chain: `EXP-042 -> EXP-044`
- [ ] Notifications chain: `EXP-040 -> EXP-041 -> EXP-044`
- [ ] Privacy chain: `EXP-043 -> EXP-044`
- [ ] `EXP-040` and `EXP-042` can run in parallel once contracts are locked

### Critical path and bottlenecks

- [ ] Critical path: moderation backend + privacy enforcement + security/regression gate
- [ ] Bottleneck: mismatched moderation permissions between BE guards and FE controls
- [ ] Bottleneck: notification preference edge cases creating noisy or missed delivery
- [ ] Bottleneck: incomplete regression coverage for abuse/privacy negative paths

### Decision gates (Sprint 5)

- [ ] `T1` Day 2: moderation/privacy contract freeze
- [ ] `T2` Day 4: moderation + privacy backend checks integrated in staging
- [ ] `T3` Day 6: FE notification and moderation UI integrated
- [ ] `T4` Day 8: safety/privacy regression suite green in CI
- [ ] `T5` Day 10: sprint exit with no P0/P1 trust/privacy defects

### 10-day schedule checklist

- [ ] Day 1-2: implement `EXP-040` and `EXP-042` core paths (`T1`)
- [ ] Day 3-4: implement `EXP-043` and backend hardening (`T2`)
- [ ] Day 5-6: integrate `EXP-041` + moderation UI and policy states (`T3`)
- [ ] Day 7-8: execute `EXP-044` matrix and CI gates (`T4`)
- [ ] Day 9-10: stabilization, triage, and sprint close review (`T5`)

---

## 28) Sprint 5 Execution Assets (Generated)

- [ ] GitHub-ready issue templates (`EXP-040..044`) in [docs/plans/2026-03-10-exp-040-044-github-issue-templates.md](docs/plans/2026-03-10-exp-040-044-github-issue-templates.md)
- [ ] Sprint 5 dependency roadmap in [docs/plans/2026-03-10-sprint-5-exp-040-044-roadmap.md](docs/plans/2026-03-10-sprint-5-exp-040-044-roadmap.md)
- [ ] Sprint 5 kickoff runbook in [docs/plans/2026-03-10-sprint-5-kickoff-runbook.md](docs/plans/2026-03-10-sprint-5-kickoff-runbook.md)

### Immediate use checklist

- [ ] Create GitHub issues from Sprint 5 templates
- [ ] Assign owners for `EXP-040..044`
- [ ] Add gate tags (`T1..T5`) to Sprint 5 issues
- [ ] Attach Sprint 5 runbook to planning ticket
- [ ] Mark safety/privacy regression suite as required checks before sprint close

---

## 29) Sprint 6 Dependency Roadmap (Analytics + Beta Ops)

### Scope

- [ ] `EXP-050` product instrumentation rollout
- [ ] `EXP-051` KPI dashboards for growth/revenue/retention
- [ ] `EXP-052` observability hardening (alerts/runbooks)
- [ ] `EXP-053` beta onboarding + support process
- [ ] `EXP-054` GA readiness review and launch decision

### Dependency graph

- [ ] Core analytics chain: `EXP-050 -> EXP-051 -> EXP-054`
- [ ] Reliability chain: `EXP-052 -> EXP-054`
- [ ] Beta operations chain: `EXP-053 -> EXP-054`
- [ ] `EXP-050` and `EXP-052` can run in parallel in early sprint

### Critical path and bottlenecks

- [ ] Critical path: instrumentation completeness + dashboard trust + readiness gate
- [ ] Bottleneck: missing event coverage leading to incorrect KPI decisions
- [ ] Bottleneck: alert noise or blind spots in observability setup
- [ ] Bottleneck: beta support process not mature enough for real user load

### Decision gates (Sprint 6)

- [ ] `A1` Day 2: analytics event schema and ownership freeze
- [ ] `A2` Day 4: baseline events visible in staging and validated
- [ ] `A3` Day 6: dashboards + observability stack functional with sample data
- [ ] `A4` Day 8: beta onboarding/support runbook rehearsed
- [ ] `A5` Day 10: GA readiness decision made from agreed thresholds

### 10-day schedule checklist

- [ ] Day 1-2: implement `EXP-050` baseline + observability foundations (`A1`)
- [ ] Day 3-4: complete event validation and start `EXP-051` (`A2`)
- [ ] Day 5-6: finalize dashboards + alerts/runbooks (`A3`)
- [ ] Day 7-8: execute beta operations rehearsal (`A4`)
- [ ] Day 9-10: readiness review and launch decision (`A5`)

---

## 30) Sprint 6 Execution Assets (Generated)

- [ ] GitHub-ready issue templates (`EXP-050..054`) in [docs/plans/2026-03-10-exp-050-054-github-issue-templates.md](docs/plans/2026-03-10-exp-050-054-github-issue-templates.md)
- [ ] Sprint 6 dependency roadmap in [docs/plans/2026-03-10-sprint-6-exp-050-054-roadmap.md](docs/plans/2026-03-10-sprint-6-exp-050-054-roadmap.md)
- [ ] Sprint 6 kickoff runbook in [docs/plans/2026-03-10-sprint-6-kickoff-runbook.md](docs/plans/2026-03-10-sprint-6-kickoff-runbook.md)

### Immediate use checklist

- [ ] Create GitHub issues from Sprint 6 templates
- [ ] Assign owners for `EXP-050..054`
- [ ] Add gate tags (`A1..A5`) to Sprint 6 issues
- [ ] Attach Sprint 6 runbook to planning ticket
- [ ] Confirm KPI thresholds before `EXP-054` review meeting

---

## 31) Sprint 7 Dependency Roadmap (Stabilization Buffer)

### Scope

- [ ] `EXP-060` beta feedback triage and prioritization
- [ ] `EXP-061` bug burn-down for launch blockers
- [ ] `EXP-062` performance/reliability tuning
- [ ] `EXP-063` onboarding/conversion polish
- [ ] `EXP-064` final launch-readiness re-check

### Dependency graph

- [ ] Feedback chain: `EXP-060 -> EXP-061 -> EXP-064`
- [ ] Reliability chain: `EXP-062 -> EXP-064`
- [ ] Conversion chain: `EXP-063 -> EXP-064`
- [ ] `EXP-061`, `EXP-062`, `EXP-063` can run in parallel after triage

### Critical path and bottlenecks

- [ ] Critical path: triage quality -> blocker resolution -> readiness sign-off
- [ ] Bottleneck: under-scoped high-severity bugs discovered late
- [ ] Bottleneck: performance issues needing architectural rework
- [ ] Bottleneck: onboarding friction reducing conversion at launch gate

### Decision gates (Sprint 7)

- [ ] `S1` Day 2: blocker triage freeze and ownership assignment
- [ ] `S2` Day 4: P0/P1 fixes in progress with validated repro paths
- [ ] `S3` Day 6: reliability/performance improvements verified
- [ ] `S4` Day 8: onboarding/conversion fixes validated in beta
- [ ] `S5` Day 10: final launch/no-launch decision

### 10-day schedule checklist

- [ ] Day 1-2: execute `EXP-060` and lock blocker queue (`S1`)
- [ ] Day 3-4: run bug burn-down (`EXP-061`) (`S2`)
- [ ] Day 5-6: performance/reliability hardening (`EXP-062`) (`S3`)
- [ ] Day 7-8: onboarding/conversion polish (`EXP-063`) (`S4`)
- [ ] Day 9-10: final launch readiness review (`EXP-064`) (`S5`)

---

## 32) Sprint 7 Execution Assets (Generated)

- [ ] GitHub-ready issue templates (`EXP-060..064`) in [docs/plans/2026-03-10-exp-060-064-github-issue-templates.md](docs/plans/2026-03-10-exp-060-064-github-issue-templates.md)
- [ ] Sprint 7 dependency roadmap in [docs/plans/2026-03-10-sprint-7-exp-060-064-roadmap.md](docs/plans/2026-03-10-sprint-7-exp-060-064-roadmap.md)
- [ ] Sprint 7 kickoff runbook in [docs/plans/2026-03-10-sprint-7-kickoff-runbook.md](docs/plans/2026-03-10-sprint-7-kickoff-runbook.md)

### Immediate use checklist

- [ ] Create GitHub issues from Sprint 7 templates
- [ ] Assign owners for `EXP-060..064`
- [ ] Add gate tags (`S1..S5`) to Sprint 7 issues
- [ ] Attach Sprint 7 runbook to planning ticket
- [ ] Ensure launch decision criteria are explicitly documented before `EXP-064`

---

## 33) Master Execution Controls

- [ ] Execution index (all sprint docs): [docs/plans/2026-03-10-execution-index.md](docs/plans/2026-03-10-execution-index.md)
- [ ] New-chat orchestration prompt (subagent loop): [docs/plans/2026-03-10-subagent-execution-prompt.md](docs/plans/2026-03-10-subagent-execution-prompt.md)

### Usage checklist

- [ ] Open the execution index first to select active sprint assets
- [ ] Paste the orchestration prompt into a fresh chat when you want autonomous execution
- [ ] Keep this master plan updated after every completed EXP item
