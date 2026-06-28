import { useState } from "react";
import { Link } from "react-router-dom";
import { useHistory } from "../api/hooks.js";
import HistoryList from "../components/HistoryList.js";

export default function HistoryPage() {
  const [month, setMonth] = useState<string>("");
  const [type, setType] = useState<string>("all");
  const { data, isLoading } = useHistory(month || undefined, type);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, paddingBottom: 60 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link
          to="/"
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface)",
            color: "var(--muted)",
            boxShadow: "var(--shadow)",
            textDecoration: "none",
          }}
        >
          ← 返回
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>我的记录</h1>
      </header>

      <div
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, padding: 16 }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          月份
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--primary-soft)",
              background: "var(--bg)",
            }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          类型
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--primary-soft)",
              background: "var(--bg)",
            }}
          >
            <option value="all">全部</option>
            <option value="task_checkin">打卡</option>
            <option value="entertainment_redeem">兑换</option>
          </select>
        </label>
        {month && (
          <button
            onClick={() => setMonth("")}
            style={{ color: "var(--muted)", fontSize: 14 }}
          >
            清除
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>加载中…</div>
      ) : (
        <HistoryList records={data?.records ?? []} />
      )}
    </div>
  );
}
