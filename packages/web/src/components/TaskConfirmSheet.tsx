interface TaskInfo {
  id: string;
  name: string;
  taskMinutes: number;
  rewardMinutes: number;
}

export default function TaskConfirmSheet({
  task,
  loading,
  onCancel,
  onConfirm,
}: {
  task: TaskInfo;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={onCancel}
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
        }}
      >
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 500, marginBottom: 16 }}>
          确认完成
        </h3>
        <div style={{ background: "var(--bg)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{task.name}</div>
          <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>
            需要 {task.taskMinutes} 分钟 · 完成后获得 {task.rewardMinutes} 分钟
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: "var(--radius-md)",
              background: "var(--bg)",
              color: "var(--ink)",
              fontSize: 16,
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: "var(--radius-md)",
              background: "var(--primary)",
              color: "white",
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            {loading ? "保存中…" : "完成打卡"}
          </button>
        </div>
      </div>
    </div>
  );
}
