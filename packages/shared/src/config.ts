import { z } from "zod";

/**
 * 孩子适用范围：["*"] 表示所有孩子；否则为孩子 ID 数组。
 */
export const childIdList = z
  .union([
    z.array(z.string().min(1).max(32)).min(1),
    z.tuple([z.literal("*")]),
  ])
  .default(["*"]);

export const childSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(32),
  avatar: z.string().min(1).max(256),
  pin: z.string().regex(/^\d{4}$/),
  enabled: z.boolean().default(true),
});

export const taskSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(64),
  category: z.string().min(1).max(32),
  // taskMinutes > 0 表示时长型任务（如阅读 30 分钟）；
  // = 0 表示一次性任务，不限时长（如整理一次房间）。
  taskMinutes: z.number().int().nonnegative(),
  rewardMinutes: z.number().int().positive(),
  childIds: childIdList,
  dailyLimit: z.number().int().positive().default(1),
  enabled: z.boolean().default(true),
});

export const redemptionOptionSchema = z.number().int().positive();

export const sessionConfigSchema = z.object({
  lifetimeDays: z.number().int().positive().default(30),
});

export const serverConfigSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().int().min(1).max(65535).default(3000),
  sessionSecret: z.string().min(16),
  timezone: z.string().optional(),
});

export const configSchema = z.object({
  children: z.array(childSchema).min(1),
  tasks: z.array(taskSchema),
  redemptionOptions: z.array(redemptionOptionSchema).min(1),
  encouragements: z.array(z.string().min(1)).min(1),
  session: sessionConfigSchema.default({ lifetimeDays: 30 }),
  server: serverConfigSchema.default({
    host: "0.0.0.0",
    port: 3000,
    sessionSecret: "",
  }),
});

export type ChildConfig = z.infer<typeof childSchema>;
export type TaskConfig = z.infer<typeof taskSchema>;
export type SessionConfig = z.infer<typeof sessionConfigSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type AppConfig = z.infer<typeof configSchema>;

/**
 * 对已通过 schema 的配置做跨记录语义校验。
 * 返回错误列表，每条带可定位路径。
 */
export interface ConfigDiagnostic {
  path: string;
  message: string;
}

export function validateConfigSemantics(config: AppConfig): ConfigDiagnostic[] {
  const diags: ConfigDiagnostic[] = [];

  const childIds = new Set<string>();
  const dupChild = new Set<string>();
  config.children.forEach((c) => {
    if (childIds.has(c.id)) dupChild.add(c.id);
    else childIds.add(c.id);
    if (!c.enabled) return;
  });
  dupChild.forEach((id) =>
    diags.push({ path: `children`, message: `重复的孩子 ID: ${id}` })
  );

  const enabledCount = config.children.filter((c) => c.enabled).length;
  if (enabledCount === 0) {
    diags.push({ path: `children`, message: `至少需要 1 个启用的孩子` });
  }

  config.tasks.forEach((t, i) => {
    if (t.childIds[0] !== "*") {
      t.childIds.forEach((cid) => {
        if (!childIds.has(cid)) {
          diags.push({
            path: `tasks[${i}].childIds`,
            message: `任务 "${t.id}" 引用了不存在的孩子 ID: ${cid}`,
          });
        }
      });
    }
  });

  const taskIds = new Set<string>();
  config.tasks.forEach((t) => {
    if (taskIds.has(t.id))
      diags.push({ path: `tasks`, message: `重复的任务 ID: ${t.id}` });
    else taskIds.add(t.id);
  });

  if (!config.server.sessionSecret || config.server.sessionSecret.length < 16) {
    diags.push({
      path: `server.sessionSecret`,
      message: `会话密钥必须存在且长度 >= 16`,
    });
  }

  return diags;
}
