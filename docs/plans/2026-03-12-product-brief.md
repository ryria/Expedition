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
