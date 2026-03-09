// Clockwise from Sydney.
// Format: [lat, lng, cumulativeKm]
export const WAYPOINTS: [number, number, number][] = [
  [-33.87, 151.21, 0],       // Sydney
  [-33.42, 151.34, 60],
  [-32.93, 151.77, 130],     // Newcastle area
  [-32.17, 152.53, 200],
  [-31.43, 152.91, 280],     // Port Macquarie area
  [-30.30, 153.11, 1340],    // Coffs Harbour → Brisbane gap
  [-28.65, 153.62, 1440],    // Byron Bay
  [-27.93, 153.44, 1540],
  [-27.47, 153.02, 1680],    // Brisbane
  [-26.65, 153.06, 1850],    // Sunshine Coast
  [-25.28, 152.84, 2060],    // Hervey Bay
  [-24.40, 151.90, 2120],
  [-23.38, 150.51, 2220],    // Rockhampton area
  [-22.57, 150.76, 2330],
  [-21.14, 149.19, 2470],    // Mackay
  [-19.98, 148.16, 2620],
  [-19.26, 146.82, 2730],    // Townsville
  [-18.29, 146.05, 2880],
  [-17.73, 146.03, 3060],
  [-16.92, 145.78, 3170],    // Cairns
  [-15.77, 145.37, 3200],
  [-14.68, 144.89, 3340],
  [-13.82, 143.60, 3500],
  [-12.65, 143.49, 3660],    // Cape York tip area
  [-11.64, 141.85, 3820],
  [-12.67, 141.87, 4020],    // Weipa area (rounding Gulf)
  [-13.82, 136.42, 4230],    // Gulf country
  [-13.00, 134.04, 4450],
  [-12.46, 130.85, 4700],    // Darwin
  [-14.05, 129.55, 4880],
  [-15.77, 128.74, 5060],    // Kununurra area
  [-17.32, 123.67, 5240],
  [-17.96, 122.24, 5440],    // Broome
  [-20.31, 118.58, 6060],    // Port Hedland
  [-21.93, 114.12, 6220],    // Exmouth
  [-24.88, 113.65, 6380],    // Carnarvon area
  [-26.56, 113.75, 6720],    // Shark Bay
  [-28.78, 114.61, 6870],    // Geraldton
  [-29.69, 115.00, 7020],
  [-31.95, 115.86, 7200],    // Perth
  [-32.53, 115.74, 8080],    // Mandurah
  [-33.33, 115.64, 8250],    // Bunbury
  [-34.32, 115.16, 8430],    // Augusta / Cape Leeuwin
  [-35.03, 117.88, 8640],    // Albany
  [-33.86, 121.89, 8860],    // Esperance
  [-32.48, 124.87, 9060],
  [-31.68, 128.88, 9260],    // Eucla
  [-31.47, 130.22, 9460],
  [-31.70, 132.08, 9680],
  [-32.13, 133.66, 9900],    // Ceduna
  [-32.49, 136.88, 10120],   // Port Augusta area
  [-34.72, 135.86, 10380],   // Yorke Peninsula
  [-35.12, 137.58, 10600],
  [-34.93, 138.60, 10810],   // Adelaide
  [-35.56, 138.10, 11240],
  [-37.16, 139.75, 11410],   // Robe
  [-38.05, 140.70, 11550],
  [-38.35, 141.60, 12100],   // Portland
  [-38.38, 142.49, 12180],   // Warrnambool
  [-38.48, 143.57, 12280],
  [-37.81, 144.97, 12440],   // Melbourne
  [-38.10, 147.07, 12690],   // Sale area
  [-37.81, 148.74, 12820],
  [-37.07, 149.91, 12940],   // Eden
  [-36.55, 150.18, 13100],
  [-35.36, 150.47, 13280],   // Ulladulla
  [-34.42, 150.89, 13480],   // Wollongong
  [-33.87, 151.21, 14500],   // Sydney (end)
];

export interface Landmark {
  name: string;
  km: number;
  fact: string;
  lat: number;
  lng: number;
}

export const LANDMARKS: Landmark[] = [
  { name: "Sydney", km: 0, fact: "Where the journey begins. The Harbour Bridge and Opera House mark the start line.", lat: -33.87, lng: 151.21 },
  { name: "Brisbane", km: 1680, fact: "Queensland's capital. Gateway to the Great Barrier Reef and the tropical north.", lat: -27.47, lng: 153.02 },
  { name: "Cairns", km: 3170, fact: "Tropical gateway to the Reef. Cassowaries roam the rainforest just behind the esplanade.", lat: -16.92, lng: 145.78 },
  { name: "Darwin", km: 4700, fact: "NT capital. Crocodiles in every waterway. Monsoonal lightning storms roll in each afternoon during the Wet.", lat: -12.46, lng: 130.85 },
  { name: "Broome", km: 5440, fact: "Famous for the Staircase to the Moon — full moon reflecting on tidal flats. Red pindan cliffs, turquoise sea.", lat: -17.96, lng: 122.24 },
  { name: "Geraldton", km: 6870, fact: "The wreck of the Dutch vessel Batavia (1629) lies offshore — a story of mutiny and survival.", lat: -28.78, lng: 114.61 },
  { name: "Perth", km: 7200, fact: "The most isolated major city on Earth. Closer to Singapore than to Sydney. Indian Ocean sunsets.", lat: -31.95, lng: 115.86 },
  { name: "Albany", km: 8640, fact: "Australia's last whaling station closed here in 1978. Now a whale-watching mecca for Southern Rights and Humpbacks.", lat: -35.03, lng: 117.88 },
  { name: "Eucla", km: 9460, fact: "Population 50. The Nullarbor Plain. The world's longest straight road — 146 km without a bend.", lat: -31.68, lng: 128.88 },
  { name: "Adelaide", km: 10810, fact: "City of Churches. The Barossa and McLaren Vale begin at the city's edge.", lat: -34.93, lng: 138.60 },
  { name: "Melbourne", km: 12440, fact: "Australia's cultural capital. Laneways, coffee, street art. Claims most liveable city regularly.", lat: -37.81, lng: 144.97 },
  { name: "Eden", km: 12940, fact: "Orcas and Humpbacks interact in Twofold Bay. The final stretch home begins.", lat: -37.07, lng: 149.91 },
  { name: "Sydney", km: 14500, fact: "Journey complete.", lat: -33.87, lng: 151.21 },
];

// ─── Interpolation ────────────────────────────────────────────────────────────

export function interpolatePosition(km: number): { lat: number; lng: number } {
  const clamped = Math.max(0, Math.min(km, 14_500));
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const [lat0, lng0, km0] = WAYPOINTS[i - 1];
    const [lat1, lng1, km1] = WAYPOINTS[i];
    if (clamped <= km1) {
      const t = km1 === km0 ? 0 : (clamped - km0) / (km1 - km0);
      return { lat: lat0 + t * (lat1 - lat0), lng: lng0 + t * (lng1 - lng0) };
    }
  }
  const last = WAYPOINTS[WAYPOINTS.length - 1];
  return { lat: last[0], lng: last[1] };
}

// ─── Trail segments ───────────────────────────────────────────────────────────

export interface TrailSegment {
  person: string;
  fromKm: number;
  toKm: number;
  color: string;
  date?: Date;
}

type EntryInput = { personName: string; distanceKm: number; timestamp?: { toDate(): Date } };
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
      const date = e.timestamp == null ? undefined : "toDate" in e.timestamp ? e.timestamp.toDate() : e.timestamp;
      segs.push({ person: e.personName, fromKm: from, toKm: to, color: colorMap.get(e.personName) ?? "#888", date });
      cursor = to;
    }
    return segs;
  }

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

// ─── LatLng path helpers ──────────────────────────────────────────────────────

/** Build an array of [lat, lng] pairs for a segment from fromKm to toKm */
export function buildSegmentLatLngs(fromKm: number, toKm: number): [number, number][] {
  if (toKm <= fromKm) return [];

  const from = interpolatePosition(fromKm);
  const to = interpolatePosition(toKm);
  const midWaypoints = WAYPOINTS.filter(([, , km]) => km > fromKm && km < toKm);

  return [
    [from.lat, from.lng],
    ...midWaypoints.map(([lat, lng]): [number, number] => [lat, lng]),
    [to.lat, to.lng],
  ];
}
