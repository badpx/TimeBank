import { describe, it, expect } from "vitest";
import {
  recordSchema,
  recordToCsvFields,
  csvFieldsToRecord,
  CSV_COLUMNS,
} from "../src/record.js";

const validCheckin = {
  id: "r1",
  requestId: "q1",
  timestamp: "2026-06-28T18:00:00+08:00",
  childId: "alice",
  recordType: "task_checkin" as const,
  taskId: "read",
  taskName: "阅读",
  taskMinutes: 30,
  entertainmentMinutes: 15,
  note: "",
};

const validRedeem = {
  id: "r2",
  requestId: "q2",
  timestamp: "2026-06-28T19:00:00+08:00",
  childId: "alice",
  recordType: "entertainment_redeem" as const,
  taskId: "",
  taskName: "",
  taskMinutes: null,
  entertainmentMinutes: -30,
  note: "",
};

describe("recordSchema", () => {
  it("parses a valid checkin", () => {
    expect(recordSchema.parse(validCheckin)).toBeDefined();
  });

  it("parses a valid redeem with null taskMinutes", () => {
    const r = recordSchema.parse(validRedeem);
    expect(r.taskMinutes).toBeNull();
  });

  it("rejects wrong recordType", () => {
    expect(() =>
      recordSchema.parse({ ...validCheckin, recordType: "bogus" })
    ).toThrow();
  });

  it("rejects timestamp without offset", () => {
    expect(() =>
      recordSchema.parse({ ...validCheckin, timestamp: "2026-06-28T18:00:00" })
    ).toThrow();
  });
});

describe("CSV round-trip", () => {
  it("round-trips a checkin record", () => {
    const fields = recordToCsvFields(validCheckin);
    expect(fields).toHaveLength(CSV_COLUMNS.length);
    const back = csvFieldsToRecord(fields);
    expect(back).toEqual(validCheckin);
  });

  it("round-trips a redeem record (empty task fields)", () => {
    const fields = recordToCsvFields(validRedeem);
    expect(fields[7]).toBe(""); // taskMinutes empty
    const back = csvFieldsToRecord(fields);
    expect(back).toEqual(validRedeem);
  });

  it("rejects wrong column count", () => {
    expect(() => csvFieldsToRecord(["a", "b"])).toThrow();
  });
});
