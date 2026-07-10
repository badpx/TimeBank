import { z } from "zod";

/** 公开：登录页所需的孩子头像列表（不含 PIN） */
export const loginChildrenResponseSchema = z.object({
  children: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      avatar: z.string(),
    })
  ),
});

export const loginRequestSchema = z.object({
  childId: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/),
});

export const sessionResponseSchema = z.object({
  childId: z.string(),
  name: z.string(),
  avatar: z.string(),
});

export const balanceResponseSchema = z.object({
  balanceMinutes: z.number().int(),
});

export const taskStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  taskMinutes: z.number().int(),
  rewardMinutes: z.number().int(),
  todayCount: z.number().int(),
  limit: z.number().int(),
  remaining: z.number().int(),
  canCheckin: z.boolean(),
});

export const tasksResponseSchema = z.object({
  tasks: z.array(taskStateSchema),
});

export const redemptionOptionStateSchema = z.object({
  minutes: z.number().int(),
  available: z.boolean(),
});

export const redemptionResponseSchema = z.object({
  options: z.array(redemptionOptionStateSchema),
});

export const checkinRequestSchema = z.object({
  taskId: z.string().min(1),
  requestId: z.string().min(1),
});

export const checkinResponseSchema = z.object({
  balanceMinutes: z.number().int(),
  taskState: taskStateSchema,
  encouragement: z.string(),
});

export const redeemRequestSchema = z.object({
  minutes: z.number().int().positive(),
  requestId: z.string().min(1),
});

export const redeemResponseSchema = z.object({
  balanceMinutes: z.number().int(),
});

export const historyQuerySchema = z.object({
  month: z.string().optional(),
  type: z.enum(["all", "task_checkin", "entertainment_redeem"]).optional(),
});

export const historyItemSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  recordType: z.enum(["task_checkin", "entertainment_redeem"]),
  taskName: z.string(),
  taskMinutes: z.number().int().nullable(),
  entertainmentMinutes: z.number().int(),
  balanceAfter: z.number().int(),
  note: z.string(),
});

export const historyResponseSchema = z.object({
  records: z.array(historyItemSchema),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type LoginChildrenResponse = z.infer<typeof loginChildrenResponseSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type BalanceResponse = z.infer<typeof balanceResponseSchema>;
export type TaskState = z.infer<typeof taskStateSchema>;
export type TasksResponse = z.infer<typeof tasksResponseSchema>;
export type RedemptionResponse = z.infer<typeof redemptionResponseSchema>;
export type CheckinRequest = z.infer<typeof checkinRequestSchema>;
export type CheckinResponse = z.infer<typeof checkinResponseSchema>;
export type RedeemRequest = z.infer<typeof redeemRequestSchema>;
export type RedeemResponse = z.infer<typeof redeemResponseSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// ── 日程管理 ──

export const scheduleItemResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  weekdays: z.array(z.number().int()),
  startTime: z.string(),
  endTime: z.string(),
  color: z.string(),
  note: z.string(),
  enabled: z.boolean(),
  createdAt: z.string(),
});

export const schedulesResponseSchema = z.object({
  schedules: z.array(scheduleItemResponseSchema),
});

/** 今日日程项（含是否已过时） */
export const todayScheduleItemSchema = scheduleItemResponseSchema.extend({
  isOverdue: z.boolean(),
});

export const todaySchedulesResponseSchema = z.object({
  items: z.array(todayScheduleItemSchema),
  date: z.string(),
  weekday: z.number().int(),
});

export type ScheduleItemResponse = z.infer<typeof scheduleItemResponseSchema>;
export type SchedulesResponse = z.infer<typeof schedulesResponseSchema>;
export type TodayScheduleItem = z.infer<typeof todayScheduleItemSchema>;
export type TodaySchedulesResponse = z.infer<typeof todaySchedulesResponseSchema>;
