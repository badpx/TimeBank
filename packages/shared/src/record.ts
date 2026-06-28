import { z } from "zod";

export const recordTypeSchema = z.enum([
  "task_checkin",
  "entertainment_redeem",
]);
export type RecordType = z.infer<typeof recordTypeSchema>;

/**
 * 一条交易记录。对应 CSV 的一行。
 * 列顺序固定：id,request_id,timestamp,child_id,record_type,task_id,task_name,task_minutes,entertainment_minutes,note
 *
 * 注意：CSV 读写时，空字符串字段表示"无值"。
 * taskMinutes 在兑换行为空字符串；这里用 number | null 表示。
 */
export const recordSchema = z.object({
  id: z.string().min(1),
  requestId: z.string(), // 可为空字符串（家长修复行）
  timestamp: z.string().datetime({ offset: true }),
  childId: z.string().min(1),
  recordType: recordTypeSchema,
  taskId: z.string(), // 可为空
  taskName: z.string(), // 可为空
  taskMinutes: z.number().int().nonnegative().nullable(), // 兑换行为 null
  entertainmentMinutes: z.number().int(), // checkin 正 / redeem 负
  note: z.string(),
});

export type Record = z.infer<typeof recordSchema>;

/** CSV 表头（固定，列顺序不可变） */
export const CSV_HEADER =
  "id,request_id,timestamp,child_id,record_type,task_id,task_name,task_minutes,entertainment_minutes,note";

export const CSV_COLUMNS = [
  "id",
  "request_id",
  "timestamp",
  "child_id",
  "record_type",
  "task_id",
  "task_name",
  "task_minutes",
  "entertainment_minutes",
  "note",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** 将 Record 序列化为 CSV 行字段数组（顺序与 CSV_COLUMNS 一致） */
export function recordToCsvFields(r: Record): string[] {
  return [
    r.id,
    r.requestId,
    r.timestamp,
    r.childId,
    r.recordType,
    r.taskId,
    r.taskName,
    r.taskMinutes === null ? "" : String(r.taskMinutes),
    String(r.entertainmentMinutes),
    r.note,
  ];
}

/** 将 CSV 行字段数组解析为 Record。字段数必须等于 CSV_COLUMNS.length */
export function csvFieldsToRecord(fields: string[]): Record {
  if (fields.length !== CSV_COLUMNS.length) {
    throw new Error(
      `CSV 列数错误: 期望 ${CSV_COLUMNS.length}, 实际 ${fields.length}`
    );
  }
  const [
    id,
    requestId,
    timestamp,
    childId,
    recordType,
    taskId,
    taskName,
    taskMinutes,
    entertainmentMinutes,
    note,
  ] = fields;

  const parsed = recordSchema.parse({
    id,
    requestId: requestId ?? "",
    timestamp,
    childId,
    recordType,
    taskId: taskId ?? "",
    taskName: taskName ?? "",
    taskMinutes: taskMinutes === "" ? null : Number(taskMinutes),
    entertainmentMinutes: Number(entertainmentMinutes),
    note: note ?? "",
  });
  return parsed;
}
