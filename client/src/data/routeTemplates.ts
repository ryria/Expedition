import type { Landmark, RouteWaypoint } from "./route";

export type RouteTemplateKey = "classic_trail" | "mountain_pass" | "coastline";

export interface ExpeditionRouteTemplate {
  key: RouteTemplateKey;
  name: string;
  description: string;
  waypoints: RouteWaypoint[];
  landmarks: Landmark[];
}

const US_COAST_TO_COAST_WAYPOINTS: RouteWaypoint[] = [
  [40.7128, -74.006, 0],
  [40.7357, -74.1724, 25],
  [41.4089, -75.6624, 260],
  [40.2732, -76.8867, 470],
  [40.4406, -79.9959, 700],
  [39.9612, -82.9988, 1120],
  [39.7684, -86.1581, 1440],
  [38.627, -90.1994, 1840],
  [39.0997, -94.5786, 2270],
  [39.7392, -104.9903, 3080],
  [41.1408, -104.8202, 3240],
  [40.7608, -111.891, 3830],
  [39.5296, -119.8138, 4380],
  [38.5816, -121.4944, 4550],
  [37.7749, -122.4194, 4700],
];

const US_COAST_TO_COAST_LANDMARKS: Landmark[] = [
  { name: "New York City", km: 0, fact: "Atlantic start by the Hudson and East River.", lat: 40.7128, lng: -74.006 },
  { name: "Pittsburgh", km: 700, fact: "Steel City at the Allegheny and Monongahela confluence.", lat: 40.4406, lng: -79.9959 },
  { name: "Indianapolis", km: 1440, fact: "Crossroads of America and home of the Indy 500.", lat: 39.7684, lng: -86.1581 },
  { name: "Kansas City", km: 2270, fact: "Famous jazz heritage and barbecue culture.", lat: 39.0997, lng: -94.5786 },
  { name: "Denver", km: 3080, fact: "Mile High City at the eastern edge of the Rockies.", lat: 39.7392, lng: -104.9903 },
  { name: "Salt Lake City", km: 3830, fact: "Gateway to Utah mountain ranges and desert basins.", lat: 40.7608, lng: -111.891 },
  { name: "Sacramento", km: 4550, fact: "California capital on the American River.", lat: 38.5816, lng: -121.4944 },
  { name: "San Francisco", km: 4700, fact: "Pacific finish at the Golden Gate.", lat: 37.7749, lng: -122.4194 },
];

const CAMINO_FRANCES_WAYPOINTS: RouteWaypoint[] = [
  [43.3183, -1.9812, 0],
  [42.8125, -1.6458, 75],
  [42.461, -2.4457, 165],
  [42.3439, -3.6969, 280],
  [42.5987, -5.5671, 430],
  [42.6056, -6.8108, 560],
  [42.8782, -8.5448, 760],
  [42.8806, -8.5449, 780],
];

const CAMINO_FRANCES_LANDMARKS: Landmark[] = [
  { name: "Saint-Jean-Pied-de-Port", km: 0, fact: "Traditional French start before crossing the Pyrenees.", lat: 43.3183, lng: -1.9812 },
  { name: "Pamplona", km: 75, fact: "Historic city famous for San Fermín festival.", lat: 42.8125, lng: -1.6458 },
  { name: "Logroño", km: 165, fact: "Heart of Rioja wine country.", lat: 42.461, lng: -2.4457 },
  { name: "Burgos", km: 280, fact: "Gothic cathedral city and major Camino waypoint.", lat: 42.3439, lng: -3.6969 },
  { name: "León", km: 430, fact: "Known for stained glass in Santa María de León.", lat: 42.5987, lng: -5.5671 },
  { name: "Ponferrada", km: 560, fact: "Templar castle marks the Bierzo region.", lat: 42.5464, lng: -6.5962 },
  { name: "Santiago de Compostela", km: 780, fact: "Pilgrimage finish at the cathedral square.", lat: 42.8806, lng: -8.5449 },
];

const TOUR_DU_MONT_BLANC_WAYPOINTS: RouteWaypoint[] = [
  [45.9237, 6.8694, 0],
  [45.8786, 6.8871, 15],
  [45.9232, 7.0115, 35],
  [45.8281, 6.9702, 58],
  [45.9158, 6.8638, 76],
  [45.9399, 7.0562, 97],
  [45.9395, 7.1025, 118],
  [45.8943, 6.806, 145],
  [45.9762, 7.0866, 170],
];

const TOUR_DU_MONT_BLANC_LANDMARKS: Landmark[] = [
  { name: "Les Houches", km: 0, fact: "Classic start just southwest of Chamonix valley.", lat: 45.9237, lng: 6.8694 },
  { name: "Les Contamines", km: 15, fact: "Village entry before climbing to high cols.", lat: 45.8234, lng: 6.7265 },
  { name: "Courmayeur", km: 76, fact: "Italian side town at the foot of Mont Blanc.", lat: 45.7833, lng: 6.9667 },
  { name: "La Fouly", km: 118, fact: "Swiss alpine village in Val Ferret.", lat: 45.9395, lng: 7.1025 },
  { name: "Trient", km: 145, fact: "Known for pink church and nearby glacier views.", lat: 46.057, lng: 7.003 },
  { name: "Les Houches", km: 170, fact: "Loop complete around the Mont Blanc massif.", lat: 45.9237, lng: 6.8694 },
];

export const ROUTE_TEMPLATES: ExpeditionRouteTemplate[] = [
  {
    key: "classic_trail",
    name: "US Coast to Coast",
    description: "East-to-west route from New York City to San Francisco with major cross-country milestones.",
    waypoints: US_COAST_TO_COAST_WAYPOINTS,
    landmarks: US_COAST_TO_COAST_LANDMARKS,
  },
  {
    key: "mountain_pass",
    name: "Camino Francés",
    description: "Pilgrimage route across northern Spain from Saint-Jean-Pied-de-Port to Santiago.",
    waypoints: CAMINO_FRANCES_WAYPOINTS,
    landmarks: CAMINO_FRANCES_LANDMARKS,
  },
  {
    key: "coastline",
    name: "Tour du Mont Blanc",
    description: "Iconic alpine circuit through France, Italy, and Switzerland around Mont Blanc.",
    waypoints: TOUR_DU_MONT_BLANC_WAYPOINTS,
    landmarks: TOUR_DU_MONT_BLANC_LANDMARKS,
  },
];

export function getRouteTemplate(templateKey: string | null | undefined): ExpeditionRouteTemplate {
  return ROUTE_TEMPLATES.find((template) => template.key === templateKey) ?? ROUTE_TEMPLATES[0];
}
