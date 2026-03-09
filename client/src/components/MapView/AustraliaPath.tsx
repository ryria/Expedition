import { WAYPOINTS } from "../../data/route";

export function AustraliaPath() {
  const d = WAYPOINTS.map(([x, y], i) =>
    `${i === 0 ? "M" : "L"}${x},${y}`
  ).join(" ") + " Z";

  return (
    <path
      d={d}
      fill="#d4b96a"
      stroke="#2c1a0e"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  );
}
