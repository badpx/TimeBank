import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  scheduleSchema,
  createScheduleRequestSchema,
  updateScheduleRequestSchema,
  uuid,
  nowIso,
  type AppConfig,
  type Schedule,
  type CreateScheduleRequest,
  type UpdateScheduleRequest,
} from "@timebank/shared";

export class ScheduleStore {
  private schedules: Schedule[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private readonly filePath: string;

  constructor(_childId: string, filePath: string, _config: AppConfig) {
    this.filePath = filePath;
  }

  async load(): Promise<void> {
    if (!existsSync(this.filePath)) {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await this.atomicWrite("[]");
      this.schedules = [];
      return;
    }
    const content = await readFile(this.filePath, "utf8");
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (e) {
      throw new Error(`日程文件 JSON 解析失败 (${this.filePath}): ${(e as Error).message}`);
    }
    if (!Array.isArray(raw)) {
      throw new Error(`日程文件应为数组 (${this.filePath})`);
    }
    const parsed: Schedule[] = [];
    const idSet = new Set<string>();
    for (let i = 0; i < raw.length; i++) {
      const result = scheduleSchema.safeParse(raw[i]);
      if (!result.success) {
        throw new Error(
          `日程校验失败 (${this.filePath}) 第 ${i + 1} 项: ${result.error.issues[0]?.message ?? "未知错误"}`
        );
      }
      if (idSet.has(result.data.id)) {
        throw new Error(`日程 ID 重复 (${this.filePath}): ${result.data.id}`);
      }
      idSet.add(result.data.id);
      parsed.push(result.data);
    }
    this.schedules = parsed;
  }

  getAll(): ReadonlyArray<Schedule> {
    return this.schedules;
  }

  create(input: CreateScheduleRequest): Promise<Schedule> {
    this.chain = this.chain.then(() => this.doCreate(input));
    return this.chain as Promise<Schedule>;
  }

  private async doCreate(input: CreateScheduleRequest): Promise<Schedule> {
    const schedule: Schedule = {
      id: uuid(),
      title: input.title,
      weekdays: input.weekdays,
      startTime: input.startTime,
      endTime: input.endTime,
      color: input.color,
      note: input.note ?? "",
      enabled: true,
      createdAt: nowIso(),
    };
    this.schedules.push(schedule);
    await this.atomicWrite(JSON.stringify(this.schedules, null, 2));
    return schedule;
  }

  update(id: string, input: UpdateScheduleRequest): Promise<Schedule> {
    this.chain = this.chain.then(() => this.doUpdate(id, input));
    return this.chain as Promise<Schedule>;
  }

  private async doUpdate(id: string, input: UpdateScheduleRequest): Promise<Schedule> {
    const idx = this.schedules.findIndex((s) => s.id === id);
    if (idx < 0) throw new ScheduleNotFoundError(id);
    const updated: Schedule = {
      ...this.schedules[idx],
      title: input.title,
      weekdays: input.weekdays,
      startTime: input.startTime,
      endTime: input.endTime,
      color: input.color,
      note: input.note ?? "",
      enabled: input.enabled ?? this.schedules[idx].enabled,
      createdAt: this.schedules[idx].createdAt,
    };
    this.schedules[idx] = updated;
    await this.atomicWrite(JSON.stringify(this.schedules, null, 2));
    return updated;
  }

  remove(id: string): Promise<void> {
    this.chain = this.chain.then(() => this.doRemove(id));
    return this.chain as Promise<void>;
  }

  private async doRemove(id: string): Promise<void> {
    const idx = this.schedules.findIndex((s) => s.id === id);
    if (idx < 0) throw new ScheduleNotFoundError(id);
    this.schedules.splice(idx, 1);
    await this.atomicWrite(JSON.stringify(this.schedules, null, 2));
  }

  /** 原子写入：写 .tmp → rename */
  private async atomicWrite(content: string): Promise<void> {
    const tmp = this.filePath + ".tmp";
    await writeFile(tmp, content, "utf8");
    await rename(tmp, this.filePath);
  }
}

export class ScheduleNotFoundError extends Error {
  constructor(id: string) {
    super(`日程不存在: ${id}`);
    this.name = "ScheduleNotFoundError";
  }
}

export { createScheduleRequestSchema, updateScheduleRequestSchema };
