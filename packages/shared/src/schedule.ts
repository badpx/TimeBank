import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeRangeRefine = {
  message: "结束时间必须晚于开始时间",
} as const;

/** 基础日程对象（不含 refine，用于 extend） */
const scheduleBase = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(64),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  color: z.enum(["learn", "play", "chore", "other"]).default("other"),
  note: z.string().max(200).default(""),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime({ offset: true }),
});

/** 日程项 schema（含时间范围校验） */
export const scheduleSchema = scheduleBase.refine(
  (s) => s.startTime < s.endTime,
  timeRangeRefine
);

export type Schedule = z.infer<typeof scheduleSchema>;

/** 创建日程请求 */
const createBase = z.object({
  title: z.string().min(1).max(64),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  color: z.enum(["learn", "play", "chore", "other"]),
  note: z.string().max(200).optional().default(""),
});

export const createScheduleRequestSchema = createBase.refine(
  (s) => s.startTime < s.endTime,
  timeRangeRefine
);

export type CreateScheduleRequest = z.infer<typeof createScheduleRequestSchema>;

/** 更新日程请求（含 enabled） */
export const updateScheduleRequestSchema = createBase
  .extend({
    enabled: z.boolean().optional(),
  })
  .refine((s) => s.startTime < s.endTime, timeRangeRefine);

export type UpdateScheduleRequest = z.infer<typeof updateScheduleRequestSchema>;
