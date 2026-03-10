# Sprint 7 GitHub Issue Templates (EXP-060..EXP-064)

Recommended buffer sprint after Sprint 6 to stabilize beta quality before launch commitment. Copy/paste each section into a GitHub issue.

---

## EXP-060: Beta feedback triage and backlog consolidation

### Title
Stand up a weekly beta feedback triage loop that converts raw user feedback into prioritized, actionable Sprint 7 work

### Why this matters
Sprint 7 is a stabilization buffer. If feedback remains fragmented across comments, chat, and ad-hoc notes, critical defects and friction points will be missed or delayed.

### Scope

**In**
- Consolidate feedback intake sources (in-app notes, GitHub issues, support messages, direct beta comments)
- Define triage taxonomy: bug, UX friction, onboarding blocker, performance/reliability issue, feature request
- Set severity and priority rules (P0/P1/P2) with explicit owner assignment
- Establish recurring triage ritual with outcome capture in issues

**Out**
- Building a new support platform or CRM integration
- Rewriting product roadmap beyond Sprint 7 stabilization goals
- Solving all feature requests raised by beta users

### Detailed tasks checklist
- [ ] Create single intake query/view for all open beta feedback artifacts
- [ ] Define and publish triage fields: `source`, `impact`, `frequency`, `severity`, `owner`, `next_action`
- [ ] Add issue template comment snippet for reproducibility metadata (member, expedition, environment, steps)
- [ ] Tag and cluster existing feedback into top themes
- [ ] Convert top 10 actionable items into linked GitHub issues with acceptance criteria
- [ ] Set weekly triage cadence and assignee rotation (driver + reviewer)
- [ ] Add workflow states (`new`, `triaged`, `in-progress`, `validated`, `closed`)
- [ ] Track triage SLA (time-to-first-triage) and unresolved high-severity count

### Acceptance criteria
- All new beta feedback enters a single triage workflow within 24 hours
- High-severity items have owners and target sprint placement
- Duplicates are linked and consolidated to a single source issue
- Weekly triage session produces an updated, prioritized stabilization queue

### Test plan
- Run a dry triage on 15+ existing feedback items and verify categorization consistency
- Validate workflow state transitions and ownership assignment in GitHub
- Spot-check that converted issues include reproducible context
- Verify SLA reporting can be derived from issue metadata/state history

### Dependencies
- Sprint 6 instrumentation and support workflow outputs (EXP-050..EXP-053)
- GitHub labels/milestone conventions already in use by Expedition repo

### Risks
- Inconsistent triage rules may cause priority churn
- Missing repro details can block engineering validation
- Triage sessions may become status-only without actionable outcomes

### Definition of done
- Triage workflow is active, documented in issue comments, and used for one full weekly cycle
- Prioritized stabilization backlog exists with linked source feedback
- Ownership and SLA expectations are visible to engineering/product leads

### Suggested labels
- type:process
- area:beta
- area:triage
- area:operations
- priority:P0
- sprint:sprint-7
- effort:M

---

## EXP-061: Bug burn-down for top stabilization defects

### Title
Execute targeted bug burn-down on top beta defects impacting core expedition logging, map experience, and collaboration flows

### Why this matters
Launch confidence depends on reducing known high-impact defects, not just adding features. A focused burn-down protects core user journeys and reduces support load.

### Scope

**In**
- Prioritize and resolve P0/P1 bugs in core flows (`LogView`, `MapView`, comments/reactions, member interactions)
- Add regression tests for each fixed defect where test coverage is missing
- Verify fixes against realistic beta data in SpacetimeDB-backed environment
- Track burn-down metrics (opened vs closed, escaped defects)

**Out**
- Low-impact cosmetic cleanup with no user-facing reliability effect
- Large feature redesigns unrelated to defect resolution
- Refactors without direct bug/risk reduction value

### Detailed tasks checklist
- [ ] Build Sprint 7 bug shortlist with severity, user impact, and repro confidence
- [ ] Freeze top-priority burn-down scope (minimum 8–12 high-value defects)
- [ ] Implement fixes in client hooks/components and/or module reducers as needed
- [ ] Add/extend tests for each defect class (unit/integration/component)
- [ ] Validate generated bindings and type contracts after backend changes
- [ ] Run daily burn-down review and re-prioritize only on new critical evidence
- [ ] Close bugs only after repro steps pass and no regression signal appears
- [ ] Publish end-of-sprint burn-down summary with unresolved carryovers

### Acceptance criteria
- Agreed Sprint 7 P0 bugs are closed or explicitly deferred with risk sign-off
- P1 closure rate meets sprint target agreed by engineering lead
- Every fixed defect includes a validation artifact (test or reproducible manual check)
- No new critical regressions introduced in core flows from bug fixes

### Test plan
- Execute focused test suite for impacted hooks/components (`useActivityLog`, `useMembers`, map/log components)
- Add regression tests for bug-specific edge cases
- Run full `npx vitest run` in `client` and verify pass
- Run `npm run build` in `client` and verify zero build/type errors
- Perform manual smoke pass for add log, comment/reaction, map render, member panel updates

### Dependencies
- Input queue from EXP-060 triage process
- Stable dev/test data and schema from current SpacetimeDB module

### Risks
- Fixes in shared hooks may create hidden regressions
- Scope creep from non-critical bugs can dilute burn-down effectiveness
- Insufficient repro fidelity may cause false closures

### Definition of done
- Burn-down target completed with evidence-backed closures
- Regression tests added for newly fixed high-impact bugs
- Remaining defects are prioritized with explicit rationale for deferment

### Suggested labels
- type:bugfix
- area:stabilization
- area:react
- area:spacetimedb
- priority:P0
- sprint:sprint-7
- effort:L

---

## EXP-062: Performance and reliability tuning across client and module

### Title
Improve runtime performance and reliability for high-traffic beta scenarios in React client and SpacetimeDB module

### Why this matters
Even when features work functionally, latency spikes and intermittent failures erode beta trust. Sprint 7 should tune bottlenecks before launch readiness re-check.

### Scope

**In**
- Profile and optimize expensive render/update paths in activity feed/map views
- Reduce redundant subscription/query work in live data hooks
- Tune critical module queries/indexes and reducer hot paths
- Add reliability safeguards for transient failures and reconnect handling

**Out**
- Premature optimization of low-impact paths
- Infrastructure migration outside current deployment model
- New feature work not tied to performance/reliability gains

### Detailed tasks checklist
- [ ] Capture baseline metrics: key route load time, interaction latency, update throughput, error/retry rates
- [ ] Profile `ActivityFeed`, map layers/markers, and comment thread update frequency
- [ ] Optimize rerender patterns (memoization/selective updates) where measurements justify
- [ ] Audit hooks (`useLiveTable`, `useRoadRoute`, comments/reactions hooks) for redundant subscriptions
- [ ] Add/adjust module indexes or query paths for top slow operations
- [ ] Add retry/backoff and user-safe fallback states for transient connection failures
- [ ] Re-measure and document before/after metrics in issue comments
- [ ] Gate merge on measurable improvements for agreed KPIs

### Acceptance criteria
- Targeted performance KPIs improve versus baseline (thresholds defined at issue kickoff)
- Reliability metrics show reduced transient failure impact in beta scenarios
- Optimizations preserve functional correctness and do not degrade UX behavior
- Performance changes are accompanied by measurement evidence

### Test plan
- Benchmark/profile run before and after each major optimization change
- Execute existing hook/component tests plus new targeted tests for tuned logic
- Run `npx vitest run` and `npm run build` in `client`
- Run module-level tests/checks in `module` (`cargo test`/`cargo build`) for affected backend changes
- Conduct manual soak test with repeated log/comment/map interactions

### Dependencies
- Defect insights from EXP-061
- Observability/instrumentation paths from Sprint 6 (EXP-050, EXP-052)

### Risks
- Over-tuning can reduce code clarity and maintainability
- Incomplete baselines may overstate gains
- Backend index changes may affect write performance if not balanced

### Definition of done
- Agreed performance/reliability goals are met with documented metrics
- No net regression in functional tests or smoke scenarios
- Any unresolved bottlenecks are documented with follow-up issues

### Suggested labels
- type:fullstack
- area:performance
- area:reliability
- area:react
- area:spacetimedb
- priority:P1
- sprint:sprint-7
- effort:L

---

## EXP-063: Onboarding and conversion polish from beta friction findings

### Title
Polish onboarding and first-value conversion path to reduce drop-off in early Expedition user journey

### Why this matters
Stabilization is not only bug fixes: onboarding friction directly impacts activation and perceived product quality. Sprint 7 should remove highest-friction onboarding blockers identified in beta.

### Scope

**In**
- Improve clarity and resilience in onboarding steps and empty/loading/error states
- Reduce friction in first successful actions (join expedition, create first log, engage with map/comments)
- Tighten copy and UI cues within existing design system components
- Validate conversion improvements using current analytics signals

**Out**
- New onboarding concept redesign from scratch
- Brand/theme overhauls or major visual system changes
- Large net-new feature additions outside conversion path

### Detailed tasks checklist
- [ ] Review onboarding funnel data and isolate top 3–5 drop-off points
- [ ] Audit current onboarding UX in `LogView`, members/settings entry points, and callback states
- [ ] Implement targeted copy/state polish for ambiguous steps and recoverable errors
- [ ] Improve empty-state guidance toward first-value action completion
- [ ] Ensure failed callback/auth states provide actionable next step for users
- [ ] Add instrumentation checks for onboarding milestone events after UX changes
- [ ] Validate accessibility basics on updated onboarding elements (focus order, labels, contrast via existing tokens)
- [ ] Re-run funnel check and compare pre/post completion and activation indicators

### Acceptance criteria
- Top identified onboarding friction points are resolved or materially improved
- Users can complete first-value flow without blocker-level confusion/errors
- Funnel metrics show improvement against Sprint 6 baseline (or no regression with documented rationale)
- Updated states/copy remain consistent with existing UI system

### Test plan
- Component tests for updated onboarding/empty/error state behavior
- Manual walkthrough for new-user path from landing/invite to first activity log
- Verify callback and failure-path handling in local dev environment
- Run `npx vitest run` and `npm run build` in `client`

### Dependencies
- Feedback clusters from EXP-060 and defect fixes from EXP-061
- Analytics events and KPI dashboards from Sprint 6 (EXP-050, EXP-051)

### Risks
- UI copy changes without metric validation may not improve conversion
- Tight coupling with unresolved auth/callback issues can mask gains
- Over-polish effort may consume capacity needed for critical reliability fixes

### Definition of done
- Onboarding polish changes are shipped with validated user-flow checks
- Conversion-impact evidence is posted in issue comments
- Remaining conversion gaps are logged as follow-up issues

### Suggested labels
- type:frontend
- area:onboarding
- area:conversion
- area:ux
- area:react
- priority:P1
- sprint:sprint-7
- effort:M

---

## EXP-064: Launch readiness re-check and stabilization exit gate

### Title
Run Sprint 7 launch readiness re-check with updated quality, reliability, and operational evidence before go/no-go recommendation

### Why this matters
Sprint 7 is the final stabilization buffer. A disciplined re-check ensures launch decisions reflect current defect, reliability, and onboarding reality rather than stale Sprint 6 assumptions.

### Scope

**In**
- Re-evaluate go/no-go criteria using post-stabilization data
- Confirm critical bug status, performance/reliability KPIs, and onboarding conversion posture
- Validate support/triage operational readiness and incident response confidence
- Publish explicit recommendation with residual risk register

**Out**
- Shipping unrelated roadmap initiatives
- Replacing existing governance process with a new framework
- Marketing launch execution details

### Detailed tasks checklist
- [ ] Refresh launch gate checklist from Sprint 6 GA-readiness artifact with Sprint 7 criteria updates
- [ ] Pull latest status from EXP-060..EXP-063 (triage health, burn-down, performance, onboarding)
- [ ] Re-validate hard thresholds (open P0 count, unresolved high-risk reliability items, blocker onboarding defects)
- [ ] Conduct cross-functional review meeting with engineering/product/ops representatives
- [ ] Record decision per criterion (`pass`, `conditional`, `fail`) with evidence links
- [ ] Create mitigation plan for any conditional/failing items with owner and due date
- [ ] Publish final recommendation (`Go`, `Conditional Go`, or `No-Go`) in issue comments
- [ ] Open follow-up issues for any deferred launch-critical gaps

### Acceptance criteria
- Launch re-check evaluates all required criteria with up-to-date evidence
- Decision output includes explicit rationale and named risk owners
- Any conditional/no-go decision has actionable mitigation timeline
- Stakeholders acknowledge final recommendation and next actions

### Test plan
- Tabletop validation of launch gate workflow and ownership responsibilities
- Data spot-checks: gate values match dashboards, issue states, and test/build status
- Verify quality baseline by running `npx vitest run` and `npm run build` in `client`
- Verify backend/module health for impacted areas via `cargo test`/`cargo build` in `module`

### Dependencies
- Completion state and evidence from EXP-060, EXP-061, EXP-062, EXP-063
- Sprint 6 readiness framework from EXP-054

### Risks
- Decision pressure may downplay unresolved critical risks
- Incomplete evidence collection can create false confidence
- Late-breaking bugs may invalidate meeting outcomes

### Definition of done
- Launch readiness re-check completed with documented decision and evidence
- Residual risk register is up to date with owners and mitigation plans
- Launch recommendation is communicated and traceable for audit

### Suggested labels
- type:process
- area:launch-readiness
- area:stabilization
- area:ops
- priority:P0
- sprint:sprint-7
- effort:M
- decision-gate
