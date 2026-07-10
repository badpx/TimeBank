import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client.js";
import { generateRequestId } from "@timebank/shared";

export const qk = {
  session: ["session"] as const,
  balance: ["balance"] as const,
  tasks: ["tasks"] as const,
  redemption: ["redemption"] as const,
  history: (month?: string, type?: string) => ["history", month ?? "all", type ?? "all"] as const,
  schedules: ["schedules"] as const,
  todaySchedules: ["schedules", "today"] as const,
};

export function useSession() {
  return useQuery({
    queryKey: qk.session,
    queryFn: api.getSession,
    retry: false,
  });
}

export function useLoginChildren() {
  return useQuery({
    queryKey: ["login-children"],
    queryFn: api.getLoginChildren,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, pin }: { childId: string; pin: string }) =>
      api.login(childId, pin),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.session }),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: api.logout,
  });
}

export function useBalance() {
  return useQuery({ queryKey: qk.balance, queryFn: api.getBalance });
}

export function useTasks() {
  return useQuery({ queryKey: qk.tasks, queryFn: api.getTasks });
}

export function useRedemption() {
  return useQuery({ queryKey: qk.redemption, queryFn: api.getRedemption });
}

export function useCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string }) =>
      api.checkin({ taskId, requestId: generateRequestId() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.balance });
      qc.invalidateQueries({ queryKey: qk.tasks });
      qc.invalidateQueries({ queryKey: qk.redemption });
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: qk.todaySchedules });
    },
  });
}

export function useRedeem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ minutes }: { minutes: number }) =>
      api.redeem({ minutes, requestId: generateRequestId() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.balance });
      qc.invalidateQueries({ queryKey: qk.redemption });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
  });
}

export function useHistory(month?: string, type?: string) {
  return useQuery({
    queryKey: qk.history(month, type),
    queryFn: () => api.getHistory({ month, type }),
  });
}

// ── 日程 ──

export function useSchedules() {
  return useQuery({ queryKey: qk.schedules, queryFn: api.getSchedules });
}

export function useTodaySchedules() {
  return useQuery({ queryKey: qk.todaySchedules, queryFn: api.getTodaySchedules });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSchedule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.schedules });
      qc.invalidateQueries({ queryKey: qk.todaySchedules });
    },
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & import("@timebank/shared").UpdateScheduleRequest) =>
      api.updateSchedule(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.schedules });
      qc.invalidateQueries({ queryKey: qk.todaySchedules });
    },
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteSchedule,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.schedules });
      qc.invalidateQueries({ queryKey: qk.todaySchedules });
    },
  });
}
