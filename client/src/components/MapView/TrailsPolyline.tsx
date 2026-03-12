import { CircleMarker, Polyline, Tooltip } from "react-leaflet";
import { buildSegmentLatLngs, interpolatePositionOnRoute, type RouteWaypoint, type TrailSegment } from "../../data/route";

interface Props {
  segments: TrailSegment[];
  totalKm: number;
  waypoints: RouteWaypoint[];
}

function getActivityPathOptions(seg: TrailSegment) {
  const activity = seg.activityType?.toLowerCase();

  if (activity === "walk") {
    return { color: seg.color, weight: 3, opacity: 0.95 };
  }

  if (activity === "run") {
    return { color: seg.color, weight: 3.5, opacity: 0.98, dashArray: "6 4" };
  }

  if (activity === "ride" || activity === "cycle") {
    return { color: seg.color, weight: 5, opacity: 0.95 };
  }

  if (activity === "row") {
    return { color: seg.color, weight: 3.5, opacity: 0.95, dashArray: "14 8" };
  }

  if (activity === "swim") {
    return { color: seg.color, weight: 3, opacity: 0.9, dashArray: "2 8" };
  }

  return { color: seg.color, weight: 3, opacity: 0.95 };
}

export function TrailsPolyline({ segments, totalKm, waypoints }: Props) {
  const fullRoute = waypoints.map(([lat, lng]): [number, number] => [lat, lng]);

  if (fullRoute.length < 2 && totalKm <= 0) return null;

  return (
    <>
      {fullRoute.length >= 2 && (
        <Polyline
          key="route-guide"
          positions={fullRoute}
          pathOptions={{ color: "#64748B", weight: 3, opacity: 0.35 }}
        />
      )}
      {segments.map((seg, i) => {
        const positions = buildSegmentLatLngs(seg.fromKm, seg.toKm, waypoints);
        if (positions.length < 2) return null;
        return (
          <Polyline key={`bloom-${i}`} positions={positions} pathOptions={{ color: seg.color, weight: 11, opacity: 0.28 }} />
        );
      })}
      {segments.map((seg, i) => {
        const positions = buildSegmentLatLngs(seg.fromKm, seg.toKm, waypoints);
        if (positions.length < 2) return null;
        const pathOptions = getActivityPathOptions(seg);
        const distKm = (seg.toKm - seg.fromKm).toFixed(1);
        const dateStr = seg.date
          ? seg.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
          : null;
        return (
          <Polyline key={`core-${i}`} positions={positions} pathOptions={pathOptions}>
            <Tooltip sticky>
              <strong>{seg.person}</strong>
              <br />
              {distKm} km
              {dateStr && <><br />{dateStr}</>}
            </Tooltip>
          </Polyline>
        );
      })}
      {totalKm > 0 && waypoints.length > 1 && (() => {
        const frontier = interpolatePositionOnRoute(totalKm, waypoints);
        return (
          <>
            <CircleMarker
              center={[frontier.lat, frontier.lng]}
              radius={15}
              pathOptions={{
                color: "#2DD4BF",
                fillColor: "#2DD4BF",
                fillOpacity: 0.22,
                weight: 1,
                className: "frontier-pulse",
              }}
            />
            <CircleMarker
              center={[frontier.lat, frontier.lng]}
              radius={7}
              pathOptions={{
                color: "#14B8A6",
                fillColor: "#14B8A6",
                fillOpacity: 0.95,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <strong>Current frontier</strong>
                <br />
                {totalKm.toFixed(1)} km logged
              </Tooltip>
            </CircleMarker>
          </>
        );
      })()}
    </>
  );
}
