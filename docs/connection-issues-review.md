# Connection Issues Notes Review

## Context

Notes from a SpacetimeDB troubleshooting session were reviewed against the actual codebase to assess relevance. Symptoms: fails to connect initially, drops/disconnects, doesn't reconnect.

---

## Notes That Are NOT Relevant (Already Handled)

| Note | Why it's fine |
|---|---|
| SDK doesn't auto-reconnect | Custom reconnect loop exists in `useConnectionHandler.ts:221–236` with exponential backoff (2s→15s) and event listeners for `online`/`offline`/`visibilitychange` |
| Use `wss://` not `https://` | `connection.ts:19–39` — `validateStdbUri()` already enforces this and throws on violation |
| Gate UI on `isActive`/`isReady` | `ConnectionPhase` enum drives intermission screens; `isConnectionActive()` and `isConnectionReady()` exist |
| `useTable isReady` SDK bug | The codebase doesn't use `useTable` at all — replaced with custom `useLiveTable.ts` that polls `getConnection()` every 250ms |

---

## Notes That ARE Potentially Relevant

### 1. Token not persisted in localStorage

**Files:** `client/src/main.tsx:142`, `client/src/spacetime/connection.ts:141`

The auth token comes from `auth.user?.id_token` (OIDC in-memory state). It is passed to `.withToken()` correctly, but it is never cached to `localStorage`. During a reconnect — especially after a page refresh or a brief OIDC hiccup — `auth.user` could be momentarily `undefined`, causing the reconnect to fire with no token (creating a new anonymous identity on the server). The `automaticSilentRenew: true` setting helps but doesn't eliminate the window.

### 2. Manual `DbConnection` singleton vs `SpacetimeDBProvider`

**Files:** `client/src/spacetime/connection.ts`, `client/src/spacetime/useConnectionHandler.ts`

The codebase manages `DbConnection` as a module-level singleton rather than using the SDK's `SpacetimeDBProvider`. The notes flag the provider as "StrictMode-safe" — React 18 StrictMode double-mounts components in dev, which could cause the singleton to be initialized twice or left in a torn state. This could explain "fails to connect initially" symptoms that appear in development.

---

## Key Files

| File | Role |
|---|---|
| `client/src/spacetime/connection.ts` | Singleton connection, `withToken()`, `isReady` flag |
| `client/src/spacetime/useConnectionHandler.ts` | Reconnection loop, phase management |
| `client/src/main.tsx` | OIDC token retrieval, passed to `useConnectionHandler` |
| `client/src/hooks/useLiveTable.ts` | 250ms polling instead of SDK `useTable` |

---

## Suggested Verifications (before making changes)

1. Log token value on each reconnect attempt — confirm it is never `undefined`
2. Test in React 18 StrictMode (dev): check if double-mount causes duplicate/torn connections
3. Verify `phase` transitions correctly through `"reconnecting"` → `"connected"` in the network drop scenario
4. Check if reconnects after a page refresh result in a new server-side identity
