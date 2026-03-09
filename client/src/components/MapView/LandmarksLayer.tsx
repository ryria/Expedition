import { useState } from "react";
import { LANDMARKS } from "../../data/route";

interface Props { totalKm: number; }

export function LandmarksLayer({ totalKm }: Props) {
  const [hoverId, setHoverId] = useState<number | null>(null);

  return (
    <g className="landmarks-layer">
      {LANDMARKS.map((lm, i) => {
        const reached = totalKm >= lm.km;
        const hovered = hoverId === i;
        return (
          <g key={i}
            onMouseEnter={() => setHoverId(i)}
            onMouseLeave={() => setHoverId(null)}
            style={{ cursor: "pointer" }}>
            <circle cx={lm.svgX} cy={lm.svgY} r={5}
              fill={reached ? "#2c1a0e" : "none"}
              stroke="#2c1a0e" strokeWidth="1.5" />
            <text x={lm.svgX + 7} y={lm.svgY + 4}
              fontFamily="'IM Fell English', serif" fontSize="9" fill="#2c1a0e" opacity={0.8}>
              {lm.name}
            </text>
            {hovered && (
              <foreignObject x={lm.svgX + 10} y={lm.svgY - 55} width="200" height="80">
                <div className="landmark-tooltip">
                  <strong>{lm.name}</strong> — {lm.km} km
                  <p>{lm.fact}</p>
                  <span>{reached ? "✅ Reached" : `${(lm.km - totalKm).toFixed(0)} km ahead`}</span>
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
    </g>
  );
}
