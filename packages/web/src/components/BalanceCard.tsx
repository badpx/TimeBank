export default function BalanceCard({ minutes }: { minutes: number }) {
  const negative = minutes < 0;
  return (
    <div
      className="card"
      style={{
        background: negative
          ? "var(--danger-soft)"
          : "linear-gradient(135deg, var(--primary) 0%, #ffb088 100%)",
        color: "white",
        textAlign: "center",
        padding: "32px 20px",
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>我的时间余额</div>
      <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1 }}>
        {minutes}
        <span style={{ fontSize: 20, marginLeft: 4 }}>分钟</span>
      </div>
      {negative && (
        <div style={{ fontSize: 13, marginTop: 12, opacity: 0.9 }}>
          余额不足，暂时不能兑换哦
        </div>
      )}
    </div>
  );
}
