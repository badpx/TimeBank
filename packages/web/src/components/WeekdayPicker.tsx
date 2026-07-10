const DAYS = [
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
  { value: 7, label: "日" },
];

export default function WeekdayPicker({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (weekdays: number[]) => void;
}) {
  const toggle = (day: number) => {
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day));
    } else {
      onChange([...selected, day].sort((a, b) => a - b));
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {DAYS.map((d) => {
        const active = selected.includes(d.value);
        return (
          <button
            type="button"
            key={d.value}
            onClick={() => toggle(d.value)}
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-sm)",
              background: active ? "var(--primary)" : "var(--bg)",
              color: active ? "white" : "var(--muted)",
              fontSize: 16,
              fontWeight: 500,
              border: active ? "none" : "1px solid var(--primary-soft)",
            }}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
