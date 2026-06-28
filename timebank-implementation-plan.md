# TimeBank 实现方案

> 本文档把 `timebank-design.md` 的产品设计翻译为可直接落地的工程实现方案：
> 技术选型、工程结构、数据契约、各模块设计、可靠性、测试、部署与里程碑。
> 所有决策均以设计文档为准绳；当方案做出额外工程选择时，会标注「决策」与理由。

---

## 1. 总体目标

- 单进程、单端口、局域网自托管的家庭应用，供小学生使用（配置可设 1 到多个孩子）。
- TypeScript monorepo：`shared`（类型与纯逻辑）、`server`（Express + 数据）、`web`（React）。
- 配置走 YAML，交易流水走「每童一个 CSV」，余额始终由流水推导。
- iPad 触控优先，温暖卡片风格，可加入主屏图标启动。
- macOS / Windows 均可一键启动，无 Docker、无云端依赖。

---

## 2. 技术选型

| 关注点 | 选型 | 决策理由 |
| --- | --- | --- |
| 运行时 | Node.js 22 LTS | 设计要求 LTS；与 Vite/Vitest 兼容好 |
| 语言 | TypeScript（strict） | 设计指定；三包共享类型 |
| 包管理 / monorepo | pnpm + workspaces | 原生 workspace、磁盘高效、脚本编排方便 |
| 前端框架 | React 18 + Vite 5 | Vite 构建快，产物可直接被 Express 托管 |
| 前端状态 | TanStack Query (React Query) | 服务端状态缓存、重试、失效简单可靠；本地态用 useState |
| 路由 | React Router v6 | 登录/主页/历史三页足够 |
| 样式 | Tailwind CSS + CSS 变量 | 快速实现「温暖卡片游乐场」主题，便于暗色/主题切换与触控尺寸约束 |
| 动效 | canvas-confetti + Framer Motion（克制使用） | 撒花庆祝与卡片过渡 |
| 后端框架 | Express 4 | 稳定、生态成熟、足够轻量 |
| 服务端 TS 执行 | tsx（开发）/ esbuild 打包（生产） | 开发热重载快，生产单文件启动 |
| 校验 | Zod | TS-first，schema 即类型，配置/CSV/API 契约统一 |
| YAML 解析 | js-yaml | 事实标准 |
| CSV 读写 | csv-stringify（写）+ csv-parse（读） | 严格引号转义、流式可控 |
| 会话签名 | HMAC-SHA256（cookie-signature） | 设计要求「签名 cookie、不含 PIN」 |
| 限流 | express-rate-limit | 按 IP + 账号对登录尝试限流 |
| 测试 | Vitest（单元/集成）+ supertest（HTTP）+ Playwright（E2E） | Vite 生态统一，E2E 覆盖冒烟用例 |
| 时间 | 服务器本地时区为准（ Intl / process.env.TZ ） | 设计要求按家庭电脑本地日历日期计算每日上限 |

> 决策：不引入 ORM/数据库。CSV 即数据源，符合「可被家长直接检视与修复」的设计原则。
> 决策：不引入状态管理库（Redux 等），React Query 足以覆盖服务端状态。

---

## 3. 仓库与工程结构

pnpm workspaces，根目录托管脚本与共享配置。

```text
TimeBank/
├─ pnpm-workspace.yaml
├─ package.json                # 根脚本：dev / build / start / test / lint
├─ tsconfig.base.json
├─ timebank-design.md
├─ timebank-implementation-plan.md
├─ README.md                   # 安装与启动说明
├─ config/
│  └─ config.yaml              # 默认配置（示例）
├─ data/
│  └─ records/
│     ├─ alice.csv             # 启动时若缺失则写入表头
│     └─ bob.csv
├─ backups/                    # 启动备份自动落盘于此
├─ scripts/
│  ├─ start-macos.command      # 双击启动（mac）
│  └─ start-windows.bat        # 双击启动（win）
└─ packages/
   ├─ shared/                  # 类型、Zod schema、纯逻辑、时间工具
   ├─ server/                  # Express + 配置/存储/认证/业务
   └─ web/                     # React + Vite
```

`pnpm-workspace.yaml`：

```yaml
packages:
  - "packages/*"
```

根 `package.json` 关键脚本：

```jsonc
{
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "build": "pnpm -r build && pnpm --filter server build",
    "start": "pnpm --filter server start",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  }
}
```

---

## 4. 共享类型与数据契约（`packages/shared`）

`shared` 是唯一的类型与契约来源，`server` 与 `web` 均依赖它。一切以 Zod schema 定义，再用 `z.infer` 推导类型，避免手写类型与 schema 漂移。

### 4.1 配置 schema（`configSchema`）

```ts
// 约定：childIds 为字符串数组；"所有孩子"用特殊值 ["*"] 表示
export const childIdList = z.union([
  z.array(z.string().min(1)),
  z.tuple([z.literal("*")]),
]);

export const configSchema = z.object({
  children: z.array(z.object({
    id: z.string().regex(/^[a-z0-9_-]+$/),
    name: z.string().min(1),
    avatar: z.string().min(1),          // emoji 或图片 URL
    pin: z.string().regex(/^\d{4}$/),
    enabled: z.boolean().default(true),
  })),
  tasks: z.array(z.object({
    id: z.string().regex(/^[a-z0-9_-]+$/),
    name: z.string().min(1),
    category: z.string().min(1),        // learning/reading/household...
    taskMinutes: z.number().int().positive(),
    rewardMinutes: z.number().int().positive(),
    childIds: childIdList,
    dailyLimit: z.number().int().positive().default(1),
    enabled: z.boolean().default(true),
  })),
  redemptionOptions: z.array(z.number().int().positive()),
  encouragements: z.array(z.string().min(1)),
  session: z.object({
    lifetimeDays: z.number().int().positive().default(30),
  }).default({}),
  server: z.object({
    host: z.string().default("0.0.0.0"),
    port: z.number().int().default(3000),
    sessionSecret: z.string().min(16),
    timezone: z.string().optional(),    // 缺省取系统本地时区
  }).default({}),
});
```

**跨记录一致性校验**（schema 之外的语义校验，在加载后执行）：

- 孩子ID 唯一；启用孩子 ≥ 1。
- 任务引用的 `childIds`（非 `*` 时）必须存在于孩子集合。
- `redemptionOptions` 不能为空。
- `encouragements` 不能为空。
- `sessionSecret` 必须存在且长度 ≥ 16（缺失则启动失败并给出明确提示）。

### 4.2 交易记录 schema（`recordSchema`）

CSV 行 ↔ TS 对象，列顺序固定：

```ts
export const recordType = z.enum(["task_checkin", "entertainment_redeem"]);

export const recordSchema = z.object({
  id: z.string().min(1),                         // 服务端生成，全局唯一（child 内唯一即可）
  requestId: z.string().min(1).or(z.literal("")),// 客户端幂等键；家长修复行可空
  timestamp: z.string().datetime({ offset: true }), // ISO8601 带偏移
  childId: z.string().min(1),
  recordType: recordType,
  taskId: z.string().or(z.literal("")),
  taskName: z.string().or(z.literal("")),
  taskMinutes: z.number().int().nonnegative().or(z.literal("")).pipe(...), // 兑换行为空
  entertainmentMinutes: z.number().int(),        // checkin 正、redeem 负
  note: z.string().or(z.literal("")),
});
```

CSV 表头（固定，启动时缺失文件则写入）：

```text
id,request_id,timestamp,child_id,record_type,task_id,task_name,task_minutes,entertainment_minutes,note
```

### 4.3 API 契约（`apiContracts`）

```ts
// 公开：登录页所需的孩子头像列表（不含 PIN）
GET /api/config/login       → { children: [{ id, name, avatar }] }

POST /api/auth/login        ← { childId, pin }
                            → 200 { childId, name, avatar } | 401
POST /api/auth/logout       → 204
GET /api/session            → { childId, name, avatar } | 401

GET  /api/me/balance        → { balanceMinutes }
GET  /api/me/tasks          → { tasks: [{
                                  id, name, category, taskMinutes, rewardMinutes,
                                  todayCount, limit, remaining, canCheckin
                                }] }
GET  /api/me/redemption     → { options: [{ minutes, available }] }
POST /api/me/checkin        ← { taskId, requestId }
                            → { balanceMinutes, taskState, encouragement }
POST /api/me/redeem         ← { minutes, requestId }
                            → { balanceMinutes }
GET  /api/me/history?month=YYYY-MM&type=all|task_checkin|entertainment_redeem
                            → { records: [{ id, timestamp, recordType, taskName,
                                            taskMinutes, entertainmentMinutes,
                                            balanceAfter, note }] }
```

所有 `/api/me/*` 强制从签名 cookie推导 `childId`，请求体里即使带 `childId` 也被忽略；跨孩子访问在逻辑层天然不可能。

### 4.4 纯逻辑函数（`shared/logic`）

可被单元测试、前后端共用：

- `deriveBalance(records)` → `number`：累加 `entertainmentMinutes`。
- `countToday(records, taskId, childId, now, tz)` → `number`：按本地日历日期过滤后计数。
- `canCheckin(task, todayCount)` → `boolean`：`task.enabled && todayCount < task.dailyLimit && task applies to child`。
- `availableRedemption(balance, options)` → 每项 `available = balance >= minutes`，且 `balance >= 0` 才允许兑换。
- `localDateKey(isoTimestamp, tz)` → `YYYY-MM-DD`（本地日历键）。

---

## 5. 配置模块（`server/config`）

```text
loadConfig(path) → { config, diagnostics }
```

- 读取 `config/config.yaml`，用 `js-yaml` 解析，再 `configSchema.safeParse`。
- 失败时收集**可定位的诊断**：`file + field path + 原因`。例如
  `config.yaml > children[1].pin: 必须为 4 位数字`。
- 通过 schema 后执行 4.1 的语义校验。
- 任一错误 → 进程退出码 1，终端打印所有诊断后停止业务服务（不监听端口）。
- 校验通过后，配置在内存中冻结（`Object.freeze` 深冻结），运行期不可变。

PIN 安全：配置加载后 `pin` 字段只参与登录比对，**绝不**进入任何响应、日志、序列化路径。

---

## 6. 存储模块（`server/store`）

### 6.1 文件布局与启动备份

- 每童一文件：`data/records/<child-id>.csv`。
- 启动时若文件缺失，创建并写入表头。
- 启动时对每个 CSV 做时间戳备份：`backups/<child-id>-YYYYMMDD-HHmmss.csv`，保留最近 10 份，超出删除最旧。

### 6.2 加载与校验

`loadRecords(childId, file)`：

1. `csv-parse` 读取（`columns: true`，`skip_empty_lines: true`，`trim: true`）。
2. 逐行 `recordSchema.safeParse`；失败收集 `file + 行号 + 字段 + 原因`。
3. 语义校验（启动错误集）：
   - `child_id` 必须等于文件名对应的孩子 ID；
   - `record_type` 必须合法；
   - `id` 在文件内唯一；
   - 非空 `request_id` 在文件内唯一；
   - `task_checkin` 的 `entertainment_minutes > 0`；`entertainment_redeem` 的 `< 0`；
   - `timestamp` 必须为带偏移 ISO8601；
   - 引用的 `task_id`（若非空）允许不在当前配置中（流水为真相，历史任务可被移除），但会带上快照 `task_name`。
4. 任一错误 → 进程退出码 1，打印诊断后停止业务服务。
5. 通过后返回排序稳定的记录数组（按文件顺序；历史展示时再倒序）。

### 6.3 写入队列（每童一条）

```text
class ChildStore {
  private chain: Promise<unknown> = Promise.resolve();
  private records: Record[];          // 内存镜像，写后即更新
  append(record): Promise<{ records, balance }> {
    this.chain = this.chain.then(() => this.doAppend(record));
    return this.chain;
  }
}
```

- `doAppend`：序列化单行（`csv-stringify`，严格引号），`fs.appendFile` 落盘并 `fsync`，成功后才更新内存 `records`。
- 不同孩子用不同 `ChildStore` 实例，互不阻塞；同一孩子的并发写按链式顺序串行，不丢不重。
- 幂等：append 前在内存 `records` 中查 `requestId`（非空时）。命中则直接返回当前余额，不重复写入。

### 6.4 余额推导

`balance = deriveBalance(records)`，每次读/写后实时计算，不单独存储。负余额（家长修复导致）允许加载与展示，但兑换被业务层拦截。

---

## 7. 认证与会话（`server/auth`）

### 7.1 登录

- `POST /api/auth/login` 接收 `{ childId, pin }`。
- 服务端比对配置中的 `pin`（常数时间比较，避免计时侧信道）。
- 仅允许 `enabled === true` 的孩子登录。
- 失败：返回 401，前端抖动并清空键盘。不暴露是「孩子不存在」还是「PIN 错」。
- 限流：`express-rate-limit` 两套窗口——按 IP（如 10 次/分钟）与按账号（如 5 次五分钟），触发后短时拒绝，**不长期锁定**。

### 7.2 会话cookie

- 成功登录后设置 `HttpOnly`、`SameSite=Lax`、`Path=/` 的签名 cookie `tb_sess`。
- Cookie 内容（明文 payload + HMAC 签名，base64url 编码）：
  `{ childId, exp }`，`exp` = `now + lifetimeDays`。**不含 PIN**。
- 签名密钥 = `config.server.sessionSecret`，跨重启稳定。
- 每个受保护请求：验签 → 检查 `exp` → 通过则**滑动续期**（重写 `exp` 并回写 cookie）。
- 登出：清 cookie，并在内存会话黑名单中标记该 `childId+exp` 失效（进程级，重启后 cookie 因签名虽仍有效，但 exp 滑动逻辑不变；为简单起见，登出即时失效靠「服务端内存吊销集合 + 短期内自然过期」实现）。

> 决策：会话吊销用进程内 `Set` 记录已登出的签名摘要，重启后丢失——可接受，因家庭场景重启频率低且 cookie 本身有有限期。若需重启后仍吊销，可落盘一个吊销文件（后续增强）。

### 7.3 鉴权中间件

`requireSession`：从 cookie 推导 `childId`，挂到 `req.session = { childId }`。后续业务一律以 `req.session.childId` 为准，忽略客户端任何身份字段。

---

## 8. 业务逻辑（`server/routes` + `server/service`）

### 8.1 任务打卡 `POST /api/me/checkin`

1. 取 `req.session.childId`、`{ taskId, requestId }`。
2. 查任务：存在、`enabled`、对当前孩子适用（`childIds` 含该 id 或为 `["*"]`）。
3. 计算今日已打卡数 `todayCount = countToday(records, taskId, childId, now, tz)`。
4. `todayCount >= dailyLimit` → 409 `{ code: "limit_reached" }`。
5. 幂等：`requestId` 已存在 → 返回当前余额与任务态，不写。
6. 生成 `id`（`crypto.randomUUID`）、`timestamp`（`new Date().toISOString()`，服务端时区）。
7. 构造 `task_checkin` 行：`entertainment_minutes = task.rewardMinutes`，并快照 `task_name`、`task_minutes`。
8. `store.append(row)`，成功后返回：
   `{ balanceMinutes, taskState: { todayCount, remaining }, encouragement: random(encouragements) }`。
9. 前端收到后撒花 + 显示鼓励语。

### 8.2 兑换 `POST /api/me/redeem`

1. 取 `childId`、`{ minutes, requestId }`。
2. `minutes` 必须在 `redemptionOptions` 中。
3. 当前 `balance = deriveBalance(records)`。
4. `balance < 0` 或 `balance < minutes` → 409 `{ code: "insufficient" }`。
5. 幂等同上。
6. 构造 `entertainment_redeem` 行：`entertainment_minutes = -minutes`，`task_*` 为空。
7. `store.append(row)`，返回 `{ balanceMinutes }`。

### 8.3 读取接口

- `GET /api/me/balance`：`deriveBalance(records)`。
- `GET /api/me/tasks`：遍历启用且适用的任务，附 `todayCount/remaining/canCheckin`。
- `GET /api/me/redemption`：每项附 `available`。
- `GET /api/me/history`：`month` 与 `type` 过滤后倒序，并计算每行 `balanceAfter`（按正序累加到该行的累计余额）。

### 8.4 日期与每日上限

- 服务器时区权威：`process.env.TZ = config.server.timezone || 系统缺省`。
- `localDateKey` 用 `Intl.DateTimeFormat('en-CA', { timeZone })` 取 `YYYY-MM-DD`（`en-CA` 天然输出 ISO 日期，避免月份名问题）。
- 每日上限仅按本地日历日期聚合，与 iPad 时钟无关。

---

## 9. API 层与错误约定

- 统一 JSON 响应：成功 `{ data }` 或直接业务体；失败 `{ error: { code, message } }`。
- 面向孩子的 `message` 友好化（如「网络开小差了，再试一次吧」），技术细节仅进终端日志。
- 状态码：200 成功；204 登出；400 请求体非法；401 未登录/PIN 错；403 不适用；409 业务冲突（上限/余额不足/重复幂等命中按语义区分）；500 未预期。
- 所有写接口要求 `requestId`（前端用 `crypto.randomUUID()` 生成），服务端做幂等。
- 请求进行中：前端禁用按钮，避免重复提交。

---

## 10. 前端架构（`packages/web`）

### 10.1 目录

```text
packages/web/
├─ index.html
├─ vite.config.ts            # dev 代理 /api 到 server；build 输出到 server 静态目录
├─ public/
│  ├─ manifest.webmanifest
│  ├─ icons/                 # 192/512 + apple-touch-icon
│  └─ favicon.ico
└─ src/
   ├─ main.tsx
   ├─ App.tsx                # 路由 + QueryClientProvider
   ├─ api/                   # fetch 封装 + 各端点 hook
   ├─ pages/
   │  ├─ LoginPage.tsx
   │  ├─ HomePage.tsx
   │  └─ HistoryPage.tsx
   ├─ components/
   │  ├─ AvatarGrid.tsx
   │  ├─ PinPad.tsx
   │  ├─ BalanceCard.tsx
   │  ├─ TaskCard.tsx
   │  ├─ TaskConfirmSheet.tsx
   │  ├─ RedemptionPanel.tsx
   │  ├─ HistoryList.tsx
   │  └─ Confetti.tsx
   ├─ theme/                 # Tailwind 配置 + CSS 变量（温暖调色板）
   └─ hooks/                 # useSession, useMutationLock 等
```

### 10.2 路由与守卫

- `/login`、`/`、`/history`。
- 启动时 `GET /api/session`：未登录跳 `/login`；已登录访问 `/login` 跳 `/`。
- React Query 负责余额/任务/历史的获取与失效：打卡/兑换成功后 `invalidate(['balance'])`、`(['tasks'])`。

### 10.3 交互细节

- 登录：头像卡为大触控目标；选中后展开 4×3 大键盘，输入 4 位自动提交。
- 错误：键盘区抖动动画（`animate-shake`），清空已输入。
- 主页：顶部头像+名字+登出；大号余额卡；任务按 `category` 分组；每卡显示「今日 x/limit」。
- 打卡：点任务 → 底部确认 sheet（名称、时长、奖励）→ 确认按钮在请求中禁用 → 成功撒花 + 鼓励语。
- 兑换：固定选项按钮，余额不足者置灰禁用；确认后显示新余额。
- 历史：倒序；打卡为暖色「+N 分钟」、兑换为冷色「-N 分钟」；每条显示时间、任务名、变动、后余额；月份与类型筛选。

---

## 11. 视觉与交互实现（「温暖卡片游乐场」）

Tailwind 主题（CSS 变量驱动，便于主题统一）：

```css
:root {
  --bg:        #FFF6EC;   /* 暖米白 */
  --surface:   #FFFFFF;
  --primary:   #FF8A5B;   /* 暖橙 */
  --ink:       #3A2E27;
  --muted:     #8A7A6E;
  --learn:     #6FB1FC;   /* 学习 蓝 */
  --read:      #7BD88F;   /* 阅读 绿 */
  --chore:     #F2C14E;   /* 家务 黄 */
  --danger:    #E5686B;
  --radius-lg: 28px;
}
```

- 大圆角卡片（`rounded-[28px]`），柔和投影。
- 触控目标最小 56px，键盘键 72px+。
- 字体：系统无衬线 + 数字加大加粗。
- 动效克制：卡片轻浮入、按钮按压回弹；成功撒花 1.2s 后收起。
- 强对比、清晰层级，无等级/徽章元素（遵守设计原则）。

---

## 12. iPad 适配与 PWA

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`。
- `<meta name="apple-mobile-web-app-capable" content="yes">`、`apple-mobile-web-app-status-bar-style`、`apple-mobile-web-app-title`。
- `manifest.webmanifest`：`display: standalone`、`theme_color`、`icons`（192/512/maskable）、`apple-touch-icon`。
- 布局：竖屏单列、横屏双列（左侧余额+任务，右侧兑换+历史入口），用 Tailwind 响应式断点。
- 仅在线：断网时提示「操作未确认，请重试」，不排队、不缓存写操作。

---

## 13. 生产构建与服务托管

- `pnpm build`：
  1. `web` 用 Vite 构建到 `packages/server/public/`（或根 `dist/public`）。
  2. `server` 用 esbuild/tsc 编译到 `packages/server/dist/`。
- 生产 `server` 进程：
  - 静态托管 `public/`（含 `index.html`、`manifest`、`icons`）。
  - 挂载 `/api/*`。
  - SPA fallback：非 `/api` 且非静态文件 → 返回 `index.html`。
- 启动顺序：加载配置 → 校验 → 备份 CSV → 加载并校验所有流水 → 注册路由 → 监听端口 → 打印访问 URL 与文件路径。

---

## 14. 可靠性与错误处理（对应设计第 10 节）

- 所有授权与业务校验在服务端，前端仅做体验性禁用。
- 每童写队列串行化、写前全序列化、`fsync` 后才返回成功。
- 幂等 `requestId`：双击/重试不产生重复行。
- 请求中按钮禁用，避免并发重复。
- 启动备份每童保留 10 份。
- 非法 YAML/CSV：收集全部诊断后退出，**先报告再停服**，给出 `文件 + 行号/字段 + 原因`。
- 负余额：加载并展示，兑换被拦截。
- 网络失败：前端提示未确认，鼓励重试。
- 未预期错误：面向孩子友好文案 + 终端完整堆栈。

---

## 15. 测试策略

### 15.1 单元测试（Vitest，`shared` + `server` 纯逻辑）

- 配置 schema 校验：合法/非法 YAML 各路径诊断。
- CSV schema 校验：重复 id、重复 requestId、错配 childId、非法 recordType、负/正方向错误。
- `deriveBalance`：空、正负混合、负余额。
- `countToday` / `canCheckin`：跨本地日历零点边界。
- `availableRedemption`：余额不足置灰、负余额全禁。
- `localDateKey`：时区切换下的日期键。
- 幂等命中返回旧余额且不写入。

### 15.2 服务集成测试（Vitest + supertest + 临时目录）

- 登录成功/失败、滑动续期、过期失效、登出即时失效。
- 跨孩子访问被拒（带 A 的 cookie 请求 B 的数据 → 403/401）。
- 打卡与兑换的文件追加与余额变化。
- 同孩子并发请求有序且不丢；不同孩子文件互不影响。
- 非法 YAML/CSV 的启动行为。
- 负余额可加载但不可兑换。
- 限流触发与恢复。

### 15.3 前端测试（Vitest + Testing Library）

- 头像 + PIN 登录流程、错误抖动。
- 余额与任务态渲染。
- 打卡确认、加载锁、撒花、错误反馈。
- 兑换选项启用/禁用与确认。
- 历史筛选。

### 15.4 E2E 冒烟（Playwright）

登录 → 打卡 → 余额增加 → 兑换 → 历史展示 → 登出 → 访问他人数据被拒。

---

## 16. 部署与运维

### 16.1 一次性安装

```bash
git clone <repo> TimeBank && cd TimeBank
# 安装 Node 22 LTS（如未装）
pnpm install
pnpm build
```

### 16.2 启动脚本

- `scripts/start-macos.command`（双击即可运行）：
  ```bash
  cd "$(dirname "$0")/.."
  pnpm start
  ```
- `scripts/start-windows.bat`：
  ```bat
  cd /d %~dp0\..
  pnpm start
  ```
- 启动后终端打印：
  ```
  TimeBank 已启动
  本机访问: http://localhost:3000
  局域网访问: http://192.168.x.x:3000
  配置文件: /.../config/config.yaml
  数据目录: /.../data/records
  ```

### 16.3 家长维护流程

1. 停止服务（终端 Ctrl+C 或关窗）。
2. 编辑 `config/config.yaml` 或 `data/records/<id>.csv`（CSV 用任意表格编辑器，注意引号转义）。
3. 重启服务，余额由编辑后的流水重新推导。
4. 需要回滚时：从 `backups/` 拷贝对应备份覆盖 `data/records/<id>.csv` 后重启。

### 16.4 iPad 主屏图标

Safari 打开局域网地址 → 分享 → 添加到主屏幕。`manifest` 与 `apple-touch-icon` 已就绪，启动后无浏览器地址栏（standalone）。

### 16.5 防火墙

macOS/Windows 首次启动会询问是否允许 Node 接入网络，选择「允许」；确保 iPad 与电脑同处一局域网。

---

## 17. 开发里程碑

按可独立验收的顺序推进，每阶段结束可演示。

| 阶段 | 范围 | 验收 |
| --- | --- | --- |
| M0 脚手架 | pnpm workspace、三包、tsconfig、lint、Vitest 跑通 | `pnpm test` 空套件通过 |
| M1 共享层 | Zod schema、纯逻辑、时间工具 + 单测 | 单测全绿 |
| M2 配置与存储 | 加载/校验/诊断、CSV 读写队列、启动备份 + 集成测试 | 非法文件给出可定位诊断 |
| M3 认证 | 登录、签名 cookie、滑动续期、登出、限流、跨孩子拒绝 | 集成测试全绿 |
| M4 业务 API | 打卡、兑换、余额、任务、历史 + 幂等与并发测试 | 冒烟接口可用 |
| M5 前端 | 登录页、主页、历史页、温暖主题、撒花 | iPad 竖/横屏可用 |
| M6 PWA 与启动 | manifest、图标、双击脚本、README、防火墙说明 | 可从主屏图标启动 |
| M7 E2E 与打磨 | Playwright 冒烟、错误文案、触控细节 | 验收清单全通过 |

---

## 18. 验收清单映射（对应设计第 14 节）

1. 头像+PIN 登录 → M3/M5。
2. 仅看自己数据 → M3 跨孩子拒绝 + M5 单视图。
3. 打卡即追加 CSV 并按配置奖励 → M4。
4. 服务端强制每日上限 → M4 `countToday`。
5. 仅可兑换不超过余额的固定额度 → M4。
6. 重启后按编辑后流水重算余额 → M2（余额始终推导）。
7. 非法文件给出文件/行/字段诊断 → M2。
8. 并发不丢不重 → M2 写队列 + M4 幂等。
9. iPad 竖/横屏 + 主屏图标 → M5/M6。
10. macOS/Windows 无 Docker/无云可跑 → M6。

---

## 19. 关键决策记录

- **无数据库**：CSV 即真相，家长可直接修复，符合设计原则。
- **pnpm + 三包**：类型与纯逻辑集中到 `shared`，前后端共享，避免漂移。
- **Zod 即契约**：schema 驱动类型与运行时校验，配置/CSV/API 一致。
- **每童写队列**：同童串行、跨童并行，简单且满足并发要求。
- **会话签名 cookie + 进程吊销集合**：无 PIN、跨重启稳定，登出即时生效（进程级）。
- **服务器时区权威**：每日上限与时间戳不受 iPad 影响。
- **不排队离线写**：断网即提示重试，避免一致性陷阱。

---

*本方案为 TimeBank v1 的工程蓝图，可在确认后按里程碑顺序进入实现。*
