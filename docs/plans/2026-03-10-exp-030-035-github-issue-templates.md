# Sprint 4 GitHub Issue Templates (EXP-030..EXP-035)

Copy/paste each section into a GitHub issue.

---

## EXP-030: Add billing and entitlement domain model in SpacetimeDB module

### Title
Add subscription, entitlement, and billing-event schema in SpacetimeDB for expedition-scoped access control

### Why this matters
Billing features are unsafe without a durable server-side source of truth for plan state and entitlements. This issue establishes the data model required to gate paid capabilities consistently and audit billing transitions.

### Scope

**In**
- New expedition-scoped billing tables for subscription state, entitlement grants, and processed webhook/idempotency events
- Plan tier and billing status encoding suitable for server-side guards
- Constraints/indexes for expedition lookup, provider subscription id lookup, and event deduplication
- Schema exposure to generated React client bindings

**Out**
- Checkout session creation and hosted payment redirects
- Webhook signature verification implementation
- Frontend upgrade/paywall UX

### Detailed tasks checklist
- [ ] Add `subscription` entity with fields: `id`, `expedition_id`, `provider_customer_id`, `provider_subscription_id`, `plan_tier`, `status`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `created_at`, `updated_at`
- [ ] Add `entitlement` entity with fields: `id`, `expedition_id`, `key`, `is_enabled`, `source`, `effective_at`, `expires_at`, `created_at`, `updated_at`
- [ ] Add `billing_event` (or `webhook_event`) entity with fields: `id`, `provider_event_id`, `event_type`, `expedition_id` (nullable until resolved), `processed_at`, `result_status`, `error_code`, `created_at`
- [ ] Add unique constraints for active subscription per expedition and unique `provider_event_id`
- [ ] Add indexes for `subscription.expedition_id`, `subscription.provider_subscription_id`, `entitlement.expedition_id+key`, and `billing_event.created_at`
- [ ] Define status/tier domain values (e.g., `free`, `pro`, `team`; `active`, `trialing`, `past_due`, `canceled`, `incomplete`) and invariants
- [ ] Add helper query paths to read effective entitlements for an expedition in one call
- [ ] Regenerate bindings and confirm compile compatibility in Rust module and React client

### Acceptance criteria
- Subscription and entitlement state can be stored and queried per expedition deterministically
- Duplicate provider webhook events are blocked at schema level
- Effective entitlement lookup is index-backed and stable for guard checks
- Generated bindings include new billing entities without manual edits

### Test plan
- Unit tests for schema constraints and status/tier invariants
- Integration tests for entitlement lookup behavior with active/expired grants
- Binding smoke test from React client type usage

### Dependencies
- Depends on Sprint 3 multi-tenant and role baseline (EXP-020..024)
- Blocks EXP-031, EXP-032, EXP-033, EXP-035

### Risks
- Ambiguous status encoding can cause mismatched entitlement decisions
- Missing uniqueness/indexes may allow duplicate processing or slow guard queries
- Poor schema boundaries can force invasive migration in later sprints

### Definition of done
- Billing schema merged with generated bindings updated
- Constraint and query tests passing in CI
- Domain value mapping and migration notes captured in issue comments

### Suggested labels
- type:backend
- area:spacetimedb
- area:billing
- area:entitlements
- priority:P0
- sprint:sprint-4
- effort:M
- security

---

## EXP-031: Implement checkout session flow and subscription bootstrap

### Title
Implement authenticated checkout-session creation and subscription bootstrap for expedition plans

### Why this matters
Without a controlled checkout entrypoint, users cannot reliably move from free to paid tiers. This issue creates the secure server integration that starts billing and links provider customer/subscription records to expeditions.

### Scope

**In**
- Server procedure to create checkout sessions for allowed plan tiers
- Provider customer/subscription identity linkage to expedition
- Validation for actor role, expedition scope, and plan transition rules
- Safe handling for retry/re-entry to avoid duplicate active checkout intents

**Out**
- Webhook verification and asynchronous status reconciliation
- Final server-side entitlement gates on feature reducers
- Full frontend upgrade UX polish

### Detailed tasks checklist
- [ ] Add `create_checkout_session` reducer/procedure requiring authenticated expedition owner/admin (per policy)
- [ ] Validate requested plan tier against allowed catalog and transition rules (e.g., no downgrade path in this issue if out-of-scope)
- [ ] Create/reuse provider customer id for expedition and persist mapping
- [ ] Call billing provider SDK/API to create checkout session with success/cancel return URLs
- [ ] Persist checkout correlation metadata (`expedition_id`, plan request, actor, request id) for reconciliation/debugging
- [ ] Return deterministic response payload with hosted checkout URL/session id and expiration metadata
- [ ] Add idempotent handling for repeated requests within short window (reuse pending checkout intent where possible)
- [ ] Add structured error mapping for provider/API/network failures

### Acceptance criteria
- Authorized caller can create checkout session for valid plan tier
- Unauthorized or invalid plan requests are denied deterministically
- Expedition-to-provider customer mapping is persisted and reused
- Duplicate rapid retries do not create uncontrolled duplicate checkout intents

### Test plan
- Unit tests for plan validation and transition rules
- Integration tests with mocked provider client for success/failure scenarios
- Idempotency test for repeated checkout session requests

### Dependencies
- Depends on EXP-030 schema foundation
- Blocks EXP-034 upgrade UX and supports EXP-032 reconciliation paths

### Risks
- Provider API failures may create partially persisted state without careful transaction boundaries
- Missing idempotency may inflate abandoned checkout sessions
- Incorrect role checks could expose billing operations to unauthorized users

### Definition of done
- Checkout session procedure merged with provider abstraction and tests
- Error and retry behavior documented for frontend integration
- CI passing for module tests/build with no regression in existing reducers

### Suggested labels
- type:backend
- area:billing
- area:payments
- area:authz
- priority:P0
- sprint:sprint-4
- effort:L
- security

---

## EXP-032: Add webhook verification and idempotent billing reconciliation

### Title
Implement signed webhook ingestion with idempotent subscription and entitlement reconciliation

### Why this matters
Checkout completion is not trustworthy until verified webhook events are processed exactly once. This issue ensures provider updates are authenticated, replay-safe, and consistently mapped into subscription/entitlement state.

### Scope

**In**
- Webhook endpoint/handler with provider signature verification
- Event deduplication using `provider_event_id` and durable processing state
- Reconciliation logic for key billing events (subscription created/updated/canceled, invoice payment success/failure)
- Deterministic error and retry strategy for transient processing failures

**Out**
- Frontend billing UI changes
- Advanced proration/refund workflows
- Multi-provider abstraction beyond primary provider

### Detailed tasks checklist
- [ ] Add webhook ingress handler with raw payload access required for signature verification
- [ ] Verify provider signature using configured secret; reject invalid signatures with audit logging
- [ ] Resolve expedition/subscription mapping from provider identifiers in event payload
- [ ] Upsert subscription state transitions and period boundaries from canonical event data
- [ ] Recompute entitlement grants/revocations from plan tier and billing status
- [ ] Record every processed event in `billing_event` with status (`processed`, `ignored_duplicate`, `failed`) and error details when relevant
- [ ] Ensure idempotent processing path so duplicate deliveries have zero side effects after first success
- [ ] Add retry-safe handling for out-of-order events (prefer latest provider timestamp/version semantics)

### Acceptance criteria
- Invalid webhook signatures are rejected and do not mutate subscription/entitlement state
- Duplicate webhook deliveries are deduplicated with no repeated side effects
- Relevant subscription lifecycle events correctly update effective entitlements
- Processing failures are observable and retryable without corrupting state

### Test plan
- Unit tests for signature verification and event-type mapping
- Integration tests for duplicate event replay and out-of-order delivery
- Failure-path tests for transient persistence/provider parsing errors

### Dependencies
- Depends on EXP-030 schema and EXP-031 provider mapping
- Blocks EXP-033 entitlement gates hardening and EXP-035 billing reliability tests

### Risks
- Signature verification mistakes can open unauthorized state mutation path
- Non-idempotent reconciliation can produce entitlement flapping
- Out-of-order event handling bugs can regress active subscriptions to stale states

### Definition of done
- Webhook verification/reconciliation merged with replay-safe tests
- Operational runbook notes added for retry and dead-letter handling
- CI passing including webhook-focused integration tests

### Suggested labels
- type:backend
- area:billing
- area:webhooks
- area:security
- priority:P0
- sprint:sprint-4
- effort:L
- security

---

## EXP-033: Enforce server-side entitlement gates on paid capabilities

### Title
Apply expedition entitlement checks to server reducers/procedures for paid feature enforcement

### Why this matters
Client-only gating is bypassable and cannot protect paid features. This issue enforces entitlements at the trusted server boundary so access aligns with billing state under all clients.

### Scope

**In**
- Central entitlement guard helper(s) in Rust module
- Guard application to paid reducers/procedures defined by product policy
- Deterministic denial errors for missing/expired entitlements
- Audit/instrumentation events for denied paid operations

**Out**
- Visual paywall and upgrade prompts in React
- Provider-side catalog/pricing administration
- Usage-meter billing model

### Detailed tasks checklist
- [ ] Define entitlement matrix mapping paid capabilities to entitlement keys
- [ ] Implement shared `require_entitlement(expedition_id, key)` guard with active-period checks
- [ ] Integrate guard into target reducers/procedures (e.g., premium analytics, advanced member controls, export endpoints per policy)
- [ ] Ensure expedition context is always derived from authenticated actor + scoped request data
- [ ] Return stable error codes/messages (e.g., `ENTITLEMENT_REQUIRED`, `ENTITLEMENT_EXPIRED`, `PLAN_INACTIVE`)
- [ ] Add instrumentation events/counters for entitlement-denied operations
- [ ] Validate guard behavior under status transitions (`active` -> `past_due` -> `canceled`)
- [ ] Add regression tests for allowed/denied permutations across roles and plans

### Acceptance criteria
- Paid reducers are blocked server-side when entitlement is absent or inactive
- Active paid expeditions can perform gated operations successfully
- Error taxonomy is deterministic for frontend UX handling
- Guard checks do not leak data across expedition boundaries

### Test plan
- Unit tests for entitlement guard helper and status-window logic
- Integration tests across targeted reducers/procedures for allow/deny coverage
- Regression tests validating behavior after webhook-driven status changes

### Dependencies
- Depends on EXP-030 and EXP-032 for authoritative entitlement state
- Blocks EXP-034 UX completion and supports EXP-035 test hardening

### Risks
- Missing one paid reducer can create policy bypass path
- Inconsistent error contracts can cause broken frontend upgrade prompts
- Overly broad guards may accidentally block free-tier core functionality

### Definition of done
- Entitlement guards merged and applied to all in-scope paid operations
- Authorization and entitlement regression tests pass in CI
- Capability-to-entitlement matrix attached to issue and reviewed

### Suggested labels
- type:backend
- area:authz
- area:entitlements
- area:billing
- priority:P0
- sprint:sprint-4
- effort:M
- security

---

## EXP-034: Build upgrade and billing-state UX in React client

### Title
Implement upgrade flow UI, billing state surfaces, and entitlement-aware prompts in React

### Why this matters
Users need clear, actionable billing experiences to upgrade plans and recover from payment issues. This issue turns server billing state into understandable UI states and drives conversion without breaking gated workflows.

### Scope

**In**
- Settings/account UI surfaces for current plan, status, renewal window, and upgrade CTA
- Checkout initiation wiring to `create_checkout_session`
- Entitlement-denied UX with contextual upgrade prompts from server error codes
- Loading/error/success states for billing actions and webhook-lag messaging

**Out**
- Full invoice history/download center
- Seat management and metered usage dashboards
- Marketing pages outside app shell

### Detailed tasks checklist
- [ ] Add billing summary panel showing plan tier, status, current period end, and cancellation state
- [ ] Add upgrade CTA and plan selection controls constrained to in-scope transitions
- [ ] Wire checkout action to backend procedure and redirect to hosted checkout URL
- [ ] Handle cancel/return states and show deterministic post-checkout messaging while awaiting webhook sync
- [ ] Add entitlement-denied UI handling for server errors from gated operations (inline prompts + upgrade action)
- [ ] Add read/refresh flow for subscription + entitlement state via existing live table/hooks patterns
- [ ] Add robust empty/loading/error states for billing data unavailable or stale conditions
- [ ] Add component/hook tests for upgrade CTA visibility, checkout initiation, and denial-state rendering

### Acceptance criteria
- User can initiate checkout from UI and is redirected to hosted provider flow
- Post-checkout return state is handled without false success before webhook confirmation
- Entitlement-denied operations surface clear upgrade guidance tied to backend error codes
- Billing status display remains consistent with server subscription state

### Test plan
- Component tests for billing panel states and CTA visibility
- Hook/integration tests for checkout call, redirect handling, and refresh behavior
- Manual E2E smoke across free -> paid path and denied -> upgraded retry path

### Dependencies
- Depends on EXP-031 checkout API and EXP-033 error contract/entitlement guards
- Contributes UX coverage inputs for EXP-035

### Risks
- Premature success messaging can create support issues when webhook is delayed
- Divergent frontend assumptions about error codes can break upgrade prompts
- Missing loading/error states can strand users during provider/API outages

### Definition of done
- Billing/upgrade UX merged with deterministic server-contract handling
- Frontend tests and build pass
- Manual smoke verification completed for primary upgrade and denied flows

### Suggested labels
- type:frontend
- area:react
- area:billing
- area:ux
- priority:P1
- sprint:sprint-4
- effort:M

---

## EXP-035: Add end-to-end billing reliability and entitlement regression tests

### Title
Establish billing and entitlement test matrix covering checkout, webhooks, gating, and upgrade recovery

### Why this matters
Billing defects directly impact revenue and user trust. This issue provides automated confidence that subscription lifecycle, entitlement enforcement, and upgrade UX remain correct as the codebase evolves.

### Scope

**In**
- Cross-layer test matrix for checkout bootstrap, webhook replay, entitlement gates, and UI recovery paths
- Test fixtures/mocks for provider webhook payloads and signature scenarios
- CI-friendly test segmentation for fast feedback on billing-critical paths
- Baseline observability assertions for processed/failed billing events

**Out**
- Load/performance testing at production scale
- Chaos testing beyond focused billing reliability scenarios
- New provider integrations

### Detailed tasks checklist
- [ ] Define billing critical-path matrix: `free -> checkout -> active`, `active -> past_due`, `past_due -> recovered`, `active -> canceled`, duplicate webhook replay
- [ ] Add backend integration tests for webhook verification/idempotency and entitlement reconciliation
- [ ] Add backend regression tests ensuring gated reducers deny/allow correctly per entitlement status
- [ ] Add frontend integration/component tests for upgrade prompts and post-upgrade state refresh
- [ ] Add deterministic test fixtures for signed/invalid webhook payloads and out-of-order delivery
- [ ] Add CI command grouping/tagging for billing-critical suites with clear failure output
- [ ] Validate no flaky timing assumptions around webhook arrival and UI refresh loops
- [ ] Document triage playbook snippet in issue comments for common billing test failures

### Acceptance criteria
- Billing-critical paths have automated coverage at backend and frontend layers
- Duplicate and invalid webhook scenarios are explicitly tested
- Entitlement gates are regression-protected against policy bypass and false denials
- CI surfaces billing failures clearly enough for fast incident response

### Test plan
- Run targeted backend billing test suite on each PR touching module billing/authz code
- Run targeted frontend billing UX tests on each PR touching checkout/paywall/settings code
- Nightly extended suite including out-of-order/replay scenarios and full upgrade smoke

### Dependencies
- Depends on EXP-031, EXP-032, EXP-033, EXP-034
- Final validation issue for Sprint 4 billing goal

### Risks
- Over-mocking may miss real integration breakages
- Flaky asynchronous tests can reduce team trust in CI signals
- Incomplete matrix can leave high-impact revenue bugs untested

### Definition of done
- Billing test matrix implemented with stable CI execution
- Known failure modes (signature, replay, entitlement drift) are covered by automated tests
- Sprint 4 billing release readiness checklist references passing evidence

### Suggested labels
- type:test
- area:billing
- area:entitlements
- area:webhooks
- priority:P0
- sprint:sprint-4
- effort:M
- quality
