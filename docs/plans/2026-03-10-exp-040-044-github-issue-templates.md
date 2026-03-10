# Sprint 5 GitHub Issue Templates (EXP-040..EXP-044)

Copy/paste each section into a GitHub issue.

---

## EXP-040: Build expedition-scoped notification domain and delivery pipeline

### Title
Implement expedition-scoped notification schema, preference controls, and event fan-out in SpacetimeDB

### Why this matters
Sprint 5 introduces notifications across collaboration workflows. Without a server-side notification model and delivery fan-out path, users miss important events and notification behavior becomes inconsistent across clients.

### Scope

**In**
- New SpacetimeDB notification entities for event records, recipient state, and read/unread tracking
- Notification preference storage per member and expedition for channel/category opt-in
- Reducer/procedure path to create notifications from domain events (comments, mentions, moderation outcomes, privacy changes)
- Generated bindings usable from React client

**Out**
- Push/email third-party provider integration
- Rich templating/localization for notification text
- Mobile-specific delivery mechanics

### Detailed tasks checklist
- [ ] Add `notification_event` table with fields: `id`, `expedition_id`, `actor_member_id`, `category`, `subject_type`, `subject_id`, `payload_json`, `created_at`
- [ ] Add `notification_recipient` table with fields: `id`, `notification_event_id`, `recipient_member_id`, `status` (`unread`/`read`/`dismissed`), `read_at`, `created_at`
- [ ] Add `notification_preference` table keyed by `expedition_id + member_id + category` with `is_enabled`, `updated_at`
- [ ] Add indexes for `notification_recipient.recipient_member_id+status+created_at` and `notification_event.expedition_id+created_at`
- [ ] Implement `emit_notification` reducer helper that validates expedition scope and fan-outs recipients
- [ ] Implement preference-aware filtering so disabled categories are not delivered to a member
- [ ] Regenerate Rust/React bindings and validate compile/build compatibility

### Acceptance criteria
- Notification events are persisted once and fan out to intended recipients only
- Members can opt out of specific categories and no longer receive those notifications
- Read/unread state is queryable by recipient with index-backed ordering
- Generated bindings include new notification entities and reducers

### Test plan
- Unit tests for notification fan-out recipient selection and preference filtering
- Integration tests for read/unread transitions and per-member query behavior
- Build/type-check smoke test in React client for new generated bindings

### Dependencies
- Depends on existing expedition/member/role baseline from Sprint 3
- Blocks EXP-041 and supports EXP-042/EXP-043 event emission hooks

### Risks
- Incorrect expedition scoping may leak notifications across expeditions
- Fan-out logic without deduplication may create duplicate recipient rows
- Missing indexes could degrade timeline performance at scale

### Definition of done
- Notification schema and emit/query reducers merged
- Tests for fan-out, preferences, and read state are passing in CI
- Event category map documented in issue comments for frontend integration

### Suggested labels
- type:backend
- area:notifications
- area:spacetimedb
- priority:P0
- sprint:sprint-5
- effort:L
- security

---

## EXP-041: Ship notification center UX and preference management in React

### Title
Implement notification inbox UI, unread indicators, and category preferences in React client

### Why this matters
Notification infrastructure only helps if users can see and manage it. This issue delivers the core notification UX so activity is visible, actionable, and tunable by each expedition member.

### Scope

**In**
- Notification center/feed component with unread-first ordering
- Mark-as-read and mark-all-as-read interactions wired to backend reducers
- Notification category preference UI per member/expedition
- Integration with existing activity/log navigation context

**Out**
- Native push notifications
- Email digest settings
- Advanced filtering/search in notification history

### Detailed tasks checklist
- [ ] Add `NotificationsPanel` component with list rendering for recipient notifications
- [ ] Add unread badge indicator in primary app navigation
- [ ] Implement optimistic mark-read and mark-all-read actions with rollback on error
- [ ] Add preference controls UI (toggle by category) tied to `notification_preference`
- [ ] Add empty/loading/error states aligned with existing app patterns
- [ ] Ensure notification items deep-link to related object (activity, comment thread, moderation event, privacy settings)
- [ ] Add accessibility checks for keyboard navigation and screen-reader labels

### Acceptance criteria
- Members can view unread/read notifications in a stable, timestamp-ordered feed
- Mark-read actions update both UI state and persistent backend state
- Members can toggle category preferences and changes persist after refresh
- Notification links route to the correct in-app context

### Test plan
- Component tests for feed render states and unread badge behavior
- Hook/integration tests for mark-read and mark-all-read flows
- End-to-end smoke test for preference toggle persistence and deep-link navigation

### Dependencies
- Depends on EXP-040 backend notification model and reducers
- Supports EXP-042 and EXP-043 by surfacing their generated notification events

### Risks
- Optimistic UI updates may drift from backend truth on network failure
- Poor feed virtualization/rendering could hurt performance with large inboxes
- Incomplete ARIA semantics may regress accessibility quality

### Definition of done
- Notification center and preferences shipped behind Sprint 5 feature scope
- Client tests for core inbox interactions are passing
- Build succeeds and no regression in existing main views

### Suggested labels
- type:frontend
- area:notifications
- area:react
- priority:P1
- sprint:sprint-5
- effort:M
- ux

---

## EXP-042: Add abuse reporting intake and reporter safety protections

### Title
Implement abuse report submission, evidence capture, and protected reporter workflow

### Why this matters
Safety requires a trusted reporting mechanism that preserves context and protects reporters. This issue creates the intake path needed for members to flag harmful content/behavior for moderation action.

### Scope

**In**
- Abuse report schema and reducers for creation and status lifecycle
- Report form in React for selecting reason, target, and optional evidence notes
- Reporter safety controls (restricted visibility of reporter identity in standard member views)
- Notification event emission to moderators/admins on new reports

**Out**
- Automated ML-based abuse classification
- External trust-and-safety tooling integration
- Appeals workflow for sanctioned members

### Detailed tasks checklist
- [ ] Add `abuse_report` table with fields: `id`, `expedition_id`, `reporter_member_id`, `target_type`, `target_id`, `reason_code`, `description`, `status`, `created_at`, `updated_at`
- [ ] Add optional `abuse_report_evidence` table for structured attachments/metadata references
- [ ] Implement `submit_abuse_report` reducer with validation and expedition-bound authorization
- [ ] Add React `ReportAbuse` entry point from activity/comment/member surfaces
- [ ] Enforce reporter-identity visibility policy (only moderators/admins can view reporter id in moderation context)
- [ ] Emit `abuse_report_created` notifications to authorized moderators/admins
- [ ] Add status enum baseline (`open`, `triaged`, `resolved`, `dismissed`) for moderation pipeline handoff

### Acceptance criteria
- Members can submit abuse reports tied to expedition-scoped targets
- Report creation validates required fields and rejects invalid target references
- Reporter identity is not exposed in non-moderation member-facing views
- Authorized moderators/admins receive new-report notifications

### Test plan
- Unit tests for report validation and authorization boundaries
- Integration tests for report submission and reporter visibility policy
- UI tests for report form success/error flows from supported entry points

### Dependencies
- Depends on Sprint 3 role model and EXP-040 notification events
- Blocks EXP-043 moderation enforcement and informs EXP-044 safety regressions

### Risks
- Weak target validation could allow orphaned or abusive report records
- Reporter identity leakage can create retaliation risk
- Over-broad report creation permissions could enable spam abuse

### Definition of done
- Abuse report data model and submission workflow merged
- Reporter protection checks verified by automated tests
- Moderator notification integration validated end-to-end

### Suggested labels
- type:fullstack
- area:safety
- area:moderation
- area:privacy
- priority:P0
- sprint:sprint-5
- effort:L
- security

---

## EXP-043: Enforce expedition privacy visibility and moderation actions server-side

### Title
Implement expedition privacy visibility controls and moderation action enforcement in SpacetimeDB + React

### Why this matters
Privacy and moderation are ineffective if only enforced in the client. This issue ensures visibility rules and moderation decisions are applied at trusted boundaries, preventing unauthorized data access and unsafe participation.

### Scope

**In**
- Expedition privacy modes (e.g., `public`, `members_only`, `private`) with explicit read policies
- Server-side guard checks on reducers/queries for expedition and activity visibility
- Moderation actions (warn/mute/suspend/ban baseline) tied to member permissions and audit trail
- React settings/moderation surfaces for authorized roles

**Out**
- Organization-wide federation/privacy controls across multiple expeditions
- Advanced legal hold/retention workflows
- Real-time external admin console

### Detailed tasks checklist
- [ ] Add/extend expedition config for `visibility_mode` with migration/backfill defaults
- [ ] Implement centralized visibility guard helper used by activity/log/comment query reducers
- [ ] Add moderation action entity (`moderation_action`) with actor, target, reason, duration/expiry, and timestamps
- [ ] Implement authorized reducers for moderation actions with role checks and self-action constraints
- [ ] Apply moderation state to request paths (e.g., muted members cannot post; suspended/banned members denied scoped operations)
- [ ] Add audit query path for authorized moderators/admins to review action history
- [ ] Expose privacy mode controls in `SettingsPanel` for allowed roles only
- [ ] Emit notifications for affected users and moderators on moderation/privacy changes where policy requires

### Acceptance criteria
- Visibility mode is enforced server-side for expedition-related reads
- Unauthorized actors cannot access private expedition data via direct reducer/query calls
- Moderation actions are role-guarded, persisted, and enforce behavior restrictions
- Authorized settings UI can update privacy mode and reflects persisted state

### Test plan
- Unit tests for visibility guard decisions across all privacy modes
- Integration tests for moderation action authorization and enforcement effects
- UI integration test for privacy mode change flow and permission gating

### Dependencies
- Depends on Sprint 3 role/authz baseline and EXP-042 report intake model
- Supports EXP-044 regression suite as primary policy surface

### Risks
- Partial guard coverage can leave bypass paths on less-used reducers
- Incorrect role matrix can over-restrict or under-restrict moderation powers
- Privacy mode migration errors may unintentionally expose existing expeditions

### Definition of done
- Privacy and moderation enforcement merged with shared guard helpers
- Permission/visibility tests pass and cover deny paths
- Auditability and notification side effects validated in integration tests

### Suggested labels
- type:fullstack
- area:privacy
- area:moderation
- area:authz
- priority:P0
- sprint:sprint-5
- effort:L
- security

---

## EXP-044: Build safety and privacy regression suite across module and client

### Title
Create automated safety/privacy regression suite for notifications, reporting, moderation, and visibility boundaries

### Why this matters
Sprint 5 introduces sensitive policy behavior that can regress silently during future work. A focused regression suite is required to prevent privacy leaks, moderation bypasses, and unsafe notification behavior.

### Scope

**In**
- End-to-end and integration tests covering Sprint 5 safety/privacy-critical flows
- Negative-path tests for unauthorized access attempts and policy bypass scenarios
- Deterministic seed fixtures for members/roles/privacy modes/moderation states
- CI execution path for safety/privacy suite with clear failure reporting

**Out**
- Full performance/load testing
- External penetration testing program setup
- Non-safety unrelated UI visual snapshot expansion

### Detailed tasks checklist
- [ ] Define test matrix covering notifications, abuse reports, moderation actions, and visibility modes
- [ ] Add backend integration tests for unauthorized read/write attempts under each privacy mode
- [ ] Add regression tests for reporter identity confidentiality and moderation action side effects
- [ ] Add notification privacy tests ensuring recipients only receive expedition-authorized events
- [ ] Add React integration/e2e smoke tests for critical safety UX paths (report submit, privacy toggle permission checks, moderation state effects)
- [ ] Create reusable fixture/seeding helpers for role combinations and expedition states
- [ ] Wire dedicated CI target and artifact output for safety/privacy regression failures

### Acceptance criteria
- Regression suite fails on known policy-bypass scenarios and passes on compliant behavior
- All Sprint 5 critical safety/privacy requirements are represented by automated tests
- Suite runs reliably in CI with actionable output for failures
- New policy changes require test updates as part of PR workflow

### Test plan
- Run targeted module tests for visibility/moderation/reporting policy matrix
- Run client integration/e2e tests for key user safety flows
- Validate CI job execution and failure artifact readability on at least one forced-failure scenario

### Dependencies
- Depends on EXP-040, EXP-042, and EXP-043 feature completion
- Informs release readiness and blocks Sprint 5 closeout if failing

### Risks
- Incomplete test matrix can create false confidence
- Flaky async tests may hide real regressions if not stabilized
- Over-coupled fixtures can become hard to maintain across schema evolution

### Definition of done
- Safety/privacy suite merged and enforced in CI branch policy
- Flake triage baseline established with stable retry policy (if used)
- Sprint 5 release checklist references suite as mandatory gate

### Suggested labels
- type:qa
- area:testing
- area:safety
- area:privacy
- priority:P0
- sprint:sprint-5
- effort:M
- ci
