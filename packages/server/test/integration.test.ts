import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import request from "supertest";
import { createApp } from "../src/app.js";
import { ChildStore } from "../src/store.js";
import { ScheduleStore } from "../src/schedule-store.js";
import type { AppConfig } from "@timebank/shared";

const TZ = "Asia/Shanghai";

const baseConfig: AppConfig = {
  children: [
    { id: "alice", name: "小狐", avatar: "🦊", pin: "1234", enabled: true },
    { id: "bob", name: "小熊", avatar: "🐻", pin: "5678", enabled: true },
  ],
  tasks: [
    {
      id: "read",
      name: "阅读",
      category: "reading",
      taskMinutes: 30,
      rewardMinutes: 15,
      childIds: ["*"],
      dailyLimit: 2,
      enabled: true,
    },
    {
      id: "math",
      name: "口算",
      category: "learning",
      taskMinutes: 20,
      rewardMinutes: 10,
      childIds: ["alice"],
      dailyLimit: 1,
      enabled: true,
    },
  ],
  redemptionOptions: [15, 30, 60],
  encouragements: ["真棒！", "继续加油！"],
  session: { lifetimeDays: 30 },
  server: {
    host: "0.0.0.0",
    port: 3000,
    sessionSecret: "test-secret-at-least-16-chars",
    timezone: TZ,
  },
};

async function setupStores(dir: string, childIds: string[]) {
  const stores = new Map<string, ChildStore>();
  for (const id of childIds) {
    const store = new ChildStore(id, path.join(dir, `${id}.csv`));
    await store.load();
    stores.set(id, store);
  }
  return stores;
}

async function setupScheduleStores(dir: string, config: AppConfig, childIds: string[]) {
  const stores = new Map<string, ScheduleStore>();
  for (const id of childIds) {
    const store = new ScheduleStore(id, path.join(dir, `${id}.json`), config);
    await store.load();
    stores.set(id, store);
  }
  return stores;
}

describe("integration: auth & business", () => {
  let tmp: string;
  let stores: Map<string, ChildStore>;
  let scheduleStores: Map<string, ScheduleStore>;

  beforeEach(async () => {
    tmp = await mkdtemp();
    stores = await setupStores(tmp, ["alice", "bob"]);
    scheduleStores = await setupScheduleStores(tmp, baseConfig, ["alice", "bob"]);
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  function app() {
    return createApp({ config: baseConfig, stores, scheduleStores, timezone: TZ });
  }

  async function loginAs(childId: string, pin: string) {
    const agent = request.agent(app());
    await agent.post("/api/auth/login").send({ childId, pin }).expect(200);
    return agent;
  }

  it("lists enabled children for login", async () => {
    const res = await request(app()).get("/api/config/login").expect(200);
    expect(res.body.children).toHaveLength(2);
    expect(res.body.children[0]).not.toHaveProperty("pin");
  });

  it("rejects wrong pin", async () => {
    await request(app())
      .post("/api/auth/login")
      .send({ childId: "alice", pin: "0000" })
      .expect(401);
  });

  it("rejects disabled child", async () => {
    const cfg: AppConfig = {
      ...baseConfig,
      children: [
        { ...baseConfig.children[0], enabled: false },
        baseConfig.children[1],
      ],
    };
    const a = createApp({ config: cfg, stores, timezone: TZ });
    await request(a)
      .post("/api/auth/login")
      .send({ childId: "alice", pin: "1234" })
      .expect(401);
  });

  it("session works after login and cleared after logout", async () => {
    const agent = await loginAs("alice", "1234");
    await agent.get("/api/session").expect(200);
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/session").expect(401);
  });

  it("blocks /api/me without session", async () => {
    await request(app()).get("/api/me/balance").expect(401);
  });

  it("cross-child access is impossible (alice cannot see bob data)", async () => {
    const alice = await loginAs("alice", "1234");
    // alice 打卡获得 15 分钟
    await alice
      .post("/api/me/checkin")
      .send({ taskId: "read", requestId: "q1" })
      .expect(200);
    // alice 余额 15
    const bal = await alice.get("/api/me/balance").expect(200);
    expect(bal.body.balanceMinutes).toBe(15);
    // bob 登录看到的是自己的 0
    const bob = await loginAs("bob", "5678");
    const bobBal = await bob.get("/api/me/balance").expect(200);
    expect(bobBal.body.balanceMinutes).toBe(0);
  });

  it("checkin credits balance and enforces daily limit", async () => {
    const agent = await loginAs("alice", "1234");
    // math dailyLimit=1
    await agent
      .post("/api/me/checkin")
      .send({ taskId: "math", requestId: "m1" })
      .expect(200);
    const r2 = await agent
      .post("/api/me/checkin")
      .send({ taskId: "math", requestId: "m2" })
      .expect(409);
    expect(r2.body.error.code).toBe("limit_reached");
  });

  it("checkin is idempotent by requestId", async () => {
    const agent = await loginAs("alice", "1234");
    const r1 = await agent
      .post("/api/me/checkin")
      .send({ taskId: "read", requestId: "dup1" })
      .expect(200);
    expect(r1.body.balanceMinutes).toBe(15);
    // 重复请求不新增
    const r2 = await agent
      .post("/api/me/checkin")
      .send({ taskId: "read", requestId: "dup1" })
      .expect(200);
    expect(r2.body.balanceMinutes).toBe(15);
    // 余额仍为 15
    const bal = await agent.get("/api/me/balance").expect(200);
    expect(bal.body.balanceMinutes).toBe(15);
  });

  it("redeem requires sufficient balance", async () => {
    const agent = await loginAs("alice", "1234");
    // 余额 0，兑换 15 失败
    const r = await agent
      .post("/api/me/redeem")
      .send({ minutes: 15, requestId: "rd1" })
      .expect(409);
    expect(r.body.error.code).toBe("insufficient");
  });

  it("redeem deducts balance", async () => {
    const agent = await loginAs("alice", "1234");
    await agent.post("/api/me/checkin").send({ taskId: "read", requestId: "c1" }).expect(200);
    await agent.post("/api/me/checkin").send({ taskId: "read", requestId: "c2" }).expect(200);
    // 余额 30
    await agent.post("/api/me/redeem").send({ minutes: 30, requestId: "r1" }).expect(200);
    const bal = await agent.get("/api/me/balance").expect(200);
    expect(bal.body.balanceMinutes).toBe(0);
  });

  it("redemption options reflect balance", async () => {
    const agent = await loginAs("alice", "1234");
    const r0 = await agent.get("/api/me/redemption").expect(200);
    expect(r0.body.options.every((o: any) => o.available === false)).toBe(true);
    await agent.post("/api/me/checkin").send({ taskId: "read", requestId: "c1" }).expect(200);
    const r1 = await agent.get("/api/me/redemption").expect(200);
    const map = Object.fromEntries(r1.body.options.map((o: any) => [o.minutes, o.available]));
    expect(map[15]).toBe(true);
    expect(map[30]).toBe(false);
  });

  it("tasks endpoint shows today count and canCheckin", async () => {
    const agent = await loginAs("alice", "1234");
    const r0 = await agent.get("/api/me/tasks").expect(200);
    const read0 = r0.body.tasks.find((t: any) => t.id === "read");
    expect(read0.todayCount).toBe(0);
    expect(read0.canCheckin).toBe(true);
    await agent.post("/api/me/checkin").send({ taskId: "read", requestId: "c1" }).expect(200);
    const r1 = await agent.get("/api/me/tasks").expect(200);
    const read1 = r1.body.tasks.find((t: any) => t.id === "read");
    expect(read1.todayCount).toBe(1);
    expect(read1.remaining).toBe(1);
  });

  it("history returns reverse chronological with running balance", async () => {
    const agent = await loginAs("alice", "1234");
    await agent.post("/api/me/checkin").send({ taskId: "read", requestId: "h1" }).expect(200);
    await agent.post("/api/me/checkin").send({ taskId: "read", requestId: "h2" }).expect(200);
    await agent.post("/api/me/redeem").send({ minutes: 15, requestId: "h3" }).expect(200);
    const res = await agent.get("/api/me/history").expect(200);
    expect(res.body.records).toHaveLength(3);
    // 最新在前：兑换在前
    expect(res.body.records[0].recordType).toBe("entertainment_redeem");
    expect(res.body.records[0].balanceAfter).toBe(15); // 30-15
    expect(res.body.records[1].balanceAfter).toBe(30);
    expect(res.body.records[2].balanceAfter).toBe(15);
  });

  it("history filters by type", async () => {
    const agent = await loginAs("alice", "1234");
    await agent.post("/api/me/checkin").send({ taskId: "read", requestId: "f1" }).expect(200);
    await agent.post("/api/me/redeem").send({ minutes: 15, requestId: "f2" }).expect(200);
    const res = await agent.get("/api/me/history?type=task_checkin").expect(200);
    expect(res.body.records).toHaveLength(1);
    expect(res.body.records[0].recordType).toBe("task_checkin");
  });

  it("task not applicable to child is rejected", async () => {
    // math 仅适用于 alice
    const bob = await loginAs("bob", "5678");
    const r = await bob
      .post("/api/me/checkin")
      .send({ taskId: "math", requestId: "x1" })
      .expect(403);
    expect(r.body.error.code).toBe("not_applicable");
  });

  it("writes are isolated per child file", async () => {
    const alice = await loginAs("alice", "1234");
    const bob = await loginAs("bob", "5678");
    await alice.post("/api/me/checkin").send({ taskId: "read", requestId: "a1" }).expect(200);
    await bob.post("/api/me/checkin").send({ taskId: "read", requestId: "b1" }).expect(200);
    const ab = await alice.get("/api/me/balance").expect(200);
    const bb = await bob.get("/api/me/balance").expect(200);
    expect(ab.body.balanceMinutes).toBe(15);
    expect(bb.body.balanceMinutes).toBe(15);
    // 文件各自独立
    expect(existsSync(path.join(tmp, "alice.csv"))).toBe(true);
    expect(existsSync(path.join(tmp, "bob.csv"))).toBe(true);
  });
});

async function mkdtemp(): Promise<string> {
  const dir = await mkdtempReal();
  return dir;
}
function mkdtempReal(): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `timebank-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdir(tmp, { recursive: true })
      .then(() => resolve(tmp))
      .catch(reject);
  });
}
