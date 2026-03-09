export const ROUTE_TOTAL_KM = 14_500;

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
