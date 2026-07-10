import { useState } from "react";
import WeekdayPicker from "./WeekdayPicker.js";
import {
  useCreateSchedule,
  useUpdateSchedule,
  useDeleteSchedule,
} from "../api/hooks.js";
import type { ScheduleItemResponse, CreateScheduleRequest, UpdateScheduleRequest } from "@timebank/shared";

interface EditorProps {
  existing: ScheduleItemResponse | null;
  onClose: () => void;
}

type ScheduleColor = "learn" | "play" | "chore" | "other";

const COLORS: { value: ScheduleColor; label: string; bg: string; soft: string }[] = [
  { value: "learn", label: "学习", bg: "var(--learn)", soft: "var(--learn-soft)" },
  { value: "play", label: "娱乐", bg: "var(--primary)", soft: "var(--primary-soft)" },
  { value: "chore", label: "家务", bg: "var(--chore)", soft: "var(--chore-soft)" },
  { value: "other", label: "其它", bg: "var(--read)", soft: "var(--read-soft)" },
];

export default function ScheduleEditor({ existing, onClose }: EditorProps) {
  const createMut = useCreateSchedule();
  const updateMut = useUpdateSchedule();
  const deleteMut = useDeleteSchedule();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(existing?.weekdays ?? []);
  const [startTime, setStartTime] = useState(existing?.startTime ?? "16:00");
  const [endTime, setEndTime] = useState(existing?.endTime ?? "17:00");
  const [color, setColor] = useState<ScheduleColor>((existing?.color as ScheduleColor) ?? "other");
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState("");

  const saving = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const validate = (): string | null => {
    if (!title.trim()) return "请输入标题";
    if (weekdays.length === 0) return "至少选择一天";
    if (startTime >= endTime) return "结束时间必须晚于开始时间";
    return null;
  };

  const buildBody = (): CreateScheduleRequest => ({
    title: title.trim(),
    weekdays,
    startTime,
    endTime,
    color,
    note: note.trim(),
  });

  const onSave = async () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError("");
    try {
      if (existing) {
        const body: UpdateScheduleRequest = buildBody();
        await updateMut.mutateAsync({ id: existing.id, ...body });
      } else {
        await createMut.mutateAsync(buildBody());
      }
      onClose();
    } catch (e) {
      setError((e as Error).message || "保存失败");
    }
  };

  const onDelete = async () => {
    if (!existing) return;
    try {
      await deleteMut.mutateAsync(existing.id);
      onClose();
    } catch (e) {
      setError((e as Error).message || "删除失败");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(58, 46, 39, 0.4)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in"
        style={{
          background: "var(--surface)",
          width: "100%",
          maxWidth: 480,
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          padding: 24,
          paddingBottom: 32,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 500, marginBottom: 20 }}>
          {existing ? "编辑日程" : "新建日程"}
        </h3>

        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: "var(--muted)", display: "block", marginBottom: 6 }}>标题</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="如：阅读、钢琴课"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--primary-soft)",
              background: "var(--bg)",
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />
        </label>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: "var(--muted)", display: "block", marginBottom: 6 }}>重复</span>
          <WeekdayPicker selected={weekdays} onChange={setWeekdays} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: "var(--muted)", display: "block", marginBottom: 6 }}>时间</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--primary-soft)",
                background: "var(--bg)",
                fontSize: 16,
              }}
            />
            <span style={{ color: "var(--muted)" }}>至</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--primary-soft)",
                background: "var(--bg)",
                fontSize: 16,
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: "var(--muted)", display: "block", marginBottom: 6 }}>颜色</span>
          <div style={{ display: "flex", gap: 12 }}>
            {COLORS.map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => setColor(c.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: color === c.value ? c.soft : "var(--bg)",
                  border: color === c.value ? `2px solid ${c.bg}` : "2px solid transparent",
                  fontSize: 14,
                }}
              >
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: c.bg }} />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "block", marginBottom: 20 }}>
          <span style={{ fontSize: 14, color: "var(--muted)", display: "block", marginBottom: 6 }}>备注（可选）</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：带乐谱"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--primary-soft)",
              background: "var(--bg)",
              fontSize: 16,
              boxSizing: "border-box",
            }}
          />
        </label>

        {error && (
          <div style={{ color: "var(--danger)", fontSize: 14, marginBottom: 12, textAlign: "center" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          {existing && (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              style={{
                padding: "14px 20px",
                borderRadius: "var(--radius-md)",
                background: "var(--danger-soft)",
                color: "var(--danger)",
                fontSize: 16,
                fontWeight: 500,
              }}
            >
              删除
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "14px 20px",
              borderRadius: "var(--radius-md)",
              background: "var(--bg)",
              color: "var(--ink)",
              fontSize: 16,
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{
              padding: "14px 24px",
              borderRadius: "var(--radius-md)",
              background: "var(--primary)",
              color: "white",
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
