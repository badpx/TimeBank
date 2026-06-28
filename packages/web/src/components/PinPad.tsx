import { useState, useEffect } from "react";

export default function PinPad({
  onSubmit,
  onBack,
  shaking,
}: {
  onSubmit: (pin: string) => void;
  onBack: () => void;
  shaking: boolean;
}) {
  const [pin, setPin] = useState("");

  // 错误反馈（抖动）出现时，清空已输入，方便重新输入
  useEffect(() => {
    if (shaking) setPin("");
  }, [shaking]);

  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      // 自动提交，稍延迟以便显示最后一位
      setTimeout(() => onSubmit(next), 120);
    }
  };

  const del = () => setPin((p) => p.slice(0, -1));

  return (
    <div className={shaking ? "shake" : ""} style={{ textAlign: "center" }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", margin: "32px 0" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: pin.length > i ? "var(--primary)" : "var(--primary-soft)",
              transition: "background 0.15s",
            }}
          />
        ))}
      </div>
      {shaking && (
        <p style={{ color: "var(--danger)", marginBottom: 16 }}>好像不对哦，再试一次</p>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          maxWidth: 320,
          margin: "0 auto",
        }}
      >
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            style={{
              height: 72,
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              boxShadow: "var(--shadow)",
              fontSize: 28,
              fontWeight: 500,
            }}
          >
            {d}
          </button>
        ))}
        <button
          onClick={onBack}
          style={{
            height: 72,
            borderRadius: "var(--radius-md)",
            background: "transparent",
            color: "var(--muted)",
            fontSize: 16,
          }}
        >
          返回
        </button>
        <button
          onClick={() => press("0")}
          style={{
            height: 72,
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            boxShadow: "var(--shadow)",
            fontSize: 28,
            fontWeight: 500,
          }}
        >
          0
        </button>
        <button
          onClick={del}
          style={{
            height: 72,
            borderRadius: "var(--radius-md)",
            background: "transparent",
            color: "var(--muted)",
            fontSize: 24,
          }}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
