import { LANDMARKS, WAYPOINTS, type Landmark, type RouteWaypoint } from "./route";

export type RouteTemplateKey = "classic_trail" | "mountain_pass" | "coastline";

export interface ExpeditionRouteTemplate {
  key: RouteTemplateKey;
  name: string;
  description: string;
  waypoints: RouteWaypoint[];
  landmarks: Landmark[];
}

function transformWaypoints(
  waypoints: RouteWaypoint[],
  latDelta: number,
  lngDelta: number,
  waveScale: number,
): RouteWaypoint[] {
  return waypoints.map(([lat, lng, km], index) => {
    const wave = Math.sin(index / 4) * waveScale;
    return [lat + latDelta + wave, lng + lngDelta - wave, km];
  });
}

function transformLandmarks(
  landmarks: Landmark[],
  latDelta: number,
  lngDelta: number,
  waveScale: number,
): Landmark[] {
  return landmarks.map((landmark, index) => {
    const wave = Math.sin(index / 2.5) * waveScale;
    return {
      ...landmark,
      lat: landmark.lat + latDelta + wave,
      lng: landmark.lng + lngDelta - wave,
    };
  });
}

const MOUNTAIN_PASS_WAYPOINTS = transformWaypoints(WAYPOINTS, 0.35, -1.15, 0.22);
const COASTLINE_WAYPOINTS = transformWaypoints(WAYPOINTS, -0.2, 0.95, 0.18);

const MOUNTAIN_PASS_LANDMARKS = transformLandmarks(LANDMARKS, 0.35, -1.15, 0.22);
const COASTLINE_LANDMARKS = transformLandmarks(LANDMARKS, -0.2, 0.95, 0.18);

export const ROUTE_TEMPLATES: ExpeditionRouteTemplate[] = [
  {
    key: "classic_trail",
    name: "Classic Trail",
    description: "Balanced loop with broad terrain variety across the full expedition route.",
    waypoints: WAYPOINTS,
    landmarks: LANDMARKS,
  },
  {
    key: "mountain_pass",
    name: "Mountain Pass",
    description: "Higher-elevation profile with inland detours and steeper route character.",
    waypoints: MOUNTAIN_PASS_WAYPOINTS,
    landmarks: MOUNTAIN_PASS_LANDMARKS,
  },
  {
    key: "coastline",
    name: "Coastline",
    description: "Ocean-hugging variant emphasizing coastal progression and shoreline milestones.",
    waypoints: COASTLINE_WAYPOINTS,
    landmarks: COASTLINE_LANDMARKS,
  },
];

export function getRouteTemplate(templateKey: string | null | undefined): ExpeditionRouteTemplate {
  return ROUTE_TEMPLATES.find((template) => template.key === templateKey) ?? ROUTE_TEMPLATES[0];
}
