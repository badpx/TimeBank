import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm } from "node:fs/promises";
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
  ],
  redemptionOptions: [15, 30, 60],
  encouragements: ["真棒！"],
  session: { lifetimeDays: 30 },
  server: {
    host: "0.0.0.0",
    port: 3000,
    sessionSecret: "test-secret-at-least-16-chars",
    timezone: TZ,
  },
};

async function mkdtemp(): Promise<string> {
  const dir = path.join(os.tmpdir(), `tb-sched-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await rm(dir, { recursive: true, force: true });
  return dir;
}

describe("integration: schedules", () => {
  let tmp: string;
  let stores: Map<string, ChildStore>;
  let scheduleStores: Map<string, ScheduleStore>;

  beforeEach(async () => {
    tmp = await mkdtemp();
    stores = new Map();
    scheduleStores = new Map();
    for (const id of ["alice", "bob"]) {
      const cs = new ChildStore(id, path.join(tmp, `${id}.csv`));
      await cs.load();
      stores.set(id, cs);
      const ss = new ScheduleStore(id, path.join(tmp, `${id}.json`), baseConfig);
      await ss.load();
      scheduleStores.set(id, ss);
    }
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

  it("creates a schedule with start and end time", async () => {
    const agent = await loginAs("alice", "1234");
    const res = await agent
      .post("/api/me/schedules")
      .send({
        title: "阅读计划",
        weekdays: [1, 3, 5],
        startTime: "16:00",
        endTime: "17:00",
        color: "learn",
        note: "",
      })
      .expect(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.startTime).toBe("16:00");
    expect(res.body.endTime).toBe("17:00");
    expect(res.body.taskId).toBeUndefined();
  });

  it("rejects schedule with endTime <= startTime", async () => {
    const agent = await loginAs("alice", "1234");
    await agent
      .post("/api/me/schedules")
      .send({
        title: "test",
        weekdays: [1],
        startTime: "17:00",
        endTime: "16:00",
        color: "other",
      })
      .expect(400);
  });

  it("lists all schedules", async () => {
    const agent = await loginAs("alice", "1234");
    await agent.post("/api/me/schedules").send({
      title: "A", weekdays: [1], startTime: "16:00", endTime: "17:00", color: "learn",
    }).expect(201);
    await agent.post("/api/me/schedules").send({
      title: "B", weekdays: [6], startTime: "09:00", endTime: "10:00", color: "play",
    }).expect(201);
    const res = await agent.get("/api/me/schedules").expect(200);
    expect(res.body.schedules).toHaveLength(2);
  });

  it("updates a schedule", async () => {
    const agent = await loginAs("alice", "1234");
    const created = await agent.post("/api/me/schedules").send({
      title: "阅读", weekdays: [1], startTime: "16:00", endTime: "17:00", color: "learn",
    }).expect(201);
    const res = await agent
      .put(`/api/me/schedules/${created.body.id}`)
      .send({
        title: "每日阅读",
        weekdays: [1, 2, 3, 4, 5],
        startTime: "17:00",
        endTime: "18:00",
        color: "learn",
      })
      .expect(200);
    expect(res.body.title).toBe("每日阅读");
    expect(res.body.startTime).toBe("17:00");
  });

  it("deletes a schedule", async () => {
    const agent = await loginAs("alice", "1234");
    const created = await agent.post("/api/me/schedules").send({
      title: "test", weekdays: [1], startTime: "09:00", endTime: "10:00", color: "other",
    }).expect(201);
    await agent.delete(`/api/me/schedules/${created.body.id}`).expect(204);
    const res = await agent.get("/api/me/schedules").expect(200);
    expect(res.body.schedules).toHaveLength(0);
  });

  it("today endpoint returns items with isOverdue", async () => {
    const agent = await loginAs("alice", "1234");
    const today = new Date();
    const jsDay = today.getDay();
    const weekday = jsDay === 0 ? 7 : jsDay;
    await agent.post("/api/me/schedules").send({
      title: "阅读",
      weekdays: [weekday],
      startTime: "00:00",
      endTime: "23:59",
      color: "learn",
    }).expect(201);
    const res = await agent.get("/api/me/schedules/today").expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].isOverdue).toBe(false);
    expect(res.body.items[0].taskName).toBeUndefined();
    expect(res.body.items[0].taskCompleted).toBeUndefined();
  });

  it("cross-child isolation", async () => {
    const alice = await loginAs("alice", "1234");
    await alice.post("/api/me/schedules").send({
      title: "alice's plan", weekdays: [1], startTime: "09:00", endTime: "10:00", color: "learn",
    }).expect(201);
    const bob = await loginAs("bob", "5678");
    const res = await bob.get("/api/me/schedules").expect(200);
    expect(res.body.schedules).toHaveLength(0);
  });

  it("404 for updating non-existent schedule", async () => {
    const agent = await loginAs("alice", "1234");
    await agent.put("/api/me/schedules/nonexistent").send({
      title: "x", weekdays: [1], startTime: "09:00", endTime: "10:00", color: "other",
    }).expect(404);
  });

  it("blocks unauthenticated access", async () => {
    await request(app()).get("/api/me/schedules").expect(401);
    await request(app()).get("/api/me/schedules/today").expect(401);
  });
});
