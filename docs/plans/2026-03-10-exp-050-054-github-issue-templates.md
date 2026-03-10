# Sprint 6 GitHub Issue Templates (EXP-050..EXP-054)

Copy/paste each section into a GitHub issue.

---

## EXP-050: Instrument core product and reliability events end-to-end

### Title
Implement standardized event instrumentation across React client and SpacetimeDB module for Sprint 6 analytics goals

### Why this matters
Sprint 6 depends on trustworthy usage and reliability data. Without consistent instrumentation, KPI dashboards and GA readiness decisions will be based on incomplete or misleading signals.

### Scope

**In**
- Define canonical event taxonomy for product usage, funnel progression, errors, and operational health
- Add event emission points in React flows (onboarding, activity interactions, collaboration, settings)
- Add server-side event capture for key reducers and operational events in SpacetimeDB Rust module
- Persist event stream in queryable schema with expedition/member scoping and timestamps
- Add lightweight event validation to prevent malformed payloads

**Out**
- Third-party BI platform procurement/integration beyond current stack
- Long-term warehouse modeling outside immediate Sprint 6 KPI needs
- Advanced attribution modeling (multi-touch, cohort causal inference)

### Detailed tasks checklist
- [ ] Publish `analytics_event` taxonomy doc in issue body/comments (name, category, required fields, source)
- [ ] Add event schema/table(s) in SpacetimeDB module with fields: `id`, `expedition_id`, `member_id?`, `event_name`, `event_category`, `source`, `payload_json`, `occurred_at`, `ingested_at`
- [ ] Add indexes for common reads (`event_name+occurred_at`, `expedition_id+occurred_at`, `source+occurred_at`)
- [ ] Implement `track_event` reducer/procedure with strict required-field validation
- [ ] Instrument React onboarding lifecycle events (viewed, started, completed, failed)
- [ ] Instrument activity feed/log interactions (create, edit, comment, reaction)
- [ ] Instrument key operational/error events from module reducers (validation failures, authz denies, recoverable failures)
- [ ] Add generated binding updates and wire typed event helpers in client
- [ ] Add privacy guardrails for event payloads (no secrets/tokens/PII fields)

### Acceptance criteria
- Event schema supports querying Sprint 6 KPIs without schema ambiguity
- Required client and server event points emit successfully in local/integration environments
- Malformed events are rejected with explicit validation errors
- Event payloads pass privacy checks and exclude forbidden fields

### Test plan
- Unit tests for event validation and required-field enforcement in module
- Integration tests for event capture across representative reducers and client actions
- Client tests confirming event helper calls for onboarding and activity interactions
- Build/type-check and end-to-end smoke run validating event flow visibility

### Dependencies
- Existing Sprint 3 role/member/expedition model and generated bindings pipeline
- Input from product/ops on KPI definitions consumed by EXP-051

### Risks
- Event name drift between frontend and backend creates broken dashboards
- Over-instrumentation introduces noisy or high-volume low-value events
- Missing privacy review may leak sensitive fields into analytics payloads

### Definition of done
- Canonical event taxonomy is frozen for Sprint 6 scope
- Core event instrumentation merged in client and module with passing tests
- Event query examples for dashboard consumers are documented in issue comments

### Suggested labels
- type:fullstack
- area:analytics
- area:instrumentation
- area:spacetimedb
- area:react
- priority:P0
- sprint:sprint-6
- effort:L

---

## EXP-051: Build Sprint 6 KPI dashboards and reporting views

### Title
Implement KPI dashboard views and backing queries for product, beta, and operational metrics

### Why this matters
Instrumentation only becomes actionable when converted into clear metrics. This issue delivers the dashboards needed by engineering, product, and ops to assess beta health and GA readiness.

### Scope

**In**
- Define KPI calculations and query contracts from EXP-050 event stream
- Build dashboard UI(s) in React for core Sprint 6 metrics
- Add server-side aggregate/query paths for performant metric retrieval
- Include time-window controls and expedition-level scoping where relevant

**Out**
- Fully generic dashboard builder framework
- Enterprise reporting exports beyond CSV/basic download
- Historical backfill beyond available event retention window

### Detailed tasks checklist
- [ ] Finalize KPI spec with formulas: onboarding completion rate, activation rate, DAU/WAU proxy, activity creation rate, error rate, support turnaround
- [ ] Add module queries/reducers for aggregate windows (24h, 7d, 14d, sprint-to-date)
- [ ] Add `KpiDashboard` React view with metric cards and trend indicators
- [ ] Add charts/tables for funnel drop-off and top failure/error categories
- [ ] Add expedition and date-range selectors scoped to authorized users
- [ ] Add loading/empty/error states aligned with existing client UX patterns
- [ ] Add baseline CSV export for key KPI table(s) if required by ops review
- [ ] Validate dashboard metric parity against raw event query spot-checks

### Acceptance criteria
- Dashboard renders all agreed Sprint 6 KPIs with correct formulas
- KPI values match sampled raw event data within accepted tolerance
- Authorized users can switch date windows and expedition scope without query errors
- Dashboards remain responsive under expected beta dataset size

### Test plan
- Unit tests for KPI aggregation math and time-window boundaries
- Integration tests for module aggregate query correctness
- Component tests for dashboard states and selector behavior
- Manual/automated parity checks comparing dashboard values to raw event queries

### Dependencies
- Depends on EXP-050 canonical event taxonomy and stable event ingestion
- Consumes member/role permissions for scoped dashboard visibility

### Risks
- KPI definition ambiguity leads to stakeholder disagreement late in sprint
- Aggregate queries may become slow without proper indexing/materialization
- Timezone/window boundary errors can skew trend interpretation

### Definition of done
- KPI dashboard shipped with agreed metric set and passing test coverage
- Metric formulas and interpretation notes documented in issue comments
- Product/ops sign-off obtained for beta and GA review usage

### Suggested labels
- type:fullstack
- area:analytics
- area:dashboard
- area:react
- area:spacetimedb
- priority:P0
- sprint:sprint-6
- effort:L

---

## EXP-052: Observability hardening for beta operations

### Title
Harden logging, error monitoring, and runtime health checks for beta reliability

### Why this matters
Beta launch success requires quick detection and diagnosis of failures. Observability hardening reduces MTTR, improves incident response quality, and protects user trust during higher-variance beta usage.

### Scope

**In**
- Structured logs and correlation IDs across client↔module request paths
- Error taxonomy and alert thresholds for critical failure classes
- Health checks and operational diagnostics for module and client runtime behavior
- Runbook-aligned dashboards/queries for common beta incidents

**Out**
- Full SRE platform migration
- 24/7 on-call staffing model design
- Deep infra cost optimization beyond Sprint 6 reliability baseline

### Detailed tasks checklist
- [ ] Define structured log schema (`level`, `component`, `expedition_id`, `member_id?`, `trace_id`, `event`, `error_code`, `timestamp`)
- [ ] Add/propagate correlation or trace IDs through critical client-server flows
- [ ] Classify error families (authz, validation, sync, dependency, unknown) and map to severity
- [ ] Add module-side operational counters for reducer failures/success rates
- [ ] Add client-side error boundary instrumentation and user-visible fallback capture events
- [ ] Configure baseline alert conditions for P0/P1 reliability thresholds
- [ ] Create troubleshooting query snippets/runbook references for top 5 likely incidents
- [ ] Validate logs do not contain secrets or sensitive config values

### Acceptance criteria
- Critical request paths produce structured, correlated logs suitable for triage
- Error taxonomy and alerting cover agreed beta-critical failure classes
- Health/diagnostic checks enable detection of degraded states before widespread impact
- Incident responders can use runbook queries to isolate root causes quickly

### Test plan
- Unit tests for error classification and structured log formatter behavior
- Integration tests confirming trace/correlation ID propagation
- Failure-injection smoke tests to verify alert triggering and observability signals
- Security review checks for log redaction/sensitive-field exclusion

### Dependencies
- Builds on EXP-050 instrumentation primitives and naming conventions
- Inputs from ops stakeholders on incident priorities and thresholds

### Risks
- High-cardinality labels/fields may degrade query performance
- Inconsistent trace propagation leaves blind spots in incident investigations
- Alert fatigue from poorly tuned thresholds may reduce responsiveness

### Definition of done
- Observability baseline implemented and validated against beta incident scenarios
- Alert conditions and incident runbook references reviewed by ops
- Reliability telemetry included in Sprint 6 KPI visibility path

### Suggested labels
- type:fullstack
- area:ops
- area:observability
- area:reliability
- priority:P0
- sprint:sprint-6
- effort:M
- security

---

## EXP-053: Beta onboarding and support operations workflow

### Title
Implement beta onboarding flow, support intake process, and feedback-to-fix loop

### Why this matters
A successful beta requires more than features: users need a guided onboarding path and fast support response when issues occur. This issue creates a repeatable operating loop that improves retention and de-risks GA.

### Scope

**In**
- Beta onboarding checklist and in-app guidance milestones
- Support intake and triage workflow (issue capture, severity, owner assignment)
- Feedback categorization and routing into product/engineering backlog
- Beta communications cadence template (welcome, known issues, status updates)

**Out**
- Full customer success platform integration
- Multi-language support process design
- SLA commitments beyond Sprint 6 beta target baseline

### Detailed tasks checklist
- [ ] Define beta user journey stages and success checkpoints (invite accepted, first session, first activity, first collaboration action)
- [ ] Add onboarding status tracking fields/events and corresponding UI hints
- [ ] Implement support intake form/process with required metadata (account, expedition, repro steps, severity)
- [ ] Define triage queue workflow and ownership transitions (new → acknowledged → investigating → resolved)
- [ ] Add support analytics hooks for first-response time and resolution time metrics
- [ ] Establish weekly beta feedback review ritual and backlog tagging rules
- [ ] Draft and store support/playbook templates for known issue responses
- [ ] Validate escalation path for blocker incidents affecting onboarding or core collaboration

### Acceptance criteria
- Beta users can progress through onboarding with measurable milestone completion
- Support requests are captured with sufficient detail for engineering triage
- Triage workflow states and ownership are visible and consistently applied
- Feedback signals are routed into backlog with clear prioritization metadata

### Test plan
- Component/integration tests for onboarding milestone status updates
- Workflow tests for support intake required-field validation and state transitions
- Operational drill: run sample support tickets through triage-to-resolution flow
- Verification of support KPI event capture for dashboard consumption

### Dependencies
- Depends on EXP-050/EXP-051 for onboarding and support KPI visibility
- Coordination with product/ops roles for process ownership and communications

### Risks
- Incomplete intake metadata can slow diagnosis and extend resolution times
- Onboarding UX friction may reduce activation before meaningful product exposure
- Process adoption gaps across team members may create inconsistent support quality

### Definition of done
- Onboarding + support workflow is live and exercised with sample beta scenarios
- Support KPI signals feed dashboard/reporting pipeline
- Owners and escalation path are documented in issue comments and used in practice

### Suggested labels
- type:fullstack
- area:beta
- area:onboarding
- area:support
- area:operations
- priority:P1
- sprint:sprint-6
- effort:M

---

## EXP-054: GA readiness decision gate and launch checklist

### Title
Create GA readiness gate with objective criteria, launch checklist, and go/no-go review process

### Why this matters
Sprint 6 ends with a decision on whether the product can safely progress from beta to GA. A formal gate with explicit metrics and risk criteria prevents premature launch and aligns cross-functional stakeholders.

### Scope

**In**
- Define GA go/no-go criteria across product quality, reliability, support, and adoption KPIs
- Build decision checklist and sign-off workflow tied to dashboard/observability evidence
- Add release-risk register and mitigation tracking for open critical gaps
- Conduct mock decision review before final Sprint 6 exit meeting

**Out**
- Automated release orchestration pipeline redesign
- Marketing launch campaign execution details
- Post-GA roadmap planning beyond immediate release gate

### Detailed tasks checklist
- [ ] Define quantitative GA thresholds (e.g., onboarding completion floor, error rate ceiling, unresolved P0/P1 limits, support response targets)
- [ ] Define qualitative gates (known issue severity posture, incident runbook readiness, rollback confidence)
- [ ] Build GA checklist artifact linking each criterion to source evidence (dashboard panel, query, incident report)
- [ ] Implement/prepare a simple readiness scorecard view or report snapshot for review meetings
- [ ] Create go/no-go meeting agenda, required attendees, and decision ownership model
- [ ] Run a dry-run gate review using latest beta data and capture gaps
- [ ] Track remediation actions for failed criteria with owners and due dates
- [ ] Finalize launch recommendation document in issue comments (Go / No-Go / Conditional Go)

### Acceptance criteria
- GA gate criteria are explicit, measurable, and approved by engineering/product/ops owners
- Every criterion has traceable evidence source from Sprint 6 systems
- Dry-run and final gate review occur with recorded outcomes and action items
- Final recommendation is published with rationale and residual risk summary

### Test plan
- Tabletop exercise validating gate workflow and stakeholder responsibilities
- Data validation checks that readiness scorecard matches underlying KPI/observability sources
- Regression spot-check ensuring criteria still evaluate correctly after late sprint fixes
- Post-review audit of action ownership and due-date tracking completeness

### Dependencies
- Depends on EXP-051 KPI dashboard readiness and EXP-052 observability hardening
- Informed by EXP-053 onboarding/support operational outcomes

### Risks
- Weak or subjective criteria can lead to inconsistent decision outcomes
- Missing/late evidence collection can delay or invalidate gate meeting
- Pressure to launch may override unresolved reliability/safety concerns

### Definition of done
- GA decision gate process and artifacts are complete and reviewed cross-functionally
- Final go/no-go recommendation is issued with evidence links and mitigation plan
- Open risks are accepted, mitigated, or explicitly deferred by named owners

### Suggested labels
- type:process
- area:ga-readiness
- area:release
- area:ops
- area:analytics
- priority:P0
- sprint:sprint-6
- effort:M
- decision-gate
