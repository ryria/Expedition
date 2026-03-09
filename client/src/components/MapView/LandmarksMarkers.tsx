import { CircleMarker, Popup } from "react-leaflet";
import { LANDMARKS } from "../../data/route";

interface Props { totalKm: number; }

export function LandmarksMarkers({ totalKm }: Props) {
  return (
    <>
      {LANDMARKS.map((lm, i) => {
        const reached = totalKm >= lm.km;
        return (
          <CircleMarker
            key={i}
            center={[lm.lat, lm.lng]}
            radius={reached ? 5 : 4}
            pathOptions={{
              color: reached ? "#ffffff" : "#555",
              fillColor: reached ? "#ffffff" : "transparent",
              fillOpacity: reached ? 0.9 : 0,
              weight: 1.5,
            }}
          >
            <Popup className="landmark-popup">
              <strong>{lm.name}</strong> — {lm.km.toLocaleString()} km
              <p>{lm.fact}</p>
              <span>{reached ? "✓ Reached" : `${(lm.km - totalKm).toFixed(0)} km ahead`}</span>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
