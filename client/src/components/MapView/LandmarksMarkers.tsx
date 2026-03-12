import { CircleMarker, Popup } from "react-leaflet";
import { LANDMARKS } from "../../data/route";

interface Props { totalKm: number; }

export function LandmarksMarkers({ totalKm }: Props) {
  const nextLandmark = LANDMARKS.find((landmark) => landmark.km > totalKm) ?? null;

  return (
    <>
      {LANDMARKS.map((lm, i) => {
        const reached = totalKm >= lm.km;
        const isNext = nextLandmark != null && nextLandmark.km === lm.km;
        return (
          <CircleMarker
            key={i}
            center={[lm.lat, lm.lng]}
            radius={isNext ? 7 : reached ? 5 : 4}
            pathOptions={{
              color: isNext ? "#F59E0B" : reached ? "#2563EB" : "#64748B",
              fillColor: isNext ? "#F59E0B" : reached ? "#2563EB" : "transparent",
              fillOpacity: isNext ? 0.92 : reached ? 0.85 : 0,
              weight: isNext ? 2.2 : 1.5,
            }}
          >
            <Popup className="landmark-popup">
              <strong>{lm.name}</strong> — {lm.km.toLocaleString()} km
              <p>{lm.fact}</p>
              <span>
                {isNext
                  ? `${(lm.km - totalKm).toFixed(0)} km to next landmark`
                  : reached
                    ? "✓ Reached"
                    : `${(lm.km - totalKm).toFixed(0)} km ahead`}
              </span>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
