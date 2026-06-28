import { describe, it, expect } from "vitest";
import {
  deriveBalance,
  countToday,
  canCheckin,
  taskAppliesTo,
  availableRedemption,
  withRunningBalance,
  filterHistory,
  sortHistoryDesc,
} from "../src/logic.js";
import { localDateKey, monthKey } from "../src/time.js";
import type { Record } from "../src/record.js";
import type { TaskConfig } from "../src/config.js";

const TZ = "Asia/Shanghai";

const makeTask = (over: Partial<TaskConfig> = {}): TaskConfig => ({
  id: "read",
  name: "阅读",
  category: "reading",
  taskMinutes: 30,
  rewardMinutes: 15,
  childIds: ["*"],
  dailyLimit: 2,
  enabled: true,
  ...over,
});

const rec = (over: Partial<Record>): Record => ({
  id: "r",
  requestId: "",
  timestamp: "2026-06-28T12:00:00+08:00",
  childId: "alice",
  recordType: "task_checkin",
  taskId: "read",
  taskName: "阅读",
  taskMinutes: 30,
  entertainmentMinutes: 15,
  note: "",
  ...over,
});

describe("deriveBalance", () => {
  it("sums entertainmentMinutes", () => {
    const rs = [
      rec({ id: "1", entertainmentMinutes: 15 }),
      rec({ id: "2", entertainmentMinutes: -30 }),
      rec({ id: "3", entertainmentMinutes: 60 }),
    ];
    expect(deriveBalance(rs)).toBe(45);
  });

  it("returns 0 for empty", () => {
    expect(deriveBalance([])).toBe(0);
  });

  it("handles negative balance", () => {
    expect(deriveBalance([rec({ id: "1", entertainmentMinutes: -10 })])).toBe(-10);
  });
});

describe("countToday", () => {
  it("counts only today and matching child+task", () => {
    const today = new Date();
    const todayIso = today.toISOString();
    const rs = [
      rec({ id: "1", timestamp: todayIso, childId: "alice", taskId: "read" }),
      rec({ id: "2", timestamp: todayIso, childId: "alice", taskId: "read" }),
      rec({ id: "3", timestamp: todayIso, childId: "bob", taskId: "read" }),
      rec({
        id: "4",
        timestamp: "2020-01-01T00:00:00+08:00",
        childId: "alice",
        taskId: "read",
      }),
    ];
    expect(countToday(rs, "alice", "read", TZ)).toBe(2);
  });
});

describe("canCheckin / taskAppliesTo", () => {
  it("applies to all when childIds is ['*']", () => {
    expect(taskAppliesTo(makeTask(), "alice")).toBe(true);
    expect(taskAppliesTo(makeTask(), "bob")).toBe(true);
  });

  it("applies only to listed children", () => {
    const t = makeTask({ childIds: ["alice"] });
    expect(taskAppliesTo(t, "alice")).toBe(true);
    expect(taskAppliesTo(t, "bob")).toBe(false);
  });

  it("disabled task does not apply", () => {
    expect(taskAppliesTo(makeTask({ enabled: false }), "alice")).toBe(false);
  });

  it("canCheckin respects daily limit", () => {
    const t = makeTask({ dailyLimit: 2 });
    expect(canCheckin(t, "alice", 0)).toBe(true);
    expect(canCheckin(t, "alice", 1)).toBe(true);
    expect(canCheckin(t, "alice", 2)).toBe(false);
  });
});

describe("availableRedemption", () => {
  it("marks options available when balance sufficient", () => {
    const r = availableRedemption(45, [15, 30, 60]);
    expect(r).toEqual([
      { minutes: 15, available: true },
      { minutes: 30, available: true },
      { minutes: 60, available: false },
    ]);
  });

  it("all unavailable when balance negative", () => {
    const r = availableRedemption(-5, [15, 30]);
    expect(r.every((x) => !x.available)).toBe(true);
  });
});

describe("withRunningBalance", () => {
  it("accumulates in order", () => {
    const rs = [
      rec({ id: "1", entertainmentMinutes: 15 }),
      rec({ id: "2", entertainmentMinutes: -30 }),
      rec({ id: "3", entertainmentMinutes: 60 }),
    ];
    const out = withRunningBalance(rs);
    expect(out.map((x) => x.balanceAfter)).toEqual([15, -15, 45]);
  });
});

describe("filterHistory", () => {
  it("filters by type", () => {
    const rs = [
      rec({ id: "1", recordType: "task_checkin" }),
      rec({ id: "2", recordType: "entertainment_redeem", entertainmentMinutes: -15 }),
    ];
    expect(filterHistory(rs, { type: "task_checkin" }, TZ)).toHaveLength(1);
    expect(filterHistory(rs, { type: "all" }, TZ)).toHaveLength(2);
  });

  it("filters by month", () => {
    const rs = [
      rec({ id: "1", timestamp: "2026-06-28T12:00:00+08:00" }),
      rec({ id: "2", timestamp: "2026-05-28T12:00:00+08:00" }),
    ];
    expect(filterHistory(rs, { month: "2026-06" }, TZ)).toHaveLength(1);
  });
});

describe("sortHistoryDesc", () => {
  it("sorts newest first", () => {
    const rs = [
      rec({ id: "1", timestamp: "2026-06-28T12:00:00+08:00" }),
      rec({ id: "2", timestamp: "2026-06-29T12:00:00+08:00" }),
    ];
    const out = sortHistoryDesc(rs);
    expect(out[0].id).toBe("2");
  });
});

describe("time utils", () => {
  it("localDateKey uses timezone", () => {
    expect(localDateKey("2026-06-28T23:30:00+00:00", "Asia/Shanghai")).toBe("2026-06-29");
  });

  it("monthKey extracts YYYY-MM", () => {
    expect(monthKey("2026-06-28T12:00:00+08:00", "Asia/Shanghai")).toBe("2026-06");
  });
});
