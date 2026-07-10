/** 最小日程形状，兼容 Schedule 和 API 响应中的松散 color 类型 */
type ScheduleLike = {
  id: string;
  enabled: boolean;
  weekdays: number[];
  startTime: string;
  endTime: string;
  color: string;
  title: string;
  note: string;
};

/** 获取某星期的日程（1=周一 ... 7=周日），仅含已启用项 */
export function schedulesForWeekday<T extends ScheduleLike>(
  schedules: ReadonlyArray<T>,
  weekday: number
): T[] {
  return schedules.filter((s) => s.enabled && s.weekdays.includes(weekday));
}

/** 按 startTime 排序 */
export function sortByTime<T extends { startTime: string }>(
  items: ReadonlyArray<T>
): T[] {
  return [...items].sort((a, b) =>
    a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0
  );
}

/**
 * 判断日程项是否"已过时"（endTime 已过当前时间）。
 * nowMin 为当前时间在当天内的分钟数（0-1439）。
 */
export function isOverdueByMinutes(
  item: { endTime: string },
  nowMin: number
): boolean {
  const [h, m] = item.endTime.split(":").map(Number);
  return h * 60 + m < nowMin;
}

/** 周几转中文标签 */
export function weekdayLabel(w: number): string {
  return ["", "一", "二", "三", "四", "五", "六", "日"][w] ?? String(w);
}

/** 颜色标签转中文 */
export function colorLabel(c: string): string {
  const map: Record<string, string> = {
    learn: "学习",
    play: "娱乐",
    chore: "家务",
    other: "其它",
  };
  return map[c] ?? c;
}

/** 获取本周一到周日的日程汇总，返回 7 个数组 */
export function weekBuckets<T extends ScheduleLike>(
  schedules: ReadonlyArray<T>
): T[][] {
  const buckets: T[][] = Array.from({ length: 7 }, () => []);
  for (const s of schedules) {
    if (!s.enabled) continue;
    for (const w of s.weekdays) {
      if (w >= 1 && w <= 7) buckets[w - 1].push(s);
    }
  }
  return buckets.map((b) => sortByTime(b));
}

/** weekdays 数组转中文短标签，如 [1,3,5] → "一三五" */
export function weekdaysShort(weekdays: ReadonlyArray<number>): string {
  return weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((w) => weekdayLabel(w))
    .join("");
}
