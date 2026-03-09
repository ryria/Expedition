// Clockwise from Sydney. ViewBox: 0 0 1100 720.
// Format: [svgX, svgY, cumulativeKm]
export const WAYPOINTS: [number, number, number][] = [
  [878, 578, 0],
  [882, 555, 60],
  [890, 520, 130],
  [900, 490, 200],
  [905, 455, 280],
  [902, 428, 1340],
  [898, 390, 1440],
  [895, 360, 1540],
  [888, 320, 1680],
  [872, 270, 1850],
  [868, 220, 2060],
  [868, 200, 2120],
  [870, 175, 2220],
  [872, 150, 2330],
  [875, 120, 2470],
  [872, 88, 2620],
  [856, 72, 2730],
  [800, 65, 2880],
  [740, 60, 3060],
  [680, 58, 3170],
  [614, 72, 3200],
  [570, 80, 3340],
  [520, 90, 3500],
  [470, 88, 3660],
  [420, 92, 3820],
  [360, 115, 4020],
  [310, 145, 4230],
  [265, 178, 4450],
  [228, 220, 4700],
  [204, 260, 4880],
  [188, 310, 5060],
  [176, 360, 5240],
  [164, 410, 5440],
  [148, 458, 6060],
  [138, 490, 6220],
  [130, 520, 6380],
  [130, 548, 6720],
  [138, 575, 6870],
  [150, 600, 7020],
  [165, 624, 7200],
  [195, 642, 8080],
  [235, 652, 8250],
  [280, 655, 8430],
  [330, 654, 8640],
  [380, 650, 8860],
  [430, 648, 9060],
  [478, 646, 9260],
  [510, 644, 9460],
  [555, 640, 9680],
  [600, 636, 9900],
  [648, 632, 10120],
  [695, 620, 10380],
  [730, 608, 10600],
  [760, 600, 10810],
  [780, 590, 11240],
  [800, 596, 11410],
  [815, 598, 11550],
  [820, 625, 12100],
  [825, 630, 12180],
  [840, 625, 12280],
  [845, 614, 12440],
  [848, 598, 12690],
  [852, 584, 12820],
  [858, 578, 12940],
  [864, 576, 13100],
  [868, 574, 13280],
  [872, 574, 13480],
  [876, 576, 13700],
  [878, 578, 14500],
];

export interface Landmark {
  name: string;
  km: number;
  fact: string;
  svgX: number;
  svgY: number;
}

export const LANDMARKS: Landmark[] = [
  { name: "Sydney", km: 0, fact: "Where the journey begins. The Harbour Bridge and Opera House mark the start line.", svgX: 878, svgY: 578 },
  { name: "Brisbane", km: 1340, fact: "Queensland's capital. Gateway to the Great Barrier Reef and the tropical north.", svgX: 902, svgY: 428 },
  { name: "Cairns", km: 2120, fact: "Tropical gateway to the Reef. Cassowaries roam the rainforest just behind the esplanade.", svgX: 868, svgY: 200 },
  { name: "Darwin", km: 3200, fact: "NT capital. Crocodiles in every waterway. Monsoonal lightning storms roll in each afternoon during the Wet.", svgX: 614, svgY: 72 },
  { name: "Broome", km: 4700, fact: "Famous for the Staircase to the Moon — full moon reflecting on tidal flats. Red pindan cliffs, turquoise sea.", svgX: 228, svgY: 220 },
  { name: "Geraldton", km: 6060, fact: "The wreck of the Dutch vessel Batavia (1629) lies offshore — a story of mutiny and survival.", svgX: 148, svgY: 458 },
  { name: "Perth", km: 6720, fact: "The most isolated major city on Earth. Closer to Singapore than to Sydney. Indian Ocean sunsets.", svgX: 130, svgY: 548 },
  { name: "Albany", km: 8080, fact: "Australia's last whaling station closed here in 1978. Now a whale-watching mecca for Southern Rights and Humpbacks.", svgX: 195, svgY: 642 },
  { name: "Eucla", km: 9460, fact: "Population 50. The Nullarbor Plain. The world's longest straight road — 146 km without a bend.", svgX: 510, svgY: 644 },
  { name: "Adelaide", km: 11240, fact: "City of Churches. The Barossa and McLaren Vale begin at the city's edge.", svgX: 780, svgY: 590 },
  { name: "Melbourne", km: 12100, fact: "Australia's cultural capital. Laneways, coffee, street art. Claims most liveable city regularly.", svgX: 820, svgY: 625 },
  { name: "Eden", km: 12690, fact: "Orcas and Humpbacks interact in Twofold Bay. The final stretch home begins.", svgX: 848, svgY: 598 },
  { name: "Sydney", km: 14500, fact: "Journey complete.", svgX: 878, svgY: 578 },
];

// ─── Interpolation ────────────────────────────────────────────────────────────

export function interpolatePosition(km: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(km, 14_500));
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const [x0, y0, km0] = WAYPOINTS[i - 1];
    const [x1, y1, km1] = WAYPOINTS[i];
    if (clamped <= km1) {
      const t = km1 === km0 ? 0 : (clamped - km0) / (km1 - km0);
      return { x: x0 + t * (x1 - x0), y: y0 + t * (y1 - y0) };
    }
  }
  const last = WAYPOINTS[WAYPOINTS.length - 1];
  return { x: last[0], y: last[1] };
}

// ─── Trail segments ───────────────────────────────────────────────────────────

export interface TrailSegment {
  person: string;
  fromKm: number;
  toKm: number;
  color: string;
}

type EntryInput = { personName: string; distanceKm: number };
type MemberInput = { name: string; colorHex: string };

/**
 * asRan: segments follow chronological order of entries (shared odometer)
 * contribution: stacked per-person totals ordered by member list
 */
export function getTrailSegments(
  entries: EntryInput[],
  members: MemberInput[],
  mode: "asRan" | "contribution"
): TrailSegment[] {
  const colorMap = new Map(members.map((m) => [m.name, m.colorHex]));

  if (mode === "asRan") {
    const segs: TrailSegment[] = [];
    let cursor = 0;
    for (const e of entries) {
      const from = cursor;
      const to = cursor + e.distanceKm;
      segs.push({ person: e.personName, fromKm: from, toKm: to, color: colorMap.get(e.personName) ?? "#888" });
      cursor = to;
    }
    return segs;
  }

  // contribution mode: sum per-person, then stack in member order
  const totals = new Map<string, number>();
  for (const e of entries) {
    totals.set(e.personName, (totals.get(e.personName) ?? 0) + e.distanceKm);
  }

  const segs: TrailSegment[] = [];
  let cursor = 0;
  for (const m of members) {
    const km = totals.get(m.name) ?? 0;
    if (km > 0) {
      segs.push({ person: m.name, fromKm: cursor, toKm: cursor + km, color: m.colorHex });
      cursor += km;
    }
  }
  return segs;
}
