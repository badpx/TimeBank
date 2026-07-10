import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useTodaySchedules,
  useSchedules,
} from "../api/hooks.js";
import {
  weekdayLabel,
  type TodayScheduleItem,
  type ScheduleItemResponse,
} from "@timebank/shared";
import ScheduleEditor from "../components/ScheduleEditor.js";
import WeekCalendarGrid from "../components/WeekCalendarGrid.js";

const COLOR_DOT: Record<string, string> = {
  learn: "var(--learn)",
  play: "var(--primary)",
  chore: "var(--chore)",
  other: "var(--read)",
};

export default function SchedulePage() {
  const { data: todayData, isLoading: todayLoading } = useTodaySchedules();
  const { data: allData, isLoading: allLoading } = useSchedules();
  const [editing, setEditing] = useState<ScheduleItemResponse | null>(null);
  const [creating, setCreating] = useState(false);

  const todayItems = todayData?.items ?? [];
  const allSchedules = allData?.schedules ?? [];
  const todayWeekday = todayData?.weekday ?? 0;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Link
          to="/"
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface)",
            color: "var(--muted)",
            boxShadow: "var(--shadow)",
            textDecoration: "none",
          }}
        >
          ← 返回
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, flex: 1 }}>我的日程</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{
            padding: "8px 20px",
            borderRadius: "var(--radius-sm)",
            background: "var(--primary)",
            color: "white",
            fontSize: 16,
            fontWeight: 500,
            boxShadow: "var(--shadow)",
          }}
        >
          + 新建
        </button>
      </header>

      {/* 周计划日历 */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 16, color: "var(--muted)", margin: "0 4px 12px" }}>本周计划</h2>
        {allLoading ? (
          <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>加载中…</div>
        ) : (
          <WeekCalendarGrid
            schedules={allSchedules}
            todayWeekday={todayWeekday}
            onItemClick={(item) => setEditing(item)}
          />
        )}
      </section>

      {/* 今日计划（底部） */}
      <section>
        <h2 style={{ fontSize: 16, color: "var(--muted)", margin: "0 4px 12px" }}>
          今天 · 周{todayWeekday ? weekdayLabel(todayWeekday) : ""}
        </h2>
        {todayLoading ? (
          <div className="card" style={{ textAlign: "center", color: "var(--muted)" }}>加载中…</div>
        ) : todayItems.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
            今天没有日程，自由安排吧
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {todayItems.map((item) => (
              <TodayItemRow
                key={item.id}
                item={item}
                onEdit={() => setEditing(item)}
              />
            ))}
          </div>
        )}
      </section>

      {(creating || editing) && (
        <ScheduleEditor
          existing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TodayItemRow({
  item,
  onEdit,
}: {
  item: TodayScheduleItem;
  onEdit: () => void;
}) {
  const dotColor = COLOR_DOT[item.color] ?? "var(--primary)";
  return (
    <button
      type="button"
      className="card"
      onClick={onEdit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 16,
        textAlign: "left",
        opacity: item.isOverdue ? 0.6 : 1,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 500 }}>
          <span style={{ color: "var(--muted)", marginRight: 8 }}>
            {item.startTime}–{item.endTime}
          </span>
          {item.title}
        </div>
        {item.note && <div style={{ fontSize: 13, color: "var(--muted)" }}>{item.note}</div>}
      </div>
      {item.isOverdue && (
        <span style={{ fontSize: 13, color: "var(--muted)" }}>已结束</span>
      )}
    </button>
  );
}
