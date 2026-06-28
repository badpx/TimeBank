interface AvatarChild {
  id: string;
  name: string;
  avatar: string;
}

export default function AvatarGrid({
  children,
  onSelect,
}: {
  children: AvatarChild[];
  onSelect: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 16,
      }}
    >
      {children.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className="card fade-in"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: 24,
            minHeight: 160,
            justifyContent: "center",
            transition: "transform 0.15s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <span style={{ fontSize: 56 }}>{c.avatar}</span>
          <span style={{ fontSize: 18, fontWeight: 500 }}>{c.name}</span>
        </button>
      ))}
    </div>
  );
}
