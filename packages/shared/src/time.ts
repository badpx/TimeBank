/**
 * 时间工具：以服务器本地时区为权威。
 * 每日上限按本地日历日期聚合。
 */

/**
 * 将 ISO8601 时间戳转换为指定时区下的本地日历日期键 YYYY-MM-DD。
 * timezone 为空时取系统本地时区。
 *
 * 使用 en-CA 区域，其 ISO 日期格式天然输出 YYYY-MM-DD。
 */
export function localDateKey(
  isoTimestamp: string,
  timezone?: string
): string {
  const d = new Date(isoTimestamp);
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  if (timezone) opts.timeZone = timezone;
  // en-CA 输出形如 2026-06-28
  return new Intl.DateTimeFormat("en-CA", opts).format(d);
}

/** 当前时间的 ISO8601 带偏移字符串（服务端时区） */
export function nowIso(): string {
  return new Date().toISOString();
}

/** 当前时区的本地日期键 */
export function todayKey(timezone?: string): string {
  return localDateKey(nowIso(), timezone);
}

/**
 * 返回 YYYY-MM 月份键，用于历史筛选。
 */
export function monthKey(isoTimestamp: string, timezone?: string): string {
  const d = new Date(isoTimestamp);
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
  };
  if (timezone) opts.timeZone = timezone;
  const formatted = new Intl.DateTimeFormat("en-CA", opts).format(d);
  // en-CA 输出 2026-06，正好是 YYYY-MM
  return formatted;
}
