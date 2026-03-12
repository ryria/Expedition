export const ROUTE_TOTAL_KM = 14_500;

export type DistanceUnit = "km" | "mi";
export const DISTANCE_UNIT_STORAGE_KEY = "expedition-distance-unit";
const KM_PER_MILE = 1.609344;

export function toDisplayDistance(distanceKm: number, unit: DistanceUnit): number {
  return unit === "mi" ? distanceKm / KM_PER_MILE : distanceKm;
}

export function toStoredDistance(distance: number, unit: DistanceUnit): number {
  return unit === "mi" ? distance * KM_PER_MILE : distance;
}

export function distanceUnitLabel(unit: DistanceUnit): "km" | "mi" {
  return unit;
}

export function formatDistance(distanceKm: number, unit: DistanceUnit, decimals = 1): string {
  return toDisplayDistance(distanceKm, unit).toFixed(decimals);
}

export const DEFAULT_COLORS = [
  "#8b2020", "#1a5c3a", "#1e3a6e",
  "#7c4a03", "#4b0082", "#005c5c",
];

export const ACTIVITY_TYPES = ["run", "row", "walk", "cycle"] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

export const STRAVA_CLIENT_ID = (import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined)?.trim() ?? "";

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  run: "🏃",
  row: "🚣",
  walk: "🚶",
  cycle: "🚴",
};
