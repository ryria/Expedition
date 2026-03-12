# Expedition Product Brief

**Date:** 2026-03-12  
**Version:** 1.0  
**Product:** Expedition

## 1) Executive Summary

Expedition is a collaborative endurance-tracking product for friend groups and clubs. Teams log run, walk, cycle, and row distances toward a shared long-distance route (default: 14,500 km circumnavigation of Australia). The core experience combines real-time social accountability, map-based progress, and lightweight AI coaching to make long-term consistency feel shared and motivating.

Current program status is **beta with conditional GA readiness**: functional quality and stabilization goals are passing, while final GA release remains gated by live KPI proof-window evidence and incident-response drill evidence.

## 2) Problem Statement

Most fitness apps optimize for individual performance, which can reduce consistency for users motivated more by social momentum than competition. Group challenges are often fragmented across chat threads, spreadsheets, and disconnected tracking tools.

Expedition solves this by offering a single shared expedition space where:
- Progress is collective and visible in real time.
- Every logged activity advances the same route.
- Social interactions (comments/reactions) and map milestones reinforce habit loops.
- Members receive contextual encouragement tied to team progress.

## 3) Target Users

### Primary ICP (v1)
- Friend groups (3–10 members) running collaborative distance goals.
- Small clubs (10–50 members) needing lightweight challenge coordination.

### Key Roles
- **Owner/Organizer:** creates and manages expedition spaces.
- **Member/Participant:** logs activity, tracks progress, engages socially.

## 4) Value Proposition

### Core Value
- **Shared progress, not isolated effort:** one route, many contributors.
- **Motivation through visibility:** map + feed + milestones maintain momentum.
- **Low operational overhead:** web-first, real-time, simple onboarding.

### Differentiators
- Real-time collaborative route progression.
- Dual route rendering modes ("As Ran" and "Contribution") for behavioral insight.
- Context-aware AI coach response generated per activity log.
- Expedition-centric data model supporting multi-team participation.

## 5) Product Scope (Current)

### Core Experiences
1. **Expedition and membership management**
   - Create and switch expeditions.
   - Membership-based data visibility.
2. **Activity logging and journal**
   - Manual logging with distance/activity metadata.
   - Shared feed with social interactions.
3. **Map and progress visualization**
   - Collaborative trail rendering along route waypoints.
   - Landmark and milestone progression framing.
4. **Stats and contribution analytics**
   - Team and per-member contribution visibility.
5. **Settings and integrations**
   - User/app settings and Strava callback integration.
6. **Observability and product analytics**
   - Client and product event tracking for launch governance.

### Explicit Non-Goals (v1)
- Native mobile apps.
- Enterprise SSO.
- Marketplace ecosystem.

## 6) Business and Success Metrics

### North Star (Planned)
- **Weekly Active Expeditions (WAE)**

### Supporting Metrics
- Expedition creation conversion.
- Invite acceptance rate.
- D7 and D30 retention.
- Free-to-paid conversion and paid churn (productization roadmap).
- Reliability and onboarding funnel health metrics.

### Launch Quality Baseline (latest)
- Client tests: **56/56 passing**.
- Client production build: **pass**.
- Module compile check: **pass**.

## 7) Technical Strategy (High Level)

- **Frontend:** React + Vite + TypeScript.
- **State and realtime backend:** SpacetimeDB Maincloud (shared tables, subscriptions, reducers/procedures).
- **AI:** Claude API invoked via module-side procedure for secure key handling.
- **Hosting/Delivery:** static frontend deploy + CI/CD automation.

Architecture emphasis:
- Realtime synchronization by default.
- Server-side enforcement and structured observability.
- Minimal ops footprint for small teams.

## 8) Risks and Readiness

### Strengths (as of Sprint 7)
- Launch blocker burn-down items closed.
- Performance/reliability hardening delivered.
- Onboarding and recovery UX improved.

### Remaining Gate Risks
- Live KPI threshold evidence window not fully complete.
- Incident response timing evidence not fully documented.

### Readiness Decision
- **Conditional Go for continued beta operations.**
- **No-Go for immediate GA** until evidence gates are closed.

## 9) Next Milestones (Near Term)

1. Complete 7-day KPI threshold evidence collection and publish deltas.
2. Run blocker-incident simulation and document response timings.
3. Conduct final cross-functional GA decision review with updated evidence packet.

## 10) One-Line Positioning

**Expedition helps groups stay consistent by turning individual workouts into a shared, real-time journey.**

## 11) MVP Public Challenges + Integrity Policy (Self-Reported Activities)

### Challenge Format (MVP)
- Public challenges are system-created and time-boxed (default: 28 days).
- Each challenge has a participant cap (default: 50) and a fixed route target.
- Users can join until capacity is reached or registration closes (24h before start).
- Completion means logging the full route distance within the challenge window.

### Trust Model
- Activities are user-entered by default; MVP uses **trust-first with risk scoring**, not hard anti-cheat enforcement.
- Rewards are cosmetic/status only (no cash or high-value prizes) to reduce abuse incentive.
- Leaderboard top placements and anomalous entries receive additional scrutiny.

### Required Submission Fields
- Activity type, distance (km), duration (minutes), timestamp (start or end time).
- Optional but encouraged: note and image proof.
- Validation fails if required fields are missing, negative/zero, or timestamp is outside challenge window.

### Automated Validation Rules (MVP)

#### Hard Reject (blocking)
- Timestamp outside challenge window.
- Distance <= 0 or duration <= 0.
- Duplicate submission fingerprint within 10 minutes (same user, same type, same distance, near-identical duration).

#### Soft Flag (non-blocking, queued for review)
- **Pace outlier:** implied pace exceeds sport-specific limits:
   - Run: faster than 2:45 min/km.
   - Walk/Hike: faster than 5:00 min/km.
   - Cycle: faster than 1:00 min/km (>=60 km/h average).
   - Row: faster than 1:15 min/km (>=48 km/h average).
- **Distance jump:** single activity contributes >35% of route target.
- **Daily spike:** total logged distance for user exceeds 4x their trailing 14-day median (or >120 km/day when no history).
- **Pattern anomaly:** 3 or more near-identical entries (distance within 1%, duration within 2%) in 24h.

### Scoring and Visibility
- All non-rejected logs count immediately toward progress.
- Flagged logs are marked `Pending Review` in challenge audit state but remain visible in user history.
- Public leaderboard uses:
   - `Provisional` totals by default (includes flagged logs).
   - `Reviewed` totals for top-10 display and final challenge closeout.

### Moderation Flow (MVP)
1. **Ingest:** log is accepted/rejected and assigned `clean` or `flagged` state.
2. **Queue:** flagged logs enter challenge integrity queue sorted by risk score, then recency.
3. **Priority review:** always review top-10 ranked participants and any user with >=3 flags.
4. **Moderator actions:** `confirm`, `exclude`, or `request evidence` (48h response window).
5. **Closeout:** at challenge end + 24h, freeze standings and issue cosmetics using reviewed totals.

### Enforcement Policy
- First offense (low severity): warning + education prompt.
- Repeated suspicious submissions (>=3 excluded logs in 60 days): challenge participation cooldown (14 days).
- Severe abuse (fabricated bulk logs, harassment around reports): account review and potential suspension.

### Community Integrity Features
- Participants can submit one `integrity report` per target user per challenge with required rationale.
- False/malicious report patterns are rate-limited and deprioritized.
- Integrity reports inform risk score but do not auto-penalize.

### Data and Audit Requirements
- Store immutable challenge log audit trail: submitted values, computed pace, flags, moderator action, timestamps.
- Keep moderation reasons as structured enums for analytics.
- Expose user-facing status: `Accepted`, `Flagged`, `Excluded`, `Confirmed`.

### MVP Success Criteria for Integrity Layer
- <2% of submitted logs are hard rejected for invalid data.
- 100% of top-10 challenge finishers reviewed before reward issuance.
- Median flagged-log review time <24h during active challenge windows.

## 12) Prioritized Implementation Checklist (Public Challenges + Integrity MVP)

### P0 (Must Ship for Beta Rollout)

#### A) Module/Data Model (SpacetimeDB)
- [ ] Add `public_challenge` table: id, slug, title, route_id, start_at, end_at, capacity, status, created_at.
- [ ] Add `public_challenge_participant` table: challenge_id, user_id, joined_at, completion_state.
- [ ] Add `challenge_activity_log` table linking activity submissions to challenge context.
- [ ] Add `challenge_integrity_event` audit table: log_id, risk_score, flags[], action, moderator_id, reason_enum, created_at.
- [ ] Add immutable status transitions: `accepted`, `flagged`, `excluded`, `confirmed`.

#### B) Module Procedures/Reducers
- [ ] `create_public_challenge` (system/admin only).
- [ ] `join_public_challenge` with capacity and registration-window checks.
- [ ] `submit_challenge_activity` with hard reject validations.
- [ ] `compute_integrity_flags` to apply soft-flag rules and risk score.
- [ ] `moderate_integrity_event` supporting actions: confirm/exclude/request_evidence.
- [ ] `close_challenge_standings` (+24h closeout freeze and reward issuance).

#### C) Frontend UX (Client)
- [ ] Add Public Challenges discovery/join surface (list + detail with spots left and days remaining).
- [ ] Add challenge progress states for users: joined, in progress, completed, reviewed.
- [ ] Show submission result state: accepted, pending review, excluded, confirmed.
- [ ] Add leaderboard mode toggle: Provisional vs Reviewed.
- [ ] Add integrity report action with one-report-per-target-per-challenge limit messaging.

#### D) Observability + Analytics
- [ ] Emit product events: challenge_viewed, challenge_joined, activity_submitted, activity_rejected, activity_flagged, moderation_actioned, challenge_closed.
- [ ] Emit integrity metrics: flag rate, reject rate, review SLA p50/p90, top-10 reviewed coverage.
- [ ] Add alert threshold: top-10 reviewed coverage <100% at closeout blocks rewards.

#### E) Policy + Ops
- [ ] Define moderator reason enums and runbook mapping.
- [ ] Define reward issuance policy for confirmed/completed states.
- [ ] Define cooldown enforcement for repeated suspicious submissions.

### P1 (Should Ship Next)
- [ ] Add evidence request UX and user response inbox with 48h timer.
- [ ] Add moderator queue UI with risk-sort and participant history summary.
- [ ] Add participant trust profile (recent flags, confirm/exclude ratio).
- [ ] Add challenge templates for monthly rotation (distance/elevation/theme variants).

### P2 (Can Follow)
- [ ] Add cohort fill optimization (merge underfilled cohorts or dynamic cap expansion before start).
- [ ] Add season-level cosmetics and streak-based prestige badges.
- [ ] Add anti-abuse model tuning from observed flag/review outcomes.

### Engineering Exit Criteria
- [ ] Integration tests cover join limits, hard reject paths, soft flags, moderation actions, and closeout freeze.
- [ ] Frontend states validate all four audit statuses and reviewed/provisional leaderboard modes.
- [ ] Dashboard proves integrity success criteria for at least one full 28-day challenge cycle.
