# Sprint 3 GitHub Issue Templates (EXP-020..EXP-024)

Copy/paste each section into a GitHub issue.

---

## EXP-020: Add invite data model and lifecycle primitives in SpacetimeDB module

### Title
Add invite schema and lifecycle state in SpacetimeDB for expedition-scoped onboarding

### Why this matters
Invite lifecycle is the foundation for controlled multi-tenant onboarding. Without durable invite state, role assignment and secure acceptance flows cannot be enforced consistently.

### Scope

**In**
- New expedition-scoped invite table with lifecycle/status fields
- Invite token/id strategy and uniqueness guarantees
- Expiration, revocation, and one-time-use state transitions in schema model
- Indexes for lookup by expedition, status, inviter, and token
- Generated bindings compatibility for React client consumption

**Out**
- Full invite acceptance reducer logic
- Role-management UI implementation
- Email delivery integrations or notification channels

### Detailed tasks checklist
- [ ] Add invite entity with id, expedition_id, token_hash (or token id), invited_email (nullable), invited_member_id (nullable), target_role, status, invited_by_member_id, created_at, expires_at, accepted_at, revoked_at
- [ ] Define status domain (`pending`, `accepted`, `expired`, `revoked`) and constraints
- [ ] Add uniqueness constraints for active invite token and optional active email+expedition combinations
- [ ] Add indexes for expedition/status, token lookup, inviter queries, and expiration scans
- [ ] Add schema-level guardrails to prevent invalid timestamp/state combinations
- [ ] Add helper/query path to classify invite as valid/invalid based on status + expiry
- [ ] Regenerate module/client bindings and verify compile compatibility
- [ ] Document invite lifecycle invariants in issue notes

### Acceptance criteria
- Invite rows can represent pending, accepted, expired, and revoked lifecycle states deterministically
- Duplicate active token cannot be inserted
- Expired/revoked invites are distinguishable from active invites via indexed queries
- Generated bindings expose invite schema to client without manual patching

### Test plan
- Unit tests for invite state constraints and uniqueness behavior
- Integration tests for expiration/revocation state classification queries
- Binding smoke test from client type generation/consumption path

### Dependencies
- Depends on Sprint 2 multi-tenant schema baseline (EXP-010/011/012)
- Blocks EXP-021, EXP-022, EXP-023

### Risks
- Weak token modeling may allow replay or collision edge cases
- Incorrect indexing can degrade invite lookup/cleanup performance
- Status/timestamp drift can break acceptance/revocation correctness

### Definition of done
- Invite schema merged with generated bindings updated
- Tests for constraints and lifecycle queries pass in CI
- Lifecycle invariants and migration notes captured on the issue

### Suggested labels
- type:backend
- area:spacetimedb
- area:invites
- priority:P0
- sprint:sprint-3
- effort:M
- security

---

## EXP-021: Implement invite lifecycle reducers/procedures with role enforcement

### Title
Implement create/revoke/accept invite reducers with strict role authorization

### Why this matters
Server-side authorization is the only trustworthy enforcement layer for invite creation and acceptance. This issue ensures only permitted actors can issue access and that accepted invites produce safe membership transitions.

### Scope

**In**
- Reducers/procedures for `create_invite`, `revoke_invite`, `accept_invite`, and expiry handling path
- Role guard matrix for who can invite to which role
- Validation for expedition context, actor membership status, and invite validity
- Deterministic error codes/messages for denied and invalid operations
- Idempotency protections for repeated acceptance/revocation attempts

**Out**
- Owner transfer workflow
- Frontend settings UX
- Email/notification integrations

### Detailed tasks checklist
- [ ] Add `create_invite` reducer with authenticated active-member requirement
- [ ] Add policy checks so inviter role can only grant allowed target roles (e.g., owner-only for admin grants if required policy)
- [ ] Add `revoke_invite` reducer with inviter/owner/admin permissions per policy
- [ ] Add `accept_invite` reducer validating pending status, non-expired token, expedition consistency, and non-revoked state
- [ ] Ensure invite acceptance creates/activates expedition membership with target role safely
- [ ] Prevent accepting an invite if actor already has incompatible active role/membership state (as defined by policy)
- [ ] Add deterministic error taxonomy for invalid token, expired invite, unauthorized action, already accepted/revoked
- [ ] Add reducer integration tests for allow/deny permutations and replay attempts

### Acceptance criteria
- Unauthorized users cannot create or revoke invites
- Invite acceptance succeeds exactly once and transitions invite state correctly
- Expired/revoked invites are consistently rejected
- Membership role assignment from invite follows policy without privilege escalation

### Test plan
- Unit tests for role-policy helper functions
- Integration tests for all reducer happy/deny paths
- Replay/idempotency tests for duplicate accept/revoke requests

### Dependencies
- Depends on EXP-020 and Sprint 2 authorization foundations (EXP-011)
- Blocks EXP-023 and contributes to EXP-024

### Risks
- Policy drift between reducers can create inconsistent authorization behavior
- Missing idempotency checks can cause duplicate membership side effects
- Ambiguous errors can produce unsafe frontend fallback behavior

### Definition of done
- Reducers/procedures implemented with centralized policy guards
- Critical invite lifecycle and role-enforcement tests pass in CI
- Permission matrix attached in issue comments and validated by QA

### Suggested labels
- type:backend
- area:authz
- area:invites
- priority:P0
- sprint:sprint-3
- effort:L
- security

---

## EXP-022: Implement owner transfer flow with invariant protections

### Title
Add owner transfer procedure and enforce single-owner expedition invariant

### Why this matters
Teams need safe ownership continuity for operational resilience and account transitions. Ownership transfer must be explicit, auditable, and protected against lockout or orphaned expeditions.

### Scope

**In**
- Server procedure for owner transfer (`transfer_owner`) within expedition
- Invariant enforcement: exactly one active owner after successful transfer
- Authorization checks requiring current owner authority
- Validation that target member is active and eligible for ownership
- Optional audit event/log record for ownership changes

**Out**
- Full owner transfer UI polish (covered in EXP-023)
- Cross-expedition bulk ownership administration
- Delegated transfer by non-owner roles

### Detailed tasks checklist
- [ ] Add `transfer_owner` reducer/procedure requiring authenticated current owner
- [ ] Validate target member exists, is active in same expedition, and is not blocked/inactive
- [ ] Implement atomic role transition: current owner -> configured fallback role (e.g., admin/member), target -> owner
- [ ] Enforce post-condition that expedition has exactly one active owner
- [ ] Prevent no-op and self-transfer edge cases if policy disallows
- [ ] Add deterministic errors for missing target, unauthorized caller, invalid membership state, invariant violation
- [ ] Add audit record/event payload for old_owner, new_owner, actor, timestamp
- [ ] Add integration tests for successful transfer and all denial paths

### Acceptance criteria
- Only current owner can transfer ownership
- Successful transfer always results in one and only one active owner
- Invalid target member states are rejected deterministically
- Ownership transfer is auditable through stored event/log data

### Test plan
- Unit tests for owner-transfer invariant checks
- Integration tests for atomic role transition and denial cases
- Regression tests for leave/archive behavior after transfer

### Dependencies
- Depends on EXP-021 role enforcement and membership baseline from Sprint 2
- Blocks final owner-management UX flows in EXP-023
- Contributes to security validation in EXP-024

### Risks
- Non-atomic updates could temporarily create zero or multiple owners
- Incomplete edge-case handling may allow owner lockout
- Missing auditability increases incident triage time

### Definition of done
- Transfer procedure merged with invariant tests passing
- Audit trail validated in test/staging environment
- Policy behavior documented and approved by product/security reviewers

### Suggested labels
- type:backend
- area:authz
- area:roles
- priority:P0
- sprint:sprint-3
- effort:M
- security

---

## EXP-023: Build invites and role-management UI in React settings/members views

### Title
Implement invite lifecycle and role management UI with owner transfer controls

### Why this matters
Users need transparent, actionable controls to manage team access without direct database operations. A clear UI is required to operationalize backend invite and role policies safely.

### Scope

**In**
- Settings/Members UI for creating and revoking invites
- Invite list view with status badges (`pending`, `accepted`, `expired`, `revoked`)
- Role-management controls aligned to caller permissions
- Owner transfer UI action with confirmation and guard-aware messaging
- Loading/error/empty states for invite and role operations

**Out**
- Custom email composition/sending UX
- New route architecture overhaul
- Non-membership profile/account management features

### Detailed tasks checklist
- [ ] Add invite creation form (email optional/required per policy, target role selector constrained by server policy)
- [ ] Add active/past invites list with status, inviter, created/expiry timestamps, revoke action where permitted
- [ ] Wire invite create/revoke/accept-related client actions to generated Spacetime reducers/procedures
- [ ] Add role update controls (where policy allows) with denied-state handling from backend errors
- [ ] Add owner transfer action in members panel with target selection and explicit confirmation step
- [ ] Enforce frontend permission gating using membership role + backend denial fallback
- [ ] Add deterministic toasts/inline errors for invite invalid/expired/unauthorized responses
- [ ] Add component/hook tests for visibility rules, form validation, and role/owner actions

### Acceptance criteria
- Authorized users can create/revoke invites from UI and see state updates promptly
- Unauthorized controls are hidden/disabled and server denials are handled clearly
- Owner transfer flow works end-to-end for valid targets and blocks invalid actions
- UI never implies successful privilege changes when backend denies request

### Test plan
- Component tests for invite form/list rendering and permission gating
- Hook/integration tests for reducer calls and optimistic/refresh state handling
- Manual E2E smoke test for owner transfer and role updates across two user sessions

### Dependencies
- Depends on EXP-021 and EXP-022 backend APIs
- Contributes to EXP-024 security and regression validation

### Risks
- UI permission assumptions may drift from backend policy matrix
- Stale state after role change can display outdated controls
- Poor error mapping can confuse operators during access changes

### Definition of done
- UI merged with full CRUD-visible invite lifecycle and owner transfer controls
- Frontend tests/build pass and manual QA scenarios completed
- Product sign-off confirms policy-aligned UX and copy

### Suggested labels
- type:frontend
- area:react
- area:invites
- area:roles
- priority:P1
- sprint:sprint-3
- effort:L

---

## EXP-024: Add security and authorization test suite for invites/roles/owner transfer

### Title
Create security-focused test matrix for invite lifecycle, role enforcement, and owner transfer

### Why this matters
Authorization features are high-risk and must be proven with adversarial and regression testing. This issue creates the confidence gate that prevents privilege escalation and cross-tenant access leaks.

### Scope

**In**
- Security/authorization matrix covering invites, role changes, and ownership transfer
- Negative-path tests for forged context, unauthorized role grants, replayed tokens, and expired invites
- Cross-tenant isolation checks for invite visibility and acceptance
- Regression coverage for Sprint 2 scoped data guarantees with new role/invite flows
- CI gate integration for critical security scenarios

**Out**
- Penetration testing of external infrastructure
- Formal third-party security audit
- Non-auth functional UI polish tests

### Detailed tasks checklist
- [ ] Define test matrix with actor-role x action x expected outcome for invites/roles/owner transfer
- [ ] Add backend integration tests for unauthorized create/revoke/accept/transfer attempts
- [ ] Add tests for token replay, expired token acceptance, revoked token acceptance, and malformed token inputs
- [ ] Add cross-expedition tests ensuring invites cannot be accepted or managed outside expedition scope
- [ ] Add tests for forbidden role escalation paths (member->admin/owner without authority)
- [ ] Add frontend regression tests verifying denied responses do not produce false-success UI states
- [ ] Wire critical security suite into CI required checks
- [ ] Document known gaps and follow-up hardening tasks in issue comments

### Acceptance criteria
- Security matrix scenarios are implemented and pass reliably in CI
- No known privilege escalation path remains untested for sprint scope
- Cross-tenant invite/role isolation checks pass consistently
- Denial-path UX remains deterministic and non-misleading

### Test plan
- Automated backend integration/security tests executed on every PR
- Frontend regression tests for role/invite denial handling
- Manual targeted abuse-case verification in staging before release

### Dependencies
- Depends on EXP-021, EXP-022, and EXP-023 deliverables
- Extends Sprint 2 security baseline (EXP-014)

### Risks
- Incomplete matrix can leave hidden escalation paths
- Flaky security tests can weaken CI trust and slow delivery
- Missing staging abuse-case checks can miss environment-specific failures

### Definition of done
- Security matrix published and linked from sprint board
- CI includes required invite/role/owner-transfer security gates
- QA + engineering sign-off recorded with no unresolved P0/P1 security defects

### Suggested labels
- type:qa
- type:security
- area:authz
- area:invites
- priority:P0
- sprint:sprint-3
- effort:M
- tenant-isolation
