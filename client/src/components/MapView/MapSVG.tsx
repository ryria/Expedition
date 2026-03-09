import { useRef, useState, useCallback } from "react";
import { AustraliaPath } from "./AustraliaPath";
import { TrailsLayer } from "./TrailsLayer";
import { LandmarksLayer } from "./LandmarksLayer";
import { MilestonesLayer } from "./MilestonesLayer";
import { CompassRose } from "./CompassRose";
import type { TrailSegment } from "../../data/route";

interface Props {
  segments: TrailSegment[];
  totalKm: number;
}

export function MapSVG({ segments, totalKm }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.5, Math.min(6, z - e.deltaY * 0.001)));
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan((p) => ({
      x: p.x + (e.clientX - lastPos.current.x),
      y: p.y + (e.clientY - lastPos.current.y),
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { dragging.current = false; };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1100 720"
      className="map-svg"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ cursor: dragging.current ? "grabbing" : "grab" }}
    >
      <defs>
        <filter id="paper-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blend" />
        </filter>
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(30,15,0,0.45)" />
        </radialGradient>
      </defs>

      <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
        {/* Parchment background */}
        <rect width="1100" height="720" fill="#e8d5a3" filter="url(#paper-grain)" />
        {/* Sea colour */}
        <rect width="1100" height="720" fill="#b8d4e8" opacity={0.35} />

        <AustraliaPath />
        <TrailsLayer segments={segments} totalKm={totalKm} />
        <MilestonesLayer />
        <LandmarksLayer totalKm={totalKm} />
        <CompassRose />

        {/* Cartouche */}
        <text x={960} y={55} textAnchor="middle" fontFamily="'IM Fell English', serif"
          fontSize="20" fill="#2c1a0e" fontStyle="italic">
          The Expedition
        </text>
        <text x={960} y={75} textAnchor="middle" fontFamily="'IM Fell English', serif"
          fontSize="11" fill="#2c1a0e" opacity={0.7}>
          Circumnavigation of Australia · 14,500 km
        </text>
      </g>

      {/* Vignette overlay */}
      <rect width="1100" height="720" fill="url(#vignette)" style={{ pointerEvents: "none" }} />
    </svg>
  );
}
