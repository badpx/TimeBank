import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ChildStore, RecordError } from "../src/store.js";

let tmp: string;

beforeEach(async () => {
  tmp = path.join(os.tmpdir(), `tb-store-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(tmp, { recursive: true });
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("ChildStore load & validate", () => {
  it("creates header file when missing", async () => {
    const store = new ChildStore("alice", path.join(tmp, "alice.csv"));
    await store.load();
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(path.join(tmp, "alice.csv"), "utf8");
    expect(content.split("\n")[0]).toContain("id,request_id,timestamp");
  });

  it("loads valid records", async () => {
    const csv =
      "id,request_id,timestamp,child_id,record_type,task_id,task_name,task_minutes,entertainment_minutes,note\n" +
      "r1,q1,2026-06-28T12:00:00+08:00,alice,task_checkin,read,阅读,30,15,\n" +
      "r2,q2,2026-06-28T13:00:00+08:00,alice,entertainment_redeem,,,,-15,\n";
    await writeFile(path.join(tmp, "alice.csv"), csv);
    const store = new ChildStore("alice", path.join(tmp, "alice.csv"));
    await store.load();
    expect(store.getRecords()).toHaveLength(2);
  });

  it("rejects duplicate id", async () => {
    const csv =
      "id,request_id,timestamp,child_id,record_type,task_id,task_name,task_minutes,entertainment_minutes,note\n" +
      "r1,q1,2026-06-28T12:00:00+08:00,alice,task_checkin,read,阅读,30,15,\n" +
      "r1,q2,2026-06-28T13:00:00+08:00,alice,task_checkin,read,阅读,30,15,\n";
    await writeFile(path.join(tmp, "alice.csv"), csv);
    const store = new ChildStore("alice", path.join(tmp, "alice.csv"));
    await expect(store.load()).rejects.toThrow(RecordError);
  });

  it("rejects duplicate non-empty request_id", async () => {
    const csv =
      "id,request_id,timestamp,child_id,record_type,task_id,task_name,task_minutes,entertainment_minutes,note\n" +
      "r1,dup,2026-06-28T12:00:00+08:00,alice,task_checkin,read,阅读,30,15,\n" +
      "r2,dup,2026-06-28T13:00:00+08:00,alice,task_checkin,read,阅读,30,15,\n";
    await writeFile(path.join(tmp, "alice.csv"), csv);
    const store = new ChildStore("alice", path.join(tmp, "alice.csv"));
    await expect(store.load()).rejects.toThrow(RecordError);
  });

  it("rejects child_id mismatch", async () => {
    const csv =
      "id,request_id,timestamp,child_id,record_type,task_id,task_name,task_minutes,entertainment_minutes,note\n" +
      "r1,q1,2026-06-28T12:00:00+08:00,bob,task_checkin,read,阅读,30,15,\n";
    await writeFile(path.join(tmp, "alice.csv"), csv);
    const store = new ChildStore("alice", path.join(tmp, "alice.csv"));
    await expect(store.load()).rejects.toThrow(RecordError);
  });

  it("rejects negative-balance-producing checkin direction", async () => {
    const csv =
      "id,request_id,timestamp,child_id,record_type,task_id,task_name,task_minutes,entertainment_minutes,note\n" +
      "r1,q1,2026-06-28T12:00:00+08:00,alice,task_checkin,read,阅读,30,-15,\n";
    await writeFile(path.join(tmp, "alice.csv"), csv);
    const store = new ChildStore("alice", path.join(tmp, "alice.csv"));
    await expect(store.load()).rejects.toThrow(RecordError);
  });
});

describe("ChildStore append & concurrency", () => {
  it("appends records and reflects in memory", async () => {
    const store = new ChildStore("alice", path.join(tmp, "alice.csv"));
    await store.load();
    await store.append({
      id: "r1",
      requestId: "q1",
      timestamp: "2026-06-28T12:00:00+08:00",
      childId: "alice",
      recordType: "task_checkin",
      taskId: "read",
      taskName: "阅读",
      taskMinutes: 30,
      entertainmentMinutes: 15,
      note: "",
    });
    expect(store.getRecords()).toHaveLength(1);
  });

  it("concurrent appends are ordered and not lost", async () => {
    const store = new ChildStore("alice", path.join(tmp, "alice.csv"));
    await store.load();
    const N = 20;
    const promises = [];
    for (let i = 0; i < N; i++) {
      promises.push(
        store.append({
          id: `r${i}`,
          requestId: `q${i}`,
          timestamp: "2026-06-28T12:00:00+08:00",
          childId: "alice",
          recordType: "task_checkin",
          taskId: "read",
          taskName: "阅读",
          taskMinutes: 30,
          entertainmentMinutes: 15,
          note: "",
        })
      );
    }
    await Promise.all(promises);
    expect(store.getRecords()).toHaveLength(N);
    // 重新从磁盘加载验证落盘完整
    const store2 = new ChildStore("alice", path.join(tmp, "alice.csv"));
    await store2.load();
    expect(store2.getRecords()).toHaveLength(N);
  });

  it("findByRequestId returns existing record", async () => {
    const store = new ChildStore("alice", path.join(tmp, "alice.csv"));
    await store.load();
    await store.append({
      id: "r1",
      requestId: "q1",
      timestamp: "2026-06-28T12:00:00+08:00",
      childId: "alice",
      recordType: "task_checkin",
      taskId: "read",
      taskName: "阅读",
      taskMinutes: 30,
      entertainmentMinutes: 15,
      note: "",
    });
    expect(store.findByRequestId("q1")?.id).toBe("r1");
    expect(store.findByRequestId("nope")).toBeNull();
  });
});
