import confetti from "canvas-confetti";

export default function Confetti({ text }: { text: string }) {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#ff8a5b", "#7bd88f", "#6fb1fc", "#f2c14e"],
  });
  return (
    <div
      style={{
        position: "fixed",
        top: "30%",
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 32px",
        boxShadow: "var(--shadow)",
        fontSize: 22,
        fontWeight: 500,
        color: "var(--primary)",
        zIndex: 60,
        animation: "fadeIn 0.3s",
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}
