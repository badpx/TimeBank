import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession, useLogout, useBalance, useTasks, useCheckin } from "../api/hooks.js";
import BalanceCard from "../components/BalanceCard.js";
import TaskCard from "../components/TaskCard.js";
import TaskConfirmSheet from "../components/TaskConfirmSheet.js";
import RedemptionPanel from "../components/RedemptionPanel.js";
import Confetti from "../components/Confetti.js";

interface TaskView {
  id: string;
  name: string;
  category: string;
  taskMinutes: number;
  rewardMinutes: number;
  todayCount: number;
  limit: number;
  remaining: number;
  canCheckin: boolean;
}

export default function HomePage() {
  const { data: session } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const { data: balance } = useBalance();
  const { data: tasks } = useTasks();
  const checkin = useCheckin();
  const [confirmTask, setConfirmTask] = useState<null | {
    id: string;
    name: string;
    category: string;
    taskMinutes: number;
    rewardMinutes: number;
  }>(null);
  const [showRedeem, setShowRedeem] = useState(false);
  const [encouragement, setEncouragement] = useState<string | null>(null);

  const onLogout = async () => {
    await logout.mutateAsync();
    navigate("/login");
  };

  const grouped = groupByCategory(tasks?.tasks ?? []);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, paddingBottom: 100 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 36 }}>{session?.avatar}</span>
          <span style={{ fontSize: 18, fontWeight: 500 }}>{session?.name}</span>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface)",
            color: "var(--muted)",
            boxShadow: "var(--shadow)",
          }}
        >
          退出
        </button>
      </header>

      <BalanceCard minutes={balance?.balanceMinutes ?? 0} />

      <div style={{ display: "flex", gap: 12, marginTop: 16, marginBottom: 24 }}>
        <button
          onClick={() => setShowRedeem(true)}
          style={{
            flex: 1,
            padding: "16px 0",
            borderRadius: "var(--radius-md)",
            background: "var(--primary)",
            color: "white",
            fontSize: 17,
            fontWeight: 500,
            boxShadow: "var(--shadow)",
          }}
        >
          玩时间
        </button>
        <Link
          to="/history"
          style={{
            flex: 1,
            textAlign: "center",
            padding: "16px 0",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontWeight: 500,
            boxShadow: "var(--shadow)",
            textDecoration: "none",
          }}
        >
          看记录
        </Link>
      </div>

      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, color: "var(--muted)", margin: "12px 4px" }}>
            {categoryLabel(cat)}
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {list.map((t) => (
              <TaskCard key={t.id} task={t} onSelect={() => setConfirmTask(t)} />
            ))}
          </div>
        </section>
      ))}

      {confirmTask && (
        <TaskConfirmSheet
          task={confirmTask}
          loading={checkin.isPending}
          onCancel={() => setConfirmTask(null)}
          onConfirm={async () => {
            const res = await checkin.mutateAsync({ taskId: confirmTask.id });
            setConfirmTask(null);
            setEncouragement(res.encouragement);
            setTimeout(() => setEncouragement(null), 1800);
          }}
        />
      )}

      {showRedeem && (
        <RedemptionPanel
          onClose={() => setShowRedeem(false)}
        />
      )}

      {encouragement && <Confetti text={encouragement} />}
    </div>
  );
}

function groupByCategory(list: TaskView[]): Record<string, TaskView[]> {
  const out: Record<string, TaskView[]> = {};
  for (const t of list) {
    (out[t.category] ??= []).push(t);
  }
  return out;
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    learning: "学习",
    reading: "阅读",
    household: "家务",
  };
  return map[cat] ?? cat;
}
