import { interpolatePosition } from "../../data/route";

export function MilestonesLayer() {
  const milestones = Array.from({ length: 9 }, (_, i) => (i + 1) * 1450);
  return (
    <g className="milestones-layer">
      {milestones.map((km) => {
        const { x, y } = interpolatePosition(km);
        return (
          <g key={km}>
            <circle cx={x} cy={y} r={4} fill="#8b6914" opacity={0.7} />
            <text x={x + 6} y={y + 3} fontSize="8" fontFamily="'IM Fell English', serif" fill="#8b6914" opacity={0.8}>
              {((km / 14500) * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </g>
  );
}
