interface TaskView {
  id: string;
  name: string;
  category: string;
  taskMinutes: number;
  rewardMinutes: number;
  todayCount: number;
  limit: number;
  remaining: number;
  canCheckin: boolean;
}

const CAT_COLOR: Record<string, { bg: string; dot: string }> = {
  learning: { bg: "var(--learn-soft)", dot: "var(--learn)" },
  reading: { bg: "var(--read-soft)", dot: "var(--read)" },
  household: { bg: "var(--chore-soft)", dot: "var(--chore)" },
};

export default function TaskCard({
  task,
  onSelect,
}: {
  task: TaskView;
  onSelect: () => void;
}) {
  const color = CAT_COLOR[task.category] ?? { bg: "var(--primary-soft)", dot: "var(--primary)" };
  return (
    <button
      onClick={onSelect}
      disabled={!task.canCheckin}
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        textAlign: "left",
        opacity: task.canCheckin ? 1 : 0.6,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: color.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: color.dot }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 500 }}>{task.name}</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          {task.taskMinutes > 0
            ? `${task.taskMinutes} 分钟 · 奖励 ${task.rewardMinutes} 分钟`
            : `完成一次 · 奖励 ${task.rewardMinutes} 分钟`}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>今日</div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>
          {task.todayCount}/{task.limit}
        </div>
      </div>
    </button>
  );
}
