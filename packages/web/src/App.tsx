import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./api/hooks.js";
import LoginPage from "./pages/LoginPage.js";
import HomePage from "./pages/HomePage.js";
import HistoryPage from "./pages/HistoryPage.js";

export default function App() {
  const { data, isLoading } = useSession();
  const loggedIn = !!data;

  if (isLoading) {
    return <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>加载中…</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={loggedIn ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/" element={loggedIn ? <HomePage /> : <Navigate to="/login" replace />} />
      <Route path="/history" element={loggedIn ? <HistoryPage /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
