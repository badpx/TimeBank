# TimeBank

家庭自托管的「时间银行」小应用——孩子完成任务换取娱乐时间。

> 设计文档见 [`timebank-design.md`](./timebank-design.md)，实现方案见 [`timebank-implementation-plan.md`](./timebank-implementation-plan.md)。

## 功能

- 两个孩子各自头像 + 4 位 PIN 登录，互不可见对方数据
- 任务打卡立即获得配置的娱乐时间
- 按固定额度兑换娱乐时间（从余额扣减）
- 余额、任务今日次数、交易历史（按月份/类型筛选）
- iPad 触控友好、温暖卡片风格、可加入主屏图标
- 单进程局域网运行，无云端、无 Docker

## 快速开始

### 1. 安装环境

- [Node.js 22 LTS](https://nodejs.org/)
- [pnpm](https://pnpm.io/)：`npm i -g pnpm`

### 2. 安装依赖并构建

```bash
pnpm install
pnpm build
```

### 3. 配置

编辑 [`config/config.yaml`](./config/config.yaml)：

- `children`：孩子的 ID、名字、头像、4 位 PIN
- `tasks`：任务（分类、时长、奖励、适用孩子、每日上限）
- `redemptionOptions`：可兑换的固定时长
- `encouragements`：打卡后的鼓励语
- `server.sessionSecret`：**请改为 >= 16 位的随机串**
- `server.timezone`：时区，如 `Asia/Shanghai`

> 配置修改后需重启服务生效。

### 4. 启动

- **双击** `scripts/start-macos.command`（macOS）或 `scripts/start-windows.bat`（Windows）
- 或命令行：`pnpm start`

启动后终端会打印本机与局域网访问地址，例如：

```
TimeBank 已启动
本机访问:   http://localhost:3000
局域网访问: http://192.168.1.10:3000
配置文件:   /.../config/config.yaml
数据目录:   /.../data/records
备份目录:   /.../backups
```

### 5. iPad 使用

1. 确保电脑与 iPad 在同一家庭 Wi-Fi
2. 首次启动时，macOS/Windows 会询问是否允许 Node 接入网络，选择「允许」
3. 在 iPad Safari 打开上面的「局域网访问」地址
4. Safari → 分享 → 添加到主屏幕
5. 之后从主屏图标启动，无浏览器地址栏

## 家长维护

- **修改配置或数据前必须先停止服务**（终端 Ctrl+C 或关窗）
- 交易流水在 `data/records/<孩子ID>.csv`，可用任意表格编辑器打开（注意含逗号的字段会被引号包裹）
- 余额始终由流水重新计算，编辑后重启即可生效
- 启动备份在 `backups/`，每个孩子保留最近 10 份；回滚时把对应备份覆盖到 `data/records/<孩子ID>.csv` 再重启
- 若修复后出现负余额，应用会照常显示但禁止兑换

## 开发

```bash
pnpm dev          # 同时启动 web(vite:5173) 与 server(tsx watch:3000)，web 代理 /api 到 server
pnpm test         # 运行全部单元/集成测试
pnpm typecheck    # 类型检查
pnpm --filter @timebank/web build   # 构建前端到 server/public
```

### 仓库结构

```
packages/
  shared/   # Zod schema + 纯逻辑 + API 契约（前后端共享）
  server/   # Express + 配置/存储/认证/业务
  web/      # React + Vite
config/     # YAML 配置
data/records/  # 每童一个 CSV
backups/    # 启动备份
scripts/    # 双击启动脚本
```

## 数据说明

- CSV 表头固定：`id,request_id,timestamp,child_id,record_type,task_id,task_name,task_minutes,entertainment_minutes,note`
- `record_type`：`task_checkin`（正数奖励）/ `entertainment_redeem`（负数扣减）
- `request_id` 是客户端幂等键，重复请求不会产生重复记录
- 任务记录会快照当时的 `task_name` 与 `task_minutes`，后续改配置不影响历史

## 安全

- PIN 仅存于本地 YAML，不会出现在 API 响应、浏览器存储或日志中
- 会话为签名 HttpOnly cookie，不含 PIN
- 登录有按 IP 的简单限流，不会长期锁定账户
- 应用不接入互联网，仅家庭局域网可用
