export function CompassRose() {
  const r = 45;
  return (
    <g transform={`translate(75,640)`} opacity={0.7}>
      <circle r={r} fill="#e8d5a3" stroke="#2c1a0e" strokeWidth="1" />
      {[0, 90, 180, 270].map((deg, i) => {
        const rad = (deg - 90) * Math.PI / 180;
        const x1 = Math.cos(rad) * 8, y1 = Math.sin(rad) * 8;
        const x2 = Math.cos(rad) * (r - 4), y2 = Math.sin(rad) * (r - 4);
        const label = ["N", "E", "S", "W"][i];
        const lx = Math.cos(rad) * (r + 10), ly = Math.sin(rad) * (r + 10);
        return (
          <g key={deg}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2c1a0e" strokeWidth="1.5" />
            <text x={lx} y={ly + 3} textAnchor="middle" fontSize="10"
              fontFamily="'IM Fell English', serif" fill="#2c1a0e" fontWeight="bold">
              {label}
            </text>
          </g>
        );
      })}
      <circle r={4} fill="#8b2020" />
    </g>
  );
}
