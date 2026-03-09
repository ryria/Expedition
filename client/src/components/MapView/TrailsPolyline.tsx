import { Polyline, Tooltip } from "react-leaflet";
import { buildSegmentLatLngs, type TrailSegment } from "../../data/route";

interface Props {
  segments: TrailSegment[];
  totalKm: number;
}

export function TrailsPolyline({ segments, totalKm }: Props) {
  if (totalKm <= 0) return null;
  return (
    <>
      {segments.map((seg, i) => {
        const positions = buildSegmentLatLngs(seg.fromKm, seg.toKm);
        if (positions.length < 2) return null;
        return (
          <Polyline key={`bloom-${i}`} positions={positions} pathOptions={{ color: seg.color, weight: 10, opacity: 0.25 }} />
        );
      })}
      {segments.map((seg, i) => {
        const positions = buildSegmentLatLngs(seg.fromKm, seg.toKm);
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
