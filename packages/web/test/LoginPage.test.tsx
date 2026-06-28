import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LoginPage from "../src/pages/LoginPage.js";

function withProviders(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={node} />
          <Route path="/login" element={node} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const fetchMock = vi.fn();
global.fetch = fetchMock as any;

beforeEach(() => {
  fetchMock.mockReset();
});

describe("LoginPage", () => {
  it("renders avatar cards from API", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        children: [
          { id: "alice", name: "小狐", avatar: "🦊" },
          { id: "bob", name: "小熊", avatar: "🐻" },
        ],
      }),
    });
    render(withProviders(<LoginPage />));
    await waitFor(() => expect(screen.getByText("小狐")).toBeInTheDocument());
    expect(screen.getByText("小熊")).toBeInTheDocument();
  });

  it("shows pin pad after selecting avatar and shakes on wrong pin", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        children: [{ id: "alice", name: "小狐", avatar: "🦊" }],
      }),
    });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { code: "invalid_credentials", message: "不对" } }) });

    render(withProviders(<LoginPage />));
    await waitFor(() => screen.getByText("小狐"));
    fireEvent.click(screen.getByText("小狐"));
    // PIN pad 出现
    await waitFor(() => screen.getByText("1"));
    // 输入 4 位错误 PIN
    fireEvent.click(screen.getByText("1"));
    fireEvent.click(screen.getByText("2"));
    fireEvent.click(screen.getByText("3"));
    fireEvent.click(screen.getByText("4"));
    await waitFor(() => expect(screen.getByText(/好像不对/)).toBeInTheDocument());
  });
});
