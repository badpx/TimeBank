import { useState } from "react";
import { useRedemption, useRedeem } from "../api/hooks.js";

export default function RedemptionPanel({ onClose }: { onClose: () => void }) {
  const { data } = useRedemption();
  const redeem = useRedeem();
  const [loading, setLoading] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const options = data?.options ?? [];

  const onPick = async (minutes: number) => {
    setLoading(minutes);
    try {
      await redeem.mutateAsync({ minutes });
      setDone(minutes);
      setTimeout(() => onClose(), 1000);
    } catch {
      setLoading(null);
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
        }}
      >
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 500, marginBottom: 8 }}>玩多久？</h3>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 20px" }}>
          选一个时间，玩完记得回来扣掉哦
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {options.map((o) => {
            const isLoading = loading === o.minutes;
            const isDone = done === o.minutes;
            return (
              <button
                key={o.minutes}
                onClick={() => onPick(o.minutes)}
                disabled={!o.available || loading !== null}
                style={{
                  padding: "18px 20px",
                  borderRadius: "var(--radius-md)",
                  background: isDone
                    ? "var(--read)"
                    : o.available
                    ? "var(--primary-soft)"
                    : "var(--bg)",
                  color: isDone ? "white" : o.available ? "var(--ink)" : "var(--muted)",
                  fontSize: 18,
                  fontWeight: 500,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{o.minutes} 分钟</span>
                {isLoading && <span style={{ fontSize: 14 }}>…</span>}
                {isDone && <span style={{ fontSize: 14 }}>✓ 已兑换</span>}
                {!o.available && !isLoading && !isDone && (
                  <span style={{ fontSize: 13 }}>时间不够</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
