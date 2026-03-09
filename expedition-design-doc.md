# The Expedition — Design Document

*Collaborative fitness tracker · Circumnavigation of Australia · v0.1*

---

## 1. Concept

Three friends. One route. A shared goal of running, rowing, walking, or cycling the equivalent of circumnavigating Australia — **14,500 km** of coastline from Sydney, clockwise around the continent, back to Sydney.

Every kilometre logged by any member advances the team's position on the map. The experience is cooperative, not competitive: the route belongs to all three of you.

---

## 2. Core Features

### 2.1 Activity Logging
- Log a distance in km with a name, activity type (run / row / walk / cycle), and optional note
- Each entry triggers an AI coach response from Claude — short, punchy, referencing the team's current position on the route and the nearest landmark
- Entries are visible to all members in real time

### 2.2 The Map View
- An aged nautical chart aesthetic — parchment, ink, worn compass rose, hand-drawn landmark icons
- The Australian coastline rendered as an SVG path, clockwise from Sydney
- The team's progress is drawn as a coloured trail along the route
- Zoom and pan (mouse wheel / pinch-to-zoom / drag)
- Two viewing modes, toggled at the bottom of the map:
  - **As Ran** — trail segments rendered sequentially as they were logged, colour-coded to the person who logged them. Visually shows the rhythm of the journey — who ran when
  - **Contribution** — each person's total distance stacked as a single block in sequence. Shows the relative share of each person's contribution to the total distance
- Landmark icons along the route; tap/hover reveals the landmark name, a short historical or geographical fact, and whether it has been reached
- Distance milestone markers at every 10% of the route
- A legend showing each person's colour
- Current position marker (a flag icon) at the leading edge of the trail

### 2.3 Activity Feed
- Reverse-chronological list of all logged entries
- Each entry shows: person name, activity type icon, distance, optional note, timestamp, and the AI coach response
- Emoji reaction bar (six reactions) on each entry — reactions persist and accumulate
- Comment thread per entry, expand/collapse — author name required to comment
- All reactions and comments sync in real time

### 2.4 Stats View
- Total km logged and percentage of route completed
- Remaining distance to Sydney
- Per-person breakdown: total km, activity count, km split by activity type
- Landmarks passed: list with name, km marker, and fact
- Activity type breakdown with proportional bar chart

---

## 3. Route

**Circumnavigation of Australia — 14,500 km**

Starting and ending at Sydney, travelling clockwise (north up the east coast, across the tropical north, south down the west coast, across the Nullarbor, back up the east).

### Landmark sequence

| # | Landmark | km | Fact |
|---|----------|----|------|
| 1 | Sydney | 0 | Where the journey begins. The Harbour Bridge and Opera House mark the start line. |
| 2 | Brisbane | 1,340 | Queensland's capital. Gateway to the Great Barrier Reef and the tropical north. |
| 3 | Cairns | 2,120 | Tropical gateway to the Reef. Cassowaries roam the rainforest just behind the esplanade. |
| 4 | Darwin | 3,200 | NT capital. Crocodiles in every waterway. Monsoonal lightning storms roll in each afternoon during the Wet. |
| 5 | Broome | 4,700 | Famous for the Staircase to the Moon — full moon reflecting on tidal flats. Red pindan cliffs, turquoise sea. |
| 6 | Geraldton | 6,060 | The wreck of the Dutch vessel *Batavia* (1629) lies offshore — a story of mutiny and survival. |
| 7 | Perth | 6,720 | The most isolated major city on Earth. Closer to Singapore than to Sydney. Indian Ocean sunsets. |
| 8 | Albany | 8,080 | Australia's last whaling station closed here in 1978. Now a whale-watching mecca for Southern Rights and Humpbacks. |
| 9 | Eucla | 9,460 | Population 50. The Nullarbor Plain. The world's longest straight road — 146 km without a bend. |
| 10 | Adelaide | 11,240 | City of Churches. The Barossa and McLaren Vale begin at the city's edge. |
| 11 | Melbourne | 12,100 | Australia's cultural capital. Laneways, coffee, street art. Claims most liveable city regularly. |
| 12 | Eden | 12,690 | Orcas and Humpbacks interact in Twofold Bay. The final stretch home begins. |
| 13 | Sydney | 14,500 | Journey complete. |

---

## 4. Technical Architecture

### 4.1 Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | React + Vite | UI, map rendering, state subscription |
| Module | SpacetimeDB Maincloud | Shared state, live sync, reducers, Claude API calls |
| AI Model | Claude (claude-sonnet-4) | Per-entry encouragement, called from SpacetimeDB Procedure |
| Hosting | GitHub Pages | Static build hosting |
| CI/CD | GitHub Actions | Auto-deploy on push to `main` |

### 4.2 Why this stack

**SpacetimeDB** eliminates the need for a traditional backend entirely — including any AI proxy. The database is also the real-time subscription layer and the server-side compute environment. SpacetimeDB 2.0 introduced **Procedures**: module functions that can make outbound HTTP requests to external services. The Claude API call happens inside a Procedure, so the API key never leaves the module environment and never touches the browser. No Cloudflare account, no Worker, no second deployment to manage.

The client SDK speaks to the module over WebSockets. CORS does not apply to WebSocket connections, so GitHub Pages works as the frontend host without any workarounds.

**GitHub Pages** serves the static React build. No server configuration required on the frontend side at all.

### 4.3 CORS notes

- Frontend → SpacetimeDB: WebSocket connection. CORS does not apply.
- SpacetimeDB Procedure → Anthropic API: server-to-server HTTP call from inside the module. No browser involvement, no CORS concern, API key never exposed.
- There is no direct browser-to-Anthropic call anywhere in this architecture.

---

## 5. SpacetimeDB Module Design

### 5.1 Tables

**`ActivityLog`**
```
id             u64       primary key, auto-increment
person_name    String
activity_type  String    ("run" | "row" | "walk" | "cycle")
distance_km    f32
note           String    optional, may be empty
timestamp      Timestamp
ai_response    String    empty on insert, patched by Procedure after Claude responds
```

**`Reaction`**
```
id             u64       primary key, auto-increment
log_id         u64       foreign key → ActivityLog.id
emoji          String
reacted_by     String    person name (no auth, trust-based)
timestamp      Timestamp
```

**`Comment`**
```
id             u64       primary key, auto-increment
log_id         u64       foreign key → ActivityLog.id
author         String
body           String
timestamp      Timestamp
```

### 5.2 Reducers

```
log_activity(person_name, activity_type, distance_km, note)
  → validates fields, inserts row into ActivityLog with ai_response = ""

get_ai_response(log_id)   ← Procedure (not a reducer)
  → fetches entry, calls Claude API, patches ai_response field

add_reaction(log_id, emoji, reacted_by)
  → inserts row into Reaction

add_comment(log_id, author, body)
  → validates non-empty body, inserts row into Comment
```

### 5.3 Subscriptions

The React client subscribes to all three tables on mount. SpacetimeDB pushes row diffs in real time. No polling. The SDK maintains a local cache that stays consistent automatically.

> **Schema note:** Design the table structure carefully before building the UI. SpacetimeDB module updates require republishing the module and may require data migration. Get the fields right in Phase 1.

---

## 6. SpacetimeDB Procedure — Claude Integration

The Claude API call is made from a **Procedure** inside the SpacetimeDB module. Procedures are like reducers but with outbound HTTP capability. This is available in TypeScript modules without any unstable feature flags; Rust modules require opting in to the `unstable` feature in `Cargo.toml`.

**Flow:**
1. Client calls the `log_activity` reducer — inserts the entry into `ActivityLog` with `ai_response` left empty
2. Client then calls the `get_ai_response` procedure, passing the new entry's ID
3. Procedure reads the entry from the database, builds the Claude prompt with landmark context, and POSTs to `api.anthropic.com`
4. Procedure opens a transaction, writes the AI response back to the `ai_response` field, commits
5. SpacetimeDB pushes the updated row to all subscribed clients automatically

**Prompt construction (inside the Procedure):**
```
System: You are the AI coach for The Expedition — three friends 
        circumnavigating Australia together. Be short (2-3 sentences),
        specific to the location, and energetic without being cheesy.

User:   [person_name] just logged [distance_km] km of [activity_type].
        Note: "[note]"
        Team total: [total_km] km ([pct]% of 14,500 km).
        Last landmark: [last_landmark_name] — [last_landmark_fact]
        Next landmark: [next_landmark_name] in [km_to_next] km.
```

**API key storage:** The key is stored as an environment variable or secret in the SpacetimeDB module configuration — never hardcoded, never in the client bundle. Check the Maincloud dashboard and SpacetimeDB docs for the current mechanism for injecting secrets into hosted modules, as this was not fully documented at the time of writing.

> **Beta caveat:** Procedures are currently in beta in SpacetimeDB 2.0. The API may change in upcoming releases. If Procedures prove unreliable during development, the fallback is a minimal Cloudflare Worker proxy (see the previous version of this document), but try the Procedure approach first — it's the cleaner architecture.

**Why not just call Claude from the reducer?** Reducers are transactional — they must complete atomically and cannot make blocking network calls. Procedures exist specifically to handle this case. The two-step flow (reducer to write the entry, procedure to fetch and patch the AI response) is the intended pattern.

---

## 7. Map Implementation

### 7.1 Approach

The map is rendered as an SVG embedded in the React component. Australia's coastline is encoded as a series of waypoints — `[svgX, svgY, cumulativeKm]` — defining the clockwise route path. The coordinate system is a fixed viewBox (e.g. `0 0 1100 720`). Pan and zoom are implemented via a CSS `transform: translate() scale()` on a wrapper div, driven by mouse/touch event listeners.

### 7.2 Route waypoints

Store as a TypeScript array of tuples: `[x: number, y: number, km: number, name?: string]`. Approximately 60–80 waypoints around the coast gives sufficient resolution for smooth trail rendering without being unwieldy.

For each activity segment, interpolate linearly between the two waypoints that bracket the `fromKm` and `toKm` values to find the exact start/end SVG coordinates, then build an SVG `<path>` using the intermediate waypoints.

### 7.3 Trail rendering — As Ran vs Contribution

Both modes produce a list of **segments**, each with `{ person, fromKm, toKm, color }`. The difference is in how segments are generated:

**As Ran:**
```
cursor = 0
for each activity in chronological order:
  segment = { person, fromKm: cursor, toKm: cursor + activity.km, color: personColor }
  cursor += activity.km
```

**Contribution:**
```
cursor = 0
for each person in display order:
  total = sum of all that person's activity km
  segment = { person, fromKm: cursor, toKm: cursor + total, color: personColor }
  cursor += total
```

Both produce the same total distance — they only differ in how the colour blocks are arranged along the path.

### 7.4 Map aesthetic

- **Background:** SVG `<rect>` filled with parchment colour (`#e8d5a3`), with an SVG `feTurbulence` filter for paper grain texture
- **Sea:** A lighter fill behind the landmass, with faint hatching lines
- **Land:** The Australia path filled with a warm sand colour (`#d4b96a`), stroke in dark ink (`#2c1a0e`)
- **Grid:** Faint latitude/longitude lines with small coordinate labels
- **Compass rose:** Decorative SVG compass in the lower-left corner
- **Scale bar:** Lower-left, kilometre scale
- **Cartouche:** Title box ("The Expedition") in the upper-right corner
- **Vignette:** Radial gradient overlay darkening the corners
- **Trails:** Three-layer strokes — ink shadow, coloured fill, faint white highlight — for hand-drawn feel
- **Typography:** `IM Fell English` (Google Fonts) for all map labels, cartouche, and UI chrome

### 7.5 Landmark icons

Each landmark is rendered as a small ink dot at its SVG coordinate. Reached landmarks get a filled dot; upcoming landmarks get an open dot. Hover/tap shows a tooltip card with name, fact, and distance status.

---

## 8. Frontend Component Structure

```
App
├── MapView
│   ├── MapSVG              (the parchment map, pan/zoom wrapper)
│   │   ├── AustraliaPath   (landmass SVG path)
│   │   ├── TrailsLayer     (coloured route segments)
│   │   ├── LandmarksLayer  (dots + tooltip triggers)
│   │   ├── MilestonesLayer (10% tick marks)
│   │   └── CompassRose
│   ├── MapControls         (zoom in / zoom out / reset)
│   ├── ModeToggle          (As Ran / Contribution)
│   ├── PersonLegend
│   ├── StatsBar            (total km / % / remaining)
│   └── LandmarkTooltip
├── LogView
│   ├── LogForm             (name, activity, distance, note → submit)
│   └── ActivityFeed
│       └── ActivityCard    (entry + AI response + reactions + comments)
└── StatsView
    ├── SummaryStats
    ├── PersonBreakdown
    ├── ActivityTypeChart
    └── LandmarksPassed
```

---

## 9. Delivery Phases

| Phase | Focus | Done when |
|-------|-------|-----------|
| **1** | SpacetimeDB module + local dev | Module deployed to cloud, React app connects, live data appears in console |
| **2** | Core UI — log form + activity feed | Can log an entry and see it appear on another browser tab in real time |
| **3** | Reactions + comments | Reactions and threads sync live across sessions |
| **4** | Claude Procedure + AI responses | Logging an entry triggers the Procedure, Claude response patches back and syncs to all clients |
| **5** | Map view — trail rendering | Coloured trails draw correctly; As Ran / Contribution toggle works |
| **6** | Map view — landmarks + polish | Tooltips, milestone markers, compass rose, parchment aesthetic |
| **7** | Stats view | All stats panels working from SpacetimeDB subscription data |
| **8** | GitHub Pages deploy + CI/CD | Auto-deploys on push; friends can access the live URL |

---

## 10. Risks & Decisions

**Identity / auth:** There is no authentication. Person name is a free-text field set by the user. This is intentional for a trusted group of three. If someone enters a friend's name, they can log under it — acceptable for this context. Add auth only if the group grows or if it becomes a problem.

**SpacetimeDB schema changes:** Once the UI is built against the module schema, changing table structures requires republishing the module. Invest time in Phase 1 to get the fields right before building anything on top.

**Running costs:** SpacetimeDB free tier gives 2,500 TeV of energy credit per month — approximately equivalent to 3 million reducer calls. Three friends logging a few activities a week will use a trivially small fraction of that. The free tier also automatically pauses databases after a period of inactivity, resuming in typically less than one second — irrelevant for this use case but good to know. GitHub Pages is free. The only real cost is the Claude API: one call per activity logged, which at casual usage amounts to a few cents per month at most.

**Map fidelity:** The SVG route path is a stylised approximation of the Australian coastline, not GeoJSON-accurate. This is a deliberate aesthetic choice — accuracy would conflict with the hand-drawn map feel. Landmark positions on the SVG are estimated to match their geographic position along the path.

**Offline behaviour:** SpacetimeDB requires a connection. There is no offline support. Entries cannot be logged without internet. Acceptable for this use case.

---

## 11. Personalisation

| Setting | Value |
|---------|-------|
| Route | Circumnavigation of Australia |
| Total distance | 14,500 km |
| Direction | Clockwise from Sydney |
| Members | Rob · Sam · Jay (placeholder names — update before deploy) |
| Colours | Rob: `#8b2020` red · Sam: `#1a5c3a` green · Jay: `#1e3a6e` navy |
| Activity types | Run · Row · Walk · Cycle |

Colours and names are defined in a single config file — change them once, they propagate everywhere.

---

*Begin with Phase 1. Everything else follows from a working SpacetimeDB connection.*
