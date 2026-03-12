import { useMemo } from "react";
import { useTable } from "spacetimedb/react";
import { tables } from "../spacetime/generated";
import { getRouteTemplate } from "../data/routeTemplates";

interface ExpeditionRow {
  id: bigint;
  routeTemplateKey: string | null;
}

export function useExpeditionRouteTemplate(activeExpeditionId?: bigint) {
  const [expeditionRows] = useTable(tables.expedition);

  return useMemo(() => {
    if (activeExpeditionId == null) return getRouteTemplate("classic_trail");

    const expedition = (expeditionRows as readonly ExpeditionRow[]).find(
      (row) => row.id === activeExpeditionId,
    );

    return getRouteTemplate(expedition?.routeTemplateKey);
  }, [activeExpeditionId, expeditionRows]);
}
