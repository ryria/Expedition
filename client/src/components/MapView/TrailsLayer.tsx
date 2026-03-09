import { buildSegmentPath, type TrailSegment } from "../../data/route";

interface Props { segments: TrailSegment[]; totalKm: number; }

export function TrailsLayer({ segments, totalKm }: Props) {
  if (totalKm <= 0) return null;
  return (
    <g className="trails-layer">
      {segments.map((seg, i) => {
        const d = buildSegmentPath(seg.fromKm, seg.toKm);
        if (!d) return null;
        return (
          <g key={i}>
            <path d={d} stroke="#2c1a0e" strokeWidth="5" fill="none" strokeLinecap="round" opacity={0.3} />
            <path d={d} stroke={seg.color} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d={d} stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}
