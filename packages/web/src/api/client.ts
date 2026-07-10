import type {
  LoginChildrenResponse,
  SessionResponse,
  BalanceResponse,
  TasksResponse,
  RedemptionResponse,
  CheckinRequest,
  CheckinResponse,
  RedeemRequest,
  RedeemResponse,
  HistoryResponse,
  SchedulesResponse,
  TodaySchedulesResponse,
  ScheduleItemResponse,
  CreateScheduleRequest,
  UpdateScheduleRequest,
} from "@timebank/shared";

const BASE = "";

async function http<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...init,
  });
  if (!res.ok) {
    let code = "error";
    let message = "出错了，请重试";
    try {
      const body = await res.json();
      code = body?.error?.code ?? code;
      message = body?.error?.message ?? message;
    } catch {
      // 非 JSON 错误
      if (res.status === 401) message = "请先登录";
    }
    const err = new Error(message) as Error & { code: string; status: number };
    err.code = code;
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getLoginChildren: () => http<LoginChildrenResponse>("/api/config/login"),
  login: (childId: string, pin: string) =>
    http<SessionResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ childId, pin }),
    }),
  logout: () => http<void>("/api/auth/logout", { method: "POST" }),
  getSession: () => http<SessionResponse>("/api/session"),
  getBalance: () => http<BalanceResponse>("/api/me/balance"),
  getTasks: () => http<TasksResponse>("/api/me/tasks"),
  getRedemption: () => http<RedemptionResponse>("/api/me/redemption"),
  checkin: (body: CheckinRequest) =>
    http<CheckinResponse>("/api/me/checkin", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  redeem: (body: RedeemRequest) =>
    http<RedeemResponse>("/api/me/redeem", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getHistory: (params: { month?: string; type?: string }) => {
    const q = new URLSearchParams();
    if (params.month) q.set("month", params.month);
    if (params.type) q.set("type", params.type);
    return http<HistoryResponse>(`/api/me/history?${q.toString()}`);
  },
  getSchedules: () => http<SchedulesResponse>("/api/me/schedules"),
  getTodaySchedules: () => http<TodaySchedulesResponse>("/api/me/schedules/today"),
  createSchedule: (body: CreateScheduleRequest) =>
    http<ScheduleItemResponse>("/api/me/schedules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSchedule: (id: string, body: UpdateScheduleRequest) =>
    http<ScheduleItemResponse>(`/api/me/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteSchedule: (id: string) =>
    http<void>(`/api/me/schedules/${id}`, { method: "DELETE" }),
};
