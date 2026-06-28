import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLoginChildren, useLogin } from "../api/hooks.js";
import AvatarGrid from "../components/AvatarGrid.js";
import PinPad from "../components/PinPad.js";

export default function LoginPage() {
  const { data, isLoading } = useLoginChildren();
  const login = useLogin();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState(false);

  if (isLoading) {
    return <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>加载中…</div>;
  }

  const children = data?.children ?? [];

  if (selected) {
    return (
      <div style={{ padding: 24, maxWidth: 420, margin: "0 auto" }}>
        <PinPad
          shaking={error}
          onSubmit={async (pin) => {
            try {
              setError(false);
              await login.mutateAsync({ childId: selected, pin });
              navigate("/");
            } catch {
              setError(true);
            }
          }}
          onBack={() => {
            setSelected(null);
            setError(false);
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", fontSize: 24, fontWeight: 500, marginBottom: 8 }}>
        时间银行
      </h1>
      <p style={{ textAlign: "center", color: "var(--muted)", marginBottom: 32 }}>
        选你的头像，开始吧
      </p>
      <AvatarGrid
        children={children}
        onSelect={(id) => {
          setSelected(id);
          setError(false);
        }}
      />
    </div>
  );
}
