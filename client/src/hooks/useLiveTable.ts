import { useEffect } from "react";
import { getConnection } from "../spacetime/connection";

type InsertCb<Row> = (ctx: unknown, row: Row) => void;
type UpdateCb<Row> = (ctx: unknown, oldRow: Row, newRow: Row) => void;
type DeleteCb<Row> = (ctx: unknown, row: Row) => void;

export interface LiveTable<Row> {
  [Symbol.iterator](): Iterator<Row>;
  onInsert(cb: InsertCb<Row>): void;
  onUpdate?(cb: UpdateCb<Row>): void;
  onDelete?(cb: DeleteCb<Row>): void;
  removeOnInsert(cb: InsertCb<Row>): void;
  removeOnUpdate?(cb: UpdateCb<Row>): void;
  removeOnDelete?(cb: DeleteCb<Row>): void;
}

interface UseLiveTableOptions<Row, Table extends LiveTable<Row>> {
  getTable: (conn: ReturnType<typeof getConnection>) => Table;
  onInitialRows: (rows: Row[]) => void;
  onInsert: InsertCb<Row>;
  onUpdate?: UpdateCb<Row>;
  onDelete?: DeleteCb<Row>;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
}

export function useLiveTable<Row, Table extends LiveTable<Row>>({
  getTable,
  onInitialRows,
  onInsert,
  onUpdate,
  onDelete,
  retryDelayMs = 250,
  maxRetryDelayMs = 4000,
}: UseLiveTableOptions<Row, Table>) {
  useEffect(() => {
    let disposed = false;
    let table: Table | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempts = 0;

    const attach = () => {
      if (disposed) return;

      let conn;
      try {
        conn = getConnection();
      } catch {
        const nextDelay = Math.min(maxRetryDelayMs, retryDelayMs * 2 ** retryAttempts);
        retryAttempts += 1;
        retryTimer = setTimeout(attach, nextDelay);
        return;
      }

      retryAttempts = 0;

      table = getTable(conn);
      onInitialRows([...table]);

      table.onInsert(onInsert);
      if (onUpdate && table.onUpdate) {
        table.onUpdate(onUpdate);
      }
      if (onDelete && table.onDelete) {
        table.onDelete(onDelete);
      }
    };

    attach();

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      table?.removeOnInsert(onInsert);
      if (onUpdate && table?.removeOnUpdate) {
        table.removeOnUpdate(onUpdate);
      }
      if (onDelete && table?.removeOnDelete) {
        table.removeOnDelete(onDelete);
      }
    };
  }, [getTable, onInitialRows, onInsert, onUpdate, onDelete, retryDelayMs, maxRetryDelayMs]);
}
