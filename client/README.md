# Expedition Client

React + TypeScript frontend for the Expedition activity tracker.

## Requirements

- Node.js 20+
- SpacetimeDB module deployed as database `expedition`

## Environment

Create `client/.env.local` with:

```env
VITE_STDB_URI=wss://maincloud.spacetimedb.com
VITE_STDB_AUTH_CLIENT_ID=your_spacetime_auth_client_id
VITE_STRAVA_CLIENT_ID=your_strava_client_id
```

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — type-check and production build
- `npx vitest run` — run tests
- `npm run lint` — run ESLint

## High-level structure

- `src/components` — UI grouped by feature (map, log, stats, members, settings)
- `src/hooks` — live SpacetimeDB data subscriptions
- `src/spacetime` — generated bindings + connection lifecycle
- `src/data` — route/landmark data and segment helpers
