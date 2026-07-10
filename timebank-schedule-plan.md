# TimeBank 日程管理功能实现计划

## 1. 概述

为孩子增加个人日程管理功能。日程项是通用的日历事件，可选择性关联已有的打卡任务。

- **关联任务型**：到时间提示 → 可一键去打卡
- **独立事件型**：到时间仅提醒（如"周六 09:00 钢琴课"）

数据由孩子通过界面创建/编辑/删除，存储在服务端个人 JSON 文件中。

## 2. 数据模型

### 2.1 Schedule Schema（shared）

文件：`packages/shared/src/schedule.ts`

```ts
import { z } from "zod";

export const scheduleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(64),
  taskId: z.string().nullable(),        // null = 独立事件；否则关联任务 ID
  weekdays: z.array(z.number().int().min(1).max(7)).min(1),  // 1=周一 ... 7=周日
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),  // "HH:MM" 或 null
  color: z.enum(["learn", "read", "chore", "custom"]).default("custom"),
  note: z.string().max(200).default(""),
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime({ offset: true }),
});

export type Schedule = z.infer<typeof scheduleSchema>;
```

### 2.2 API 契约 Schema（shared）

文件：`packages/shared/src/api.ts`（追加）

```ts
// 日程相关
export const scheduleItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  taskId: z.string().nullable(),
  weekdays: z.array(z.number().int()),
  time: z.string().nullable(),
  color: z.string(),
  note: z.string(),
  enabled: z.boolean(),
  createdAt: z.string(),
});

// 今日日程项（含打卡状态）
export const todayScheduleItemSchema = scheduleItemSchema.extend({
  taskName: z.string().nullable(),       // 关联任务的名称（独立事件为 null）
  taskCompleted: z.boolean(),            // 今日是否已打卡（独立事件恒为 false）
  isOverdue: z.boolean(),                // 设了时间且已过（仅提示用）
});

export const schedulesResponseSchema = z.object({
  schedules: z.array(scheduleItemSchema),
});

export const todaySchedulesResponseSchema = z.object({
  items: z.array(todayScheduleItemSchema),
  date: z.string(),                      // "2026-07-09"
  weekday: z.number().int(),             // 1-7
});

export const createScheduleRequestSchema = z.object({
  title: z.string().min(1).max(64),
  taskId: z.string().nullable(),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1),
  time: z.string().nullable(),
  color: z.enum(["learn", "read", "chore", "custom"]),
  note: z.string().max(200).optional().default(""),
});

export const updateScheduleRequestSchema = createScheduleRequestSchema.extend({
  enabled: z.boolean().optional(),
});
```

### 2.3 纯逻辑函数（shared）

文件：`packages/shared/src/schedule-logic.ts`

```ts
import type { Schedule } from "./schedule.js";

/** 获取某星几的日程（1=周一 ... 7=周日） */
export function schedulesForWeekday(schedules: ReadonlyArray<Schedule>, weekday: number): Schedule[] {
  return schedules.filter((s) => s.enabled && s.weekdays.includes(weekday));
}

/** 按时间排序：有时间的按 HH:MM 升序，无时间的排最后 */
export function sortByTime(items: ReadonlyArray<Schedule>): Schedule[] {
  return [...items].sort((a, b) => {
    if (a.time && b.time) return a.time < b.time ? -1 : 1;
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });
}

/** 判断日程项是否"已过时"（设了时间且当前时间已过） */
export function isOverdue(item: Schedule, now: Date): boolean {
  if (!item.time) return false;
  const [h, m] = item.time.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return h * 60 + m < nowMin;
}

/** 周几转中文标签 */
export function weekdayLabel(w: number): string {
  return ["", "一", "二", "三", "四", "五", "六", "日"][w];
}

/** 颜色标签转中文 */
export function colorLabel(c: string): string {
  const map: Record<string, string> = { learn: "学习", read: "阅读", chore: "家务", custom: "其他" };
  return map[c] ?? c;
}
```

### 2.4 存储（server）

文件：`packages/server/src/schedule-store.ts`

```ts
export class ScheduleStore {
  private schedules: Schedule[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private readonly filePath: string;
  private readonly childId: string;
  private readonly config: AppConfig;

  constructor(childId: string, filePath: string, config: AppConfig) { ... }

  async load(): Promise<void> {
    // 文件不存在 → 创建空数组
    // 文件存在 → 解析 JSON → 校验每条 schedule
    // 校验：id 唯一、taskId（非 null 时）存在于 config.tasks 且适用于该孩子
  }

  getAll(): ReadonlyArray<Schedule> { ... }

  create(input: CreateScheduleInput): Promise<Schedule> {
    // 生成 id（uuid()）、createdAt
    // 追加到数组 → 全量写入 JSON（原子写：写临时文件 → rename）
    // 通过 chain 串行化
  }

  update(id: string, input: UpdateScheduleInput): Promise<Schedule> {
    // 找到对应项 → 合并更新 → 全量写入
  }

  remove(id: string): Promise<void> {
    // 过滤掉对应项 → 全量写入
  }
}
```

存储文件：`data/schedules/<child-id>.json`

原子写入策略：写入 `*.tmp` → `rename` 覆盖原文件，避免写一半崩溃。

### 2.5 启动备份

在 `backup.ts` 中扩展 `backupChildFiles` 为 `backupChildDataFiles`，同时备份 `records/*.csv` 和 `schedules/*.json`。或新增 `backupScheduleFiles` 函数。

## 3. API 设计

文件：`packages/server/src/app.ts`（追加路由）

所有日程 API 在 `/api/me` 鉴权中间件之后，自动获得 `sessionChildId`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/me/schedules` | 获取自己的全部日程 |
| POST | `/api/me/schedules` | 新建日程 |
| PUT | `/api/me/schedules/:id` | 编辑日程 |
| DELETE | `/api/me/schedules/:id` | 删除日程 |
| GET | `/api/me/schedules/today` | 今日日程 + 打卡状态 |

### 3.1 GET /api/me/schedules

返回该孩子的全部日程（含已禁用的）。

```json
{ "schedules": [ { ...schedule } ] }
```

### 3.2 POST /api/me/schedules

请求体：`createScheduleRequestSchema`

校验：
- taskId 非 null 时，必须存在于 config.tasks、已启用、适用于该孩子
- weekdays 至少一个

成功返回 201 + 创建的日程项。

### 3.3 PUT /api/me/schedules/:id

请求体：`updateScheduleRequestSchema`

校验同上。404 如果 id 不存在。

### 3.4 DELETE /api/me/schedules/:id

204。404 如果 id 不存在。

### 3.5 GET /api/me/schedules/today

核心接口，返回今日的日程项并附带打卡状态：

```json
{
  "items": [
    {
      "id": "sched-1",
      "title": "阅读",
      "taskId": "read",
      "weekdays": [1, 3, 5],
      "time": "16:00",
      "color": "read",
      "note": "",
      "enabled": true,
      "createdAt": "2026-07-09T10:00:00+08:00",
      "taskName": "阅读",
      "taskCompleted": false,
      "isOverdue": false
    }
  ],
  "date": "2026-07-09",
  "weekday": 4
}
```

`taskCompleted` 逻辑：
- taskId 为 null → false
- taskId 非 null → 查 ChildStore 的今日打卡记录，countToday > 0 则 true

`isOverdue` 逻辑：
- time 为 null → false
- time 非 null → 当前服务端时间 > time 则 true

## 4. 服务端启动流程变更

文件：`packages/server/src/index.ts`

```ts
// 现有：加载 CSV stores
// 新增：加载 schedule stores
const scheduleStores = new Map<string, ScheduleStore>();
for (const child of config.children) {
  const file = path.join(schedulesDir, `${child.id}.json`);
  const store = new ScheduleStore(child.id, file, config);
  await store.load();
  scheduleStores.set(child.id, store);
}
```

`AppDeps` 增加 `scheduleStores`：

```ts
export interface AppDeps {
  config: AppConfig;
  stores: Map<string, ChildStore>;
  scheduleStores: Map<string, ScheduleStore>;  // NEW
  timezone?: string;
  staticDir?: string;
}
```

启动日志增加日程目录输出。

## 5. 前端实现

### 5.1 路由

文件：`packages/web/src/App.tsx`

```tsx
<Route path="/schedule" element={loggedIn ? <SchedulePage /> : <Navigate to="/login" replace />} />
```

### 5.2 API Client

文件：`packages/web/src/api/client.ts`（追加）

```ts
getSchedules: () => http<SchedulesResponse>("/api/me/schedules"),
getTodaySchedules: () => http<TodaySchedulesResponse>("/api/me/schedules/today"),
createSchedule: (body: CreateScheduleRequest) =>
  http<ScheduleItem>("/api/me/schedules", { method: "POST", body: JSON.stringify(body) }),
updateSchedule: (id: string, body: UpdateScheduleRequest) =>
  http<ScheduleItem>(`/api/me/schedules/${id}`, { method: "PUT", body: JSON.stringify(body) }),
deleteSchedule: (id: string) =>
  http<void>(`/api/me/schedules/${id}`, { method: "DELETE" }),
```

### 5.3 Hooks

文件：`packages/web/src/api/hooks.ts`（追加）

```ts
export const qk = {
  ...existing,
  schedules: ["schedules"] as const,
  todaySchedules: ["schedules", "today"] as const,
};

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

export function useUpdateSchedule() { ... }
export function useDeleteSchedule() { ... }
```

### 5.4 页面与组件

#### SchedulePage（`packages/web/src/pages/SchedulePage.tsx`）

页面布局从上到下：

```
┌─────────────────────────────────┐
│ ← 返回    我的日程    [+ 新建]   │  header
├─────────────────────────────────┤
│  今天 7月9日 周四                 │
│  ┌───────────────────────────┐  │
│  │ 16:00  阅读      [去打卡]  │  │  TodayList
│  │ 09:00  钢琴课              │  │
│  │ 今日 2 项                  │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  本周计划                        │
│  ┌───────────────────────────┐  │
│  │ 一  阅读·口算              │  │
│  │ 二  （无）                 │  │  WeekOverview
│  │ 三  阅读·口算              │  │
│  │ 四  阅读·钢琴课  ← 今天    │  │
│  │ ...                       │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  全部计划                        │
│  ┌───────────────────────────┐  │
│  │ ● 阅读  一三五 16:00  [编辑]│  │  ScheduleList
│  │ ● 钢琴课 六 09:00    [编辑] │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

#### 子组件清单

| 组件 | 文件 | 职责 |
|------|------|------|
| `TodayScheduleCard` | `components/TodayScheduleCard.tsx` | 今日日程卡片，含打卡状态 |
| `WeekOverview` | `components/WeekOverview.tsx` | 周一到周日总览 |
| `ScheduleListItem` | `components/ScheduleListItem.tsx` | 单条计划行（全列表） |
| `ScheduleEditor` | `components/ScheduleEditor.tsx` | 新建/编辑弹窗 |
| `WeekdayPicker` | `components/WeekdayPicker.tsx` | 周几多选按钮组 |

#### ScheduleEditor 弹窗

```
┌──────────────────────────────────┐
│  新建日程                    ✕   │
│                                  │
│  标题  [ 钢琴课            ]     │
│                                  │
│  关联任务                        │
│  ● 不关联（独立事件）             │
│  ○ 阅读（30分钟→奖励15分钟）      │
│  ○ 口算练习（20分钟→奖励10分钟）  │
│  ○ 整理房间（完成一次→奖励10分钟）│
│                                  │
│  重复                            │
│  [一][二][三][四][五][六][日]    │
│                                  │
│  时间  [ 09:00 ]  ☐ 不设时间     │
│                                  │
│  颜色  ● 🟢学习 ● 🔵阅读 ● 🟡家务 ● 🟠其他 │
│                                  │
│  备注  [ 带乐谱            ]     │
│                                  │
│  [删除]        [取消]  [保存]    │  编辑时才有删除
└──────────────────────────────────┘
```

### 5.5 主页联动

文件：`packages/web/src/pages/HomePage.tsx`

1. 底部操作栏从 2 个改为 3 个：「兑换时间」「查看记录」「我的日程」
2. 主页加载 `useTodaySchedules()`，如果今日有未完成的关联任务型日程，顶部显示提示条：
   ```
   ┌──────────────────────────────────┐
   │ 📅 今天还有 2 项计划  →           │  点击跳转 /schedule
   └──────────────────────────────────┘
   ```
3. 任务卡上：如果该任务今天有日程，显示小日历图标

### 5.6 前台定时提醒

在 SchedulePage（或全局 App）中，如果应用在前台：
- 每 30 秒检查一次 `todaySchedules` 中是否有 `isOverdue` 从 false 变 true 的项
- 如果有，弹出一个底部提示条："到时间了：阅读" + 轻微震动/音效
- 这是 best-effort 的前台提醒，非推送通知

## 6. 测试计划

### 6.1 shared 单测

- `scheduleSchema` 解析与校验（标题空、weekdays 空、time 格式）
- `schedulesForWeekday` 过滤
- `sortByTime` 排序（有时间在前，无时间在后）
- `isOverdue` 时间判断

### 6.2 server 集成测试

- 创建日程 → 返回 201
- 创建时 taskId 指向不存在/不适用任务 → 400
- 编辑日程 → 字段更新
- 删除日程 → 204，再 GET 不含该项
- GET today → 含 taskCompleted 状态（打卡后变 true）
- 跨孩子隔离：alice 看不到 bob 的日程
- ScheduleStore 原子写：并发 create 不丢失

### 6.3 前端测试

- ScheduleEditor 表单校验（标题必填、至少选一个周几）
- TodayScheduleCard 显示打卡状态
- WeekOverview 正确聚合

## 7. 里程碑

| 里程碑 | 内容 | 产出 |
|--------|------|------|
| S1 | shared 层 | schedule schema + API 契约 + 纯逻辑 + 单测 |
| S2 | server 层 | ScheduleStore + 5 个 API + 启动集成 + 集成测试 |
| S3 | web 核心 | SchedulePage（今日/周览/全列表）+ hooks + 路由 |
| S4 | web 编辑 | ScheduleEditor 弹窗 + 创建/编辑/删除 |
| S5 | 联动与打磨 | 主页三按钮 + 提示条 + 任务卡标记 + 前台提醒 |

## 8. 数据目录结构

```
data/
  records/
    alice.csv          ← 现有，交易流水
    bob.csv
  schedules/           ← 新增
    alice.json         ← 日程数据
    bob.json
```

`.gitignore` 增加 `data/schedules/*.json`，保留 `.gitkeep`。

## 9. 配置不变

日程功能不需要在 `config.yaml` 中增加任何配置。日程数据完全由孩子在运行时通过界面管理。

## 10. 风险与注意事项

1. **JSON 原子写**：必须用 `write tmp → rename` 策略，避免写一半崩溃导致 JSON 损坏
2. **taskId 引用完整性**：如果家长后来删除了某个任务，已引用它的日程在 today 接口中 taskName 应为 null、taskCompleted 为 false（降级为独立事件行为）
3. **时区**：今日判断、isOverdue 都用服务端时区（与现有 dailyLimit 一致）
4. **uuid fallback**：日程 ID 用 shared 中已有的 `uuid()` 函数，兼容非安全上下文
5. **分页**：日程数量通常很少（< 50），无需分页
