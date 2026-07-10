import { describe, it, expect } from "vitest";
import {
  scheduleSchema,
  createScheduleRequestSchema,
} from "../src/schedule.js";
import {
  schedulesForWeekday,
  sortByTime,
  isOverdueByMinutes,
  weekdayLabel,
  colorLabel,
  weekBuckets,
  weekdaysShort,
} from "../src/schedule-logic.js";
import type { Schedule } from "../src/schedule.js";

const makeSchedule = (over: Partial<Schedule> = {}): Schedule => ({
  id: "s1",
  title: "阅读",
  weekdays: [1, 3, 5],
  startTime: "16:00",
  endTime: "17:00",
  color: "learn",
  note: "",
  enabled: true,
  createdAt: "2026-07-09T10:00:00+08:00",
  ...over,
});

describe("scheduleSchema", () => {
  it("parses a valid schedule", () => {
    expect(scheduleSchema.parse(makeSchedule())).toBeDefined();
  });

  it("rejects empty weekdays", () => {
    expect(() => scheduleSchema.parse(makeSchedule({ weekdays: [] }))).toThrow();
  });

  it("rejects weekday out of range", () => {
    expect(() => scheduleSchema.parse(makeSchedule({ weekdays: [0] }))).toThrow();
    expect(() => scheduleSchema.parse(makeSchedule({ weekdays: [8] }))).toThrow();
  });

  it("rejects invalid time format", () => {
    expect(() => scheduleSchema.parse(makeSchedule({ startTime: "25:00" }))).toThrow();
    expect(() => scheduleSchema.parse(makeSchedule({ startTime: "9:00" }))).toThrow();
  });

  it("rejects empty title", () => {
    expect(() => scheduleSchema.parse(makeSchedule({ title: "" }))).toThrow();
  });

  it("rejects endTime <= startTime", () => {
    expect(() => scheduleSchema.parse(makeSchedule({ startTime: "16:00", endTime: "16:00" }))).toThrow();
    expect(() => scheduleSchema.parse(makeSchedule({ startTime: "17:00", endTime: "16:00" }))).toThrow();
  });
});

describe("createScheduleRequestSchema", () => {
  it("parses a valid create request", () => {
    const r = createScheduleRequestSchema.parse({
      title: "钢琴课",
      weekdays: [6],
      startTime: "09:00",
      endTime: "10:30",
      color: "other",
    });
    expect(r.note).toBe(""); // default
  });

  it("rejects missing weekdays", () => {
    expect(() =>
      createScheduleRequestSchema.parse({
        title: "test",
        weekdays: [],
        startTime: "09:00",
        endTime: "10:00",
        color: "other",
      })
    ).toThrow();
  });

  it("rejects endTime <= startTime", () => {
    expect(() =>
      createScheduleRequestSchema.parse({
        title: "test",
        weekdays: [1],
        startTime: "10:00",
        endTime: "10:00",
        color: "other",
      })
    ).toThrow();
  });
});

describe("schedule-logic", () => {
  it("schedulesForWeekday filters by weekday and enabled", () => {
    const list = [
      makeSchedule({ id: "a", weekdays: [1, 3], enabled: true }),
      makeSchedule({ id: "b", weekdays: [1], enabled: false }),
      makeSchedule({ id: "c", weekdays: [2], enabled: true }),
    ];
    const result = schedulesForWeekday(list, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("sortByTime sorts by startTime ascending", () => {
    const list = [
      makeSchedule({ id: "a", startTime: "18:00" }),
      makeSchedule({ id: "b", startTime: "09:00" }),
      makeSchedule({ id: "c", startTime: "16:00" }),
    ];
    const sorted = sortByTime(list);
    expect(sorted.map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("isOverdueByMinutes works correctly", () => {
    expect(isOverdueByMinutes({ endTime: "09:00" }, 600)).toBe(true);
    expect(isOverdueByMinutes({ endTime: "16:00" }, 600)).toBe(false);
  });

  it("weekdayLabel returns correct Chinese", () => {
    expect(weekdayLabel(1)).toBe("一");
    expect(weekdayLabel(7)).toBe("日");
  });

  it("colorLabel returns correct Chinese", () => {
    expect(colorLabel("learn")).toBe("学习");
    expect(colorLabel("play")).toBe("娱乐");
    expect(colorLabel("chore")).toBe("家务");
    expect(colorLabel("other")).toBe("其它");
  });

  it("weekBuckets groups by weekday", () => {
    const list = [
      makeSchedule({ id: "a", weekdays: [1, 3] }),
      makeSchedule({ id: "b", weekdays: [6] }),
    ];
    const buckets = weekBuckets(list);
    expect(buckets).toHaveLength(7);
    expect(buckets[0].map((s) => s.id)).toEqual(["a"]); // Monday
    expect(buckets[2].map((s) => s.id)).toEqual(["a"]); // Wednesday
    expect(buckets[5].map((s) => s.id)).toEqual(["b"]); // Saturday
    expect(buckets[1]).toHaveLength(0); // Tuesday
  });

  it("weekBuckets excludes disabled", () => {
    const list = [makeSchedule({ id: "a", weekdays: [1], enabled: false })];
    const buckets = weekBuckets(list);
    expect(buckets[0]).toHaveLength(0);
  });

  it("weekdaysShort returns compact label", () => {
    expect(weekdaysShort([1, 3, 5])).toBe("一三五");
    expect(weekdaysShort([6, 7])).toBe("六日");
  });
});
