interface HistoryItemView {
  id: string;
  timestamp: string;
  recordType: "task_checkin" | "entertainment_redeem";
  taskName: string;
  entertainmentMinutes: number;
  balanceAfter: number;
}

export default function HistoryList({ records }: { records: HistoryItemView[] }) {
  if (records.length === 0) {
    return (
      <div
        className="card"
        style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}
      >
        还没有记录哦
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {records.map((r) => {
        const isCheckin = r.recordType === "task_checkin";
        const sign = r.entertainmentMinutes > 0 ? "+" : "";
        return (
          <div
            key={r.id}
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>
                {isCheckin ? r.taskName || "打卡" : "兑换娱乐时间"}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {formatTime(r.timestamp)}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: isCheckin ? "var(--read)" : "var(--learn)",
                }}
              >
                {sign}
                {r.entertainmentMinutes}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                余额 {r.balanceAfter}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
