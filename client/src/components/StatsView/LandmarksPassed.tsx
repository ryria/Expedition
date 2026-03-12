import { useActivityLog } from "../../hooks/useActivityLog";
import { useExpeditionRouteTemplate } from "../../hooks/useExpeditionRouteTemplate";

interface LandmarksPassedProps {
  activeExpeditionId?: bigint;
}

export function LandmarksPassed({ activeExpeditionId }: LandmarksPassedProps) {
  const { entries } = useActivityLog(activeExpeditionId);
  const routeTemplate = useExpeditionRouteTemplate(activeExpeditionId);
  const totalKm = entries.reduce((s, e) => s + e.distanceKm, 0);
  const passed = routeTemplate.landmarks.filter((l) => l.km <= totalKm && l.km > 0);
  if (!passed.length) return null;
  return (
    <div className="landmarks-passed">
      <h3>Landmarks Reached</h3>
      {passed.map((l) => (
        <div key={l.name + l.km} className="landmark-item">
          <strong>{l.name}</strong> <span className="km-badge">{l.km} km</span>
          <p>{l.fact}</p>
        </div>
      ))}
    </div>
  );
}
