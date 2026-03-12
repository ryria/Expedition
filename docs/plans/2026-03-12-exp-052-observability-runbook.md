# EXP-052 Observability Runbook (Beta)

**Date:** 2026-03-12  
**Scope:** Sprint 6 beta reliability baseline (`EXP-052`)  
**Systems:** React client (`client/src`), SpacetimeDB module (`module/src/lib.rs`)

---

## 1) Structured signal schema

### Client signal shape

- `level`: derived from severity (`p0=error`, `p1=warn`, `p2=info`)
- `component`: subsystem source (for example `client.provider`, `client.runtime`, `client.ui`)
- `expedition_id`: expedition scope as string (`"0"` for global)
- `trace_id`: per-session correlation id
- `event`: normalized event name (for example `provider_connect_error`)
- `error_code`: normalized error code (for example `provider.connect.error`)
- `timestamp`: ISO timestamp

### Module counter shape

Table: `operational_counter`

- `key` (pk): `${operation}:${status}` or `${operation}:${status}:${error_code}`
- `operation`: reducer operation name
- `status`: `success` or `failure`
- `count`: monotonic count
- `last_error_code`: latest failure code for this bucket
- `updated_at`: last update timestamp

---

## 2) Error taxonomy and severity mapping

- `authz`: authentication/authorization mismatches (`p0`/`p1` depending on blast radius)
- `validation`: invalid inputs, malformed payloads (`p1`)
- `sync`: subscription/connectivity/timeout drift (`p1`)
- `dependency`: third-party/network failures (`p0` if sustained)
- `unknown`: fallback classification (`p1`)

---

## 3) Baseline alert thresholds (beta)

- `P0`: provider connect failures > 5 in 5m OR repeated UI error boundary triggers (> 3 in 5m)
- `P1`: reducer failure ratio > 10% for `log_activity`, `accept_invite`, `join_expedition` in 15m
- `P1`: `track_product_event` validation failures > 20 in 15m
- `P1`: no reducer success updates in `operational_counter` for 15m during active beta window

---

## 4) Top-5 incident triage query snippets

### A) Beta users cannot connect

```sql
SELECT *
FROM product_analytics_event
WHERE event_name = 'client_observability_signal'
ORDER BY created_at DESC
LIMIT 200;
```

Filter payload for `event=provider_connect_error` and group by `error_code`.

### B) Activity logging failures spike

```sql
SELECT operation, status, last_error_code, count, updated_at
FROM operational_counter
WHERE operation = 'log_activity'
ORDER BY updated_at DESC;
```

### C) Invite acceptance broken

```sql
SELECT operation, status, last_error_code, count, updated_at
FROM operational_counter
WHERE operation = 'accept_invite'
ORDER BY updated_at DESC;
```

### D) Join failures after visibility/privacy changes

```sql
SELECT operation, status, last_error_code, count, updated_at
FROM operational_counter
WHERE operation = 'join_expedition'
ORDER BY updated_at DESC;
```

### E) Instrumentation/data quality regressions

```sql
SELECT operation, status, last_error_code, count, updated_at
FROM operational_counter
WHERE operation = 'track_product_event'
ORDER BY updated_at DESC;
```

---

## 5) Response workflow

1. Confirm incident severity (`p0` or `p1`) and affected user journey.
2. Capture failing `trace_id` from latest `client_observability_signal` events.
3. Correlate with `operational_counter` failure buckets by reducer operation.
4. Apply containment (rollback or guard path) if thresholds remain breached.
5. Validate recovery by observing success counters increase and failure slope flatten.

---

## 6) Security/log redaction guardrails

- Never emit auth tokens, secrets, webhook payloads, or raw PII into `payload_json`.
- Keep error messages concise and capped (client truncates message fields).
- Use normalized `error_code` values for dashboards/alerts instead of raw exception text.
