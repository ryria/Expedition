import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLiveTable, type LiveTable } from "./useLiveTable";
import * as connection from "../spacetime/connection";

type Row = { id: number };

describe("useLiveTable", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("retries with exponential backoff and attaches when connection recovers", () => {
    const onInitialRows = vi.fn();
    const onInsert = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();

    const table: LiveTable<Row> = {
      [Symbol.iterator]: function* iterator() {
        yield { id: 1 };
      },
      onInsert: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
      removeOnInsert: vi.fn(),
      removeOnUpdate: vi.fn(),
      removeOnDelete: vi.fn(),
    };

    const getConnectionSpy = vi.spyOn(connection, "getConnection");
    getConnectionSpy
      .mockImplementationOnce(() => {
        throw new Error("not connected");
      })
      .mockImplementationOnce(() => {
        throw new Error("not connected");
      })
      .mockImplementation(() => ({}) as ReturnType<typeof connection.getConnection>);

    renderHook(() =>
      useLiveTable<Row, LiveTable<Row>>({
        getTable: () => table,
        onInitialRows,
        onInsert,
        onUpdate,
        onDelete,
        retryDelayMs: 100,
        maxRetryDelayMs: 1000,
      }),
    );

    expect(getConnectionSpy).toHaveBeenCalledTimes(1);
    expect(onInitialRows).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(getConnectionSpy).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(200);
    expect(getConnectionSpy).toHaveBeenCalledTimes(3);

    expect(onInitialRows).toHaveBeenCalledWith([{ id: 1 }]);
    expect(table.onInsert).toHaveBeenCalledWith(onInsert);
  });
});
