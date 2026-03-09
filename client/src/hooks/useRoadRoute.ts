import { useEffect, useMemo, useState } from "react";
import { ROUTE_TOTAL_KM } from "../config";
import {
  WAYPOINTS,
  buildDistanceWaypointsFromPath,
  type RouteWaypoint,
} from "../data/route";

interface UseRoadRouteResult {
  waypoints: RouteWaypoint[];
  routeTotalKm: number;
  isSnapped: boolean;
}

const CACHE_KEY = "expedition-road-route-v1";
const CHUNK_SIZE = 10;

function asAnchorPoints(): [number, number][] {
  return WAYPOINTS.map(([lat, lng]) => [lat, lng]);
}

function toChunkedLegs(points: [number, number][]): [number, number][][] {
  const chunks: [number, number][][] = [];
  for (let start = 0; start < points.length - 1; start += CHUNK_SIZE - 1) {
    const chunk = points.slice(start, Math.min(start + CHUNK_SIZE, points.length));
    if (chunk.length >= 2) {
      chunks.push(chunk);
    }
    if (start + CHUNK_SIZE >= points.length) {
      break;
    }
  }
  return chunks;
}

async function fetchRoadLeg(points: [number, number][]): Promise<[number, number][]> {
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false&continue_straight=true`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM request failed: ${res.status}`);
  }

  const json = await res.json() as {
    code?: string;
    routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
  };

  const coordinates = json.routes?.[0]?.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    throw new Error("OSRM route geometry missing");
  }

  return coordinates.map(([lng, lat]) => [lat, lng]);
}

function mergeLegs(legs: [number, number][][]): [number, number][] {
  const merged: [number, number][] = [];
  for (const leg of legs) {
    if (merged.length === 0) {
      merged.push(...leg);
      continue;
    }

    const startIndex = leg[0][0] === merged[merged.length - 1][0] && leg[0][1] === merged[merged.length - 1][1] ? 1 : 0;
    merged.push(...leg.slice(startIndex));
  }
  return merged;
}

function loadCachedPath(): [number, number][] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as [number, number][];
    if (!Array.isArray(parsed) || parsed.length < 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeCachedPath(path: [number, number][]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(path));
  } catch {
    // no-op
  }
}

export function useRoadRoute(): UseRoadRouteResult {
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>(WAYPOINTS);
  const [isSnapped, setIsSnapped] = useState(false);

  useEffect(() => {
    let active = true;

    const cached = loadCachedPath();
    if (cached) {
      const cachedWaypoints = buildDistanceWaypointsFromPath(cached);
      if (cachedWaypoints.length >= 2) {
        setWaypoints(cachedWaypoints);
        setIsSnapped(true);
      }
      return;
    }

    const run = async () => {
      try {
        const anchors = asAnchorPoints();
        const legs = toChunkedLegs(anchors);
        const snappedLegs: [number, number][][] = [];

        for (const leg of legs) {
          const snapped = await fetchRoadLeg(leg);
          snappedLegs.push(snapped);
        }

        const path = mergeLegs(snappedLegs);
        const distanceWaypoints = buildDistanceWaypointsFromPath(path);
        if (!active || distanceWaypoints.length < 2) return;

        setWaypoints(distanceWaypoints);
        setIsSnapped(true);
        storeCachedPath(path);
      } catch {
        if (!active) return;
        setWaypoints(WAYPOINTS);
        setIsSnapped(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  const routeTotalKm = useMemo(() => {
    if (waypoints.length === 0) return ROUTE_TOTAL_KM;
    return waypoints[waypoints.length - 1][2] || ROUTE_TOTAL_KM;
  }, [waypoints]);

  return { waypoints, routeTotalKm, isSnapped };
}
