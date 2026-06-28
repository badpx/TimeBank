import { useState, useEffect, useRef } from "react";

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
  // 用 ref 保存最新 pin，供键盘事件处理器读取，避免闭包过期
  const pinRef = useRef("");

  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  // 错误反馈（抖动）出现时，清空已输入，方便重新输入
  useEffect(() => {
    if (shaking) setPin("");
  }, [shaking]);

  const press = (d: string) => {
    const cur = pinRef.current;
    if (cur.length >= 4) return;
    const next = cur + d;
    setPin(next);
    pinRef.current = next;
    if (next.length === 4) {
      // 自动提交，稍延迟以便显示最后一位
      setTimeout(() => onSubmit(next), 120);
    }
  };

  const del = () => {
    setPin((p) => {
      const next = p.slice(0, -1);
      pinRef.current = next;
      return next;
    });
  };

  // 键盘输入支持：数字键输入、Backspace 删除、Escape 返回
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        press(e.key);
      } else if (e.key === "Backspace") {
        del();
      } else if (e.key === "Escape") {
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // press/del/onBack 通过 ref 读取最新状态，无需放入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
