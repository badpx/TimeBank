import { useEffect, useRef } from "react";
import type { ScheduleItemResponse } from "@timebank/shared";
import { weekdayLabel } from "@timebank/shared";

const COLOR_BG: Record<string, string> = {
  learn: "var(--learn-soft)",
  play: "var(--primary-soft)",
  chore: "var(--chore-soft)",
  other: "var(--read-soft)",
};
const COLOR_BORDER: Record<string, string> = {
  learn: "var(--learn)",
  play: "var(--primary)",
  chore: "var(--chore)",
  other: "var(--read)",
};
const COLOR_TEXT: Record<string, string> = {
  learn: "var(--learn)",
  play: "var(--primary)",
  chore: "var(--chore)",
  other: "var(--read)",
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DEFAULT_SCROLL_HOUR = 9;
const ROW_HEIGHT = 56;
const TIME_COL_WIDTH = 44;

export default function WeekCalendarGrid({
  schedules,
  todayWeekday,
  onItemClick,
}: {
  schedules: ReadonlyArray<ScheduleItemResponse>;
  todayWeekday: number;
  onItemClick: (item: ScheduleItemResponse) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = DEFAULT_SCROLL_HOUR * ROW_HEIGHT;
    }
  }, []);

  const enabled = schedules.filter((s) => s.enabled);

  const getCellItems = (day: number, hour: number) =>
    enabled.filter((s) => {
      const h = parseInt(s.startTime.split(":")[0], 10);
      return s.weekdays.includes(day) && h === hour;
    });

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* 表头：周几 */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--primary-soft)" }}>
        <div
          style={{
            width: TIME_COL_WIDTH,
            padding: "8px 0",
            textAlign: "center",
            fontSize: 11,
            color: "var(--muted)",
            flexShrink: 0,
          }}
        >
          时
        </div>
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const isToday = day === todayWeekday;
          return (
            <div
              key={day}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "8px 0",
                textAlign: "center",
                fontSize: 13,
                fontWeight: 500,
                color: isToday ? "var(--primary)" : "var(--ink)",
                borderLeft: "1px solid var(--primary-soft)",
                background: isToday ? "rgba(255, 138, 91, 0.06)" : "transparent",
              }}
            >
              {weekdayLabel(day)}
            </div>
          );
        })}
      </div>

      {/* 可滚动的时间网格 — 隐藏滚动条使其与表头宽度对齐 */}
      <div
        ref={scrollRef}
        style={{
          overflowY: "auto",
          maxHeight: 400,
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        className="hide-scrollbar"
      >
        {HOURS.map((hour) => (
          <div
            key={hour}
            style={{
              display: "flex",
              height: ROW_HEIGHT,
              borderBottom: "1px solid var(--primary-soft)",
            }}
          >
            <div
              style={{
                width: TIME_COL_WIDTH,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                paddingTop: 2,
                fontSize: 11,
                color: "var(--muted)",
                flexShrink: 0,
              }}
            >
              {hour.toString().padStart(2, "0")}:00
            </div>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const items = getCellItems(day, hour);
              const isToday = day === todayWeekday;
              return (
                <div
                  key={day}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderLeft: "1px solid var(--primary-soft)",
                    background: isToday ? "rgba(255, 138, 91, 0.04)" : "transparent",
                    padding: 2,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    overflow: "hidden",
                  }}
                >
                  {items.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => onItemClick(s)}
                      style={{
                        fontSize: 10,
                        padding: "3px 5px",
                        borderRadius: 4,
                        background: COLOR_BG[s.color] ?? "var(--primary-soft)",
                        borderLeft: `3px solid ${COLOR_BORDER[s.color] ?? "var(--primary)"}`,
                        color: COLOR_TEXT[s.color] ?? "var(--primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        lineHeight: 1.3,
                        textAlign: "left",
                        cursor: "pointer",
                        touchAction: "manipulation",
                      }}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
