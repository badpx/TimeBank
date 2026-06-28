import express from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import {
  deriveBalance,
  countToday,
  canCheckin,
  taskAppliesTo,
  availableRedemption,
  pickEncouragement,
  filterHistory,
  withRunningBalance,
  sortHistoryDesc,
  generateRecordId,
  nowIso,
  loginRequestSchema,
  checkinRequestSchema,
  redeemRequestSchema,
  historyQuerySchema,
  type AppConfig,
  type Record,
} from "@timebank/shared";
import { ChildStore } from "./store.js";
import { SessionStore } from "./session.js";

export interface AppDeps {
  config: AppConfig;
  stores: Map<string, ChildStore>;
  timezone?: string;
  /** 静态资源目录（生产构建产物），可选 */
  staticDir?: string;
}

export function createApp(deps: AppDeps): express.Express {
  const { config, stores, timezone, staticDir } = deps;
  const session = new SessionStore(config);
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // 友好错误处理
  const sendError = (
    res: express.Response,
    status: number,
    code: string,
    message: string
  ) => res.status(status).json({ error: { code, message } });

  // ---------- 公开接口 ----------
  app.get("/api/config/login", (_req, res) => {
    res.json({
      children: config.children
        .filter((c) => c.enabled)
        .map((c) => ({ id: c.id, name: c.name, avatar: c.avatar })),
    });
  });

  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "rate_limited", message: "尝试太频繁了，稍等一下再试吧" } },
  });

  app.post("/api/auth/login", loginLimiter, (req, res) => {
    const parsed = loginRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "bad_request", "输入有误");
    const { childId, pin } = parsed.data;
    const child = config.children.find((c) => c.id === childId && c.enabled);
    if (!child || child.pin !== pin) {
      return sendError(res, 401, "invalid_credentials", "好像不对哦，再试一次");
    }
    const token = session.issue(childId);
    res.cookie(session.cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: session.lifetimeMsValue,
    });
    res.json({ childId, name: child.name, avatar: child.avatar });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = req.cookies?.[session.cookieName];
    if (token) session.revoke(token);
    res.clearCookie(session.cookieName, { path: "/" });
    res.status(204).end();
  });

  app.get("/api/session", (req, res) => {
    const payload = getSessionPayload(req, session);
    if (!payload) return sendError(res, 401, "no_session", "请先登录");
    const child = config.children.find((c) => c.id === payload.childId);
    if (!child) return sendError(res, 401, "no_session", "请先登录");
    maybeRenew(res, req, session, payload);
    res.json({ childId: child.id, name: child.name, avatar: child.avatar });
  });

  // ---------- 鉴权中间件 ----------
  app.use("/api/me", (req, res, next) => {
    const payload = getSessionPayload(req, session);
    if (!payload) return sendError(res, 401, "no_session", "请先登录");
    const child = config.children.find((c) => c.id === payload.childId && c.enabled);
    if (!child) return sendError(res, 401, "no_session", "请先登录");
    (req as any).sessionChildId = payload.childId;
    maybeRenew(res, req, session, payload);
    next();
  });

  // ---------- 受保护接口 ----------
  app.get("/api/me/balance", (req, res) => {
    const childId = (req as any).sessionChildId as string;
    const store = stores.get(childId)!;
    res.json({ balanceMinutes: deriveBalance(store.getRecords()) });
  });

  app.get("/api/me/tasks", (req, res) => {
    const childId = (req as any).sessionChildId as string;
    const store = stores.get(childId)!;
    const tasks = config.tasks
      .filter((t) => taskAppliesTo(t, childId))
      .map((t) => {
        const todayCount = countToday(store.getRecords(), childId, t.id, timezone);
        return {
          id: t.id,
          name: t.name,
          category: t.category,
          taskMinutes: t.taskMinutes,
          rewardMinutes: t.rewardMinutes,
          todayCount,
          limit: t.dailyLimit,
          remaining: Math.max(0, t.dailyLimit - todayCount),
          canCheckin: canCheckin(t, childId, todayCount),
        };
      });
    res.json({ tasks });
  });

  app.get("/api/me/redemption", (req, res) => {
    const childId = (req as any).sessionChildId as string;
    const store = stores.get(childId)!;
    const balance = deriveBalance(store.getRecords());
    res.json({ options: availableRedemption(balance, config.redemptionOptions) });
  });

  app.post("/api/me/checkin", async (req, res) => {
    const childId = (req as any).sessionChildId as string;
    const parsed = checkinRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "bad_request", "输入有误");
    const { taskId, requestId } = parsed.data;
    const task = config.tasks.find((t) => t.id === taskId);
    if (!task || !task.enabled) return sendError(res, 404, "task_not_found", "任务不存在");
    if (!taskAppliesTo(task, childId))
      return sendError(res, 403, "not_applicable", "这个任务不适合你哦");

    const store = stores.get(childId)!;
    // 幂等
    const existing = store.findByRequestId(requestId);
    if (existing) {
      const balance = deriveBalance(store.getRecords());
      const todayCount = countToday(store.getRecords(), childId, taskId, timezone);
      return res.json({
        balanceMinutes: balance,
        taskState: toTaskState(task, todayCount),
        encouragement: pickEncouragement(config.encouragements),
      });
    }

    const todayCount = countToday(store.getRecords(), childId, taskId, timezone);
    if (todayCount >= task.dailyLimit)
      return sendError(res, 409, "limit_reached", "今天的次数用完啦");

    const record: Record = {
      id: generateRecordId(),
      requestId,
      timestamp: nowIso(),
      childId,
      recordType: "task_checkin",
      taskId: task.id,
      taskName: task.name,
      taskMinutes: task.taskMinutes,
      entertainmentMinutes: task.rewardMinutes,
      note: "",
    };
    try {
      await store.append(record);
    } catch (e) {
      console.error("append failed", e);
      return sendError(res, 500, "write_failed", "保存失败了，请重试");
    }
    const balance = deriveBalance(store.getRecords());
    const newTodayCount = todayCount + 1;
    res.json({
      balanceMinutes: balance,
      taskState: toTaskState(task, newTodayCount),
      encouragement: pickEncouragement(config.encouragements),
    });
  });

  app.post("/api/me/redeem", async (req, res) => {
    const childId = (req as any).sessionChildId as string;
    const parsed = redeemRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "bad_request", "输入有误");
    const { minutes, requestId } = parsed.data;
    if (!config.redemptionOptions.includes(minutes))
      return sendError(res, 400, "invalid_option", "请选择有效的时长");

    const store = stores.get(childId)!;
    const existing = store.findByRequestId(requestId);
    if (existing) {
      return res.json({ balanceMinutes: deriveBalance(store.getRecords()) });
    }

    const balance = deriveBalance(store.getRecords());
    if (balance < 0 || balance < minutes)
      return sendError(res, 409, "insufficient", "时间不够啦");

    const record: Record = {
      id: generateRecordId(),
      requestId,
      timestamp: nowIso(),
      childId,
      recordType: "entertainment_redeem",
      taskId: "",
      taskName: "",
      taskMinutes: null,
      entertainmentMinutes: -minutes,
      note: "",
    };
    try {
      await store.append(record);
    } catch (e) {
      console.error("append failed", e);
      return sendError(res, 500, "write_failed", "保存失败了，请重试");
    }
    res.json({ balanceMinutes: deriveBalance(store.getRecords()) });
  });

  app.get("/api/me/history", (req, res) => {
    const childId = (req as any).sessionChildId as string;
    const parsed = historyQuerySchema.safeParse({
      month: req.query.month,
      type: req.query.type,
    });
    if (!parsed.success) return sendError(res, 400, "bad_request", "筛选条件有误");
    const store = stores.get(childId)!;
    const filtered = filterHistory(store.getRecords(), parsed.data, timezone);
    const withBalance = withRunningBalance(filtered);
    const sorted = sortHistoryDesc(withBalance.map((x) => x.record));
    // 注意：倒序后需要重新对应 balanceAfter
    const running = withRunningBalance(filtered);
    const map = new Map<string, number>();
    running.forEach((x) => map.set(x.record.id, x.balanceAfter));
    const items = sorted.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      recordType: r.recordType,
      taskName: r.taskName,
      taskMinutes: r.taskMinutes,
      entertainmentMinutes: r.entertainmentMinutes,
      balanceAfter: map.get(r.id)!,
      note: r.note,
    }));
    res.json({ records: items });
  });

  // ---------- 静态资源 ----------
  if (staticDir) {
    app.use(express.static(staticDir));
    // SPA fallback：非 /api 路径回退到 index.html
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  // ---------- 兜底错误 ----------
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("unhandled", err);
      sendError(res, 500, "server_error", "出错了，请重试");
    }
  );

  return app;
}

function toTaskState(task: AppConfig["tasks"][number], todayCount: number) {
  return {
    id: task.id,
    name: task.name,
    category: task.category,
    taskMinutes: task.taskMinutes,
    rewardMinutes: task.rewardMinutes,
    todayCount,
    limit: task.dailyLimit,
    remaining: Math.max(0, task.dailyLimit - todayCount),
    canCheckin: todayCount < task.dailyLimit,
  };
}

function getSessionPayload(req: express.Request, session: SessionStore) {
  const token = req.cookies?.[session.cookieName];
  if (!token) return null;
  return session.verify(token);
}

function maybeRenew(
  res: express.Response,
  _req: express.Request,
  session: SessionStore,
  payload: { childId: string; exp: number }
) {
  if (session.shouldRenew(payload)) {
    const newToken = session.issue(payload.childId);
    res.cookie(session.cookieName, newToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: session.lifetimeMsValue,
    });
  }
}
