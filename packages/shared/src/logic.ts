import type { TaskConfig } from "./config.js";
import type { Record } from "./record.js";
import { localDateKey, monthKey, todayKey } from "./time.js";

/** 余额 = 所有记录 entertainmentMinutes 之和 */
export function deriveBalance(records: ReadonlyArray<Record>): number {
  let sum = 0;
  for (const r of records) sum += r.entertainmentMinutes;
  return sum;
}

/** 统计某孩子某任务在本地日历"今日"已打卡次数 */
export function countToday(
  records: ReadonlyArray<Record>,
  childId: string,
  taskId: string,
  timezone?: string
): number {
  const today = todayKey(timezone);
  let n = 0;
  for (const r of records) {
    if (
      r.childId === childId &&
      r.recordType === "task_checkin" &&
      r.taskId === taskId &&
      localDateKey(r.timestamp, timezone) === today
    ) {
      n++;
    }
  }
  return n;
}

/** 任务是否适用于某孩子 */
export function taskAppliesTo(task: TaskConfig, childId: string): boolean {
  if (!task.enabled) return false;
  const ids = task.childIds as readonly string[];
  if (ids[0] === "*") return true;
  return ids.includes(childId);
}

/** 是否可打卡：已启用 + 适用 + 今日未超限 */
export function canCheckin(
  task: TaskConfig,
  childId: string,
  todayCount: number
): boolean {
  if (!taskAppliesTo(task, childId)) return false;
  return todayCount < task.dailyLimit;
}

/** 兑换选项可用性：余额 >= 0 且 >= 该额度 */
export function availableRedemption(
  balance: number,
  options: ReadonlyArray<number>
): { minutes: number; available: boolean }[] {
  return options.map((m) => ({
    minutes: m,
    available: balance >= 0 && balance >= m,
  }));
}

/** 随机鼓励语 */
export function pickEncouragement(
  encouragements: ReadonlyArray<string>
): string {
  if (encouragements.length === 0) return "做得好！";
  return encouragements[Math.floor(Math.random() * encouragements.length)];
}

/** 历史记录倒序 */
export function sortHistoryDesc(records: ReadonlyArray<Record>): Record[] {
  return [...records].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

/** 计算每条记录的累计余额（按时间正序累加）。返回数组与输入同序。 */
export function withRunningBalance(records: ReadonlyArray<Record>): {
  record: Record;
  balanceAfter: number;
}[] {
  let running = 0;
  return records.map((r) => {
    running += r.entertainmentMinutes;
    return { record: r, balanceAfter: running };
  });
}

/** 按月份与类型过滤历史 */
export function filterHistory(
  records: ReadonlyArray<Record>,
  opts: {
    month?: string;
    type?: "all" | "task_checkin" | "entertainment_redeem";
  },
  timezone?: string
): Record[] {
  return records.filter((r) => {
    if (opts.type && opts.type !== "all" && r.recordType !== opts.type)
      return false;
    if (opts.month && monthKey(r.timestamp, timezone) !== opts.month)
      return false;
    return true;
  });
}

/** 生成服务端记录 ID */
export function generateRecordId(): string {
  return crypto.randomUUID();
}

/** 生成客户端请求 ID（前端调用） */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
