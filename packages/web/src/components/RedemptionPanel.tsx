import { useState } from "react";
import { useRedemption, useRedeem } from "../api/hooks.js";

interface OptionView {
  minutes: number;
  available: boolean;
}

export default function RedemptionPanel({ onClose }: { onClose: () => void }) {
  const { data } = useRedemption();
  const redeem = useRedeem();
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const options: OptionView[] = data?.options ?? [];

  const onConfirm = async (minutes: number) => {
    setLoading(true);
    setError(false);
    try {
      await redeem.mutateAsync({ minutes });
      setDone(minutes);
      setTimeout(() => onClose(), 900);
    } catch {
      setError(true);
      setLoading(false);
    }
  };

  const busy = loading || done != null;

  return (
    <div
      onClick={busy ? undefined : onClose}
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
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 500, marginBottom: 8 }}>
          选择娱乐时长
        </h3>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 20px" }}>
          点击时长选中，再点右侧「确认」扣除
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {options.map((o) => {
            const isSelected = selected === o.minutes;
            const isDone = done === o.minutes;
            const showConfirm = isSelected && !isDone && !busy;
            return (
              <div
                key={o.minutes}
                onClick={() => {
                  if (!busy && o.available && !isDone) setSelected(o.minutes);
                }}
                style={{
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                  background: isDone
                    ? "var(--read)"
                    : isSelected
                    ? "var(--primary)"
                    : o.available
                    ? "var(--primary-soft)"
                    : "var(--bg)",
                  color: isDone || isSelected ? "white" : o.available ? "var(--ink)" : "var(--muted)",
                  fontSize: 18,
                  fontWeight: 500,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  cursor: !busy && o.available && !isDone ? "pointer" : "default",
                  touchAction: "manipulation",
                  opacity: !o.available && !isSelected ? 0.7 : 1,
                  border: isSelected && !isDone ? "2px solid var(--primary)" : "2px solid transparent",
                  boxSizing: "border-box",
                }}
              >
                <span>{o.minutes} 分钟</span>
                {isDone && <span style={{ fontSize: 14 }}>✓ 已兑换</span>}
                {showConfirm && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirm(o.minutes);
                    }}
                    disabled={loading}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--read)",
                      color: "white",
                      fontSize: 15,
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {loading ? "兑换中…" : "确认"}
                  </button>
                )}
                {!o.available && !isSelected && !isDone && (
                  <span style={{ fontSize: 13 }}>时间不够</span>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{ textAlign: "center", marginTop: 16, color: "var(--danger)", fontSize: 14 }}>
            兑换失败，请重试
          </div>
        )}

        {!busy && (
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              marginTop: 16,
              padding: "14px 0",
              borderRadius: "var(--radius-md)",
              background: "var(--danger-soft)",
              color: "var(--danger)",
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            取消
          </button>
        )}
      </div>
    </div>
  );
}
