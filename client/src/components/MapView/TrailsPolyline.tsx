import { Polyline, Tooltip } from "react-leaflet";
import { buildSegmentLatLngs, type RouteWaypoint, type TrailSegment } from "../../data/route";

interface Props {
  segments: TrailSegment[];
  totalKm: number;
  waypoints: RouteWaypoint[];
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
          pathOptions={{ color: "#ffffff", weight: 2, opacity: 0.2 }}
        />
      )}
      {segments.map((seg, i) => {
        const positions = buildSegmentLatLngs(seg.fromKm, seg.toKm, waypoints);
        if (positions.length < 2) return null;
        return (
          <Polyline key={`bloom-${i}`} positions={positions} pathOptions={{ color: seg.color, weight: 10, opacity: 0.25 }} />
        );
      })}
      {segments.map((seg, i) => {
        const positions = buildSegmentLatLngs(seg.fromKm, seg.toKm, waypoints);
        if (positions.length < 2) return null;
        const distKm = (seg.toKm - seg.fromKm).toFixed(1);
        const dateStr = seg.date
          ? seg.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
          : null;
        return (
          <Polyline key={`core-${i}`} positions={positions} pathOptions={{ color: seg.color, weight: 3, opacity: 0.95 }}>
            <Tooltip sticky>
              <strong>{seg.person}</strong>
              <br />
              {distKm} km
              {dateStr && <><br />{dateStr}</>}
            </Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}
