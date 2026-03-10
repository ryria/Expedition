# Sprint 2 GitHub Issue Templates (EXP-010..EXP-014)

Copy/paste each section into a GitHub issue.

---

## EXP-010: Add expedition and membership tables in SpacetimeDB module

### Why this matters
Multi-tenant workspaces require first-class expedition ownership and membership state. This is the schema foundation for all scoped auth, reads, and writes.

### Scope

**In**
- New expedition table with lifecycle fields
- New membership table with role/status fields
- Constraints and indexes for uniqueness and query performance
- Schema publication to generated client bindings

**Out**
- Reducer/procedure business logic beyond minimal creator-owner bootstrap
- Data migration of existing activity/comment/reaction rows
- Frontend expedition switch/create UX

### Detailed tasks checklist
- [ ] Add expedition entity with id, name, slug, created_by_member_id, is_archived, created_at, archived_at
- [ ] Add membership entity with id, expedition_id, member_id, role, status, joined_at, left_at
- [ ] Add unique slug constraint for expedition
- [ ] Add uniqueness guard for active expedition/member pairing
- [ ] Add indexes for expedition/member/status and creator/archive queries
- [ ] Ensure expedition creation path auto-creates owner membership row
- [ ] Regenerate and verify Rust module/client bindings
- [ ] Document schema assumptions in issue comments

### Acceptance criteria
- Duplicate expedition slug is rejected deterministically
- Duplicate active membership for same expedition/member is rejected
- Expedition creator is owner immediately after create flow
- New tables are queryable/subscribable from client bindings

### Test plan
- Unit tests for slug and active-membership uniqueness
- Integration test for create expedition creating owner membership
- Schema smoke test from client subscription path

### Dependencies
- Depends on EXP-003
- Blocks EXP-011, EXP-012, EXP-013, EXP-014

### Risks
- Constraint modeling may differ between local and hosted environments
- Missing indexes can cause performance regressions in membership queries
- Role/status encoding mistakes can break future guard logic

### Definition of done
- Schema merged, generated bindings updated, and tests green in CI
- No schema lint/build errors in Rust module
- Issue includes migration notes and rollback considerations

### Suggested labels
- type:backend
- area:spacetimedb
- priority:P0
- sprint:sprint-2
- effort:M
- tenant-isolation

---

## EXP-011: Implement expedition reducers/procedures with role guards (create/archive/join/leave)

### Why this matters
Without server-side reducer guards, tenant boundaries and role permissions are unenforceable. This issue provides the operational control plane for expedition lifecycle and membership transitions.

### Scope

**In**
- Reducers/procedures: create_expedition, archive_expedition, join_expedition, leave_expedition
- Shared authorization and existence checks
- Deterministic error handling for rejected actions
- Idempotent behavior for join where appropriate

**Out**
- Invite token flows and role management UI
- Billing/entitlement checks
- Frontend switcher UX details beyond API compatibility

### Detailed tasks checklist
- [ ] Add create_expedition reducer with authenticated member requirement
- [ ] Add archive_expedition reducer with owner-only guard
- [ ] Add join_expedition reducer with archived-expedition protection
- [ ] Add leave_expedition reducer with owner-leave prevention unless transferred
- [ ] Implement shared guard helpers for auth/member/expedition checks
- [ ] Enforce active membership rules for scoped mutations
- [ ] Standardize reducer error codes/messages
- [ ] Add reducer integration tests for happy path and denial path

### Acceptance criteria
- Non-owner archive attempts are denied
- Authenticated member can create expedition and becomes owner
- Join/leave transitions correctly update active/left state and timestamps
- Archived expedition blocks join and scoped writes

### Test plan
- Unit tests for guard helpers
- Integration tests per reducer covering allow/deny permutations
- Idempotency test for repeated join requests

### Dependencies
- Depends on EXP-010
- Blocks EXP-013 and contributes to EXP-014

### Risks
- Inconsistent guard reuse can create policy drift
- Non-deterministic errors complicate frontend handling
- Edge cases around owner leave can corrupt ownership invariants

### Definition of done
- Reducers implemented with centralized guards and full test coverage for critical paths
- CI passing for module tests and build
- Permission matrix validated in issue checklist

### Suggested labels
- type:backend
- area:authz
- area:spacetimedb
- priority:P0
- sprint:sprint-2
- effort:M

---

## EXP-012: Migrate activity/comment/reaction to expedition-scoped data with cutover plan

### Why this matters
Tenant isolation is incomplete until all legacy social/activity data is partitioned by expedition_id and enforced server-side.

### Scope

**In**
- Expand/contract migration for expedition_id on activity_log, comment, reaction
- Legacy expedition seeding and membership bootstrap
- Backfill, verification, and cutover runbook checkpoints
- Enforced non-null + strict scoped checks after backfill

**Out**
- New invite/role features
- Frontend redesign
- Non-expedition schema refactors unrelated to isolation

### Detailed tasks checklist
- [ ] Phase A: add nullable expedition_id columns and required tables
- [ ] Phase B: create legacy/default expedition and seed memberships
- [ ] Phase C: backfill expedition_id for activity/comment/reaction
- [ ] Validate comment/reaction expedition_id matches parent activity expedition_id
- [ ] Phase D: enforce non-null and scoped query/write behavior
- [ ] Prepare staging dry run and rollback drill artifacts
- [ ] Prepare production maintenance window checklist and comms
- [ ] Add post-cutover monitoring checklist (24-hour window)

### Acceptance criteria
- Zero null expedition_id rows in scoped tables post-migration
- Parent-child expedition consistency holds for all comments/reactions
- Scoped queries and writes pass isolation checks
- Staging dry-run and rollback drill completed successfully

### Test plan
- Migration integration test on representative snapshot data
- Consistency validation tests for parent-child expedition linkage
- Regression smoke tests for map/feed/stats behavior in legacy expedition mode

### Dependencies
- Depends on EXP-010
- Feeds EXP-014 and required before strict tenant test gate

### Risks
- Backfill mismatch could produce orphaned or cross-tenant associations
- Cutover timing may impact active users during migration window
- Rollback complexity if constraints are enforced too early

### Definition of done
- Migration executed in staging with evidence attached
- Production-ready runbook approved
- Non-null enforcement merged with passing migration and regression tests

### Suggested labels
- type:backend
- type:migration
- area:data-model
- priority:P0
- sprint:sprint-2
- effort:L
- tenant-isolation

---

## EXP-013: Add expedition switcher and create expedition UI in React client

### Why this matters
Users need an explicit active expedition context to interact safely with multi-tenant data across map, feed, members, and settings.

### Scope

**In**
- Header/nav expedition switcher visible across tabs
- Create expedition flow (header + settings entry point)
- No-membership empty state with create CTA
- Active expedition persistence and deterministic restore/fallback
- Expedition-scoped data wiring for existing views
- expedition_* instrumentation events for switch/create lifecycle

**Out**
- Billing/paywall UX
- Invite/role management UX (placeholder only)
- Archive/delete expedition full UX
- New route architecture overhaul

### Detailed tasks checklist
- [ ] Add active expedition orchestration at app shell level
- [ ] Build switcher UI with list/select and loading/error states
- [ ] Build create expedition form flow with submission states
- [ ] Persist active expedition id and stale-id recovery behavior
- [ ] Scope members, map/journal, and settings reads to active expedition
- [ ] Add no-membership and no-activity empty states
- [ ] Emit required expedition_* events for switch/create/restore outcomes
- [ ] Add focused frontend tests for state transitions and scoped rendering

### Acceptance criteria
- Switching expedition updates all views without mixed-tenant data
- Create expedition succeeds and auto-selects new expedition
- Invalid persisted expedition id recovers to deterministic fallback
- Loading/error/empty states are visible and actionable

### Test plan
- Component tests for switcher interactions and create flow
- Hook tests for active expedition persistence and fallback resolution
- End-to-end sanity for tab retention during context switch

### Dependencies
- Depends on EXP-011 (and schema from EXP-010)
- Supports validation in EXP-014

### Risks
- Race conditions during rapid switching can cause stale renders
- Partial scoping can leak old-context data into one tab
- Persisted context bugs can strand users in error/empty state

### Definition of done
- UI merged with scoped data wiring and instrumentation events
- Frontend tests and build pass
- Manual verification confirms no mixed-context display across tabs

### Suggested labels
- type:frontend
- area:react
- area:multi-tenant
- priority:P0
- sprint:sprint-2
- effort:M

---

## EXP-014: Tenant isolation test suite (unit, integration, security, regression)

### Why this matters
Isolation guarantees must be continuously enforced; this suite is the quality gate preventing cross-expedition data leakage and auth bypass regressions.

### Scope

**In**
- Unit tests for expedition-scoped hooks/selectors
- Integration tests for scoped reducers and permission guards
- Security tests for cross-expedition read/write attempts
- Regression tests validating scoped behavior post-migration
- CI gate for security-critical isolation tests

**Out**
- New product features
- Non-isolation test expansion unrelated to Sprint 2 risks
- Broad performance benchmarking

### Detailed tasks checklist
- [ ] Implement EXP014-UT-001..003 coverage for filtering and stale-state handling
- [ ] Implement EXP014-INT-001..005 for scoped mutation auth/behavior
- [ ] Implement EXP014-SEC-001..003 for forged context/auth mismatch rejection
- [ ] Implement EXP014-REG-001..004 for migration and legacy behavior regressions
- [ ] Add CI requirement so SEC and cross-expedition INT tests must pass
- [ ] Add manual multi-session leakage validation checklist
- [ ] Attach migration verification artifacts to sprint review

### Acceptance criteria
- All SEC tests pass in CI with required-check enforcement
- No P0/P1 cross-expedition leakage or authorization defects
- Integration tests confirm scoped reducers deny unauthorized operations
- Regression suite passes against migrated data model

### Test plan
- Run focused suites by tag/class (UT, INT, SEC, REG) on every PR
- Run full isolation matrix on release branch candidate
- Include manual two-session verification for cross-tenant visibility/writes

### Dependencies
- Depends on EXP-012
- Relies on EXP-010 and EXP-011 behavior plus EXP-013 client flows for end-to-end checks

### Risks
- Flaky async tests can mask real isolation regressions
- Incomplete negative-path coverage can leave auth gaps
- CI gating misconfiguration can allow bypassed security checks

### Definition of done
- Test suite merged, stable, and enforced in CI required checks
- Security and cross-expedition integration tests green
- Sprint review includes test evidence and leakage sign-off

### Suggested labels
- type:qa
- type:security
- area:tenant-isolation
- priority:P0
- sprint:sprint-2
- effort:M
